import test from "node:test";
import assert from "node:assert/strict";
import {generateKeyPairSync,createHash,sign} from "node:crypto";
import {PROOF_GRAPH_SCHEMA,evaluateIntentProofGraph} from "../engineering/intent-proof-graph.mjs";
import {PROOF_WITNESS_SCHEMA,witnessSigningPayload,verifyProofWitnesses,verifyWitnessedArtifactBytes,
  WitnessError} from "../engineering/proof-witness.mjs";

const builder=generateKeyPairSync("ed25519"),qa=generateKeyPairSync("ed25519");
const pem=key=>key.publicKey.export({format:"pem",type:"spki"}).toString();
const sha=key=>createHash("sha256").update(
  key.publicKey.export({format:"der",type:"spki"})).digest("hex");
function data() {
 const graph={schema:PROOF_GRAPH_SCHEMA,mission_id:"MIS-WITNESS-001",
   requirements:[{id:"REQ_CLI",acceptance:"The example application passes its local unit test command."}],
   evidence:[
     {id:"EVI_SRC",requirement_id:"REQ_CLI",kind:"SOURCE",status:"PASS",sha256:"a".repeat(64)},
     {id:"EVI_TST",requirement_id:"REQ_CLI",kind:"TEST",status:"PASS",sha256:"b".repeat(64)},
     {id:"EVI_QA1",requirement_id:"REQ_CLI",kind:"INDEPENDENT_QA",status:"PASS",sha256:"c".repeat(64)}
   ]};
 const trust={builder:{public_key_pem:pem(builder),pinned_spki_sha256:sha(builder)},
    qa:{public_key_pem:pem(qa),pinned_spki_sha256:sha(qa)}};
 const digest=evaluateIntentProofGraph(graph).graph_sha256;
 const now=1790000000000;
 const witnesses=graph.evidence.map((e,i)=>{
   const w={schema:PROOF_WITNESS_SCHEMA,mission_id:graph.mission_id,graph_sha256:digest,
     evidence_id:e.id,requirement_id:e.requirement_id,kind:e.kind,status:e.status,
     artifact_sha256:e.sha256,role:e.kind==="INDEPENDENT_QA"?"QA":"BUILDER",
     issued_at_ms:now-1000,expires_at_ms:now+60000,
     nonce:"NONCE_WITNESS_"+String(i).padStart(3,"0")};
   const sig=sign(null,witnessSigningPayload(w),w.role==="QA"?qa.privateKey:builder.privateKey);
   return {...w,signature_b64url:sig.toString("base64url")};
 });
 return {graph,witnesses,trust,now,consumedNonces:new Set()};
}
const fails=(d,code)=>assert.throws(()=>verifyProofWitnesses(d),e=>
  e instanceof WitnessError && e.code===code);
test("three bounded signatures verify without granting release",()=>{
 const a=data(),r=verifyProofWitnesses(a);
 assert.equal(r.signatures_verified,3);
 assert.equal(r.evidence_review,"READY_FOR_HUMAN_EVIDENCE_REVIEW");
 assert.equal(r.release,"DENIED");
 assert.equal(r.independent_qa_execution,"NOT_VERIFIED");
 assert.equal(r.artifact_byte_integrity,"NOT_VERIFIED");
 assert.equal(r.owner_approval,"NOT_VERIFIED");
 assert.equal(a.consumedNonces.size,3);
});
test("replay is rejected after successful verification",()=>{
 const a=data();verifyProofWitnesses(a);fails(a,"WITNESS_NONCE_REPLAY");
});
test("replay state is unchanged when later signature is invalid",()=>{
 const a=data();a.witnesses[2].signature_b64url="A".repeat(86);
 fails(a,"INVALID_WITNESS_SIGNATURE");
 assert.equal(a.consumedNonces.size,0);
});
test("tampered evidence digest cannot reuse a signature",()=>{
 const a=data();a.witnesses[0].artifact_sha256="d".repeat(64);
 fails(a,"WITNESS_GRAPH_BINDING_MISMATCH");
});
test("graph acceptance change invalidates all signed witnesses",()=>{
 const a=data();a.graph.requirements[0].acceptance+=" Proven again.";
 fails(a,"WITNESS_GRAPH_BINDING_MISMATCH");
});
test("signature on copied envelope does not verify mutated role",()=>{
 const a=data();a.witnesses[2].role="BUILDER";
 fails(a,"WITNESS_ROLE_MISMATCH");
});
test("QA key may not equal BUILDER key",()=>{
 const a=data();a.trust.qa=a.trust.builder;
 fails(a,"INDEPENDENT_KEY_REQUIRED");
});
test("unanchored QA public key is refused",()=>{
 const a=data();a.trust.qa.pinned_spki_sha256="f".repeat(64);
 fails(a,"PUBLIC_KEY_PIN_MISMATCH");
});
test("expired witness refused even if signature is valid",()=>{
 const a=data();a.now+=70000;
 fails(a,"WITNESS_EXPIRED_OR_FUTURE");
});
test("future witness refused",()=>{
 const a=data();a.now-=7000;
 fails(a,"WITNESS_EXPIRED_OR_FUTURE");
});
test("missing signed proof is fail closed",()=>{
 const a=data();a.witnesses.pop();
 fails(a,"WITNESS_COUNT_MISMATCH");
});
test("duplicate signed proof is fail closed",()=>{
 const a=data();a.witnesses[1]=a.witnesses[0];
 fails(a,"UNBOUND_OR_DUPLICATE_WITNESS");
});
test("separate signature bytes are required",()=>{
 const a=data();a.witnesses[1].signature_b64url="garbage";
 fails(a,"INVALID_SIGNATURE_FORMAT");
});
test("non-ed25519 key cannot assert QA role",()=>{
 const a=data();const ecc=generateKeyPairSync("ec",{namedCurve:"prime256v1"});
 a.trust.qa={public_key_pem:pem(ecc),pinned_spki_sha256:sha(ecc)};
 fails(a,"ED25519_KEY_REQUIRED");
});
test("extra field declaring release approval is refused",()=>{
 const a=data();a.witnesses[0].release="APPROVED";
 fails(a,"INVALID_WITNESS_ENVELOPE");
});
test("nonce cannot be silently reused across two evidence IDs",()=>{
 const a=data();a.witnesses[2].nonce=a.witnesses[0].nonce;
 // re-sign the mutated nonce with correct QA key, ensuring replay check (not signature) detects it
 const {signature_b64url,...body}=a.witnesses[2];
 a.witnesses[2].signature_b64url=sign(null,witnessSigningPayload(body),qa.privateKey).toString("base64url");
 fails(a,"WITNESS_NONCE_REPLAY");
 assert.equal(a.consumedNonces.size,0);
});
test("witness signature is strictly domain/schema bound",()=>{
 const a=data();a.witnesses[0].schema="other_witness_schema_v1";
 fails(a,"INVALID_SIGNING_PAYLOAD");
});
test("caller cannot omit externally supplied trust pins",()=>{
 const a=data();delete a.trust.qa.pinned_spki_sha256;
 fails(a,"INVALID_TRUST_RECORD");
});
test("graph missing QA stays blocked, even with valid two signatures",()=>{
 const a=data();a.graph.evidence=a.graph.evidence.slice(0,2);
 const d=evaluateIntentProofGraph(a.graph).graph_sha256;
 const w=a.witnesses.slice(0,2).map((v,i)=>{
   const {signature_b64url,...body}=v;
   body.graph_sha256=d;
   return {...body,signature_b64url:sign(null,witnessSigningPayload(body),builder.privateKey).toString("base64url")};
 });
 const r=verifyProofWitnesses({...a,witnesses:w});
 assert.equal(r.evidence_review,"BLOCKED_MISSING_OR_FAILED_EVIDENCE");
 assert.equal(r.release,"DENIED");
});

function fixtureWithActualBytes(){
 const a=data(),bytesById=new Map();
 const {signature_b64url:_,...unused}=a.witnesses[0];
 for(const [i,e] of a.graph.evidence.entries()){
   const bytes=Buffer.from("SYNTHETIC_ONLY::"+e.id+"::"+e.kind);
   e.sha256=createHash("sha256").update(bytes).digest("hex");
   bytesById.set(e.id,bytes);
 }
 const ghash=evaluateIntentProofGraph(a.graph).graph_sha256;
 a.witnesses=a.graph.evidence.map((e,i)=>{
   const {signature_b64url,...body}=a.witnesses[i];
   body.graph_sha256=ghash;
   body.artifact_sha256=e.sha256;
   return {...body,signature_b64url:sign(null,witnessSigningPayload(body),
     body.role==="QA"?qa.privateKey:builder.privateKey).toString("base64url")};
 });
 return {...a,artifactBytesById:bytesById};
}
test("signed graph can check actual caller-presented bytes, not provenance",()=>{
 const a=fixtureWithActualBytes(),r=verifyWitnessedArtifactBytes(a);
 assert.equal(r.artifact_byte_integrity,"CALLER_BYTES_MATCH_SHA256");
 assert.equal(r.byte_provenance,"CALLER_SUPPLIED_UNATTESTED");
 assert.equal(r.release,"DENIED");
 assert.equal(a.consumedNonces.size,3);
});
test("changed artifact bytes fail before any nonce is consumed",()=>{
 const a=fixtureWithActualBytes();
 a.artifactBytesById.set("EVI_QA1",Buffer.from("fake substitute"));
 assert.throws(()=>verifyWitnessedArtifactBytes(a),
   e=>e instanceof WitnessError && e.code==="ARTIFACT_BYTES_DIGEST_MISMATCH");
 assert.equal(a.consumedNonces.size,0);
});
test("missing artifact is always blocked",()=>{
 const a=fixtureWithActualBytes();a.artifactBytesById.delete("EVI_SRC");
 assert.throws(()=>verifyWitnessedArtifactBytes(a),
   e=>e instanceof WitnessError && e.code==="ARTIFACT_BYTE_COVERAGE_MISMATCH");
});
test("overlarge bytes rejected before signing checks",()=>{
 const a=fixtureWithActualBytes();a.artifactBytesById.set("EVI_TST",Buffer.alloc(65537));
 assert.throws(()=>verifyWitnessedArtifactBytes(a),
   e=>e instanceof WitnessError && e.code==="INVALID_ARTIFACT_BYTES");
});
test("extra unbound byte data cannot smuggle a new artifact",()=>{
 const a=fixtureWithActualBytes();a.artifactBytesById.set("IMPOSTOR",Buffer.from("secret"));
 assert.throws(()=>verifyWitnessedArtifactBytes(a),
   e=>e instanceof WitnessError && e.code==="ARTIFACT_BYTE_COVERAGE_MISMATCH");
});
test("bytes alone never bypass a mismatched signature",()=>{
 const a=fixtureWithActualBytes();a.witnesses[1].signature_b64url="A".repeat(86);
 assert.throws(()=>verifyWitnessedArtifactBytes(a),
   e=>e instanceof WitnessError && e.code==="INVALID_WITNESS_SIGNATURE");
 assert.equal(a.consumedNonces.size,0);
});
