// Project author and founding architect: Alexander Nikolaevich Romaskevich (RomaskevicH).
// Local review authorization: requires separately supplied trusted Owner and QA public keys.
// This code NEVER issues or enrolls keys and grants no production authority.
import {createHash,createPublicKey,verify as edVerify} from 'node:crypto';
import {verifyTaskQaAttestation} from './task-qa-attestation.mjs';
const H=/^[a-f0-9]{64}$/, ID=/^[A-Za-z0-9_-]{6,72}$/;
export function verifyTaskOwnerApproval({approval,ownerPublicKeyPem,qaProof,qaPublicKeyPem,
  expectedQaSuiteSha256,consumedNonces,now=Date.now()}={}){
 const qa=verifyTaskQaAttestation({attestation:qaProof,qaPublicKeyPem,
   expectedSuiteSha256:expectedQaSuiteSha256,now});
 if(typeof ownerPublicKeyPem!=='string'||!ownerPublicKeyPem.startsWith('-----BEGIN PUBLIC KEY-----'))
   throw Error('OWNER_PUBLIC_KEY_NOT_ENROLLED');
 let key;try{key=createPublicKey(ownerPublicKeyPem);}catch{throw Error('OWNER_PUBLIC_KEY_INVALID');}
 if(key.asymmetricKeyType!=='ed25519')throw Error('OWNER_KEY_MUST_BE_ED25519');
 const qaKey=createPublicKey(qaPublicKeyPem);
 if(key.export({type:'spki',format:'der'}).equals(qaKey.export({type:'spki',format:'der'})))
   throw Error('QA_AND_OWNER_KEYS_MUST_DIFFER');
 if(!(consumedNonces instanceof Set))throw Error('PERSISTENT_REPLAY_STORE_REQUIRED');
 if(!approval||typeof approval!=='object'||Array.isArray(approval)||
   Object.keys(approval).sort().join('|')!=='action|expiresAt|issuedAt|missionId|nonce|qaAttestationSha256|qaLogSha256|signature|signer|stageManifestSha256|version')
   throw Error('APPROVAL_FORMAT_INVALID');
 const {signature,...raw}=approval;
 // Canonical field order is stable even when a JSON producer reorders keys.
 const message={version:raw.version,signer:raw.signer,action:raw.action,
   missionId:raw.missionId,stageManifestSha256:raw.stageManifestSha256,
   qaLogSha256:raw.qaLogSha256,qaAttestationSha256:raw.qaAttestationSha256,
   issuedAt:raw.issuedAt,expiresAt:raw.expiresAt,nonce:raw.nonce};
 if(message.version!=='constructor_owner_local_export_v2'||message.signer!=='OWNER'||
    message.action!=='export:local-review-only'||!ID.test(message.missionId??'')||
    !H.test(message.stageManifestSha256??'')||!H.test(message.qaLogSha256??'')||
    !H.test(message.qaAttestationSha256??'')||message.qaAttestationSha256!==qa.attestationSha256||
    message.stageManifestSha256!==qa.payload.stageManifestSha256||
    message.qaLogSha256!==qa.payload.qaLogSha256||message.missionId!==qa.payload.missionId||
    typeof message.nonce!=='string'||!/^[A-Za-z0-9_-]{12,80}$/.test(message.nonce)||
    !Number.isSafeInteger(message.issuedAt)||!Number.isSafeInteger(message.expiresAt)||
    !Number.isSafeInteger(now)||message.issuedAt>now+5000||message.expiresAt<=now||
    message.expiresAt-message.issuedAt>300000||message.expiresAt<=message.issuedAt)
   throw Error('APPROVAL_SCOPE_OR_TIME_DENIED');
 if(consumedNonces.has(message.nonce))throw Error('APPROVAL_REPLAY_DENIED');
 if(typeof signature!=='string'||!/^[A-Za-z0-9_-]{86}$/.test(signature))
   throw Error('APPROVAL_SIGNATURE_FORMAT');
 const payload=Buffer.from(JSON.stringify(message));
 if(!edVerify(null,payload,key,Buffer.from(signature,'base64url')))throw Error('OWNER_SIGNATURE_INVALID');
 consumedNonces.add(message.nonce);
 return Object.freeze({status:'OWNER_APPROVED_LOCAL_REVIEW_EXPORT_ONLY',
  missionId:message.missionId,qaAttestationSha256:qa.attestationSha256,
  qaIdentity:'SUPPLIED_KEY_NOT_INDEPENDENTLY_ENROLLED',
  approvalPayloadSha256:createHash('sha256').update(payload).digest('hex'),
  permission:'EXPORT_REVIEW_COPY_ONLY',productionDeployment:'DENIED',
  financialOperations:'DENIED',autonomousExecution:'DENIED'});
}
