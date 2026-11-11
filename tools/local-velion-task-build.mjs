// Project author and founding architect: Alexander Nikolaevich Romaskevich (RomaskevicH).
// Explicit opt-in local VELION routing to Ollama. No execution, QA or Owner approval.
import {randomBytes} from 'node:crypto';
import {issueLocalDraftPermit,ROUTE_LOCAL_TASK} from '../engineering/local-permit.mjs';
import {requestVelionTaskDraft} from '../engineering/velion-task-generator.mjs';
import {stageGeneratedTaskApp} from '../engineering/task-build-quarantine.mjs';
const [,,goal,outputRoot]=process.argv;
if(!goal||!outputRoot||process.argv.length!==4)throw Error('USAGE: node tools/local-velion-task-build.mjs "Build a task manager ..." EXISTING_OUTPUT_ROOT');
if(process.env.IMPERIAL_TASK_LOCAL_ONLY!=='YES')throw Error('LOCAL_INFERENCE_EXPLICIT_OPT_IN_REQUIRED');
const secret=process.env.VELION_LOCAL_PERMIT_SECRET,model=process.env.VELION_LOCAL_MODEL;
if(!secret||Buffer.byteLength(secret)<32||!model)throw Error('LOCAL_PERMIT_SECRET_AND_MODEL_REQUIRED');
const now=Date.now(),mission={id:'local-task-'+randomBytes(8).toString('hex'),goal,allowModel:true};
const permit=issueLocalDraftPermit({mission,route:ROUTE_LOCAL_TASK,model,secret,now});
const result=await requestVelionTaskDraft({mission,permit,permitSecret:secret,
 model,now,consumedNonces:new Set()});
const staged=await stageGeneratedTaskApp({receipt:result,outputRoot});
console.log(JSON.stringify({status:'UNTRUSTED_MODEL_OUTPUT_QUARANTINED',
 mode:'REAL_LOCAL_MODEL_REQUEST_NOT_INDEPENDENTLY_ATTESTED',missionId:result.missionId,
 stage:staged.stage,draftSha256:result.draftSha256,preflight:staged.preflight,execution:'NOT_RUN',
 independentQa:'NOT_RUN',ownerApproval:'NOT_GRANTED',release:'DENIED'}));

