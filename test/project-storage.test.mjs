import test from 'node:test';
import assert from 'node:assert/strict';
import {guardLocalStorage} from '../src/project-runtime.mjs';

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
