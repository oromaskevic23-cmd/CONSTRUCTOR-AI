import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {generateFreeLLMAPIDraft,resolveFreeLLMAPIEndpoint} from "../engineering/freellmapi-gateway.mjs";
import {issueLocalDraftPermit} from "../engineering/local-permit.mjs";
import {runPlanOnlyMission} from "../engineering/plan-only.mjs";
import {quarantineDraft,verifyProofBundle} from "../engineering/proof-bundle.mjs";

const mission={id:"proxy-test-mission",goal:"Build an offline task tracker",allowModel:true};
const draft={schema:"constructor_draft_v1",summary:"Build a task tracker",steps:[
  {id:"s1",action:"Implement state logic",acceptance:"Task can be created"}
],files:[{path:"src/main.js",content:"export const ok = true;"}]};
const apiKey="freellmapi-test-only-not-an-actual-key-12345";
const reply=(value=draft,finish="stop",status=200)=>new Response(JSON.stringify({
  id:"chat-test",model:"upstream-free-model",choices:[
    {finish_reason:finish,message:{role:"assistant",content:JSON.stringify(value)}}
  ]
}),{status,headers:{"content-type":"application/json"}});
const base={
  mission,apiKey,model:"auto",baseUrl:"http://127.0.0.1:3001/v1",
  freeChainVerified:true,paidBillingDisabled:true,
  internalPrototypeOnly:true,termsReviewed:true
};
function denyCode(code){return e=>{assert.equal(e.code,code);return true;}}

test("only loopback origin or explicitly pinned HTTPS remote is permitted",()=>{
  assert.equal(resolveFreeLLMAPIEndpoint(base.baseUrl),
    "http://127.0.0.1:3001/v1/chat/completions");
  assert.equal(resolveFreeLLMAPIEndpoint("https://ai.example.com/v1",
    {approvedRemoteOrigin:"https://ai.example.com"}),
    "https://ai.example.com/v1/chat/completions");
  for(const url of [
    "http://evil.example/v1","http://127.0.0.1:3333/v1",
    "http://169.254.169.254:3001/v1","http://localhost:3001/v1",
    "https://ai.example.com/v1?secret=true","https://me:pass@ai.example.com/v1",
    "https://ai.example.com/internal","file:///etc/passwd"
  ])assert.throws(()=>resolveFreeLLMAPIEndpoint(url),e=>
    ["PROXY_ENDPOINT_INVALID","PROXY_ENDPOINT_NOT_APPROVED"].includes(e.code));
  assert.throws(()=>resolveFreeLLMAPIEndpoint("https://ai.example.com/v1",
    {approvedRemoteOrigin:"https://other.example.com"}),denyCode("PROXY_ENDPOINT_NOT_APPROVED"));
});
test("no model request unless four free internal governance flags are true",async()=>{
  for(const field of ["freeChainVerified","paidBillingDisabled","internalPrototypeOnly","termsReviewed"]){
    let count=0;
    await assert.rejects(generateFreeLLMAPIDraft({...base,[field]:false,
      fetchImpl:async()=>{count++;return reply();}}),denyCode("PROXY_FREE_ONLY_POLICY_DENIED"));
    assert.equal(count,0);
  }
});
test("invalid credential prevents all requests",async()=>{
  let count=0;
  await assert.rejects(generateFreeLLMAPIDraft({...base,apiKey:"short",
    fetchImpl:async()=>{count++;return reply();}}),denyCode("PROXY_KEY_MISSING_OR_INVALID"));
  assert.equal(count,0);
});
test("request is exactly one approved POST with no tools, no redirects and no streams",async()=>{
  let calls=0;
  const x=await generateFreeLLMAPIDraft({...base,fetchImpl:async(url,init)=>{
    calls++;
    assert.equal(url,"http://127.0.0.1:3001/v1/chat/completions");
    assert.equal(init.method,"POST");assert.equal(init.redirect,"error");
    assert.equal(init.headers.Authorization,"Bearer "+apiKey);
    const body=JSON.parse(init.body);
    assert.equal(body.stream,false);assert.equal(body.model,"auto");
    assert.equal(body.tools,undefined);assert.equal(body.tool_choice,undefined);
    assert.equal(body.messages[1].role,"user");
    return reply();
  }});
  assert.equal(calls,1);
  assert.equal(x.status,"DRAFT_VALIDATED_NOT_EXECUTED");
  assert.equal(x.model_provider,"freellmapi-proxy");
  assert.equal(x.free_chain_status,"OWNER_DECLARATION_NOT_PROVIDER_ATTESTATION");
  assert.equal(x.route_verification,"NOT_INDEPENDENTLY_VERIFIED");
  assert.equal(x.release,"DENIED");assert.equal(x.sandbox_execution,"NOT_RUN");
  assert.equal(x.draft.files[0].path,"src/main.js");
  assert.equal(JSON.stringify(x).includes(apiKey),false);
});
test("model id and task require safe contract",async()=>{
  await assert.rejects(generateFreeLLMAPIDraft({...base,model:"http://evil.test",
    fetchImpl:async()=>reply()}),denyCode("PROXY_MODEL_INVALID"));
  await assert.rejects(generateFreeLLMAPIDraft({...base,mission:{...mission,allowModel:false},
    fetchImpl:async()=>reply()}),/authorize/);
});
test("remote HTTPS calls must be owner pinned, no unapproved host",async()=>{
  let sent=false;
  await assert.rejects(generateFreeLLMAPIDraft({...base,baseUrl:"https://proxy.example.com/v1",
    fetchImpl:async()=>{sent=true;return reply();}}),denyCode("PROXY_ENDPOINT_NOT_APPROVED"));
  assert.equal(sent,false);
  const x=await generateFreeLLMAPIDraft({...base,baseUrl:"https://proxy.example.com/v1",
    approvedRemoteOrigin:"https://proxy.example.com",fetchImpl:async(url)=>{
      assert.equal(url,"https://proxy.example.com/v1/chat/completions");return reply();
    }});
  assert.equal(x.model_provider,"freellmapi-proxy");
});
test("429, 401, 503 fail closed without a client retry",async()=>{
  for(const [status,code] of [[429,"PROXY_RATE_LIMITED"],[401,"PROXY_AUTH_DENIED"],[503,"PROXY_HTTP_FAILED"]]){
    let calls=0;
    await assert.rejects(generateFreeLLMAPIDraft({...base,fetchImpl:async()=>{
      calls++;return new Response("private credential text",{status});
    }}),denyCode(code));
    assert.equal(calls,1);
  }
});
test("truncated answers and function/tool calls rejected",async()=>{
  await assert.rejects(generateFreeLLMAPIDraft({...base,fetchImpl:async()=>reply(draft,"length")}),
    denyCode("PROXY_INCOMPLETE_OR_TOOL_RESPONSE"));
  await assert.rejects(generateFreeLLMAPIDraft({...base,fetchImpl:async()=>{
    const payload={choices:[{finish_reason:"stop",message:{
      content:JSON.stringify(draft),tool_calls:[{id:"t1",type:"function"}]}}]};
    return new Response(JSON.stringify(payload));
  }}),denyCode("PROXY_INCOMPLETE_OR_TOOL_RESPONSE"));
});
test("invalid plan JSON is rejected by existing draft contract",async()=>{
  await assert.rejects(generateFreeLLMAPIDraft({...base,fetchImpl:async()=>
    reply({...draft,schema:"untrusted"})}),/schema/);
});
test("response size cap enforced even without declared Content-Length",async()=>{
  await assert.rejects(generateFreeLLMAPIDraft({...base,fetchImpl:async()=>
    new Response("x".repeat(96001),{status:200,headers:{"content-type":"application/json"}})}),
    denyCode("PROXY_BODY_TOO_LARGE"));
});
test("transport failure never exposes upstream secrets",async()=>{
  await assert.rejects(generateFreeLLMAPIDraft({...base,fetchImpl:async()=>{
    throw new Error("leaked: "+apiKey);
  }}),e=>{assert.equal(e.code,"PROXY_TRANSPORT_FAILED");assert.ok(!e.message.includes(apiKey));return true;});
});
test("permit -> free proxy -> validated draft -> quarantine -> proof verification",async()=>{
  const secret="local-only-permit-secret-for-integration-tests-123";
  const now=1782500000000;
  const permit=issueLocalDraftPermit({missionId:mission.id,secret,now,ttlMs:5000,nonce:"freellmapi-test-nonce-123"});
  const consumedNonces=new Set();
  const opts={mission,permit,permitSecret:secret,consumedNonces,provider:"freellmapi",
    apiKey,model:"auto",proxyBaseUrl:base.baseUrl,
    proxyFreeChainVerified:true,proxyPaidBillingDisabled:true,
    proxyInternalPrototypeOnly:true,proxyTermsReviewed:true,
    now:now+1,fetchImpl:async()=>reply()};
  const x=await runPlanOnlyMission(opts);
  assert.equal(x.authorization.status,"LOCAL_HMAC_PERMIT_VERIFIED");
  await assert.rejects(runPlanOnlyMission(opts),/REPLAY_DETECTED/);
  const root=await mkdtemp(join(tmpdir(),"constructor-freellmapi-test-"));
  try{
    const receipt=await quarantineDraft({result:x,outputRoot:root});
    assert.equal(receipt.release,"DENIED");
    const verified=await verifyProofBundle(receipt.bundle_path);
    assert.equal(verified.execution,"NOT_RUN");
    assert.equal(verified.files,1);
  }finally{await rm(root,{recursive:true,force:true});}
});
test("unknown provider denied after permit, before touching remote",async()=>{
  const secret="local-only-permit-secret-for-integration-tests-123";
  const now=1782500000000;
  const permit=issueLocalDraftPermit({missionId:mission.id,secret,now,nonce:"nonceroute1234"});
  let calls=0;
  await assert.rejects(runPlanOnlyMission({mission,permit,permitSecret:secret,
    consumedNonces:new Set(),provider:"other",now:now+1,
    fetchImpl:async()=>{calls++;return reply();}}),denyCode("BLOCKED_PROVIDER_NOT_APPROVED"));
  assert.equal(calls,0);
});
