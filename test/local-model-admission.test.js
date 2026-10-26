import test from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {admitLocalGGUFObservation,LocalModelError} from "../engineering/local-model-admission.mjs";
const sha=s=>createHash("sha256").update(s).digest("hex");
const goal="Create a minimal arithmetic JavaScript module.";
const draft=JSON.stringify({schema:"constructor_draft_v1",summary:"Minimal arithmetic example.",
 steps:[{id:"implement",action:"Write a single function.",acceptance:"The function adds two numbers."}],
 files:[{path:"app.mjs",content:"export const add = (a,b) => a+b;"}]});
const fixture=()=>({schema:"constructor_local_gguf_observation_v1",
 model_id:"Qwen/Qwen2.5-Coder-0.5B-Instruct-GGUF:q4_0",
 model_sha256:"9739055e046d62a937e5b7879012209ef40ebea8a1569a96028de491f3f091d5",
 input_sha256:sha(goal),response_sha256:sha(draft),finish_reason:"stop",
 response_text:draft,provider:"LOCAL_LLAMA_CPP_PYTHON",
 inference_attempted:true,model_generated_files_executed:false,release:"DENIED"});
const rejects=(r,code)=>assert.throws(()=>admitLocalGGUFObservation(r,{goal}),
  e=>e instanceof LocalModelError&&e.code===code);
test("synthetic observation admitted for review, not execution",()=>{
 const x=admitLocalGGUFObservation(fixture(),{goal});
 assert.equal(x.release,"DENIED");assert.equal(x.source_execution,"NOT_RUN");
 assert.equal(x.real_inference_attestation,"NOT_EXTERNALLY_VERIFIED");
});
test("model pin cannot change",()=>{const x=fixture();x.model_sha256="f".repeat(64);
 rejects(x,"UNTRUSTED_MODEL_REPORT");});
test("cannot claim owner-approved code",()=>{const x=fixture();x.owner_approved=true;
 rejects(x,"UNTRUSTED_MODEL_REPORT");});
test("truncation always blocked",()=>{const x=fixture();x.finish_reason="length";
 rejects(x,"INCOMPLETE_MODEL_OUTPUT");});
test("modified model bytes cannot be admitted",()=>{const x=fixture();x.response_text+="x";
 rejects(x,"INCOMPLETE_MODEL_OUTPUT");});
test("wrong user mission refused",()=>{const x=fixture();x.input_sha256="a".repeat(64);
 rejects(x,"INCOMPLETE_MODEL_OUTPUT");});
test("non-JSON response rejected",()=>{const x=fixture();x.response_text="plain natural language";
 x.response_sha256=sha(x.response_text);rejects(x,"MODEL_DRAFT_CONTRACT_REJECTED");});
test("model producing zero source files rejected",()=>{const x=fixture();x.response_text=JSON.stringify({...JSON.parse(draft),files:[]});
 x.response_sha256=sha(x.response_text);rejects(x,"NO_GENERATED_FILES");});
test("model output with secret-looking string is blocked",()=>{const x=fixture();
 const d=JSON.parse(draft);d.files[0].content="const key='gsk_"+ "A".repeat(25) +"';";
 x.response_text=JSON.stringify(d);x.response_sha256=sha(x.response_text);
 rejects(x,"UNSAFE_UNTRUSTED_SOURCE");});
test("network-using output requires security review",()=>{const x=fixture();
 const d=JSON.parse(draft);d.files[0].content="fetch('https://example.com');";
 x.response_text=JSON.stringify(d);x.response_sha256=sha(x.response_text);
 rejects(x,"UNSAFE_UNTRUSTED_SOURCE");});
