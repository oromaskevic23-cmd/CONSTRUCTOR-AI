// Synthetic CI: injected fake model transport, never real VELION inference.
import {randomBytes} from 'node:crypto';
import {issueLocalDraftPermit} from '../engineering/local-permit.mjs';
import {requestVelionTaskDraft} from '../engineering/velion-task-generator.mjs';
import {stageGeneratedTaskApp} from '../engineering/task-build-quarantine.mjs';
const outputRoot=process.argv[2];
if(!outputRoot||process.argv.length!==3)throw Error('USAGE: node tools/prepare-synthetic-task-build.mjs EXISTING_OUTPUT_ROOT');
const mission={id:'synthetic-task-001',goal:'Build a task manager domain API for synthetic regression tests',allowModel:true};
const app=[
 "export function createTask(id,title){if(typeof id!=='string'||!/^[A-Za-z0-9_-]+$/.test(id)||typeof title!=='string'||!title.trim())throw new TypeError('INVALID_TASK');return {id,title,done:false};}",
 "export function completeTask(task){if(!task||typeof task!=='object'||typeof task.id!=='string'||typeof task.title!=='string'||typeof task.done!=='boolean')throw new TypeError('INVALID_TASK');return {...task,done:true};}",
 "export function filterOpen(tasks){if(!Array.isArray(tasks))throw new TypeError('INVALID_LIST');return tasks.filter(task=>task&&task.done===false);}"
].join('\n')+'\n';
const tests=[
 "import test from 'node:test';",
 "import assert from 'node:assert/strict';",
 "import {createTask,completeTask,filterOpen} from '../app.mjs';",
 "test('generated contract basics',()=>{const task=createTask('1','Sample');assert.equal(task.done,false);assert.equal(completeTask(task).done,true);assert.equal(filterOpen([task]).length,1);});"
].join('\n')+'\n';
const fixture={schema:'constructor_draft_v1',summary:'Synthetic task-manager implementation (NOT actual model inference)',
 steps:[{id:'implementation',action:'Create a pure task API',acceptance:'Independent trusted acceptance validates behavior'}],
 files:[{path:'app.mjs',content:app},{path:'test/app.test.mjs',content:tests}]};
const permitSecret=randomBytes(32).toString('base64url'),now=Date.now();
const permit=issueLocalDraftPermit({missionId:mission.id,secret:permitSecret,now});
const result=await requestVelionTaskDraft({mission,permit,permitSecret,
 consumedNonces:new Set(),model:'fixture-only:task-v1',now,
 fetchImpl:async()=>new Response(JSON.stringify({model:'fixture-only:task-v1',done:true,response:JSON.stringify(fixture)}),{status:200})});
const artifact=await stageGeneratedTaskApp({receipt:result,outputRoot});
console.log(JSON.stringify({schema:'constructor_synthetic_stage_v1',mode:'FAKE_MODEL_FIXTURE_NOT_LIVE_VELION',
 stage:artifact.stage,manifestSha256:artifact.stageManifestSha256,release:'DENIED'}));
