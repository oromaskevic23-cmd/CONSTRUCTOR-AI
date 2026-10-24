import test from "node:test";
import assert from "node:assert/strict";
import {generateGroqDraft,ModelGatewayError} from "../engineering/groq-gateway.mjs";
import {issueLocalDraftPermit} from "../engineering/local-permit.mjs";
import {runPlanOnlyMission} from "../engineering/plan-only.mjs";

const key = "gsk_TEST_ONLY_VALID_LENGTH_NOT_REAL_TOKEN_1234";
const model = "openai/gpt-oss-20b";
const mission = {id:"mission-123",goal:"Make a small offline task app",allowModel:true};
const draft = {schema:"constructor_draft_v1",summary:"Generate a task tracker",steps:[{id:"step-1",action:"Design local state",acceptance:"Can add and list tasks"}],files:[{path:"src/main.js",content:"export const task = true;"}]};
const reply = (body = draft, finish = "stop", status = 200) => new Response(JSON.stringify({id:"chat-test",choices:[{finish_reason:finish,message:{role:"assistant",content:JSON.stringify(body)}}]}),{status,headers:{"Content-Type":"application/json"}});
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
  await assert.rejects(()=>generateGroqDraft({...options,fetchImpl:async()=>new Response("x".repeat(96001),{status:200})}),/TOO_LARGE/);
});
test("valid local permit gates a plan-only provider call and stops replay",async()=>{
  const secret="local-demo-signing-secret-not-production-001";
  const now=1770000000000, consumedNonces=new Set();
  const permit=issueLocalDraftPermit({missionId:mission.id,secret,now,ttlMs:2000,nonce:"nonce-unique-test-01"});
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
