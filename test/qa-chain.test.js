import test from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {PROOF_GRAPH_SCHEMA} from "../engineering/intent-proof-graph.mjs";
import {signCIEnvelope,verifyCIEnvelope,verifyBuilderEnvelope,verifyQAChain,
  qaPayloadFromRun,qaSourceFor,QAChainError} from "../engineering/qa-chain.mjs";
const sha=x=>createHash("sha256").update(x).digest("hex");
const fixture=()=>{
 const source='import test from "node:test";test("build test",()=>{});';
 const mission_id="MISSION-QA-001",requirement_id="REQ_001",acceptance="A bounded test executes correctly under the isolated runner.";
 const id="sha256:"+"a".repeat(64);
 const receipt=(src,name)=>({
   schema:"constructor_isolated_execution_receipt_v1",mission_id,requirement_id,
   runner:"LOCAL_DOCKER_NODE_TEST",container_image_id:id,executable:"node",
   arguments:["--test","--test-reporter=tap","/work/test.mjs"],
   isolation:{network:"none"},source_sha256:sha(Buffer.from(src)),exit_code:0,
   stdout:"# tests 1\n# pass 1\n# fail 0\n"+name+"\n",stderr:"",
   stdout_sha256:sha(Buffer.from("# tests 1\n# pass 1\n# fail 0\n"+name+"\n")),
   stderr_sha256:sha(Buffer.alloc(0)),status:"PASS",
   untrusted_code_execution:"CONTAINER_EXECUTED_NOT_VM_ATTESTED",
   independent_qa:"NOT_RUN",release:"DENIED"
 });
 const br=receipt(source,"builder");
 const graph={schema:PROOF_GRAPH_SCHEMA,mission_id,requirements:[{id:requirement_id,acceptance}],
   evidence:[
     {id:"EVID_SOURCE",requirement_id,kind:"SOURCE",status:"PASS",sha256:sha(Buffer.from(source))},
     {id:"EVID_TEST",requirement_id,kind:"TEST",status:"PASS",sha256:sha(Buffer.from(JSON.stringify(br)))}
   ]};
 const builder=signCIEnvelope({role:"BUILDER",payload:{
   schema:"constructor_ci_builder_v1",mission_id,requirement_id,acceptance,
   source_b64:Buffer.from(source).toString("base64"),execution_receipt:br,graph}});
 const qaSrc=qaSourceFor(source),qr=receipt(qaSrc,"independent-qa");
 const qa=signCIEnvelope({role:"QA",payload:qaPayloadFromRun(builder,{receipt:qr,release:"DENIED"},qaSrc)});
 return {schema:"constructor_ci_chain_v1",builder,qa};
};
const rejects=(a,code)=>assert.throws(()=>verifyQAChain(a),err=>
  err instanceof QAChainError&&err.code===code);
test("two signed job records form complete reviewable graph, never release",()=>{
 const r=verifyQAChain(fixture());
 assert.equal(r.evidence_review,"READY_FOR_HUMAN_EVIDENCE_REVIEW");
 assert.equal(r.release,"DENIED");
 assert.equal(r.owner_approval,"NOT_VERIFIED");
 assert.equal(r.vm_attestation,"NOT_VERIFIED");
 assert.match(r.separation,/NOT_EXTERNAL_AUDIT/);
});
test("role-specific signatures verify independently",()=>{
 const a=fixture();
 assert.equal(verifyCIEnvelope(a.builder,"BUILDER"),true);
 assert.equal(verifyCIEnvelope(a.qa,"QA"),true);
});
test("changed builder source cannot be silently attached",()=>{
 const a=fixture();a.builder.payload.source_b64=Buffer.from("attack").toString("base64");
 rejects(a,"CI_SIGNATURE_INVALID");
});
test("changed builder receipt stdout cannot be silently attached",()=>{
 const a=fixture();a.builder.payload.execution_receipt.stdout="not really";
 rejects(a,"CI_SIGNATURE_INVALID");
});
test("changed QA log invalidates detached QA signature",()=>{
 const a=fixture();a.qa.payload.qa_execution_receipt.stderr="wrong";
 rejects(a,"CI_SIGNATURE_INVALID");
});

test("QA key material reused for builder role is detected",()=>{
 const a=fixture();
 a.qa.public_key_pem=a.builder.public_key_pem;
 a.qa.spki_sha256=a.builder.spki_sha256;
 rejects(a,"CI_SIGNATURE_INVALID");
});
test("wrong predecessor hash makes QA report invalid",()=>{
 const a=fixture();
 a.qa.payload.builder_envelope_sha256="0".repeat(64);
 rejects(a,"CI_SIGNATURE_INVALID");
});
test("cross-mission copied QA evidence is rejected",()=>{
 const a=fixture();const old=a.qa.payload;
 const changed={...old,qa_execution_receipt:{...old.qa_execution_receipt,mission_id:"MISSION-OTHER"}};
 a.qa=signCIEnvelope({role:"QA",payload:changed});
 rejects(a,"QA_SOURCE_OR_MISSION_MISMATCH");
});
test("self-signed forged QA graph still checked against real builder graph",()=>{
 const a=fixture(),p=a.qa.payload;
 a.qa=signCIEnvelope({role:"QA",payload:{
   ...p,graph:{...p.graph,evidence:p.graph.evidence.slice(0,2)}}});
 rejects(a,"QA_GRAPH_MISMATCH");
});
test("QA script may not be substituted for an easier one",()=>{
 const a=fixture(),p=a.qa.payload;
 const newSrc="test('easy',()=>{})";
 a.qa=signCIEnvelope({role:"QA",payload:{
   ...p,qa_source_b64:Buffer.from(newSrc).toString("base64")}});
 rejects(a,"QA_SOURCE_OR_MISSION_MISMATCH");
});
test("failed QA process cannot be marked PASS",()=>{
 const a=fixture(),p=a.qa.payload;
 a.qa=signCIEnvelope({role:"QA",payload:{
   ...p,qa_execution_receipt:{...p.qa_execution_receipt,status:"FAIL",exit_code:1}}});
 rejects(a,"QA_RECEIPT_INCOMPLETE");
});
test("mocked Docker adapter cannot impersonate real executor",()=>{
 const a=fixture(),p=a.builder.payload;
 a.builder=signCIEnvelope({role:"BUILDER",payload:{
   ...p,execution_receipt:{...p.execution_receipt,runner:"INJECTED_TEST_ADAPTER"}}});
 rejects(a,"BUILDER_RECEIPT_INCOMPLETE");
});
test("public key cannot be swapped to another identity",()=>{
 const a=fixture();a.qa.spki_sha256="f".repeat(64);
 rejects(a,"CI_KEY_PIN_MISMATCH");
});
test("no QA envelope is never a passed verification",()=>{
 const a=fixture();delete a.qa;
 rejects(a,"INVALID_QA_CHAIN");
});
test("extra release field cannot override deny-by-default",()=>{
 const a=fixture();a.owner_approved=true;
 rejects(a,"INVALID_QA_CHAIN");
});
test("invalid source bytes are rejected",()=>{
 const a=fixture();
 a.builder.payload.source_b64="!!!";
 rejects(a,"CI_SIGNATURE_INVALID");
});
test("QA append enforces extra independently defined acceptance test",()=>{
 const s=qaSourceFor('import test from "node:test";');
 assert(s.includes('QA-owned acceptance assertion'));
 assert(s.includes('process.getuid()'));
});
