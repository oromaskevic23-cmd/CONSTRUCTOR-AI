// Project author and founding architect: Alexander Nikolaevich Romaskevich (RomaskevicH).
// Signature verification only. A supplied public key is NOT automatically an enrolled trust root.
import {createHash,createPublicKey,verify} from 'node:crypto';

const H=/^[a-f0-9]{64}$/, ID=/^[A-Za-z0-9_-]{6,72}$/;
const FIELDS=['schema','missionId','stageManifestSha256','qaLogSha256','qaSuiteSha256',
  'execution','result','issuedAt','expiresAt'];

// Canonical field order is part of the external QA-signing contract.
export function taskQaPayload(input){
 if(!input||typeof input!=='object'||Array.isArray(input)||
    Object.keys(input).sort().join('|')!==[...FIELDS].sort().join('|'))
   throw Error('QA_ATTESTATION_FORMAT_INVALID');
 const p={schema:input.schema,missionId:input.missionId,
   stageManifestSha256:input.stageManifestSha256,qaLogSha256:input.qaLogSha256,
   qaSuiteSha256:input.qaSuiteSha256,execution:input.execution,result:input.result,
   issuedAt:input.issuedAt,expiresAt:input.expiresAt};
 if(p.schema!=='constructor_task_qa_attestation_v1'||!ID.test(p.missionId??'')||
    !H.test(p.stageManifestSha256??'')||!H.test(p.qaLogSha256??'')||!H.test(p.qaSuiteSha256??'')||
    p.execution!=='ISOLATED_DOCKER_NO_NETWORK'||p.result!=='INDEPENDENT_QA_PASSED'||
    !Number.isSafeInteger(p.issuedAt)||!Number.isSafeInteger(p.expiresAt)||
    p.expiresAt<=p.issuedAt||p.expiresAt-p.issuedAt>86400000)
   throw Error('QA_ATTESTATION_FIELDS_INVALID');
 return p;
}

export function verifyTaskQaAttestation({attestation,qaPublicKeyPem,expectedSuiteSha256,now=Date.now()}={}){
 if(!attestation||typeof attestation!=='object'||Array.isArray(attestation)||
    Object.keys(attestation).sort().join('|')!==[...FIELDS,'signature'].sort().join('|'))
   throw Error('QA_ATTESTATION_FORMAT_INVALID');
 const {signature,...unvalidated}=attestation;
 const payload=taskQaPayload(unvalidated);
 if(!Number.isSafeInteger(now)||payload.issuedAt>now+5000||payload.expiresAt<=now)
   throw Error('QA_ATTESTATION_EXPIRED_OR_FUTURE');
 if(!H.test(expectedSuiteSha256??'')||payload.qaSuiteSha256!==expectedSuiteSha256)
   throw Error('QA_SUITE_MISMATCH');
 if(typeof qaPublicKeyPem!=='string'||!qaPublicKeyPem.startsWith('-----BEGIN PUBLIC KEY-----'))
   throw Error('QA_PUBLIC_KEY_NOT_ENROLLED');
 let key;try{key=createPublicKey(qaPublicKeyPem);}catch{throw Error('QA_PUBLIC_KEY_INVALID');}
 if(key.asymmetricKeyType!=='ed25519')throw Error('QA_KEY_MUST_BE_ED25519');
 if(typeof signature!=='string'||!/^[A-Za-z0-9_-]{86}$/.test(signature))
   throw Error('QA_SIGNATURE_FORMAT');
 const canonical=JSON.stringify(payload);
 if(!verify(null,Buffer.from(canonical),key,Buffer.from(signature,'base64url')))
   throw Error('QA_SIGNATURE_INVALID');
 const attestationSha256=createHash('sha256')
   .update(JSON.stringify({...payload,signature})).digest('hex');
 return Object.freeze({payload,attestationSha256,
   status:'QA_SIGNATURE_VALID_FOR_SUPPLIED_KEY_NOT_INDEPENDENTLY_ATTESTED'});
}
