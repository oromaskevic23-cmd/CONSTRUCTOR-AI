// Independent acceptance written by CONSTRUCTOR AI QA, not by the model.
// Run ONLY within a no-network, non-root, read-only Docker sandbox.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createTask,completeTask,filterOpen} from '/work/app.mjs';
test('model generated real task creation contract',()=>{
  assert.deepEqual(createTask('a-1','First'),{id:'a-1',title:'First',done:false});
  assert.deepEqual(createTask('b_2','Second'),{id:'b_2',title:'Second',done:false});
  assert.throws(()=>createTask('../escape','Bad'),TypeError);
  assert.throws(()=>createTask('c','   '),TypeError);
});
test('completion is immutable and independently observable',()=>{
  const original=createTask('task-a','Preserve');
  const result=completeTask(original);
  assert.deepEqual(result,{id:'task-a',title:'Preserve',done:true});
  assert.equal(original.done,false);
  assert.notEqual(original,result);
  assert.throws(()=>completeTask({}),TypeError);
});
test('filterOpen is nonmutating with realistic case variation',()=>{
  const open=createTask('task-b','Follow up');
  const done=completeTask(createTask('task-c','Ship'));
  const source=[open,done];
  const result=filterOpen(source);
  assert.deepEqual(result,[open]);
  assert.notEqual(result,source);
  assert.equal(source.length,2);
});
