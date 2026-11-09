import test from 'node:test';
import assert from 'node:assert/strict';
import {mountApplication} from '../src/project-runtime.mjs';

// A deliberately small DOM double tests event wiring without claiming browser acceptance.
class Element {
  constructor(tag, doc) {
    Object.assign(this, {tag, ownerDocument: doc, children: [], dataset: {}, attributes: {},
      listeners: {}, value: '', textContent: '', hidden: false,
      style: {values: {}, setProperty(name, value) {this.values[name] = value;}}});
  }
  set innerHTML(value) { throw new Error('Unexpected HTML parsing: ' + value); }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = children; }
  setAttribute(name, value) { this.attributes[name] = value; }
  addEventListener(type, callback) { this.listeners[type] = callback; }
  fire(type, event = {}) { return this.listeners[type]?.({preventDefault() {}, ...event}); }
  focus() { this.ownerDocument.focused = this; }
  contains(child) { return this === child || this.children.some(element => element.contains(child)); }
  closest(selector) {
    if (this.tag !== 'button') return null;
    if (selector === 'button[data-action]' && this.dataset.action) return this;
    if (selector === 'button[data-filter]' && this.dataset.filter) return this;
    return null;
  }
  querySelectorAll(selector) {
    return all(this).filter(element => selector === 'button[data-action]' && element.tag === 'button' && element.dataset.action);
  }
  reset() { for (const child of all(this)) if (child.tag === 'input') child.value = ''; }
}
function all(root) { return [root, ...root.children.flatMap(all)]; }
function storage(raw = null) {
  const held = new Set();
  return {raw, writes: 0, getItem() {return this.raw;}, setItem(_key, value) {this.raw = value; this.writes++;},
    locks: {async request(name, options, callback) {
      assert.deepEqual(options, {mode: 'exclusive', ifAvailable: true});
      if (held.has(name)) return callback(null);
      held.add(name);
      try {return await callback({name});} finally {held.delete(name);}
    }}};
}
function makeDocument(store) {
  const doc = {defaultView: {localStorage: store, navigator: {locks: store.locks}, crypto: {randomUUID: () => 'task-1'}, confirm: () => true}};
  doc.createElement = tag => new Element(tag, doc);
  return doc;
}
function one(root, predicate) {
  const found = all(root).filter(predicate);
  assert.equal(found.length, 1);
  return found[0];
}

test('exported UI applies readable colors for a dark selected accent',()=>{
  const doc=makeDocument(storage()),root=doc.createElement('main');
  mountApplication(root,{template:'tasks',name:'Smart Task Manager',accent:'#000000'});
  assert.deepEqual(root.style.values,{'--accent':'#000000','--on-accent':'#ffffff',
    '--accent-text':'#66e3c4','--accent-focus':'#66e3c4'});
});

test('exported task UI wires CRUD, search, status and persistent reload', async () => {
  const store = storage();
  const doc = makeDocument(store);
  const root = doc.createElement('main');
  mountApplication(root, {template: 'tasks', name: 'Smart Task Manager', accent: '#66e3c4'});
  const form = one(root, element => element.tag === 'form');
  const inputs = all(form).filter(element => element.tag === 'input');
  const search = one(root, element => element.tag === 'input' && element.type === 'search');
  const status = one(root, element => element.tag === 'select');
  const submit = () => form.fire('submit');
  const button = text => one(root, element => element.tag === 'button' && element.textContent === text);
  const headings = () => all(root).filter(element => element.tag === 'h2').map(element => element.textContent);

  inputs[0].value = '<img src=x onerror=alert(1)>';
  inputs[1].value = 'Quarterly plan';
  await submit();
  assert.deepEqual(headings(), ['<img src=x onerror=alert(1)>']);
  assert.equal(JSON.parse(store.raw)[0].status, 'Open');
  const beforeInvalid = store.raw;
  await submit();
  assert.equal(store.raw, beforeInvalid, 'an empty title must not be saved');
  await button('Open').fire('click');
  assert.equal(JSON.parse(store.raw)[0].status, 'Done');
  assert.equal(doc.focused.textContent, 'Done');
  status.value = 'Open'; status.fire('change');
  assert.deepEqual(headings(), []);
  status.value = 'Done'; status.fire('change');
  search.value = 'QUARTERLY'; search.fire('input');
  assert.equal(headings().length, 1);
  search.value = 'missing'; search.fire('input');
  assert.deepEqual(headings(), []);
  search.value = ''; search.fire('input');
  button('Edit').fire('click');
  inputs[0].value = 'Revised task'; await submit();
  assert.equal(JSON.parse(store.raw)[0].title, 'Revised task');

  const reloaded = doc.createElement('main');
  mountApplication(reloaded, {template: 'tasks', name: 'Smart Task Manager', accent: '#66e3c4'});
  assert.equal(one(reloaded, element => element.tag === 'h2').textContent, 'Revised task');
  await one(reloaded, element => element.tag === 'button' && element.textContent === 'Done').fire('click');
  assert.equal(JSON.parse(store.raw)[0].status, 'Open');
  await one(reloaded, element => element.tag === 'button' && element.textContent === 'Delete').fire('click');
  assert.deepEqual(JSON.parse(store.raw), []);
});

test('exported UI refuses to overwrite an empty invalid saved value', async () => {
  const store = storage('');
  const doc = makeDocument(store);
  const root = doc.createElement('main');
  mountApplication(root, {template: 'tasks', name: 'Smart Task Manager', accent: '#66e3c4'});
  const form = one(root, element => element.tag === 'form');
  all(form).filter(element => element.tag === 'input')[0].value = 'Session only';
  await form.fire('submit');
  assert.equal(store.raw, '');
  assert.equal(store.writes, 0);
  assert.match(one(root, element => element.attributes.role === 'alert').textContent, /not been replaced/);
});

test('a stale second tab cannot silently replace another tab\'s saved tasks', async () => {
  const store = storage(), firstDoc = makeDocument(store), secondDoc = makeDocument(store);
  const first = firstDoc.createElement('main'), second = secondDoc.createElement('main');
  const config = {template: 'tasks', name: 'Smart Task Manager', accent: '#66e3c4'};
  mountApplication(first, config); mountApplication(second, config);
  const firstForm = one(first, element => element.tag === 'form');
  const secondForm = one(second, element => element.tag === 'form');
  all(firstForm).find(element => element.tag === 'input').value = 'First tab';
  await firstForm.fire('submit');
  const firstSaved = store.raw;
  all(secondForm).find(element => element.tag === 'input').value = 'Second tab';
  await secondForm.fire('submit');
  assert.equal(store.raw, firstSaved, 'the stale tab must not overwrite persisted data');
  assert.match(one(second, element => element.attributes.role === 'alert').textContent, /another tab/i);
  assert.equal(one(second, element => element.tag === 'h2').textContent, 'Second tab');
  assert.match(one(second, element => element.attributes.role === 'status').textContent, /session/);
});

test('exported UI preserves externally corrupted storage and keeps the new task for this session', async () => {
  const store = storage(), doc = makeDocument(store), root = doc.createElement('main');
  mountApplication(root, {template: 'tasks', name: 'Smart Task Manager', accent: '#66e3c4'});
  store.raw = '{externally corrupted';
  const form = one(root, element => element.tag === 'form');
  all(form).find(element => element.tag === 'input').value = 'Session task';
  await form.fire('submit');
  assert.equal(store.raw, '{externally corrupted');
  assert.equal(store.writes, 0);
  assert.equal(one(root, element => element.tag === 'h2').textContent, 'Session task');
  assert.match(one(root, element => element.attributes.role === 'alert').textContent, /not been overwritten/);
});

test('exported UI keeps changes session-only when cross-tab locks are unavailable', async () => {
  const store = storage(), doc = makeDocument(store), root = doc.createElement('main');
  delete doc.defaultView.navigator.locks;
  mountApplication(root, {template: 'tasks', name: 'Smart Task Manager', accent: '#66e3c4'});
  const form = one(root, element => element.tag === 'form');
  all(form).find(element => element.tag === 'input').value = 'Session task';
  await form.fire('submit');
  assert.equal(store.raw, null);assert.equal(store.writes, 0);
  assert.equal(one(root, element => element.tag === 'h2').textContent, 'Session task');
  assert.match(one(root, element => element.attributes.role === 'alert').textContent, /only in this session/);
});

test('exported UI preserves form input if another tab holds the write lock', async () => {
  const store = storage(), doc = makeDocument(store), root = doc.createElement('main');
  doc.defaultView.navigator.locks = {request: async (_name, _options, callback) => callback(null)};
  mountApplication(root, {template: 'tasks', name: 'Smart Task Manager', accent: '#66e3c4'});
  const form = one(root, element => element.tag === 'form');
  const title = all(form).find(element => element.tag === 'input');
  title.value = 'Pending task';
  await form.fire('submit');
  assert.equal(store.raw, null);assert.equal(title.value, 'Pending task');
  assert.match(one(root, element => element.attributes.role === 'status').textContent, /try again/);
});

test('exported UI disables editing while an asynchronous write is pending', async () => {
  const store = storage(), doc = makeDocument(store), root = doc.createElement('main');
  let release;
  doc.defaultView.navigator.locks = {request: (_name, _options, callback) =>
    new Promise(resolve => {release = () => resolve(callback({}));})};
  mountApplication(root, {template: 'tasks', name: 'Smart Task Manager', accent: '#66e3c4'});
  const form = one(root, element => element.tag === 'form');
  const title = all(form).find(element => element.tag === 'input');
  title.value = 'Pending task';
  const first = form.fire('submit');
  assert.equal(title.disabled, true);
  await form.fire('submit');
  assert.equal(store.raw, null);assert.equal(title.value, 'Pending task');
  release();await first;
  assert.equal(title.disabled, false);
  assert.equal(JSON.parse(store.raw)[0].title, 'Pending task');
  assert.equal(store.writes, 1);
});

test('exported UI cannot start editing or export while an earlier write is pending', async () => {
  const store = storage(), doc = makeDocument(store), root = doc.createElement('main');
  mountApplication(root, {template: 'tasks', name: 'Smart Task Manager', accent: '#66e3c4'});
  const form = one(root, element => element.tag === 'form');
  const title = all(form).find(element => element.tag === 'input');
  title.value = 'Existing task';await form.fire('submit');
  let release;
  store.locks.request = (_name, _options, callback) => new Promise(resolve => {release = () => resolve(callback({}));});
  const pending = one(root, element => element.tag === 'button' && element.textContent === 'Open').fire('click');
  const edit = one(root, element => element.tag === 'button' && element.textContent === 'Edit');
  const backup = one(root, element => element.tag === 'button' && element.textContent === 'Export data');
  assert.equal(backup.disabled, true);
  edit.fire('click');
  assert.equal(title.value, '');
  assert.match(one(root, element => element.attributes.role === 'status').textContent, /in progress/);
  release();await pending;
  assert.equal(backup.disabled, false);
  assert.equal(JSON.parse(store.raw)[0].status, 'Done');
});

test('exported UI does not claim persistence when browser storage rejects a write', async () => {
  const store = storage(), doc = makeDocument(store), root = doc.createElement('main');
  store.setItem = () => {throw Error('storage blocked');};
  mountApplication(root, {template: 'tasks', name: 'Smart Task Manager', accent: '#66e3c4'});
  const form = one(root, element => element.tag === 'form');
  all(form).find(element => element.tag === 'input').value = 'Session task';
  await form.fire('submit');
  assert.equal(store.raw, null);
  assert.equal(one(root, element => element.tag === 'h2').textContent, 'Session task');
  assert.match(one(root, element => element.attributes.role === 'status').textContent, /session/);
  assert.match(one(root, element => element.attributes.role === 'alert').textContent, /only in this session/);
});

test('reference UI preserves unreadable saved data and displays a persistent warning', async () => {
  const store = storage('{broken');
  const doc = makeDocument(store);
  const ids = ['task-form', 'title', 'description', 'submit-task', 'cancel-edit', 'task-list',
    'message', 'search-tasks', 'storage-warning', 'count-total', 'count-active', 'count-completed', 'filters'];
  const elements = Object.fromEntries(ids.map(id => [id, doc.createElement(id === 'task-form' ? 'form' : 'div')]));
  elements['task-form'].reset = () => {elements.title.value = ''; elements.description.value = '';};
  doc.querySelector = selector => elements[selector.slice(1)];
  doc.querySelectorAll = () => [];
  const previousDocument = globalThis.document, previousWindow = globalThis.window;
  globalThis.document = doc; globalThis.window = doc.defaultView;
  try {
    await import('../src/app.js?reference-storage-test');
    assert.equal(elements['storage-warning'].hidden, false);
    elements.title.value = 'Session only';
    await elements['task-form'].fire('submit');
    assert.equal(store.raw, '{broken');
    assert.equal(store.writes, 0);
    assert.equal(elements['storage-warning'].hidden, false);
    assert.match(elements['storage-warning'].textContent, /not been replaced/);
    assert.equal(elements.message.textContent, 'Task created for this session only.');
  } finally {
    if (previousDocument === undefined) delete globalThis.document; else globalThis.document = previousDocument;
    if (previousWindow === undefined) delete globalThis.window; else globalThis.window = previousWindow;
  }
});

test('reference UI does not overwrite storage changed after it loaded', async () => {
  const store = storage(), doc = makeDocument(store);
  const ids = ['task-form', 'title', 'description', 'submit-task', 'cancel-edit', 'task-list',
    'message', 'search-tasks', 'storage-warning', 'count-total', 'count-active', 'count-completed', 'filters'];
  const elements = Object.fromEntries(ids.map(id => [id, doc.createElement(id === 'task-form' ? 'form' : 'div')]));
  elements['task-form'].reset = () => {elements.title.value = ''; elements.description.value = '';};
  doc.querySelector = selector => elements[selector.slice(1)];
  doc.querySelectorAll = () => [];
  const previousDocument = globalThis.document, previousWindow = globalThis.window;
  globalThis.document = doc; globalThis.window = doc.defaultView;
  try {
    await import('../src/app.js?reference-concurrent-storage-test');
    store.raw = '[]';
    elements.title.value = 'Session task';
    await elements['task-form'].fire('submit');
    assert.equal(store.raw, '[]');assert.equal(store.writes, 0);
    assert.match(elements['storage-warning'].textContent, /not overwritten/);
    assert.equal(elements.message.textContent, 'Task created for this session only.');
    assert.equal(elements['count-total'].textContent, '1');
  } finally {
    if (previousDocument === undefined) delete globalThis.document; else globalThis.document = previousDocument;
    if (previousWindow === undefined) delete globalThis.window; else globalThis.window = previousWindow;
  }
});
