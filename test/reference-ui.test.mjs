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
  fire(type, event = {}) { this.listeners[type]?.({preventDefault() {}, ...event}); }
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
  return {raw, writes: 0, getItem() {return this.raw;}, setItem(_key, value) {this.raw = value; this.writes++;}};
}
function makeDocument(store) {
  const doc = {defaultView: {localStorage: store, crypto: {randomUUID: () => 'task-1'}, confirm: () => true}};
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

test('exported task UI wires CRUD, search, status and persistent reload', () => {
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
  submit();
  assert.deepEqual(headings(), ['<img src=x onerror=alert(1)>']);
  assert.equal(JSON.parse(store.raw)[0].status, 'Open');
  const beforeInvalid = store.raw;
  submit();
  assert.equal(store.raw, beforeInvalid, 'an empty title must not be saved');
  button('Open').fire('click');
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
  inputs[0].value = 'Revised task'; submit();
  assert.equal(JSON.parse(store.raw)[0].title, 'Revised task');

  const reloaded = doc.createElement('main');
  mountApplication(reloaded, {template: 'tasks', name: 'Smart Task Manager', accent: '#66e3c4'});
  assert.equal(one(reloaded, element => element.tag === 'h2').textContent, 'Revised task');
  one(reloaded, element => element.tag === 'button' && element.textContent === 'Done').fire('click');
  assert.equal(JSON.parse(store.raw)[0].status, 'Open');
  one(reloaded, element => element.tag === 'button' && element.textContent === 'Delete').fire('click');
  assert.deepEqual(JSON.parse(store.raw), []);
});

test('exported UI refuses to overwrite an empty invalid saved value', () => {
  const store = storage('');
  const doc = makeDocument(store);
  const root = doc.createElement('main');
  mountApplication(root, {template: 'tasks', name: 'Smart Task Manager', accent: '#66e3c4'});
  const form = one(root, element => element.tag === 'form');
  all(form).filter(element => element.tag === 'input')[0].value = 'Session only';
  form.fire('submit');
  assert.equal(store.raw, '');
  assert.equal(store.writes, 0);
  assert.match(one(root, element => element.attributes.role === 'alert').textContent, /not been replaced/);
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
    elements['task-form'].fire('submit');
    assert.equal(store.raw, '{broken');
    assert.equal(store.writes, 0);
    assert.equal(elements['storage-warning'].hidden, false);
    assert.match(elements['storage-warning'].textContent, /not been replaced/);
    assert.equal(elements.message.textContent, 'Task created.');
  } finally {
    if (previousDocument === undefined) delete globalThis.document; else globalThis.document = previousDocument;
    if (previousWindow === undefined) delete globalThis.window; else globalThis.window = previousWindow;
  }
});
