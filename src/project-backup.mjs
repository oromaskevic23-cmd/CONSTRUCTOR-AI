// Strict, dependency-free JSON recovery contract for local single-user apps.
// Parsing never mutates the existing workspace; callers confirm replacement separately.
import {templateDefinition, validateRecords} from './project-domain.mjs';
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
