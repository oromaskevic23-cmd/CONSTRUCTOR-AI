// Shared, dependency-free domain for the three built-in application templates.
export const TEMPLATE_IDS = Object.freeze(['tasks', 'crm', 'dashboard']);
export function normalizeProject(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('Project settings are required');
  if (Object.keys(input).some(k => !['template', 'name', 'accent'].includes(k))) throw new TypeError('Unknown project setting');
  if (!TEMPLATE_IDS.includes(input.template)) throw new RangeError('Choose a supported template');
  if (typeof input.name !== 'string') throw new TypeError('Project name is required');
  const name = input.name.trim().replace(/\s+/g, ' ');
  if (!name || name.length > 70 || /[\u0000-\u001f\u007f]/.test(name)) throw new RangeError('Use a project name of 1–70 printable characters');
  const accent = input.accent ?? '#66e3c4';
  if (typeof accent !== 'string' || !/^#[0-9a-f]{6}$/i.test(accent)) throw new RangeError('Accent must be a six-digit hex color');
  return Object.freeze({template: input.template, name, accent: accent.toLowerCase()});
}

// Choose readable text and focus colors for any user-selected six-digit accent.
// This does not replace browser accessibility or screen-reader testing.
export function accentPalette(accent) {
  if (typeof accent !== 'string' || !/^#[0-9a-f]{6}$/i.test(accent)) throw new RangeError('Accent must be a six-digit hex color');
  const normalized=accent.toLowerCase();
  const luminance=hex=>{
    const channels=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255)
      .map(v=>v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4);
    return 0.2126*channels[0]+0.7152*channels[1]+0.0722*channels[2];
  };
  const ratio=(a,b)=>{const x=luminance(a),y=luminance(b);return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05);};
  const fallback='#66e3c4';
  return Object.freeze({
    onAccent:ratio(normalized,'#000000')>=ratio(normalized,'#ffffff')?'#000000':'#ffffff',
    textAccent:ratio(normalized,'#10151e')>=4.5?normalized:fallback,
    focusAccent:Math.min(ratio(normalized,'#10151e'),ratio(normalized,'#1a2332'))>=3?normalized:fallback
  });
}

// Coordinate cooperating tabs before comparing and replacing localStorage.
// The Web Locks API is required: a read followed by a write without a lock is
// not an atomic compare-and-swap. Other same-origin code that ignores this
// protocol can still modify storage; this is not a security boundary.
export function createGuardedStorageWriter({storage, locks, key, initialRaw}) {
  if (typeof key !== 'string' || !key || (initialRaw !== null && typeof initialRaw !== 'string'))
    throw new TypeError('Invalid storage writer configuration');
  let expected = initialRaw;
  let reason = !locks || typeof locks.request !== 'function' ? 'LOCKS_UNAVAILABLE' : null;
  let pending = false;
  const sessionOnly = () => ({status: 'SESSION_ONLY', reason});
  return Object.freeze({
    get reason() {return reason;},
    async write(nextRaw) {
      if (typeof nextRaw !== 'string') throw new TypeError('Storage value must be text');
      if (reason) return sessionOnly();
      if (pending) return {status: 'BUSY'};
      pending = true;
      let active = true, called = false, wrote = false;
      try {
        const result = await locks.request('constructor-storage:' + key, {mode: 'exclusive', ifAvailable: true}, lock => {
          if (!active || called) {reason = 'LOCKS_UNAVAILABLE'; return sessionOnly();}
          called = true;
          if (!lock) return {status: 'BUSY'};
          let current;
          try {current = storage.getItem(key);}
          catch {reason = 'STORAGE_UNAVAILABLE'; return sessionOnly();}
          if (current !== expected) {reason = 'EXTERNAL_CHANGE'; return sessionOnly();}
          try {storage.setItem(key, nextRaw);}
          catch {reason = 'STORAGE_UNAVAILABLE'; return sessionOnly();}
          wrote = true;
          expected = nextRaw;
          return {status: 'SAVED'};
        });
        if (!called || !result || !['SAVED', 'BUSY', 'SESSION_ONLY'].includes(result.status) ||
            (result.status === 'SAVED' && !wrote)) {
          reason = 'LOCKS_UNAVAILABLE';
          return sessionOnly();
        }
        return result;
      } catch {
        reason = 'LOCKS_UNAVAILABLE';
        return sessionOnly();
      } finally {active = false; pending = false;}
    }
  });
}

export function templateDefinition(id) {
  const definitions = {
    tasks: {label: 'Task Manager', item: 'Task', detail: 'Notes', value: null, statuses: ['Open', 'Done']},
    crm: {label: 'Business CRM', item: 'Opportunity', detail: 'Company / contact', value: 'Deal value (USD)', statuses: ['New', 'Qualified', 'Won']},
    dashboard: {label: 'Business Dashboard', item: 'Metric', detail: 'Unit / context', value: 'Value', statuses: ['On track', 'At risk']}
  };
  if (!Object.hasOwn(definitions, id)) throw new RangeError('Unknown template');
  return definitions[id];
}
export function validateRecords(records, template) {
  const definition = templateDefinition(template);
  if (!Array.isArray(records) || records.length > 250) throw new RangeError('At most 250 records are supported');
  const ids = new Set();
  for (const record of records) {
    if (!record || typeof record !== 'object' || Array.isArray(record) || Object.keys(record).sort().join(',') !== 'detail,id,status,title,value') throw new TypeError('Invalid record');
    if (typeof record.id !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(record.id) || ids.has(record.id)) throw new TypeError('Invalid or duplicate record ID');
    ids.add(record.id);
    if (typeof record.title !== 'string' || !record.title.trim() || record.title.length > 100 || /[\u0000-\u001f\u007f]/.test(record.title)) throw new TypeError('Invalid record title');
    if (typeof record.detail !== 'string' || record.detail.length > 240 || /[\u0000-\u001f\u007f]/.test(record.detail)) throw new TypeError('Invalid record detail');
    if (!Number.isFinite(record.value) || record.value < 0 || record.value > 1e9) throw new RangeError('Value must be between 0 and 1 billion');
    if (!definition.statuses.includes(record.status)) throw new RangeError('Invalid record status');
  }
  return records;
}
export function saveRecord(records, input, template) {
  validateRecords(records, template);
  validateRecords([input], template);
  const next = records.some(r => r.id === input.id) ? records.map(r => r.id === input.id ? {...input} : {...r}) : [...records.map(r => ({...r})), {...input}];
  return validateRecords(next, template);
}
export function changeStatus(records, id, template) {
  validateRecords(records, template);
  const statuses = templateDefinition(template).statuses;
  if (!records.some(r => r.id === id)) throw new RangeError('Record not found');
  return records.map(r => r.id === id ? {...r, status: statuses[(statuses.indexOf(r.status) + 1) % statuses.length]} : {...r});
}
export function removeRecord(records, id, template) {
  validateRecords(records, template);
  if (!records.some(r => r.id === id)) throw new RangeError('Record not found');
  return records.filter(r => r.id !== id).map(r => ({...r}));
}
export function filterRecords(records, template, {query = '', status = 'all'} = {}) {
  validateRecords(records, template);
  const definition = templateDefinition(template);
  if (typeof query !== 'string' || query.length > 240) throw new RangeError('Search must be at most 240 characters');
  if (status !== 'all' && !definition.statuses.includes(status)) throw new RangeError('Invalid status filter');
  const needle = query.trim().toLowerCase();
  return records.filter(record => (status === 'all' || record.status === status) &&
    (record.title + ' ' + record.detail + ' ' + record.status).toLowerCase().includes(needle));
}
export function summarizeRecords(records, template) {
  validateRecords(records, template);
  if (template === 'tasks') return [['Tasks', records.length], ['Open', records.filter(r => r.status === 'Open').length], ['Done', records.filter(r => r.status === 'Done').length]];
  if (template === 'crm') {
    const sum = list => list.reduce((total, r) => total + Math.round(r.value * 100), 0) / 100;
    return [['Opportunities', records.length], ['Pipeline · USD', sum(records)], ['Won · USD', sum(records.filter(r => r.status === 'Won'))]];
  }
  return [['Metrics', records.length], ['On track', records.filter(r => r.status === 'On track').length], ['At risk', records.filter(r => r.status === 'At risk').length]];
}
