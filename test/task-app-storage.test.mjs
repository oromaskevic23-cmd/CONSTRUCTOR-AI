import test from 'node:test';
import assert from 'node:assert/strict';

class Element {
  constructor(id = '') {
    this.id = id;
    this.textContent = '';
    this.value = '';
    this.dataset = {};
    this.hidden = id === 'storage-warning';
    this.disabled = false;
    this.children = [];
    this.listeners = new Map();
    this.resetCount = 0;
  }
  addEventListener(type, callback) { this.listeners.set(type, callback); }
  dispatch(type) { this.listeners.get(type)?.({preventDefault(){}, target:this}); }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = [...nodes]; }
  setAttribute() {}
  reset() { this.resetCount++; }
  focus() {}
}

let serial = 0;
async function boot(t, {raw = null, failRead = false, failWrite = false, failDownload = false, failClick = false} = {}) {
  const prior = new Map(['window', 'document', 'crypto'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  t.after(() => {
    for (const [key, descriptor] of prior) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });

  const nodes = new Map();
  const element = selector => {
    if (!nodes.has(selector)) nodes.set(selector, new Element(selector.slice(1)));
    return nodes.get(selector);
  };
  const storage = {
    raw, writes: 0, failRead, failWrite,
    getItem() { if (this.failRead) throw new Error('blocked read'); return this.raw; },
    setItem(_key, value) { this.writes++; if (this.failWrite) throw new Error('quota'); this.raw = value; }
  };
  const downloads = [], urls = new Map(), revoked = [], timers = [];
  const document = {
    querySelector: element,
    querySelectorAll: () => [],
    createElement: tag => {
      const el = new Element(tag);
      if (tag === 'a') el.click = () => {
        if (failClick) throw new Error('download click failed');
        downloads.push({href:el.href, name:el.download, blob:urls.get(el.href)});
      };
      return el;
    }
  };
  const windowListeners = new Map();
  Object.defineProperty(globalThis, 'window', {configurable:true, value:{
    localStorage:storage, confirm:()=>true,
    addEventListener(type, listener) { windowListeners.set(type, listener); },
    URL: {
      createObjectURL(blob) {
        if (failDownload) throw new Error('download unavailable');
        const url = 'blob:fixture-' + (urls.size + 1); urls.set(url, blob); return url;
      },
      revokeObjectURL(url) { revoked.push(url); urls.delete(url); }
    },
    setTimeout(callback) { timers.push(callback); }
  }});
  Object.defineProperty(globalThis, 'document', {configurable:true, value:document});
  let generated = 0;
  Object.defineProperty(globalThis, 'crypto', {configurable:true, value:{randomUUID:()=> 'task-' + ++generated}});
  await import('../src/app.js?storage-test=' + ++serial);

  const submit = title => {
    element('#title').value = title;
    element('#task-form').dispatch('submit');
  };
  const storageEvent = (key, newValue, storageArea = storage) => {
    windowListeners.get('storage')?.({key, newValue, storageArea});
  };
  return {element, storage, submit, storageEvent, downloads, revoked, timers};
}

test('invalid stored data cannot be overwritten by a new task', async t => {
  const original = '{"unrecognized":"preserve me"}';
  const {element, storage, submit} = await boot(t, {raw:original});
  submit('New task');
  assert.equal(storage.writes, 0);
  assert.equal(storage.raw, original);
  assert.equal(element('#task-form').resetCount, 0);
  assert.match(element('#storage-warning').textContent, /saving.*disabled/i);
  assert.equal(element('#count-total').textContent, '—');
  assert.equal(element('#task-list').children[0].textContent, 'Stored tasks are unavailable.');
});

test('a failed initial storage read prevents subsequent writes', async t => {
  const {element, storage, submit} = await boot(t, {raw:'original bytes', failRead:true});
  submit('New task');
  assert.equal(storage.writes, 0);
  assert.equal(storage.raw, 'original bytes');
  assert.match(element('#storage-warning').textContent, /saving.*disabled/i);
});

test('valid whitespace around an empty saved list is accepted', async t => {
  const {element, storage, submit} = await boot(t, {raw:' [ ] '});
  assert.equal(element('#storage-warning').hidden, true);
  assert.equal(element('#message').textContent, '');
  submit('Saved task');
  assert.equal(JSON.parse(storage.raw)[0].title, 'Saved task');
  assert.equal(element('#message').textContent, 'Task created.');
});

test('storage write failure leaves an explicit persistent warning', async t => {
  const {element, storage, submit} = await boot(t, {failWrite:true});
  submit('Temporary task');
  assert.equal(storage.raw, null);
  assert.equal(element('#storage-warning').hidden, false);
  assert.match(element('#storage-warning').textContent, /only in memory/i);
  assert.match(element('#message').textContent, /memory/i);
  element('#cancel-edit').dispatch('click');
  assert.equal(element('#storage-warning').hidden, false);
  storage.failWrite = false;
  submit('Another task');
  assert.equal(element('#storage-warning').hidden, true);
  assert.equal(JSON.parse(storage.raw).length, 2);
});

test('a changed stored value is not overwritten before a storage event arrives', async t => {
  const {element, storage, submit} = await boot(t, {raw:'[]'});
  const otherValue = '[{"from":"another tab"}]';
  storage.raw = otherValue;
  submit('Local task');
  assert.equal(storage.writes, 0);
  assert.equal(storage.raw, otherValue);
  assert.match(element('#storage-warning').textContent, /changed outside/i);
  assert.match(element('#message').textContent, /memory only/i);
  assert.equal(element('#count-total').textContent, '1');
  submit('Another local task');
  assert.equal(storage.raw, otherValue);
  assert.match(element('#storage-warning').textContent, /changed outside/i);
});

test('an observed storage change stays blocked even if the stored value changes back', async t => {
  const {element, storage, submit, storageEvent} = await boot(t, {raw:'[]'});
  storageEvent('constructor_ai_task_manager_v1', '[{"from":"another tab"}]');
  assert.match(element('#storage-warning').textContent, /changed outside/i);
  submit('Local task');
  assert.equal(storage.writes, 0);
  assert.equal(storage.raw, '[]');
  assert.match(element('#message').textContent, /memory only/i);
});

test('storage clear is a conflict but other storage keys and areas are ignored', async t => {
  const {element, storage, submit, storageEvent} = await boot(t, {raw:'[]'});
  storageEvent('unrelated', 'x');
  storageEvent('constructor_ai_task_manager_v1', 'x', {});
  assert.equal(element('#storage-warning').hidden, true);
  storageEvent(null, null);
  submit('Local task');
  assert.equal(storage.writes, 0);
  assert.match(element('#storage-warning').textContent, /changed outside/i);
});

test('a later storage read failure prevents an unchecked overwrite', async t => {
  const {element, storage, submit} = await boot(t, {raw:'[]'});
  storage.failRead = true;
  submit('Local task');
  assert.equal(storage.writes, 0);
  assert.equal(storage.raw, '[]');
  assert.match(element('#storage-warning').textContent, /only in memory/i);
  assert.match(element('#message').textContent, /memory only/i);
});

test('a local copy preserves memory-only tasks and an unfinished form without writing storage', async t => {
  const {element, storage, submit, downloads, revoked, timers} = await boot(t, {raw:'[]'});
  const newer = '[{"changed":"outside"}]';
  storage.raw = newer;
  submit('Only in this tab');
  element('#title').value = 'Unsubmitted draft';
  element('#description').value = 'Draft details <not markup>';
  element('#download-task-copy').dispatch('click');
  assert.equal(downloads.length, 1);
  assert.equal(downloads[0].name, 'constructor-task-copy.json');
  const copy = JSON.parse(await downloads[0].blob.text());
  assert.equal(copy.format, 'constructor-reference-task-copy-v1');
  assert.equal(copy.kind, 'current-tab');
  assert.deepEqual(copy.tasks.map(task => task.title), ['Only in this tab']);
  assert.deepEqual(copy.editor, {title:'Unsubmitted draft', description:'Draft details <not markup>', editingId:null});
  assert.equal(storage.raw, newer);
  assert.equal(storage.writes, 0);
  assert.match(element('#message').textContent, /download requested/i);
  assert.match(element('#storage-warning').textContent, /changed outside/i);
  assert.equal(timers.length, 1);
  timers[0]();
  assert.deepEqual(revoked, [downloads[0].href]);
});

test('a malformed stored value is copied exactly without replacing it', async t => {
  const original = '{bad:' + String.fromCharCode(0xd800) + '</script>\\n';
  const {element, storage, downloads} = await boot(t, {raw:original});
  element('#download-task-copy').dispatch('click');
  assert.equal(downloads.length, 1);
  const copy = JSON.parse(await downloads[0].blob.text());
  assert.equal(copy.format, 'constructor-reference-task-copy-v1');
  assert.equal(copy.kind, 'unreadable-storage-at-load');
  assert.equal(copy.storedRaw, original);
  assert.equal(storage.raw, original);
  assert.equal(storage.writes, 0);
  assert.equal(element('#submit-task').disabled, true);
});

test('a blocked initial read does not present an empty copy as recovered data', async t => {
  const {element, storage, downloads} = await boot(t, {raw:'unreadable', failRead:true});
  assert.equal(element('#download-task-copy').disabled, true);
  element('#download-task-copy').dispatch('click');
  assert.equal(downloads.length, 0);
  assert.equal(storage.raw, 'unreadable');
  assert.equal(storage.writes, 0);
});

test('copy preparation failure reports an error and preserves the session', async t => {
  const {element, storage, submit, downloads} = await boot(t, {failWrite:true, failDownload:true});
  submit('Unsaved task');
  element('#download-task-copy').dispatch('click');
  assert.equal(downloads.length, 0);
  assert.equal(storage.raw, null);
  assert.match(element('#message').textContent, /could not.*copy/i);
  assert.equal(element('#message').dataset.state, 'error');
  assert.equal(element('#count-total').textContent, '1');
  assert.equal(element('#storage-warning').hidden, false);
});

test('a failed download click still schedules revocation of the created URL', async t => {
  const {element, storage, downloads, revoked, timers} = await boot(t, {raw:'[]', failClick:true});
  assert.equal(downloads.length, 0);
  element('#download-task-copy').dispatch('click');
  assert.equal(downloads.length, 0);
  assert.equal(storage.writes, 0);
  assert.equal(element('#message').dataset.state, 'error');
  assert.equal(timers.length, 1);
  timers[0]();
  assert.equal(revoked.length, 1);
});
