// Explicit local-only repair opt-in; no execution, independent QA or Owner approval.
import {randomBytes} from 'node:crypto';
import {issueLocalDraftPermit,ROUTE_LOCAL_TASK} from '../engineering/local-permit.mjs';
import {requestVelionTaskDraft} from '../engineering/velion-task-generator.mjs';
import {stageGeneratedTaskApp} from '../engineering/task-build-quarantine.mjs';
import {runBoundedTaskRepair} from '../engineering/task-repair-loop.mjs';
const [,,goal,outputRoot,count]=process.argv;
if(!goal||!outputRoot||!['1','2','3'].includes(count)||process.argv.length!==5)
 throw Error('USAGE: node tools/local-velion-task-repair.mjs "Build a task manager" EXISTING_OUTPUT_ROOT 1|2|3');
if(process.env.IMPERIAL_TASK_LOCAL_ONLY!=='YES')throw Error('LOCAL_INFERENCE_EXPLICIT_OPT_IN_REQUIRED');
const secret=process.env.VELION_LOCAL_PERMIT_SECRET,model=process.env.VELION_LOCAL_MODEL;
if(!secret||Buffer.byteLength(secret)<32||!model)throw Error('LOCAL_PERMIT_SECRET_AND_MODEL_REQUIRED');
const mission={id:'repair-task-'+randomBytes(8).toString('hex'),goal:goal.trim(),allowModel:true};
const consumedNonces=new Set();
const result=await runBoundedTaskRepair({mission,maxAttempts:Number(count),runAttempt:async(scoped,n,signal)=>{
 const now=Date.now();
 const permit=issueLocalDraftPermit({mission:scoped,route:ROUTE_LOCAL_TASK,model,secret,now});
 const receipt=await requestVelionTaskDraft({mission:scoped,permit,permitSecret:secret,consumedNonces,
  model,now,timeoutMs:90000,signal});
 const staged=await stageGeneratedTaskApp({receipt,outputRoot});
 return {receipt,staged};
}});
console.log(JSON.stringify(result));
if(result.status!=='PREFLIGHT_PASSED_QUARANTINED')process.exitCode=3;
