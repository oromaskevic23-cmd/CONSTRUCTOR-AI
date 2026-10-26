// Protected-VM admission gate: verify an EXTERNALLY enrolled operator key
// before any VM result can be considered for engineering review.
// This module DOES NOT launch or attest a VM and NEVER approves releases.
import {createHash,createPublicKey,verify} from "node:crypto";
const SHA=/^[a-f0-9]{64}$/;
const SIG=/^[A-Za-z0-9_-]{86}$/;
const FIELDS=["schema","mission_id","vm_image_sha256","source_sha256",
 "test_log_sha256","exit_code","network_policy","isolation_claim",
 "issued_at_ms","nonce","release"];
const exact=(x,k)=>x&&typeof x==="object"&&!Array.isArray(x)&&
 Object.getPrototypeOf(x)===Object.prototype&&Object.keys(x).length===k.length&&
 k.every(z=>Object.hasOwn(x,z));
const hash=b=>createHash("sha256").update(b).digest("hex");
export class VMGateError extends Error{
 constructor(code){super(code);this.name="VMGateError";this.code=code;}
}
export function vmReceiptSigningBytes(receipt){
 if(!exact(receipt,FIELDS)||receipt.schema!=="constructor_vm_execution_claim_v1"||
    !/^[A-Za-z0-9_-]{6,72}$/.test(receipt.mission_id??"")||
    !SHA.test(receipt.vm_image_sha256??"")||
    !SHA.test(receipt.source_sha256??"")||!SHA.test(receipt.test_log_sha256??"")||
    !Number.isSafeInteger(receipt.issued_at_ms)||
    !/^[A-Za-z0-9_-]{16,96}$/.test(receipt.nonce??"")||
    receipt.exit_code!==0||receipt.network_policy!=="DENY_ALL"||
    receipt.isolation_claim!=="VM_GUEST_CLAIMED_NOT_HARDWARE_ATTESTED"||
    receipt.release!=="DENIED")
   throw new VMGateError("INVALID_VM_CLAIM");
 return Buffer.from(JSON.stringify(Object.fromEntries(FIELDS.map(k=>[k,receipt[k]]))),"utf8");
}
export function assessProtectedVMClaim({receipt,signature_b64url,
  trusted_operator_public_key_pem,trusted_operator_spki_sha256,
  sourceBytes,testLogBytes,expectedMission,now=Date.now(),consumedNonces}={}){
 const payload=vmReceiptSigningBytes(receipt);
 if(!Buffer.isBuffer(sourceBytes)||!Buffer.isBuffer(testLogBytes)||
    !sourceBytes.length||sourceBytes.length>32768||
    !testLogBytes.length||testLogBytes.length>32768||
    hash(sourceBytes)!==receipt.source_sha256||
    hash(testLogBytes)!==receipt.test_log_sha256)
   throw new VMGateError("VM_BYTES_NOT_BOUND_TO_RECEIPT");
 if(receipt.mission_id!==expectedMission||
    !Number.isSafeInteger(now)||receipt.issued_at_ms>now+5000||
    now-receipt.issued_at_ms>300000)
   throw new VMGateError("VM_MISSION_OR_TIME_MISMATCH");
 if(!(consumedNonces instanceof Set)||consumedNonces.has(receipt.nonce))
   throw new VMGateError("VM_REPLAY_UNSAFE");
 if(!SHA.test(trusted_operator_spki_sha256??"")||
    typeof trusted_operator_public_key_pem!=="string"||
    trusted_operator_public_key_pem.length>4096||
    !SIG.test(signature_b64url??""))
   throw new VMGateError("EXTERNALLY_PINNED_VM_TRUST_REQUIRED");
 let key;
 try{key=createPublicKey(trusted_operator_public_key_pem);}
 catch{throw new VMGateError("INVALID_VM_OPERATOR_KEY");}
 if(key.asymmetricKeyType!=="ed25519"||
    hash(key.export({format:"der",type:"spki"}))!==trusted_operator_spki_sha256)
   throw new VMGateError("VM_OPERATOR_KEY_PIN_MISMATCH");
 if(!verify(null,payload,key,Buffer.from(signature_b64url,"base64url")))
   throw new VMGateError("BAD_VM_OPERATOR_SIGNATURE");
 consumedNonces.add(receipt.nonce);
 return Object.freeze({schema:"constructor_vm_claim_assessment_v1",
   signature:"EXTERNAL_PUBLIC_KEY_PIN_MATCH_AND_SIGNATURE_VERIFIED",
   source_bytes:"SHA256_MATCH",log_bytes:"SHA256_MATCH",
   guest_attestation:"NOT_VERIFIED",
   vm_provider_identity:"OPERATOR_KEY_NOT_HARDWARE_VM_IDENTITY",
   execution:"REVIEW_ONLY_NO_VM_LAUNCHED_BY_THIS_MODULE",
   independent_qa:"NOT_VERIFIED",owner_approval:"NOT_VERIFIED",
   release:"DENIED"});
}
