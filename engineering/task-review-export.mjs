// Project author and founding architect: Alexander Nikolaevich Romaskevich (RomaskevicH).
// Explicit Owner-signed, replay-protected export of a LOCAL REVIEW COPY ONLY.
// No build execution, network calls, deployment, payments or production authority.
import {createHash} from 'node:crypto';
import {constants} from 'node:fs';
import {lstat,readdir,mkdir,open,realpath} from 'node:fs/promises';
import {join,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {verifyTaskOwnerApproval} from './task-approval-gateway.mjs';
import {assertTaskStagePreflight} from './task-stage-preflight.mjs';
import {makeLocalReviewProof} from './local-review-evidence.mjs';

const sha=x=>createHash('sha256').update(x).digest('hex');
async function existingDir(path){
 const stat=await lstat(path);
 if(!stat.isDirectory()||stat.isSymbolicLink())throw Error('UNSAFE_DIRECTORY');
 return realpath(path);
}
async function exactFile(path){
 // Open the actual inode once. A pre-open lstat followed by readFile is a
 // symlink-swap race; O_NOFOLLOW rejects final-component symlinks.
 let handle;
 try{
   handle=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW);
   const stat=await handle.stat();
   if(!stat.isFile()||stat.size>100000)throw Error('UNSAFE_INPUT_FILE');
   const bytes=await handle.readFile();
   if(bytes.length>100000)throw Error('UNSAFE_INPUT_FILE');
   return bytes;
 }catch(error){
   if(error?.code==='ELOOP')throw Error('UNSAFE_INPUT_FILE');
   throw error;
 }finally{await handle?.close();}
}
function overlaps(a,b){
 return a===b||a.startsWith(b+sep)||b.startsWith(a+sep);
}
async function createExclusive(path,bytes){
 const handle=await open(path,constants.O_CREAT|constants.O_EXCL|constants.O_WRONLY|constants.O_NOFOLLOW,0o600);
 try{await handle.writeFile(bytes);await handle.sync();}finally{await handle.close();}
}
export async function exportOwnerApprovedReviewCopy({
 stagePath,qaProofPath,qaLogPath,approvalPath,ownerPublicKeyPath,qaPublicKeyPath,
 replayDirectory,outputDirectory,now=Date.now()
}={}){
 // All evidence paths must pre-exist. Never create/guess a trusted Owner key.
 const stage=await existingDir(resolve(stagePath));
 const replay=await existingDir(resolve(replayDirectory));
 const output=await existingDir(resolve(outputDirectory));
 // Trusted replay claims, quarantined source and review output must be disjoint.
 if(overlaps(stage,replay)||overlaps(stage,output)||overlaps(replay,output))
   throw Error('UNSAFE_PATH_OVERLAP');
 const manifestBytes=await exactFile(join(stage,'stage-manifest.json'));
 const manifest=JSON.parse(manifestBytes.toString('utf8'));
 if(manifest.schema!=='constructor_task_stage_v1'||manifest.release!=='DENIED'||
    !Array.isArray(manifest.files)||manifest.files.length!==2||
    manifest.files.map(f=>f.path).sort().join('|')!=='app.mjs|test/app.test.mjs')throw Error('STAGE_NOT_VALID');
 // Do not follow a stage/test symlink into unrelated host files.
 await existingDir(join(stage,'test'));
 if((await readdir(stage)).sort().join('|')!=='app.mjs|stage-manifest.json|test'||
    (await readdir(join(stage,'test'))).join('|')!=='app.test.mjs')throw Error('STAGE_UNEXPECTED_FILES');
 const files=[];
 for(const entry of manifest.files){
   const bytes=await exactFile(join(stage,entry.path));
   if(bytes.length!==entry.bytes||sha(bytes)!==entry.sha256)throw Error('STAGE_TAMPERED');
   files.push({path:entry.path,bytes});
 }
 // Source content is hashed above. Recheck the claimed preflight against the actual bytes,
 // before reading credentials, creating replay claims or writing an export.
 assertTaskStagePreflight(manifest,files.map(f=>({path:f.path,content:f.bytes.toString('utf8')})));
 const qaProofBytes=await exactFile(resolve(qaProofPath));
 const qaProof=JSON.parse(qaProofBytes.toString('utf8'));
 const qaLog=await exactFile(resolve(qaLogPath));
 if(qaProof.stageManifestSha256!==sha(manifestBytes)||qaProof.qaLogSha256!==sha(qaLog)||
    qaProof.missionId!==manifest.missionId)throw Error('QA_EVIDENCE_BINDING_FAILED');
 const approvalBytes=await exactFile(resolve(approvalPath));
 const approval=JSON.parse(approvalBytes.toString('utf8'));
 const ownerKey=(await exactFile(resolve(ownerPublicKeyPath))).toString('utf8');
 const qaKey=(await exactFile(resolve(qaPublicKeyPath))).toString('utf8');
 const qaSuite=await exactFile(fileURLToPath(new URL('../qa/independent-task-suite.mjs',import.meta.url)));
 const checked=verifyTaskOwnerApproval({approval,ownerPublicKeyPem:ownerKey,qaProof,
   qaPublicKeyPem:qaKey,expectedQaSuiteSha256:sha(qaSuite),
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
 // Preserve exact signed evidence for independent review. Public keys stay out-of-band.
 for(const [name,bytes] of [
   ['stage-manifest.json',manifestBytes],['qa.log',qaLog],
   ['qa-attestation.json',qaProofBytes],['owner-approval.json',approvalBytes]
 ])await createExclusive(join(destination,name),bytes);
 const proof=makeLocalReviewProof({missionId:approval.missionId,
   manifestBytes,qaLog,checked,files});
 await createExclusive(join(destination,'review-proof.json'),JSON.stringify(proof,null,2)+'\n');
 return Object.freeze({status:'LOCAL_REVIEW_COPY_EXPORTED',destination,
   productionRelease:'DENIED',cloudDeployment:'DENIED',financialOperation:'DENIED'});
}
