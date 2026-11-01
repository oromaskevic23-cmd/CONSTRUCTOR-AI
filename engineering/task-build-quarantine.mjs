// Prepare exactly two untrusted files; never execute source on the host.
import {createHash} from 'node:crypto';
import {lstat,mkdtemp,mkdir,open,realpath} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {constants} from 'node:fs';
import {parseModelDraft} from './draft-contract.mjs';
import {staticDraftReview} from './static-review.mjs';
import {validateTaskDraft} from './velion-task-generator.mjs';
const hash=x=>createHash('sha256').update(x).digest('hex');

export async function stageGeneratedTaskApp({receipt,outputRoot}={}){
  if(!receipt||receipt.status!=='UNTRUSTED_GENERATED_TASK_APP'||
    receipt.execution!=='NOT_RUN'||receipt.independentQa!=='NOT_RUN'||
    receipt.release!=='DENIED'||receipt.approval!=='DENIED')throw Error('RECEIPT_NOT_UNTRUSTED');
  const parsed=validateTaskDraft(JSON.stringify(receipt.draft));
  if(parsed.sha256!==receipt.draftSha256)throw Error('DRAFT_HASH_MISMATCH');
  const review=staticDraftReview(parsed.draft);
  if(review.forbidden.length||review.flags.length)throw Error('STATIC_REVIEW_BLOCKED');
  if(typeof outputRoot!=='string'||!outputRoot)throw Error('OUTPUT_ROOT_REQUIRED');
  const dest=resolve(outputRoot),info=await lstat(dest);
  if(!info.isDirectory()||info.isSymbolicLink())throw Error('UNSAFE_OUTPUT_ROOT');
  const root=await realpath(dest),stage=await mkdtemp(join(root,'constructor-task-quarantine-'));
  const inventory=[];
  for(const file of parsed.draft.files){
    const target=join(stage,file.path);
    if(file.path==='test/app.test.mjs')await mkdir(join(stage,'test'),{mode:0o755});
    const handle=await open(target,constants.O_CREAT|constants.O_EXCL|constants.O_WRONLY|constants.O_NOFOLLOW,0o644);
    try{await handle.writeFile(file.content);await handle.sync();}finally{await handle.close();}
    inventory.push({path:file.path,bytes:Buffer.byteLength(file.content),sha256:hash(file.content)});
  }
  const evidence={schema:'constructor_task_stage_v1',missionId:receipt.missionId,
    goalSha256:receipt.goalSha256,model:receipt.model,
    modelOutputSha256:receipt.modelOutputSha256,draftSha256:receipt.draftSha256,
    source:'UNTRUSTED_LOCAL_MODEL_PROPOSAL',files:inventory.sort((a,b)=>a.path.localeCompare(b.path)),
    staticReview:'NO_HEURISTIC_FLAGS_NOT_A_SANDBOX',execution:'NOT_RUN',
    independentQa:'NOT_RUN',approval:'DENIED',release:'DENIED'};
  const manifestText=JSON.stringify(evidence,null,2)+'\n';
  const handle=await open(join(stage,'stage-manifest.json'),constants.O_CREAT|constants.O_EXCL|constants.O_WRONLY|constants.O_NOFOLLOW,0o644);
  try{await handle.writeFile(manifestText);await handle.sync();}finally{await handle.close();}
  return Object.freeze({stage,stageManifestSha256:hash(manifestText),status:'QUARANTINED_NOT_EXECUTED',release:'DENIED'});
}
