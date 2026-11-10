// Project author and founding architect: Alexander Nikolaevich Romaskevich (RomaskevicH).
// Explicit opt-in local VELION routing to Ollama. No execution, QA or Owner approval.
import {randomBytes} from 'node:crypto';
import {issueLocalDraftPermit,ROUTE_LOCAL_TASK,ROUTE_LOCAL_APPLICATION} from '../engineering/local-permit.mjs';
import {requestVelionTaskDraft,requestVelionFullApplicationDraft} from '../engineering/velion-task-generator.mjs';
import {stageGeneratedTaskApp,stageGeneratedFullApplication} from '../engineering/task-build-quarantine.mjs';
const args=process.argv.slice(2),fullApp=args[0]==='--full-app';
const [goal,outputRoot]=fullApp?args.slice(1):args;
if(!goal||!outputRoot||args.length!==(fullApp?3:2))throw Error('USAGE: node tools/local-velion-task-build.mjs [--full-app] "Build a task manager ..." EXISTING_OUTPUT_ROOT');
if(process.env.IMPERIAL_TASK_LOCAL_ONLY!=='YES')throw Error('LOCAL_INFERENCE_EXPLICIT_OPT_IN_REQUIRED');
const secret=process.env.VELION_LOCAL_PERMIT_SECRET,model=process.env.VELION_LOCAL_MODEL;
if(!secret||Buffer.byteLength(secret)<32||!model)throw Error('LOCAL_PERMIT_SECRET_AND_MODEL_REQUIRED');
const now=Date.now(),mission={id:'local-task-'+randomBytes(8).toString('hex'),goal,allowModel:true};
const permit=issueLocalDraftPermit({mission,route:fullApp?ROUTE_LOCAL_APPLICATION:ROUTE_LOCAL_TASK,model,secret,now});
const result=await (fullApp?requestVelionFullApplicationDraft:requestVelionTaskDraft)({mission,permit,permitSecret:secret,
 model,now,consumedNonces:new Set(),...(fullApp?{requireRealInferenceEvidence:true,timeoutMs:300000}:{})});
const staged=await (fullApp?stageGeneratedFullApplication:stageGeneratedTaskApp)({receipt:result,outputRoot});
console.log(JSON.stringify({status:'UNTRUSTED_MODEL_OUTPUT_QUARANTINED',
 mode:'LOCAL_MODEL_REQUEST_NOT_INDEPENDENTLY_ATTESTED',contract:fullApp?'FULL_APPLICATION_V1':'TASK_DOMAIN_V1',missionId:result.missionId,
 stage:staged.stage,draftSha256:result.draftSha256,execution:'NOT_RUN',
 independentQa:'NOT_RUN',ownerApproval:'NOT_GRANTED',release:'DENIED'}));
