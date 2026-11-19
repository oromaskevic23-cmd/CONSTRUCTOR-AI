// Project author and founding architect: Alexander Nikolaevich Romaskevich (RomaskevicH).
// Regression cases exercise admission only. No live model, untrusted execution or key enrollment.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp,mkdir,writeFile,readFile,rm,symlink} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {requireTaskStageBeforeExecution} from '../tools/require-task-stage.mjs';

const hash=x=>createHash('sha256').update(x).digest('hex');
const app='export function createTask(){};export function completeTask(){};export function filterOpen(){};\n';
const suite="import test from 'node:test';import assert from 'node:assert/strict';import {createTask,completeTask,filterOpen} from '../app.mjs';test('shape',()=>assert.ok(createTask));\n";
async function fixture(t){
 const root=await mkdtemp(join(tmpdir(),'constructor-admission-'));
 t.after(()=>rm(root,{recursive:true,force:true}));
 const stage=join(root,'stage');await mkdir(stage);await mkdir(join(stage,'test'));
 await writeFile(join(stage,'app.mjs'),app);
 await writeFile(join(stage,'test/app.test.mjs'),suite);
 const manifest={schema:'constructor_task_stage_v1',
  artifactState:'QUARANTINED_DENIED',release_allowed:false,
  staticReview:'NO_HEURISTIC_FLAGS_NOT_A_SANDBOX',
  execution:'NOT_RUN',independentQa:'NOT_RUN',approval:'DENIED',release:'DENIED',
  preflight:{status:'PASS',scope:'SYNTAX_AND_MODULE_SHAPE_ONLY_NOT_QA',issues:[]},
  files:[{path:'app.mjs',bytes:Buffer.byteLength(app),sha256:hash(app)},
         {path:'test/app.test.mjs',bytes:Buffer.byteLength(suite),sha256:hash(suite)}]};
 const write=async()=>writeFile(join(stage,'stage-manifest.json'),JSON.stringify(manifest)+'\n');
 await write();
 return {root,stage,manifest,write};
}
test('pre-execution gate verifies SHA-bound files without executing them',async t=>{
 const f=await fixture(t);
 const result=await requireTaskStageBeforeExecution(f.stage);
 assert.equal(result.status,'QUARANTINE_PRE_EXECUTION_VALIDATED');
 assert.equal(result.execution,'NOT_RUN');
 assert.equal(result.release,'DENIED');
});
test('stage with failing or missing preflight is rejected before Docker and QA logs',async t=>{
 const f=await fixture(t);
 f.manifest.preflight.status='FAIL';f.manifest.preflight.issues=['TEST_REGISTRATION_MISSING'];
 f.manifest.artifactState='QUARANTINED_PREFLIGHT_FAILED';await f.write();
 await assert.rejects(requireTaskStageBeforeExecution(f.stage),/STAGE_PREFLIGHT_DENIED/);
 const run=spawnSync('bash',['tools/run-isolated-task-qa.sh',f.stage,f.root],{encoding:'utf8'});
 assert.notEqual(run.status,0);
 assert.match(run.stderr,/STAGE_PREFLIGHT_DENIED/);
 assert.doesNotMatch(run.stderr,/PINNED_SANDBOX_IMAGE_NOT_PRELOADED/);
});
test('changed SHA-bound code is denied without reading any QA credentials',async t=>{
 const f=await fixture(t);
 await writeFile(join(f.stage,'app.mjs'),app+'export const injected=true;\n');
 await assert.rejects(requireTaskStageBeforeExecution(f.stage),/STAGE_FILE_TAMPERED/);
});
test('forged PASS status cannot hide invalid generated code',async t=>{
 const f=await fixture(t);
 const invalid='export const unrelated=true;\n';
 await writeFile(join(f.stage,'app.mjs'),invalid);
 f.manifest.files[0].sha256=hash(invalid);
 f.manifest.files[0].bytes=Buffer.byteLength(invalid);
 await f.write();
 await assert.rejects(requireTaskStageBeforeExecution(f.stage),/STAGE_PREFLIGHT_RECHECK_FAILED/);
});
test('extra files and symlinked test directory are rejected',async t=>{
 const f=await fixture(t);
 await writeFile(join(f.stage,'extra.js'),'x');
 await assert.rejects(requireTaskStageBeforeExecution(f.stage),/STAGE_UNEXPECTED_FILES/);
 const g=await fixture(t);
 const outside=join(g.root,'outside');await mkdir(outside);
 await rm(join(g.stage,'test'),{recursive:true});
 await symlink(outside,join(g.stage,'test'),'dir');
 await assert.rejects(requireTaskStageBeforeExecution(g.stage),/STAGE_UNSAFE_DIRECTORY/);
});
