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
export function summarizeRecords(records, template) {
  validateRecords(records, template);
  if (template === 'tasks') return [['Tasks', records.length], ['Open', records.filter(r => r.status === 'Open').length], ['Done', records.filter(r => r.status === 'Done').length]];
  if (template === 'crm') {
    const sum = list => list.reduce((total, r) => total + Math.round(r.value * 100), 0) / 100;
    return [['Opportunities', records.length], ['Pipeline · USD', sum(records)], ['Won · USD', sum(records.filter(r => r.status === 'Won'))]];
  }
  return [['Metrics', records.length], ['On track', records.filter(r => r.status === 'On track').length], ['At risk', records.filter(r => r.status === 'At risk').length]];
}
