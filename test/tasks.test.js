import test from "node:test";
import assert from "node:assert/strict";
import {
  createTask, updateTask, toggleTask, deleteTask, filterTasks,
  taskCounts, loadTasks, isTask, normalizeTitle, normalizeDescription, MAX_TASKS
} from "../src/tasks.js";

const NOW = "2026-10-24T12:00:00.000Z";
const LATER = "2026-10-24T14:00:00.000Z";
const add = (list, name = "Review specification", id = "task-1") =>
  createTask(list, {title:name,description:"Original detail"}, {id,now:NOW});

test("creates immutable task with deterministic metadata", () => {
  const original = [];
  const created = add(original);
  assert.equal(original.length, 0);
  assert.equal(created.length, 1);
  assert.deepEqual(created[0], {
    id:"task-1", title:"Review specification", description:"Original detail",
    completed:false,createdAt:NOW,updatedAt:NOW
  });
});

test("normalizes whitespace without permitting an empty title", () => {
  assert.equal(normalizeTitle("  Validate   CI \n  workflow "), "Validate CI workflow");
  assert.throws(() => normalizeTitle(" \t "), /Task title/);
  assert.throws(() => normalizeTitle(9), TypeError);
});

test("enforces upper bound on title length", () => {
  assert.throws(() => add([], "A".repeat(121)), RangeError);
  assert.doesNotThrow(() => add([], "A".repeat(120)));
});

test("rejects invalid description types and excessive length", () => {
  assert.throws(() => normalizeDescription(42), TypeError);
  assert.throws(() => normalizeDescription("x".repeat(501)), RangeError);
  assert.equal(normalizeDescription(" ok \n"), "ok");
});

test("generates independent immutable updates", () => {
  const previous = add([]);
  const next = updateTask(previous,"task-1",{title:"Updated",description:"New detail"},LATER);
  assert.equal(previous[0].title,"Review specification");
  assert.equal(next[0].title,"Updated");
  assert.equal(next[0].updatedAt,LATER);
  assert.equal(next[0].createdAt,NOW);
});

test("completion can be toggled both ways", () => {
  const first = add([]);
  const completed = toggleTask(first,"task-1",LATER);
  assert.equal(completed[0].completed,true);
  assert.equal(first[0].completed,false);
  const reopened = toggleTask(completed,"task-1",LATER);
  assert.equal(reopened[0].completed,false);
});

test("deleting one task leaves other tasks and original state untouched", () => {
  const one = add([]);
  const two = add(one,"Ship QA report","task-2");
  const result = deleteTask(two,"task-1");
  assert.deepEqual(result.map(t => t.id), ["task-2"]);
  assert.equal(two.length,2);
});

test("counts and filters remain consistent", () => {
  const two = add(add([]),"Second task","task-2");
  const completed = toggleTask(two,"task-1",LATER);
  assert.deepEqual(taskCounts(completed),{total:2,active:1,completed:1});
  assert.equal(filterTasks(completed,"active").length,1);
  assert.equal(filterTasks(completed,"completed").length,1);
  assert.equal(filterTasks(completed,"all").length,2);
});

test("invalid filter fails closed", () => {
  assert.throws(() => filterTasks(add([]),"deleted"), RangeError);
});

test("rejects duplicate and invalid IDs", () => {
  const first = add([]);
  assert.throws(() => add(first,"Again","task-1"), TypeError);
  assert.throws(() => add(first,"Invalid","../escape"), TypeError);
});

test("unknown task operations fail without mutating existing data", () => {
  const first = add([]);
  assert.throws(() => toggleTask(first,"missing",LATER), /not found/);
  assert.throws(() => updateTask(first,"missing",{title:"Other"},LATER), /not found/);
  assert.throws(() => deleteTask(first,"missing"), /not found/);
  assert.equal(first[0].completed,false);
});

test("enforces maximum task count", () => {
  const full = Array.from({length:MAX_TASKS},(_,i)=>({
    id:"id-"+i,title:"Task "+i,description:"",completed:false,createdAt:NOW,updatedAt:NOW
  }));
  assert.throws(() => createTask(full,{title:"One more"},{id:"overflow",now:NOW}), /Maximum/);
});

test("malformed, primitive, and oversized persisted state is rejected", () => {
  assert.deepEqual(loadTasks("{invalid"),[]);
  assert.deepEqual(loadTasks("{}"),[]);
  assert.deepEqual(loadTasks(JSON.stringify([{id:"a"}])),[]);
  assert.deepEqual(loadTasks(JSON.stringify(Array(MAX_TASKS+1).fill({}))),[]);
});

test("loading valid state does not share object references", () => {
  const first = add([]);
  const restored = loadTasks(JSON.stringify(first));
  assert.deepEqual(restored,first);
  assert.notEqual(restored[0],first[0]);
});

test("duplicate IDs in persisted storage are rejected", () => {
  const one = add([])[0];
  assert.deepEqual(loadTasks(JSON.stringify([one,one])),[]);
});

test("malicious-looking task content remains text data, not executable HTML", () => {
  const title="<img src=x onerror=alert(1)>";
  const result = add([],title);
  assert.equal(result[0].title,title);
  // src/app.js must render titles via textContent, never innerHTML.
});

test("task record validator rejects missing or incorrect properties", () => {
  const good = add([])[0];
  assert.equal(isTask(good),true);
  assert.equal(isTask({...good,completed:"false"}),false);
  assert.equal(isTask({...good,title:""}),false);
  assert.equal(isTask({...good,createdAt:"today"}),false);
});

test("bad clock and malformed state fail without creating a task", () => {
  assert.throws(() => createTask([],{title:"ok"},{id:"task-2",now:"soon"}),TypeError);
  assert.throws(() => add(null),TypeError);
});
