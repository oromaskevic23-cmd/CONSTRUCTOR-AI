import test from 'node:test';
import assert from 'node:assert/strict';
import {BACKUP_SCHEMA, MAX_BACKUP_BYTES, serializeBackup, parseBackup} from '../src/project-backup.mjs';
import {TEMPLATE_IDS, templateDefinition} from '../src/project-domain.mjs';
const sample = kind => ({id:'case-1',title:'Customer <script>alert(1)</script>',detail:'Notes & follow-up',value:19.95,status:templateDefinition(kind).statuses[0]});
for (const kind of TEMPLATE_IDS) test(kind + ': JSON backup round trip preserves records without reusing mutable input', () => {
  const data = [sample(kind)];
  const raw = serializeBackup(data, kind);
  assert.deepEqual(parseBackup(raw, kind), data);
  assert.equal(JSON.parse(raw).schema, BACKUP_SCHEMA);
  const restored = parseBackup(raw, kind);
  restored[0].title = 'Changed';
  assert.equal(data[0].title, sample(kind).title);
  assert.deepEqual(parseBackup(serializeBackup([], kind), kind), []);
});
test('restore rejects malformed, mismatched, oversized and unknown-schema files', () => {
  const good = JSON.parse(serializeBackup([sample('tasks')], 'tasks'));
  for (const data of [
    {...good, schema:'untrusted'},
    {...good, template:'crm'},
    {...good, extra:'unexpected'},
    {...good, records:[sample('tasks'),sample('tasks')]},
    {...good, records:[{...sample('tasks'),status:'ADMIN'}]},
    {...good, records:[{...sample('tasks'),value:-1}]},
    {...good, records:{'0':sample('tasks')}},
    {...good, records:Array(251).fill(sample('tasks'))}
  ]) assert.throws(() => parseBackup(JSON.stringify(data), 'tasks'));
  assert.throws(() => parseBackup('{', 'tasks'), /valid JSON/);
  assert.throws(() => parseBackup(null, 'tasks'));
  assert.throws(() => parseBackup(' '.repeat(MAX_BACKUP_BYTES+1), 'tasks'), /256 KiB/);
  assert.throws(() => parseBackup(serializeBackup([sample('tasks')], 'tasks'), 'crm'), /different application/);
});
test('invalid backups are rejected without changing the caller workspace', () => {
  const workspace = [sample('tasks')];
  assert.throws(() => parseBackup('{"schema":"constructor-records-v1","template":"tasks","records":[{"id":"x"}]}', 'tasks'));
  assert.deepEqual(workspace, [sample('tasks')]);
});
