import test from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {guardLocalStorage, mountApplication} from '../src/project-runtime.mjs';
import {serializeBackup} from '../src/project-backup.mjs';

function storageFixture() {
  const values = new Map();
  return {
    getItem: key => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key)
  };
}

test('a stale tab keeps its edits in memory rather than overwriting another tab', () => {
  const storage = storageFixture();
  const first = guardLocalStorage(storage, 'workspace');
  const second = guardLocalStorage(storage, 'workspace');
  assert.equal(first.read(), null);
  assert.equal(second.write('["second tab"]'), true);
  assert.equal(first.write('["first tab"]'), false);
  assert.equal(storage.getItem('workspace'), '["second tab"]');
  assert.equal(second.write('["second tab", "more"]'), true);
  assert.equal(storage.getItem('workspace'), '["second tab", "more"]');
});

test('external deletion is treated as a conflict and a fresh tab can save again', () => {
  const storage = storageFixture();
  storage.setItem('workspace', '["initial"]');
  const stale = guardLocalStorage(storage, 'workspace');
  storage.removeItem('workspace');
  assert.equal(stale.write('["stale"]'), false);
  assert.equal(storage.getItem('workspace'), null);
  const refreshed = guardLocalStorage(storage, 'workspace');
  assert.equal(refreshed.write('["new"]'), true);
  assert.equal(storage.getItem('workspace'), '["new"]');
});

const config = {template:'crm', name:'Recovery test', accent:'#66e3c4'};
const storageKey = 'constructor-app-v1:crm:Recovery test';
const opportunity = (id, title, value = 10) => ({id,title,value,detail:'',status:'New'});
const active = opportunity('a', 'Current');
const backupOnly = opportunity('b', 'Backup only');

function recoveryWorkspace(t) {
  const window = new Window({url:'http://localhost/'});
  t.after(() => window.happyDOM.close());
  const document = window.document;
  const root = document.createElement('main');
  document.body.append(root);
  window.localStorage.setItem(storageKey, JSON.stringify([active]));
  mountApplication(root, config);
  const picker = root.querySelector('input[type=file]');
  const panel = root.querySelector('.recovery-panel');
  function click(label) {
    Array.from(root.querySelectorAll('button')).find(button => button.textContent === label).click();
  }
  async function choose(rows, read) {
    const raw = serializeBackup(rows, 'crm');
    Object.defineProperty(picker, 'files', {
      configurable:true, value:[{size:Buffer.byteLength(raw), text:read ?? (async () => raw)}]
    });
    picker.dispatchEvent(new window.Event('change'));
    await new Promise(resolve => setImmediate(resolve));
  }
  return {
    window, root, panel, choose, click,
    read:() => JSON.parse(window.localStorage.getItem(storageKey)),
    titles:() => Array.from(root.querySelectorAll('.record-list h2'), heading => heading.textContent),
    status:() => root.querySelector('[role=status]').textContent,
  };
}

test('backup review shows changed values and merges without replacing existing opportunities', async t => {
  const app = recoveryWorkspace(t);
  app.click('Edit');
  const title = app.root.querySelector('.record-form input[type=text]');
  title.value = 'Unsaved edit';
  await app.choose([{...active,value:30}, backupOnly]);
  assert.equal(app.panel.hidden, false);
  assert.match(app.panel.textContent, /1 new, 1 conflicting/);
  assert.match(app.panel.textContent, /Deal value \(USD\): 10 → 30/);
  assert.deepEqual(app.read(), [active]);
  app.click('Add new records');
  assert.equal(app.panel.hidden, true);
  assert.deepEqual(app.read(), [active, backupOnly]);
  assert.deepEqual(app.titles(), ['Current','Backup only']);
  assert.equal(title.value, 'Unsaved edit');
});

test('replacing a reviewed backup requires confirmation and writes only after acceptance', async t => {
  const app = recoveryWorkspace(t);
  app.window.confirm = () => false;
  await app.choose([backupOnly]);
  app.click('Replace workspace');
  assert.deepEqual(app.read(), [active]);
  assert.match(app.status(), /cancelled/);
  app.window.confirm = () => true;
  await app.choose([backupOnly]);
  app.click('Replace workspace');
  assert.deepEqual(app.read(), [backupOnly]);
  assert.equal(app.panel.hidden, true);
});

test('a storage change after preview does not overwrite newer records or alter the visible workspace', async t => {
  const app = recoveryWorkspace(t);
  await app.choose([backupOnly]);
  const concurrent = opportunity('c', 'From another tab');
  app.window.localStorage.setItem(storageKey, JSON.stringify([concurrent]));
  app.click('Add new records');
  assert.match(app.status(), /changed in another tab/);
  assert.deepEqual(app.read(), [concurrent]);
  assert.deepEqual(app.titles(), ['Current']);
});

test('an edit in the same tab invalidates the reviewed recovery plan', async t => {
  const app = recoveryWorkspace(t);
  await app.choose([backupOnly]);
  app.click('New');
  app.click('Add new records');
  assert.match(app.status(), /Workspace changed after review/);
  assert.equal(app.panel.hidden, true);
  assert.deepEqual(app.read(), [{...active,status:'Qualified'}]);
});

test('a slow initial backup cannot replace a more recent review', async t => {
  const app = recoveryWorkspace(t);
  let complete;
  await app.choose([backupOnly], () => new Promise(resolve => {complete = resolve;}));
  const newer = opportunity('c', 'Other backup');
  await app.choose([newer]);
  complete(serializeBackup([backupOnly], 'crm'));
  await new Promise(resolve => setImmediate(resolve));
  assert.match(app.panel.textContent, /Other backup/);
  assert.doesNotMatch(app.panel.textContent, /Backup only/);
  app.click('Add new records');
  assert.deepEqual(app.read(), [active, newer]);
});
