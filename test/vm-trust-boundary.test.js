import test from "node:test";
import assert from "node:assert/strict";
import {createHash,generateKeyPairSync,sign} from "node:crypto";
import {vmReceiptSigningBytes,assessProtectedVMClaim,VMGateError} from "../engineering/vm-trust-boundary.mjs";
const sha=b=>createHash("sha256").update(b).digest("hex");
function fixture(){
 const kp=generateKeyPairSync("ed25519");
 const sourceBytes=Buffer.from("test source submitted to VM");
 const testLogBytes=Buffer.from("test output claimed from VM");
 const now=1790000000000;
 const receipt={schema:"constructor_vm_execution_claim_v1",mission_id:"MISSION-VM-001",
  vm_image_sha256:"a".repeat(64),source_sha256:sha(sourceBytes),
  test_log_sha256:sha(testLogBytes),exit_code:0,network_policy:"DENY_ALL",
  isolation_claim:"VM_GUEST_CLAIMED_NOT_HARDWARE_ATTESTED",
  issued_at_ms:now-1000,nonce:"VM_NONCE_1234567890123",release:"DENIED"};
 return {receipt,signature_b64url:sign(null,vmReceiptSigningBytes(receipt),kp.privateKey).toString("base64url"),
  trusted_operator_public_key_pem:kp.publicKey.export({type:"spki",format:"pem"}).toString(),
  trusted_operator_spki_sha256:sha(kp.publicKey.export({type:"spki",format:"der"})),
  sourceBytes,testLogBytes,expectedMission:receipt.mission_id,now,consumedNonces:new Set()};
}
const reject=(x,code)=>assert.throws(()=>assessProtectedVMClaim(x),
 e=>e instanceof VMGateError&&e.code===code);
test("synthetic signed operator claim never becomes hardware attestation",()=>{
 const a=fixture(),r=assessProtectedVMClaim(a);
 assert.equal(r.release,"DENIED");
 assert.equal(r.guest_attestation,"NOT_VERIFIED");
 assert.equal(a.consumedNonces.size,1);
});
test("replay nonce rejected after first review",()=>{
 const a=fixture();assessProtectedVMClaim(a);reject(a,"VM_REPLAY_UNSAFE");
});
test("tampered source bytes rejected",()=>{
 const a=fixture();a.sourceBytes=Buffer.from("tampered");
 reject(a,"VM_BYTES_NOT_BOUND_TO_RECEIPT");
});
test("tampered test log bytes rejected",()=>{
 const a=fixture();a.testLogBytes=Buffer.from("tampered");
 reject(a,"VM_BYTES_NOT_BOUND_TO_RECEIPT");
});
test("signature alteration rejected",()=>{
 const a=fixture();a.signature_b64url="A".repeat(86);
 reject(a,"BAD_VM_OPERATOR_SIGNATURE");
});
test("operator key cannot be swapped",()=>{
 const a=fixture();a.trusted_operator_spki_sha256="f".repeat(64);
 reject(a,"VM_OPERATOR_KEY_PIN_MISMATCH");
});
test("wrong mission rejected",()=>{
 const a=fixture();a.expectedMission="MISSION-OTHER";
 reject(a,"VM_MISSION_OR_TIME_MISMATCH");
});
test("old guest claim rejected",()=>{
 const a=fixture();a.now+=360000;
 reject(a,"VM_MISSION_OR_TIME_MISMATCH");
});
test("no trust root rejected",()=>{
 const a=fixture();delete a.trusted_operator_public_key_pem;
 reject(a,"EXTERNALLY_PINNED_VM_TRUST_REQUIRED");
});
test("owner-approved extra field rejected",()=>{
 const a=fixture();a.receipt.owner_approval="APPROVED";
 reject(a,"INVALID_VM_CLAIM");
});
test("container-only isolation not a VM claim",()=>{
 const a=fixture();a.receipt.isolation_claim="DOCKER_CONTAINER";
 reject(a,"INVALID_VM_CLAIM");
});
test("unsigned fail result cannot be accepted",()=>{
 const a=fixture();a.receipt.exit_code=1;
 reject(a,"INVALID_VM_CLAIM");
});
