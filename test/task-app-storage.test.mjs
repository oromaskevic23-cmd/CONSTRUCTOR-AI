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
async function boot(t, {raw = null, failRead = false, failWrite = false} = {}) {
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
  const document = {
    querySelector: element,
    querySelectorAll: () => [],
    createElement: tag => new Element(tag)
  };
  const windowListeners = new Map();
  Object.defineProperty(globalThis, 'window', {configurable:true, value:{
    localStorage:storage, confirm:()=>true,
    addEventListener(type, listener) { windowListeners.set(type, listener); }
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
  return {element, storage, submit, storageEvent};
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
