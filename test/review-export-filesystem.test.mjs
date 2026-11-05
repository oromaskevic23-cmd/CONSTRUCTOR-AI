// Project author and founding architect: Alexander Nikolaevich Romaskevich (RomaskevicH).
// Negative tests for local review-export filesystem trust boundaries.
// These tests DO NOT grant Owner authority, execute model output or attest QA.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,symlink,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {exportOwnerApprovedReviewCopy} from '../engineering/task-review-export.mjs';

async function fixture(t){
 const root=await mkdtemp(join(tmpdir(),'constructor-review-fs-'));
 t.after(()=>rm(root,{recursive:true,force:true}));
 const stage=join(root,'stage'),replay=join(root,'replay'),output=join(root,'output');
 await Promise.all([mkdir(stage),mkdir(replay),mkdir(output)]);
 return {root,stage,replay,output};
}
const args=({stage,replay,output})=>({
 stagePath:stage,replayDirectory:replay,outputDirectory:output
});
async function writeStageManifest(stage){
 const manifest={schema:'constructor_task_stage_v1',release:'DENIED',files:[
  {path:'app.mjs',bytes:13,sha256:'a'.repeat(64)},
  {path:'test/app.test.mjs',bytes:13,sha256:'b'.repeat(64)}
 ]};
 await writeFile(join(stage,'stage-manifest.json'),JSON.stringify(manifest)+'\n');
}

test('review export rejects a symlinked stage/test directory before QA credentials are loaded',async t=>{
 const f=await fixture(t);
 const outside=join(f.root,'outside');
 await mkdir(outside);
 await writeFile(join(outside,'app.test.mjs'),'not trusted\n');
 await writeFile(join(f.stage,'app.mjs'),'export {};\n');
 await writeStageManifest(f.stage);
 await symlink(outside,join(f.stage,'test'),'dir');
 await assert.rejects(exportOwnerApprovedReviewCopy(args(f)),/UNSAFE_DIRECTORY/);
});

test('review export never reads a symlinked generated source file',async t=>{
 const f=await fixture(t);
 const outside=join(f.root,'external.mjs');
 await writeFile(outside,'export const secret = true;\n');
 await writeStageManifest(f.stage);
 await mkdir(join(f.stage,'test'));
 await writeFile(join(f.stage,'test','app.test.mjs'),'export {};\n');
 await symlink(outside,join(f.stage,'app.mjs'));
 await assert.rejects(exportOwnerApprovedReviewCopy(args(f)),/UNSAFE_INPUT_FILE/);
});

test('review export rejects nested replay/output directories',async t=>{
 const f=await fixture(t);
 const nested=join(f.replay,'nested-output');
 await mkdir(nested);
 await assert.rejects(exportOwnerApprovedReviewCopy({
  ...args(f),outputDirectory:nested
 }),/UNSAFE_PATH_OVERLAP/);
});

test('review export rejects stage directories containing the output directory',async t=>{
 const f=await fixture(t);
 const nested=join(f.stage,'output');
 await mkdir(nested);
 await assert.rejects(exportOwnerApprovedReviewCopy({
  ...args(f),outputDirectory:nested
 }),/UNSAFE_PATH_OVERLAP/);
});

test('review export rejects use of the same directory for output and replay claims',async t=>{
 const f=await fixture(t);
 await assert.rejects(exportOwnerApprovedReviewCopy({
  ...args(f),outputDirectory:f.replay
 }),/UNSAFE_PATH_OVERLAP/);
});
