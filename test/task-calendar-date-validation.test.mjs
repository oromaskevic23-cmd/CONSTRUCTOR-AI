import test from 'node:test';
import assert from 'node:assert/strict';
import {createTask, isTask, toggleTask} from '../src/tasks.js';

const base = {
  id: 'task-1',
  title: 'Calendar validation',
  description: '',
  completed: false,
  createdAt: '2026-02-28T12:00:00.000Z',
  updatedAt: '2026-02-28T12:00:00.000Z',
};

test('rejects impossible calendar days in persisted task state', () => {
  for (const date of ['2026-02-30T12:00:00.000Z', '2026-04-31T12:00:00.000Z', '2026-13-01T12:00:00.000Z', '2026-00-01T12:00:00.000Z']) {
    assert.equal(isTask({...base, createdAt: date}), false, date);
  }
});

test('rejects impossible timestamps on create and toggle', () => {
  assert.throws(() => createTask([], {title: 'New task'}, {id: 'task-2', now: '2026-02-30T12:00:00.000Z'}), /Invalid ISO timestamp/);
  assert.throws(() => toggleTask([base], base.id, '2026-04-31T12:00:00.000Z'), /Invalid ISO timestamp/);
});

test('accepts valid leap day and normal timestamps', () => {
  assert.equal(isTask({...base, createdAt: '2024-02-29T12:00:00.000Z'}), true);
  assert.equal(isTask({...base, createdAt: '2026-02-28T12:00:00.000Z'}), true);
  assert.equal(isTask({...base, createdAt: '2025-02-29T12:00:00.000Z'}), false);
});
