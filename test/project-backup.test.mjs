import test from 'node:test';
import assert from 'node:assert/strict';
import {BACKUP_SCHEMA, MAX_BACKUP_BYTES, serializeBackup, parseBackup, planRecovery} from '../src/project-backup.mjs';
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
  assert.throws(() => parseBackup(' '.repeat(MAX_BACKUP_BYTES+1), 'tasks'), /1 MiB/);
  assert.throws(() => parseBackup(serializeBackup([sample('tasks')], 'tasks'), 'crm'), /different application/);
});
test('invalid backups are rejected without changing the caller workspace', () => {
  const workspace = [sample('tasks')];
  assert.throws(() => parseBackup('{"schema":"constructor-records-v1","template":"tasks","records":[{"id":"x"}]}', 'tasks'));
  assert.deepEqual(workspace, [sample('tasks')]);
});
test('maximum-size valid multilingual and escaped workspaces can be exported and restored', () => {
  for (const character of ['界', '\ud800']) {
    const records = Array.from({length:250}, (_, index) => ({
      id:'record-' + index, title:character.repeat(100), detail:character.repeat(240),
      value:1_000_000_000, status:'Qualified'
    }));
    const json = serializeBackup(records, 'crm');
    assert.ok(new TextEncoder().encode(json).byteLength <= MAX_BACKUP_BYTES);
    assert.deepEqual(parseBackup(json, 'crm'), records);
  }
});

test('recovery groups changes by record ID and merges only new records', () => {
  const original = sample('crm');
  const preserved = {...original, id:'keep', title:'Kept'};
  const unchanged = {...original, id:'same', title:'Unchanged'};
  const modified = {...original, value:20.25};
  const incoming = {...original, id:'new', title:'New'};
  const current = [original, preserved, unchanged];
  const plan = planRecovery(current, [modified, {...unchanged}, incoming], 'crm');
  assert.deepEqual(plan.added, [incoming]);
  assert.deepEqual(plan.conflicts, [{existing:original, incoming:modified}]);
  assert.deepEqual(plan.removed, [preserved]);
  assert.equal(plan.unchanged, 1);
  assert.deepEqual(plan.merged, [...current, incoming]);
  assert.notEqual(plan.merged[0], original);
});

test('recovery rejects over-limit merging while keeping the valid replacement available', () => {
  const current = Array.from({length:250}, (_, index) => ({...sample('tasks'), id:'existing-' + index}));
  const incoming = [sample('tasks')];
  const plan = planRecovery(current, incoming, 'tasks');
  assert.equal(plan.merged, null);
  assert.equal(plan.added.length, 1);
  assert.equal(plan.removed.length, 250);
  assert.deepEqual(parseBackup(serializeBackup(incoming, 'tasks'), 'tasks'), incoming);
});
