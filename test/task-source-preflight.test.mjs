import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {inspectTaskSource} from '../engineering/task-source-preflight.mjs';

const goodApp='export function createTask(){}; export const completeTask=()=>{}; function filterOpen(){}; export {filterOpen};';
const goodTest="import test from 'node:test'; import assert from 'node:assert/strict'; import {createTask} from '../app.mjs';";
const pair=(app=goodApp,test=goodTest)=>[{path:'app.mjs',content:app},{path:'test/app.test.mjs',content:test}];

test('preflight checks syntax and exact module shape without running code',()=>{
  const result=inspectTaskSource(pair(goodApp+';throw new Error("not executed")'));
  assert.equal(result.status,'PASS');assert.equal(result.scope,'SYNTAX_AND_MODULE_SHAPE_ONLY_NOT_QA');
  assert.deepEqual(result.issues,[]);
  assert.throws(()=>inspectTaskSource([{path:'app.mjs',content:'x'}]),/TASK_PREFLIGHT_INPUT_INVALID/);
});

test('preflight rejects syntax errors, spoofed comments, missing exports and imports',()=>{
  const result=inspectTaskSource(pair('// export function createTask(){}\n const s="export function completeTask(){}";',
    "import x from './app.mjs';"));
  assert.equal(result.status,'FAIL');
  for(const code of ['APP_MISSING_EXPORT_CREATETASK','APP_MISSING_EXPORT_COMPLETETASK',
    'APP_MISSING_EXPORT_FILTEROPEN','TEST_NODE_TEST_IMPORT_MISSING','TEST_ASSERT_STRICT_IMPORT_MISSING',
    'TEST_APP_IMPORT_MISSING'])assert.ok(result.issues.includes(code),code);
  const bad=inspectTaskSource(pair('export function (',goodTest));
  assert.ok(bad.issues.includes('APP_PARSE_ERROR'));
  assert.ok(inspectTaskSource(pair(goodApp+";import('node:fs')",goodTest)).issues.includes('APP_DYNAMIC_IMPORT'));
});

test('the real quarantined model output is statically flagged without execution',async()=>{
  const root=new URL('../evidence/structured-gguf-20261111/',import.meta.url);
  const app=await readFile(new URL('candidate-app.mjs.txt',root),'utf8');
  const modelTest=await readFile(new URL('candidate-test.mjs.txt',root),'utf8');
  const result=inspectTaskSource(pair(app,modelTest));
  assert.equal(result.status,'FAIL');
  for(const code of ['APP_MISSING_EXPORT_CREATETASK','APP_MISSING_EXPORT_COMPLETETASK',
    'APP_MISSING_EXPORT_FILTEROPEN','TEST_NODE_TEST_IMPORT_MISSING','TEST_ASSERT_STRICT_IMPORT_MISSING',
    'TEST_APP_IMPORT_MISSING'])assert.ok(result.issues.includes(code),code);
});
