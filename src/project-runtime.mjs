import {templateDefinition, validateRecords, saveRecord, changeStatus, removeRecord, summarizeRecords} from './project-domain.mjs';

// Only built-in, reviewed application logic is mounted. No model output is executed.
export function mountApplication(root, config, {persist = true} = {}) {
  const doc = root.ownerDocument;
  root.style.setProperty('--accent', config.accent);
  const definition = templateDefinition(config.template);
  const key = 'constructor-app-v1:' + config.template + ':' + config.name;
  let records = [], editing = null, storageAvailable = persist;
  root.replaceChildren();
  const element = (tag, text, parent = root) => {const el = doc.createElement(tag); if (text !== undefined) el.textContent = text; parent.append(el); return el;};
  const header = element('header'); header.className = 'app-heading';
  element('p', definition.label.toUpperCase(), header).className = 'eyebrow';
  element('h1', config.name, header);
  element('p', 'Your work, in one clear view.', header).className = 'muted';
  const stats = element('section'); stats.className = 'stats'; stats.setAttribute('aria-label', 'Summary');
  const message = element('p'); message.setAttribute('role', 'status'); message.className = 'message';
  if (persist) {
    try {const raw = doc.defaultView.localStorage.getItem(key); if (raw) records = validateRecords(JSON.parse(raw), config.template);}
    catch {storageAvailable = false; message.textContent = 'Stored data could not be loaded. This session uses temporary memory; export a backup before leaving.';}
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
  const list = element('ul'); list.className = 'record-list'; list.setAttribute('aria-label', 'Records');
  element('p', 'Local browser storage only. No cloud account, team access or automatic backup.', root).className = 'storage-note';
  function resetForm() {editing = null; form.reset(); if (value) value.value = '0'; submit.textContent = 'Add ' + definition.item.toLowerCase(); cancel.hidden = true;}
  function persistAndRender() {
    if (storageAvailable) {try {doc.defaultView.localStorage.setItem(key, JSON.stringify(records));} catch {storageAvailable = false; message.textContent = 'Browser storage is unavailable. Export your data before leaving.';}}
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
      records = saveRecord(records, {id: editing ?? doc.defaultView.crypto.randomUUID(), title: title.value.trim(), detail: detail.value.trim(), value: value ? Number(value.value) : 0, status: previous?.status ?? definition.statuses[0]}, config.template);
      message.textContent = editing ? 'Changes saved.' : definition.item + ' added.'; resetForm(); persistAndRender();
    } catch (error) {message.textContent = error.message;}
  });
  cancel.addEventListener('click', resetForm); search.addEventListener('input', render);
  backup.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify({schema: 'constructor-records-v1', template: config.template, records}, null, 2)], {type: 'application/json'});
    const url = URL.createObjectURL(blob); const a = element('a', undefined); a.href = url; a.download = 'workspace-data.json'; a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  render();
}
