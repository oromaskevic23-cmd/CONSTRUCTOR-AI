/** ARTEMIS mobile QA preparation for CONSTRUCTOR AI.
 * Planning only: no ADB, USB, network, launch, device access, or MCP calls.
 */
import {createHash} from 'node:crypto';

export const ARTEMIS_PIN='351ca8422f7b5b54e80a9c1ce03a222e02415b6b';
const assert=(ok,code)=>{if(!ok)throw Error(code);};
const safeLabel=s=>typeof s==='string'&&s.length>0&&s.length<=100&&
 !/[\x00-\x1f\x7f]/.test(s);
const allowedChecks=new Set(['LAUNCH','NAVIGATE','SCREENSHOT','ACCESSIBILITY','PERFORMANCE']);

export function prepareAndroidQaPlan({projectId,checks,upstreamSha=ARTEMIS_PIN,
 mode='NO_DEVICE_PREFLIGHT',budgetUsd=0}={}) {
  assert(upstreamSha===ARTEMIS_PIN,'UNPINNED_ARTEMIS_SOURCE');
  assert(mode==='NO_DEVICE_PREFLIGHT','LIVE_DEVICE_MODE_DENIED');
  assert(budgetUsd===0,'FREE_ONLY_DENIED');
  assert(safeLabel(projectId)&&/^[A-Za-z0-9_-]+$/.test(projectId),'PROJECT_ID_INVALID');
  assert(Array.isArray(checks)&&checks.length>0&&checks.length<=8&&
    checks.every(x=>allowedChecks.has(x))&&new Set(checks).size===checks.length,
    'CHECKS_NOT_ALLOWED');
  const tasks=checks.map((check,index)=>({id:index+1,check,status:'BLOCKED_DEVICE_REQUIRED'}));
  const digest=createHash('sha256').update(JSON.stringify({
    projectId,upstreamSha,mode,budgetUsd,tasks
  })).digest('hex');
  return Object.freeze({
    schema:'constructor.ai.artemis.mobile_qa_plan.v1',
    upstreamSha:ARTEMIS_PIN,projectId,
    tasks,planSha256:digest,
    status:'AWAITING_AUTHORIZED_ANDROID_SANDBOX',
    deviceTestsPassed:0,deviceTestsExecuted:0,
    androidDeviceConnected:false,modelCalls:0,
    mcpToolsUsed:0,externalEffects:0,productionAuthority:false,
    promotion:'OWNER_APPROVAL_AND_ISOLATED_DEVICE_REQUIRED'
  });
}
