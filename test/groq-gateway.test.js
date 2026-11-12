// Project author and founding architect: Alexander Nikolaevich Romaskevich (RomaskevicH).
import test from "node:test";
import assert from "node:assert/strict";
import {DRAFT_ENVELOPE_BYTES} from '../engineering/model-response-boundary.mjs';
import {generateGroqDraft,ModelGatewayError} from "../engineering/groq-gateway.mjs";
import {issueLocalDraftPermit,ROUTE_GROQ_PLAN} from "../engineering/local-permit.mjs";
import {runPlanOnlyMission} from "../engineering/plan-only.mjs";

const key = "gsk_TEST_ONLY_VALID_LENGTH_NOT_REAL_TOKEN_1234";
const model = "openai/gpt-oss-20b";
const mission = {id:"mission-123",goal:"Make a small offline task app",allowModel:true};
const draft = {schema:"constructor_draft_v1",summary:"Generate a task tracker",steps:[{id:"step-1",action:"Design local state",acceptance:"Can add and list tasks"}],files:[{path:"src/main.js",content:"export const task = true;"}]};
const reply = (body = draft, finish = "stop", status = 200) => new Response(JSON.stringify({id:"chat-test",model,choices:[{finish_reason:finish,message:{role:"assistant",content:JSON.stringify(body)}}]}),{status,headers:{"Content-Type":"application/json"}});
const options = {mission,apiKey:key,model};

test("mock Groq POST uses fixed HTTPS origin and no tools",async()=>{
  let calls=0;
  const result=await generateGroqDraft({...options,fetchImpl:async(url,req)=>{
    calls++;
    assert.equal(url,"https://api.groq.com/openai/v1/chat/completions");
    assert.equal(req.method,"POST");
    assert.equal(req.redirect,"error");
    assert.equal(req.headers.Authorization,"Bearer "+key);
    const body=JSON.parse(req.body);
    assert.equal(body.model,model);
    assert.equal(body.messages[1].role,"user");
    assert.equal(body.stream,false);
    assert.equal(body.tools,undefined);
    return reply();
  }});
  assert.equal(calls,1);
  assert.equal(result.status,"DRAFT_VALIDATED_NOT_EXECUTED");
  assert.equal(result.sandbox_execution,"NOT_RUN");
  assert.equal(result.independent_qa,"NOT_RUN");
  assert.equal(result.release,"DENIED");
  assert.equal(result.draft.files[0].path,"src/main.js");
  assert.equal(JSON.stringify(result).includes(key),false);
});
test("no provider request with invalid key",async()=>{
  let called=false;
  await assert.rejects(()=>generateGroqDraft({...options,apiKey:"bad",fetchImpl:async()=>{called=true;return reply();}}),/BLOCKED_INVALID_OR_MISSING_GROQ_KEY/);
  assert.equal(called,false);
});
test("no provider request without configured model",async()=>{
  let called=false;
  await assert.rejects(()=>generateGroqDraft({...options,model:"",fetchImpl:async()=>{called=true;return reply();}}),/BLOCKED_MODEL_NOT_CONFIGURED/);
  assert.equal(called,false);
});
test("denied mission blocks before network",async()=>{
  let called=false;
  await assert.rejects(()=>generateGroqDraft({...options,mission:{...mission,allowModel:false},fetchImpl:async()=>{called=true;return reply();}}),/authorize/);
  assert.equal(called,false);
});
test("rejects rate-limit, authentication failures and incomplete provider responses",async()=>{
  for(const [status,msg] of [[401,"PROVIDER_CREDENTIAL_REJECTED"],[429,"PROVIDER_RATE_LIMITED"],[503,"PROVIDER_HTTP_FAILED"]]){
    await assert.rejects(()=>generateGroqDraft({...options,fetchImpl:async()=>reply(draft,"stop",status)}),new RegExp(msg));
  }
  await assert.rejects(()=>generateGroqDraft({...options,fetchImpl:async()=>reply(draft,"length")}),/INCOMPLETE/);
});
test("rejects fake successful responses without a valid draft",async()=>{
  await assert.rejects(()=>generateGroqDraft({...options,fetchImpl:async()=>reply({...draft,schema:"wrong"})}),/schema/);
  await assert.rejects(()=>generateGroqDraft({...options,fetchImpl:async()=>new Response("{}",{status:200})}),/INCOMPLETE/);
});
test("upstream errors and secret-bearing exceptions are not revealed",async()=>{
  await assert.rejects(()=>generateGroqDraft({...options,fetchImpl:async()=>{throw Error("SENSITIVE "+key);}}),(err)=>{
    assert.equal(err.code,"PROVIDER_TRANSPORT_FAILED");
    assert.equal(err.message.includes(key),false);
    return true;
  });
});
test("oversized provider payload fails closed",async()=>{
  await assert.rejects(()=>generateGroqDraft({...options,fetchImpl:async()=>new Response("x".repeat(DRAFT_ENVELOPE_BYTES+1),{status:200})}),/TOO_LARGE/);
});
test("valid local permit gates a plan-only provider call and stops replay",async()=>{
  const secret="local-demo-signing-secret-not-production-001";
  const now=1770000000000, consumedNonces=new Set();
  const permit=issueLocalDraftPermit({mission,route:ROUTE_GROQ_PLAN,model,secret,now,ttlMs:2000,nonce:"nonce-unique-test-01"});
  const run=()=>runPlanOnlyMission({...options,permit,permitSecret:secret,now:now+1,consumedNonces,fetchImpl:async()=>reply()});
  const result=await run();
  assert.equal(result.authorization.status,"LOCAL_HMAC_PERMIT_VERIFIED");
  assert.equal(result.release,"DENIED");
  await assert.rejects(run,/REPLAY_DETECTED/);
});
test("permit failure blocks provider call",async()=>{
  let called=false;
  await assert.rejects(()=>runPlanOnlyMission({...options,permit:"bad",permitSecret:"local-demo-signing-secret-not-production-001",consumedNonces:new Set(),fetchImpl:async()=>{called=true;return reply();}}),/PERMIT/);
  assert.equal(called,false);
});
test("goal and model substitution are denied before any Groq request",async()=>{
  const secret="local-demo-signing-secret-not-production-001",now=1770000000000;
  const permit=issueLocalDraftPermit({mission,route:ROUTE_GROQ_PLAN,model,secret,now});
  let calls=0;
  const base={...options,permit,permitSecret:secret,now:now+1,
    consumedNonces:new Set(),fetchImpl:async()=>{calls++;return reply();}};
  await assert.rejects(runPlanOnlyMission({...base,mission:{...mission,goal:"Create a different application"}}),/SCOPE/);
  await assert.rejects(runPlanOnlyMission({...base,model:"other-model"}),/SCOPE/);
  assert.equal(calls,0);
});

test("Groq reports usage separately and rejects over-budget or wrong model receipts",async()=>{
 const response=(usage,returned=model)=>new Response(JSON.stringify({model:returned,usage,choices:[{finish_reason:"stop",message:{content:JSON.stringify(draft)}}]}));
 const r=await generateGroqDraft({...options,fetchImpl:async()=>response({prompt_tokens:100,completion_tokens:40})});
 assert.deepEqual(r.usage.measured,{input_tokens:100,output_tokens:40});assert.equal(r.usage.requested_output_tokens,4000);assert.equal(r.returned_model,model);
 await assert.rejects(generateGroqDraft({...options,fetchImpl:async()=>response({prompt_tokens:1,completion_tokens:4001})}),/OVER_BUDGET/);
 await assert.rejects(generateGroqDraft({...options,fetchImpl:async()=>response({prompt_tokens:1,completion_tokens:2},"other")}),/MODEL_MISMATCH/);
 const missing=await generateGroqDraft({...options,fetchImpl:async()=>reply()});assert.equal(missing.usage.measured,null);
});
test("402 and 429 are terminal, with bounded retry-after metadata",async()=>{
 let calls=0;for(const status of [402,429])await assert.rejects(generateGroqDraft({...options,fetchImpl:async()=>{calls++;return new Response("sensitive response",{status,headers:{"Retry-After":"30"}});}}),e=>e.code===(status===402?"PROVIDER_PAYMENT_REQUIRED":"PROVIDER_RATE_LIMITED")&&(status!==429||e.retryAfterSeconds===30));assert.equal(calls,2);
});

test("failed provider call emits safe observation even when rate limited",async()=>{let observed;await assert.rejects(generateGroqDraft({...options,onObservation:o=>{observed=o;},fetchImpl:async()=>new Response("private error",{status:429})}),/RATE_LIMITED/);assert.equal(observed.measured,null);assert.equal(observed.measured_null_reason,"HTTP_REJECTED_BEFORE_USAGE");assert.equal(observed.bytes_read,0);assert.equal(JSON.stringify(observed).includes("private error"),false);});
