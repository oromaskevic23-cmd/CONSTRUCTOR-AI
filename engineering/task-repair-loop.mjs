// CONSTRUCTOR AI — bounded preflight repair; no execution or release authority.
import {createHash} from 'node:crypto';
const hash=s=>createHash('sha256').update(s).digest('hex');
const codes=new Set(['APP_PARSE_ERROR','TEST_PARSE_ERROR','APP_IMPORT_OR_REEXPORT','APP_DYNAMIC_IMPORT',
 'TEST_NODE_TEST_IMPORT_MISSING','TEST_ASSERT_STRICT_IMPORT_MISSING','TEST_APP_IMPORT_MISSING','TEST_REGISTRATION_MISSING',
 ...['CREATETASK','COMPLETETASK','FILTEROPEN'].flatMap(n=>['APP_MISSING_EXPORT_'+n,'TEST_TASK_IMPORT_MISSING_'+n])]);
const digest=/^[a-f0-9]{64}$/;
export async function runBoundedTaskRepair({mission,maxAttempts=1,runAttempt,signal}={}){
 if(!mission||typeof mission.id!=='string'||!/^[A-Za-z0-9_-]{6,72}$/.test(mission.id)||
    typeof mission.goal!=='string'||!mission.goal.trim()||mission.goal.length>1200||mission.allowModel!==true||
    !Number.isInteger(maxAttempts)||maxAttempts<1||maxAttempts>3||typeof runAttempt!=='function')throw Error('REPAIR_SCOPE_INVALID');
 const original=Object.freeze({id:mission.id,goal:mission.goal,allowModel:true});
 const attempts=[];let feedback=[];
 for(let n=1;n<=maxAttempts;n++){
   if(signal?.aborted)throw Error('REPAIR_CANCELLED');
   const goal=original.goal+(n===1?'':'\nRegenerate both files. Trusted structural diagnostics: '+feedback.join(', ')+'. Correct these issues.');
   const scoped=Object.freeze({...original,goal});
   // The trusted caller must issue a fresh permit for this exact scoped mission.
   // Any transport, policy or quarantine exception stops the entire loop.
   const {receipt,staged}=await runAttempt(scoped,n,signal);
   if(signal?.aborted)throw Error('REPAIR_CANCELLED');
   const p=staged?.preflight;
   if(receipt?.status!=='UNTRUSTED_GENERATED_TASK_APP'||receipt.missionId!==original.id||
      receipt.goalSha256!==hash(goal)||receipt.release!=='DENIED'||receipt.execution!=='NOT_RUN'||
      receipt.independentQa!=='NOT_RUN'||receipt.approval!=='DENIED'||!digest.test(receipt.draftSha256??'')||
      staged?.status!=='QUARANTINED_NOT_EXECUTED'||staged.release!=='DENIED'||!digest.test(staged.stageManifestSha256??'')||
      p?.scope!=='SYNTAX_AND_MODULE_SHAPE_ONLY_NOT_QA'||!Array.isArray(p.issues)||p.issues.length>codes.size||
      p.issues.some(c=>!codes.has(c))||!['PASS','FAIL'].includes(p.status)||
      (p.status==='PASS')!==(p.issues.length===0))throw Error('REPAIR_EVIDENCE_INVALID');
   feedback=[...new Set(p.issues)].sort();
   attempts.push(Object.freeze({attempt:n,goalSha256:hash(goal),draftSha256:receipt.draftSha256,
     stageManifestSha256:staged.stageManifestSha256,preflight:p.status,issues:Object.freeze(feedback)}));
   if(p.status==='PASS'||n===maxAttempts)return Object.freeze({schema:'constructor_task_preflight_repair_v1',
     missionId:original.id,originalGoalSha256:hash(original.goal),maxAttempts,attempts:Object.freeze(attempts),
     status:p.status==='PASS'?'PREFLIGHT_PASSED_QUARANTINED':'PREFLIGHT_FAILED_BUDGET_EXHAUSTED',
     stage:staged.stage,execution:'NOT_RUN',independentQa:'NOT_RUN',approval:'DENIED',release:'DENIED'});
 }
}
