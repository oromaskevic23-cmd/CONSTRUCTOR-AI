// Owner Approval Gateway reference: deny by default; NEVER issues or enrolls Owner keys.
import {createHash,createPublicKey,verify as edVerify} from 'node:crypto';
const H=/^[a-f0-9]{64}$/, ID=/^[A-Za-z0-9_-]{6,72}$/;
export function verifyTaskOwnerApproval({approval,ownerPublicKeyPem,qaProof,consumedNonces,now=Date.now()}={}){
 if(!qaProof||qaProof.schema!=='constructor_task_qa_v1'||
    qaProof.status!=='SANDBOX_INDEPENDENT_QA_PASS'||
    qaProof.execution!=='ISOLATED_DOCKER_NO_NETWORK'||
    qaProof.release!=='DENIED'||!H.test(qaProof.manifestSha256??'')||
    !H.test(qaProof.qaLogSha256??''))throw Error('QA_EVIDENCE_NOT_ACCEPTABLE');
 if(typeof ownerPublicKeyPem!=='string'||!ownerPublicKeyPem.startsWith('-----BEGIN PUBLIC KEY-----'))throw Error('OWNER_PUBLIC_KEY_NOT_ENROLLED');
 let key;try{key=createPublicKey(ownerPublicKeyPem);}catch{throw Error('OWNER_PUBLIC_KEY_INVALID');}
 if(key.asymmetricKeyType!=='ed25519')throw Error('OWNER_KEY_MUST_BE_ED25519');
 if(!(consumedNonces instanceof Set))throw Error('PERSISTENT_REPLAY_STORE_REQUIRED');
 if(!approval||typeof approval!=='object'||Array.isArray(approval)||
   Object.keys(approval).sort().join('|')!=='action|expiresAt|issuedAt|missionId|nonce|qaLogSha256|stageManifestSha256|signature|signer|version')throw Error('APPROVAL_FORMAT_INVALID');
 const {signature,...message}=approval;
 if(message.version!=='constructor_owner_local_export_v1'||message.signer!=='OWNER'||
    message.action!=='export:local-review-only'||!ID.test(message.missionId??'')||
    !H.test(message.stageManifestSha256??'')||!H.test(message.qaLogSha256??'')||
    message.stageManifestSha256!==qaProof.manifestSha256||
    message.qaLogSha256!==qaProof.qaLogSha256||message.missionId!==qaProof.missionId||
    typeof message.nonce!=='string'||!/^[A-Za-z0-9_-]{12,80}$/.test(message.nonce)||
    !Number.isSafeInteger(message.issuedAt)||!Number.isSafeInteger(message.expiresAt)||
    !Number.isSafeInteger(now)||message.issuedAt>now+5000||message.expiresAt<=now||
    message.expiresAt-message.issuedAt>300000||message.expiresAt<=message.issuedAt)throw Error('APPROVAL_SCOPE_OR_TIME_DENIED');
 if(consumedNonces.has(message.nonce))throw Error('APPROVAL_REPLAY_DENIED');
 if(typeof signature!=='string'||!/^[A-Za-z0-9_-]{80,90}$/.test(signature))throw Error('APPROVAL_SIGNATURE_FORMAT');
 const payload=Buffer.from(JSON.stringify(message));
 if(!edVerify(null,payload,key,Buffer.from(signature,'base64url')))throw Error('OWNER_SIGNATURE_INVALID');
 consumedNonces.add(message.nonce);
 return Object.freeze({status:'OWNER_APPROVED_LOCAL_REVIEW_EXPORT_ONLY',
  missionId:message.missionId,
  approvalPayloadSha256:createHash('sha256').update(payload).digest('hex'),
  permission:'EXPORT_REVIEW_COPY_ONLY',productionDeployment:'DENIED',
  financialOperations:'DENIED',autonomousExecution:'DENIED'});
}
