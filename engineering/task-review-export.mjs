// Explicit Owner-signed, replay-protected export of a LOCAL REVIEW COPY ONLY.
// No build execution, network calls, deployment, payments or production authority.
import {createHash} from 'node:crypto';
import {constants} from 'node:fs';
import {lstat,readFile,readdir,mkdir,open,realpath} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {verifyTaskOwnerApproval} from './task-approval-gateway.mjs';

const sha=x=>createHash('sha256').update(x).digest('hex');
async function existingDir(path){
 const stat=await lstat(path);
 if(!stat.isDirectory()||stat.isSymbolicLink())throw Error('UNSAFE_DIRECTORY');
 return realpath(path);
}
async function exactFile(path){
 const stat=await lstat(path);
 if(!stat.isFile()||stat.isSymbolicLink()||stat.size>100000)throw Error('UNSAFE_INPUT_FILE');
 return readFile(path);
}
async function createExclusive(path,bytes){
 const handle=await open(path,constants.O_CREAT|constants.O_EXCL|constants.O_WRONLY|constants.O_NOFOLLOW,0o600);
 try{await handle.writeFile(bytes);await handle.sync();}finally{await handle.close();}
}
export async function exportOwnerApprovedReviewCopy({
 stagePath,qaProofPath,qaLogPath,approvalPath,ownerPublicKeyPath,
 replayDirectory,outputDirectory,now=Date.now()
}={}){
 // All evidence paths must pre-exist. Never create/guess a trusted Owner key.
 const stage=await existingDir(resolve(stagePath));
 const replay=await existingDir(resolve(replayDirectory));
 const output=await existingDir(resolve(outputDirectory));
 const manifestBytes=await exactFile(join(stage,'stage-manifest.json'));
 const manifest=JSON.parse(manifestBytes.toString('utf8'));
 if(manifest.schema!=='constructor_task_stage_v1'||manifest.release!=='DENIED'||
    !Array.isArray(manifest.files)||manifest.files.length!==2||
    manifest.files.map(f=>f.path).sort().join('|')!=='app.mjs|test/app.test.mjs')throw Error('STAGE_NOT_VALID');
 if((await readdir(stage)).sort().join('|')!=='app.mjs|stage-manifest.json|test'||
    (await readdir(join(stage,'test'))).join('|')!=='app.test.mjs')throw Error('STAGE_UNEXPECTED_FILES');
 const files=[];
 for(const entry of manifest.files){
   const bytes=await exactFile(join(stage,entry.path));
   if(bytes.length!==entry.bytes||sha(bytes)!==entry.sha256)throw Error('STAGE_TAMPERED');
   files.push({path:entry.path,bytes});
 }
 const qaProof=JSON.parse((await exactFile(resolve(qaProofPath))).toString('utf8'));
 const qaLog=await exactFile(resolve(qaLogPath));
 if(qaProof.manifestSha256!==sha(manifestBytes)||qaProof.qaLogSha256!==sha(qaLog)||
    qaProof.missionId!==manifest.missionId)throw Error('QA_EVIDENCE_BINDING_FAILED');
 const approval=JSON.parse((await exactFile(resolve(approvalPath))).toString('utf8'));
 const ownerKey=(await exactFile(resolve(ownerPublicKeyPath))).toString('utf8');
 const checked=verifyTaskOwnerApproval({approval,ownerPublicKeyPem:ownerKey,qaProof,
   consumedNonces:new Set(),now});
 if(checked.permission!=='EXPORT_REVIEW_COPY_ONLY')throw Error('APPROVAL_NOT_ENOUGH');
 // Replay claim: atomic, persistent on the supplied trusted filesystem.
 const claim=join(replay,'consumed-'+sha(approval.nonce)+'.json');
 await createExclusive(claim,JSON.stringify({missionId:approval.missionId,
   nonceHash:sha(approval.nonce),approvedAt:now,action:'export:local-review-only'})+'\n');
 // A replay consumes its permit even if subsequent copy fails; fail closed.
 const destination=join(output,'task-review-'+approval.missionId+'-'+sha(approval.nonce).slice(0,12));
 await mkdir(destination,{mode:0o700,recursive:false});
 await mkdir(join(destination,'test'),{mode:0o700});
 for(const file of files)await createExclusive(join(destination,file.path),file.bytes);
 const proof={schema:'constructor_local_review_copy_v1',missionId:approval.missionId,
   artifactManifestSha256:sha(manifestBytes),qaLogSha256:sha(qaLog),
   approvedExportSha256:checked.approvalPayloadSha256,
   originalModelSource:'UNTRUSTED',ownerApproval:'EXTERNALLY_SIGNED_KEY_REQUIRED',
   destination:'LOCAL_REVIEW_ONLY',productionRelease:'DENIED'};
 await createExclusive(join(destination,'review-proof.json'),JSON.stringify(proof,null,2)+'\n');
 return Object.freeze({status:'LOCAL_REVIEW_COPY_EXPORTED',destination,
   productionRelease:'DENIED',cloudDeployment:'DENIED',financialOperation:'DENIED'});
}
