import {templateDefinition, validateRecords, saveRecord, changeStatus, removeRecord, summarizeRecords} from './project-domain.mjs';
import {MAX_BACKUP_BYTES, serializeBackup, parseBackup, planRecovery} from './project-backup.mjs';

// Detect a stale workspace before overwriting changes from another tab. This is
// a best-effort check; localStorage does not provide an atomic compare-and-set.
export function guardLocalStorage(storage, key) {
  let observed = storage.getItem(key);
  return Object.freeze({
    read: () => observed,
    write(value) {
      if (storage.getItem(key) !== observed) return false;
      storage.setItem(key, value);
      observed = value;
      return true;
    }
  });
}

// Only built-in, reviewed application logic is mounted. No model output is executed.
export function mountApplication(root, config, {persist = true} = {}) {
  const doc = root.ownerDocument;
  root.style.setProperty('--accent', config.accent);
  const definition = templateDefinition(config.template);
  const key = 'constructor-app-v1:' + config.template + ':' + config.name;
  let records = [], editing = null, storageAvailable = persist, storageGuard;
  let recovery = null, recoveryRequest = 0;
  root.replaceChildren();
  const element = (tag, text, parent = root) => {const el = doc.createElement(tag); if (text !== undefined) el.textContent = text; parent.append(el); return el;};
  const header = element('header'); header.className = 'app-heading';
  element('p', definition.label.toUpperCase(), header).className = 'eyebrow';
  element('h1', config.name, header);
  element('p', 'Your work, in one clear view.', header).className = 'muted';
  const stats = element('section'); stats.className = 'stats'; stats.setAttribute('aria-label', 'Summary');
  const message = element('p'); message.setAttribute('role', 'status'); message.className = 'message';
  const storageWarning = element('p'); storageWarning.setAttribute('role', 'alert'); storageWarning.className = 'storage-warning'; storageWarning.hidden = true;
  function warnStorage(text) {storageWarning.textContent = text; storageWarning.hidden = false;}
  if (persist) {
    try {storageGuard = guardLocalStorage(doc.defaultView.localStorage, key); const raw = storageGuard.read(); if (raw) records = validateRecords(JSON.parse(raw), config.template);}
    catch {storageAvailable = false; warnStorage('Stored data could not be loaded and has not been replaced. Changes exist only in this session; export its data before closing.');}
  } else message.textContent = 'Interactive preview · temporary sample workspace. Exported apps save data in your browser.';
  const form = element('form'); form.className = 'record-form';
  const field = (label, type, max) => {const wrapper = element('label', label, form); const input = element('input', undefined, wrapper); input.type = type; if (max) input.maxLength = max; return input;};
  const title = field(definition.item, 'text', 100); title.required = true;
  const detail = field(definition.detail, 'text', 240);
  const value = definition.value ? field(definition.value, 'number') : null;
  if (value) {value.min = '0'; value.max = '1000000000'; value.step = config.template === 'crm' ? '0.01' : 'any'; value.value = '0';}
  const submit = element('button', 'Add ' + definition.item.toLowerCase(), form); submit.type = 'submit'; submit.className = 'primary';
  const cancel = element('button', 'Cancel edit', form); cancel.type = 'button'; cancel.hidden = true;
  const toolbar = element('div'); toolbar.className = 'toolbar';
  const searchLabel = element('label', 'Search', toolbar); const search = element('input', undefined, searchLabel); search.type = 'search'; search.placeholder = 'Filter your workspace';
  const backup = element('button', 'Export data', toolbar); backup.type = 'button';
  const restoreLabel = element('label', 'Restore JSON backup', toolbar);
  const restoreInput = element('input', undefined, restoreLabel); restoreInput.type = 'file'; restoreInput.accept = '.json,application/json';
  const recoveryPanel = element('section'); recoveryPanel.hidden = true; recoveryPanel.className = 'recovery-panel';
  recoveryPanel.setAttribute('aria-label', 'Backup review');
  const recoveryHeading = element('h2', 'Review backup', recoveryPanel); recoveryHeading.tabIndex = -1;
  const recoverySummary = element('p', undefined, recoveryPanel);
  const recoveryDetails = element('details', undefined, recoveryPanel);
  element('summary', 'View affected records', recoveryDetails);
  const recoveryList = element('ul', undefined, recoveryDetails);
  const recoveryActions = element('div', undefined, recoveryPanel); recoveryActions.className = 'record-actions';
  const mergeBackup = element('button', 'Add new records', recoveryActions); mergeBackup.type = 'button';
  const replaceBackup = element('button', 'Replace workspace', recoveryActions); replaceBackup.type = 'button';
  const cancelRecovery = element('button', 'Cancel restore', recoveryActions); cancelRecovery.type = 'button';
  const list = element('ul'); list.className = 'record-list'; list.setAttribute('aria-label', 'Records');
  element('p', 'Local browser storage only. No cloud account, team access or automatic backup.', root).className = 'storage-note';
  function resetForm() {editing = null; form.reset(); if (value) value.value = '0'; submit.textContent = 'Add ' + definition.item.toLowerCase(); cancel.hidden = true;}
  function persistAndRender() {
    if (storageAvailable) {
      try {
        if (!storageGuard.write(JSON.stringify(records))) {
          storageAvailable = false;
          warnStorage('Browser storage changed in another tab. Changes exist only in this session; export its data before reloading.');
        }
      } catch {storageAvailable = false; warnStorage('Browser storage is unavailable. Changes exist only in this session; export its data before closing.');}
    }
    render();
  }
  function render() {
    stats.replaceChildren();
    for (const [label, total] of summarizeRecords(records, config.template)) {const box = element('div', undefined, stats); element('span', label, box); element('strong', new Intl.NumberFormat('en-US', {maximumFractionDigits: 2}).format(total), box);}
    list.replaceChildren();
    const query = search.value.trim().toLowerCase();
    const visible = records.filter(r => (r.title + ' ' + r.detail + ' ' + r.status).toLowerCase().includes(query));
    if (!visible.length) element('li', records.length ? 'No matching records.' : 'A clear workspace. Add your first ' + definition.item.toLowerCase() + '.', list).className = 'empty';
    for (const record of visible) {
      const row = element('li', undefined, list); const body = element('div', undefined, row); element('h2', record.title, body); element('p', record.detail, body);
      if (definition.value) element('strong', new Intl.NumberFormat('en-US', {maximumFractionDigits: 2}).format(record.value) + (config.template === 'crm' ? ' USD' : ''), body);
      const actions = element('div', undefined, row); actions.className = 'record-actions';
      const status = element('button', record.status, actions); status.type = 'button'; status.setAttribute('aria-label', 'Change status: ' + record.title); status.addEventListener('click', () => {records = changeStatus(records, record.id, config.template); persistAndRender();});
      const edit = element('button', 'Edit', actions); edit.type = 'button'; edit.setAttribute('aria-label', 'Edit: ' + record.title); edit.addEventListener('click', () => {editing = record.id; title.value = record.title; detail.value = record.detail; if (value) value.value = String(record.value); submit.textContent = 'Save changes'; cancel.hidden = false; title.focus();});
      const del = element('button', 'Delete', actions); del.type = 'button'; del.setAttribute('aria-label', 'Delete: ' + record.title); del.addEventListener('click', () => {records = removeRecord(records, record.id, config.template); if (editing === record.id) resetForm(); persistAndRender();});
    }
  }
  form.addEventListener('submit', event => {
    event.preventDefault();
    try {
      const previous = records.find(r => r.id === editing);
      const wasEditing = editing !== null;
      records = saveRecord(records, {id: editing ?? doc.defaultView.crypto.randomUUID(), title: title.value.trim(), detail: detail.value.trim(), value: value ? Number(value.value) : 0, status: previous?.status ?? definition.statuses[0]}, config.template);
      resetForm(); persistAndRender();
      message.textContent = (wasEditing ? 'Changes updated' : definition.item + ' added') + (storageAvailable ? ' in browser storage.' : ' for this session.');
    } catch (error) {message.textContent = error.message;}
  });
  cancel.addEventListener('click', resetForm); search.addEventListener('input', render);
  function closeRecovery() {
    recovery = null;
    recoveryPanel.hidden = true;
    recoveryList.replaceChildren();
    recoveryDetails.open = false;
  }
  function showRecovery(original, next) {
    const plan = planRecovery(original, next, config.template);
    recovery = {original, next, plan};
    const counts = [plan.added.length + ' new', plan.conflicts.length + ' conflicting',
      plan.unchanged + ' unchanged', plan.removed.length + ' only in this workspace'];
    recoverySummary.textContent = counts.join(', ') + '. Adding new records keeps existing ones.'
      + (plan.merged === null ? ' The combined workspace would exceed the record limit.' : '');
    for (const record of plan.added) element('li', 'New: ' + record.title + ' (' + record.id + ')', recoveryList);
    for (const {existing, incoming} of plan.conflicts) {
      const conflict = element('li', 'Conflict: ' + existing.title + ' (' + existing.id + ')', recoveryList);
      const fields = element('ul', undefined, conflict);
      for (const [field, label] of [['title', definition.item], ['detail', definition.detail], ['status', 'Status'], ['value', definition.value ?? 'Value']]) {
        if (existing[field] === incoming[field]) continue;
        const before = existing[field] === '' ? 'empty' : existing[field];
        const after = incoming[field] === '' ? 'empty' : incoming[field];
        element('li', label + ': ' + before + ' → ' + after, fields);
      }
    }
    for (const record of plan.removed) element('li', 'Removed only on replacement: ' + record.title + ' (' + record.id + ')', recoveryList);
    recoveryDetails.hidden = !recoveryList.childElementCount;
    mergeBackup.disabled = plan.merged === null || !plan.added.length;
    recoveryPanel.hidden = false;
    recoveryHeading.focus();
  }
  function applyRecovery(replace) {
    if (!recovery) return;
    const {original, next, plan} = recovery;
    if (records !== original) {
      closeRecovery();
      restoreInput.focus();
      message.textContent = 'Workspace changed after review. Select the backup again.';
      return;
    }
    const result = replace ? next : plan.merged;
    if (!result || (!replace && !plan.added.length)) return;
    if (replace && !doc.defaultView.confirm(
      'Replace all ' + original.length + ' current records with ' + next.length + ' from this backup? This cannot be undone.'
    )) {
      closeRecovery();
      restoreInput.focus();
      message.textContent = 'Restore cancelled; existing records are unchanged.';
      return;
    }
    try {
      if (storageAvailable && !storageGuard.write(JSON.stringify(result))) {
        closeRecovery();
        restoreInput.focus();
        message.textContent = 'Browser storage changed in another tab. Reload and review the backup again.';
        return;
      }
    } catch {
      message.textContent = 'Browser storage could not save the restore. Existing records are unchanged.';
      return;
    }
    records = result;
    closeRecovery();
    if (replace) resetForm();
    render();
    restoreInput.focus();
    const affected = replace ? records.length : plan.added.length;
    const noun = affected === 1 ? 'record' : 'records';
    message.textContent = (replace ? 'Restored ' + affected + ' ' + noun + ' from a validated local backup'
      : 'Added ' + affected + ' new ' + noun + ' and kept existing records') + (storageAvailable ? '.' : ' for this session only.');
  }
  mergeBackup.addEventListener('click', () => applyRecovery(false));
  replaceBackup.addEventListener('click', () => applyRecovery(true));
  cancelRecovery.addEventListener('click', () => {
    closeRecovery();
    restoreInput.focus();
    message.textContent = 'Restore cancelled; existing records are unchanged.';
  });
  restoreInput.addEventListener('change', async () => {
    const file = restoreInput.files?.[0];
    if (!file) return;
    const original = records;
    const request = ++recoveryRequest;
    closeRecovery();
    try {
      if (file.size > MAX_BACKUP_BYTES) throw new RangeError('Backup exceeds 1 MiB');
      const next = parseBackup(await file.text(), config.template);
      if (request !== recoveryRequest) return;
      if (original !== records) {
        message.textContent = 'Workspace changed while reading the backup. Select it again.';
        return;
      }
      showRecovery(original, next);
      message.textContent = 'Backup ready to review.';
    } catch (error) {
      if (request === recoveryRequest) message.textContent = 'Restore rejected: ' + error.message;
    } finally {
      if (request === recoveryRequest) restoreInput.value = '';
    }
  });
  backup.addEventListener('click', () => {
    const blob = new Blob([serializeBackup(records, config.template)], {type: 'application/json'});
    const url = URL.createObjectURL(blob); const a = element('a', undefined); a.href = url; a.download = 'workspace-data.json'; a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  render();
}
