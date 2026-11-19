// Author: Alexander Nikolaevich Romaskevich (RomaskevicH).
// Portable LOCAL REVIEW verification: signature validity for supplied keys is not key enrollment.
import {createHash} from 'node:crypto';
import {constants} from 'node:fs';
import {lstat,open,readdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {assertTaskStagePreflight} from './task-stage-preflight.mjs';
import {verifyTaskOwnerApproval} from './task-approval-gateway.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
const HASH=/^[a-f0-9]{64}$/;
async function safeFile(path){
 let h;
 try{
   h=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW);
   const st=await h.stat();if(!st.isFile()||st.size>100000)throw Error('REVIEW_UNSAFE_FILE');
   const bytes=await h.readFile();if(bytes.length>100000)throw Error('REVIEW_UNSAFE_FILE');
   return bytes;
 }catch(e){if(e?.code==='ELOOP')throw Error('REVIEW_UNSAFE_FILE');throw e;}
 finally{await h?.close();}
}
function parse(bytes){
 try{return JSON.parse(bytes.toString('utf8'));}catch{throw Error('REVIEW_EVIDENCE_JSON_INVALID');}
}
export function makeLocalReviewProof({missionId,manifestBytes,qaLog,checked,files}={}){
 if(typeof missionId!=='string'||!manifestBytes||!qaLog||!checked||
    !Array.isArray(files)||files.length!==2)throw Error('REVIEW_PROOF_INPUT_INVALID');
 const sourceFiles=files.map(f=>({path:f.path,bytes:f.bytes.length,sha256:sha(f.bytes)}))
   .sort((a,b)=>a.path.localeCompare(b.path));
 if(sourceFiles.map(f=>f.path).join('|')!=='app.mjs|test/app.test.mjs')
   throw Error('REVIEW_PROOF_FILE_SET_DENIED');
 return {schema:'constructor_local_review_copy_v2',missionId,
   artifactManifestSha256:sha(manifestBytes),qaLogSha256:sha(qaLog),
   qaAttestationSha256:checked.qaAttestationSha256,
   approvedExportSha256:checked.approvalPayloadSha256,sourceFiles,
   qaAuthority:'SUPPLIED_KEY_NOT_INDEPENDENTLY_ENROLLED',
   originalModelSource:'UNTRUSTED',ownerApproval:'EXTERNALLY_SIGNED_KEY_REQUIRED',
   destination:'LOCAL_REVIEW_ONLY',productionRelease:'DENIED'};
}
export async function verifyLocalReviewCopy({directory,ownerPublicKeyPem,qaPublicKeyPem,
 expectedQaSuiteSha256}={}){
 if(typeof directory!=='string'||!directory.trim()||!HASH.test(expectedQaSuiteSha256??''))
   throw Error('REVIEW_VERIFICATION_INPUT_INVALID');
 const root=resolve(directory);
 const st=await lstat(root),testDir=await lstat(join(root,'test'));
 if(!st.isDirectory()||st.isSymbolicLink()||!testDir.isDirectory()||testDir.isSymbolicLink())
   throw Error('REVIEW_UNSAFE_DIRECTORY');
 if((await readdir(root)).sort().join('|')!==
      'app.mjs|owner-approval.json|qa-attestation.json|qa.log|review-proof.json|stage-manifest.json|test'||
    (await readdir(join(root,'test'))).join('|')!=='app.test.mjs')
   throw Error('REVIEW_UNEXPECTED_FILES');
 const manifestBytes=await safeFile(join(root,'stage-manifest.json'));
 const qaLog=await safeFile(join(root,'qa.log'));
 const qaProof=parse(await safeFile(join(root,'qa-attestation.json')));
 const approval=parse(await safeFile(join(root,'owner-approval.json')));
 const manifest=parse(manifestBytes);
 const proof=parse(await safeFile(join(root,'review-proof.json')));
 if(manifest?.schema!=='constructor_task_stage_v1'||!Array.isArray(manifest.files)||
    manifest.files.length!==2||
    manifest.files.map(f=>f.path).sort().join('|')!=='app.mjs|test/app.test.mjs')
   throw Error('REVIEW_STAGE_INVALID');
 const files=[];
 for(const item of manifest.files){
   if(!item||!HASH.test(item.sha256??'')||!Number.isSafeInteger(item.bytes)||
      item.bytes<1||item.bytes>100000)throw Error('REVIEW_STAGE_INVENTORY_INVALID');
   const bytes=await safeFile(join(root,item.path));
   if(bytes.length!==item.bytes||sha(bytes)!==item.sha256)throw Error('REVIEW_SOURCE_MISMATCH');
   files.push({path:item.path,bytes});
 }
 assertTaskStagePreflight(manifest,files.map(f=>({path:f.path,content:f.bytes.toString('utf8')})));
 if(qaProof?.stageManifestSha256!==sha(manifestBytes)||
    qaProof.qaLogSha256!==sha(qaLog)||qaProof.missionId!==manifest.missionId)
   throw Error('REVIEW_QA_EVIDENCE_MISMATCH');
 // Signatures are checked at the signed approval issuance time only for historical inspection.
 // There is no reliable timestamp, trusted key enrollment or replay-store check here.
 const checked=verifyTaskOwnerApproval({approval,qaProof,ownerPublicKeyPem,qaPublicKeyPem,
   expectedQaSuiteSha256,consumedNonces:new Set(),now:approval?.issuedAt});
 const expected=makeLocalReviewProof({missionId:approval.missionId,manifestBytes,qaLog,checked,files});
 if(JSON.stringify(proof)!==JSON.stringify(expected))throw Error('REVIEW_PROOF_MISMATCH');
 return Object.freeze({status:'REVIEW_COPY_SIGNATURES_AND_INTEGRITY_VALID_FOR_SUPPLIED_KEYS',
   missionId:approval.missionId,filesVerified:files.length,
   artifactManifestSha256:expected.artifactManifestSha256,
   proofSha256:sha(JSON.stringify(proof)+'\n'),
   keyEnrollment:'NOT_INDEPENDENTLY_VERIFIED',
   timestamp:'SIGNED_CLAIM_NOT_ATTESTED',replayProtection:'NOT_CHECKED',
   sandboxOrigin:'NOT_INDEPENDENTLY_ATTESTED',
   execution:'NOT_RUN_BY_VERIFIER',productionRelease:'DENIED'});
}
