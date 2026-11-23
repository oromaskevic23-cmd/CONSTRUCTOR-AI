// Strict, dependency-free JSON recovery contract for local single-user apps.
// Parsing never mutates the existing workspace; callers confirm replacement separately.
import {MAX_RECORDS, templateDefinition, validateRecords} from './project-domain.mjs';
export const BACKUP_SCHEMA = 'constructor-records-v1';
// Large enough for all 250 valid records, including escaped Unicode, while
// retaining a hard bound for untrusted backup input.
export const MAX_BACKUP_BYTES = 1024 * 1024;

export function serializeBackup(records, template) {
  templateDefinition(template);
  validateRecords(records, template);
  const json = JSON.stringify({schema: BACKUP_SCHEMA, template, records}, null, 2) + '\n';
  if (new TextEncoder().encode(json).byteLength > MAX_BACKUP_BYTES) throw new RangeError('Backup exceeds 1 MiB');
  return json;
}

export function parseBackup(text, template) {
  templateDefinition(template);
  if (typeof text !== 'string' || new TextEncoder().encode(text).byteLength > MAX_BACKUP_BYTES) {
    throw new RangeError('Backup must be a JSON file no larger than 1 MiB');
  }
  let data;
  try { data = JSON.parse(text); }
  catch { throw new TypeError('Backup is not valid JSON'); }
  if (!data || typeof data !== 'object' || Array.isArray(data) ||
      Object.keys(data).sort().join(',') !== 'records,schema,template' ||
      data.schema !== BACKUP_SCHEMA) {
    throw new TypeError('Unsupported backup structure or schema');
  }
  if (data.template !== template) throw new RangeError('Backup belongs to a different application type');
  validateRecords(data.records, template);
  return data.records.map(record => ({...record}));
}

export function planRecovery(current, backup, template) {
  validateRecords(current, template);
  validateRecords(backup, template);
  const byId = new Map(current.map(record => [record.id, record]));
  const backupIds = new Set(backup.map(record => record.id));
  const added = [], conflicts = [];
  let unchanged = 0;
  for (const incoming of backup) {
    const existing = byId.get(incoming.id);
    if (!existing) added.push(incoming);
    else if (Object.keys(existing).every(key => existing[key] === incoming[key])) unchanged++;
    else conflicts.push({existing, incoming});
  }
  const removed = current.filter(record => !backupIds.has(record.id));
  const fits = current.length + added.length <= MAX_RECORDS;
  return {
    added, conflicts, removed, unchanged,
    merged: fits ? [...current, ...added].map(record => ({...record})) : null,
  };
}
