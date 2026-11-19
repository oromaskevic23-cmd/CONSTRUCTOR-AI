// Project author and founding architect: Alexander Nikolaevich Romaskevich (RomaskevicH).
// Synthetic negative regression coverage. No trusted QA or Owner enrollment implied.
import test from 'node:test';
import assert from 'node:assert/strict';
import {assertTaskStagePreflight} from '../engineering/task-stage-preflight.mjs';

const app='export function createTask(){};export function completeTask(){};export function filterOpen(){};';
const suite="import test from 'node:test';import assert from 'node:assert/strict';import {createTask,completeTask,filterOpen} from '../app.mjs';test('contract',()=>assert.ok(createTask));";
const sourceFiles=[{path:'app.mjs',content:app},{path:'test/app.test.mjs',content:suite}];
const manifest=()=>({
 schema:'constructor_task_stage_v1',
 artifactState:'QUARANTINED_DENIED',release_allowed:false,
 staticReview:'NO_HEURISTIC_FLAGS_NOT_A_SANDBOX',
 execution:'NOT_RUN',independentQa:'NOT_RUN',approval:'DENIED',release:'DENIED',
 preflight:{status:'PASS',scope:'SYNTAX_AND_MODULE_SHAPE_ONLY_NOT_QA',issues:[]}
});

test('only a matching PASS preflight may proceed to signed local review checks',()=>{
 const result=assertTaskStagePreflight(manifest(),sourceFiles);
 assert.equal(result.status,'STAGE_PREFLIGHT_REVALIDATED');
 assert.equal(result.productionRelease,'DENIED');
 assert.equal(result.execution,'NOT_RUN');
});

test('a failed, missing or spoofed manifest preflight is denied before credentials and replay claims',()=>{
 for(const preflight of [
   {status:'FAIL',scope:'SYNTAX_AND_MODULE_SHAPE_ONLY_NOT_QA',issues:['APP_MISSING_EXPORT_CREATETASK']},
   {status:'PASS',scope:'SYNTAX_AND_MODULE_SHAPE_ONLY_NOT_QA',issues:['TEST_REGISTRATION_MISSING']},
   {status:'PASS',scope:'UNTRUSTED',issues:[]},
   undefined,
 ]){
  assert.throws(()=>assertTaskStagePreflight({...manifest(),preflight},sourceFiles),/STAGE_PREFLIGHT_DENIED/);
 }
});

test('tampering with staged source cannot bypass the manifest PASS label',()=>{
 const badApp=sourceFiles.map(f=>f.path==='app.mjs'?{...f,content:'export const notTheContract = true;'}:f);
 assert.throws(()=>assertTaskStagePreflight(manifest(),badApp),/STAGE_PREFLIGHT_RECHECK_FAILED/);
 const skipped=sourceFiles.map(f=>f.path==='test/app.test.mjs'?{...f,content:suite.replace("test('contract'","test.skip('contract'")}:f);
 assert.throws(()=>assertTaskStagePreflight(manifest(),skipped),/STAGE_PREFLIGHT_RECHECK_FAILED/);
});

test('review gate rejects unreviewed or elevated execution and release state',()=>{
 const denied=[
  {artifactState:'QUARANTINED_PREFLIGHT_FAILED'}, {artifactState:'APPROVED'},
  {release_allowed:true}, {staticReview:'UNREVIEWED'}, {execution:'PASSED'},
  {independentQa:'PASSED'}, {approval:'APPROVED'}, {release:'ALLOWED'},
 ];
 for(const changes of denied){
   assert.throws(()=>assertTaskStagePreflight({...manifest(),...changes},sourceFiles),/STAGE_PREFLIGHT_DENIED/);
 }
});

test('review gate denies unexpected and duplicate staged file sets',()=>{
 for(const files of [[],[sourceFiles[0]],[sourceFiles[0],sourceFiles[0]], [...sourceFiles,{path:'secret.env',content:'x'}]]){
  assert.throws(()=>assertTaskStagePreflight(manifest(),files),/STAGE_PREFLIGHT_FILE_SET_DENIED/);
 }
});
