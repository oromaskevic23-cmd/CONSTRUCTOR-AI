// Project author and founding architect: Alexander Nikolaevich Romaskevich (RomaskevicH).
import test from "node:test";
import assert from "node:assert/strict";
import {createHmac} from "node:crypto";
import {issueLocalDraftPermit,verifyLocalDraftPermit,ROUTE_GROQ_PLAN,ROUTE_LOCAL_TASK} from "../engineering/local-permit.mjs";
const s="development-secret-not-for-production-12345678",t=1770000000000;
const mission={id:"mission-123",goal:"Build a private task manager",allowModel:true};
const args={mission,route:ROUTE_GROQ_PLAN,model:"test-model",secret:s,now:t,ttlMs:10000,nonce:"nonce-test-001"};
const verify=(token,overrides={})=>verifyLocalDraftPermit({token,mission,route:args.route,model:args.model,
  secret:s,consumedNonces:new Set(),now:t+1,...overrides});

test("valid scoped local plan-only HMAC permit works once without exposing goal",()=>{
 const token=issueLocalDraftPermit(args),used=new Set();
 assert.match(token,/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
 const raw=Buffer.from(token.split(".")[0],"base64url").toString("utf8");
 assert.equal(raw.includes(mission.goal),false);
 const ok=verify(token,{consumedNonces:used});
 assert.equal(ok.action,"model:generate_draft");
 assert.equal(ok.route,args.route);
 assert.throws(()=>verify(token,{consumedNonces:used,now:t+2}),/REPLAY/);
});
test("permit rejects modified goal, mission, model and execution route",()=>{
 const token=issueLocalDraftPermit(args);
 for(const changed of [
   {mission:{...mission,goal:"Build a different task manager"}},
   {mission:{...mission,id:"different-012"}},
   {model:"other-model"},
   {route:ROUTE_LOCAL_TASK}
 ]) assert.throws(()=>verify(token,changed),/SCOPE/);
});
test("old mission-ID-only permits are rejected even when correctly signed",()=>{
 const raw=JSON.stringify({v:"constructor_local_draft_permit_v1",mission:mission.id,
   action:"model:generate_draft",iat:t,exp:t+10000,nonce:"nonce-test-001"});
 const token=Buffer.from(raw).toString("base64url")+"."+
   createHmac("sha256",s).update(raw).digest("base64url");
 assert.throws(()=>verify(token),/SCOPE/);
});
test("rejects weak secrets, altered token and invalid issuance",()=>{
 assert.throws(()=>issueLocalDraftPermit({...args,secret:"short"}),/WEAK/);
 const token=issueLocalDraftPermit(args);
 assert.throws(()=>verify(token.slice(0,-1)+"!"),/FORMAT/);
 assert.throws(()=>issueLocalDraftPermit({...args,ttlMs:300001}),/EXPIRATION/);
 assert.throws(()=>issueLocalDraftPermit({...args,model:"https://example.com"}),/MODEL_SCOPE/);
 assert.throws(()=>issueLocalDraftPermit({...args,mission:undefined}),/MISSION_SCOPE/);
});
test("expired permits and absent replay trackers fail closed",()=>{
 const token=issueLocalDraftPermit(args);
 assert.throws(()=>verify(token,{now:t+10000}),/EXPIRED/);
 assert.throws(()=>verifyLocalDraftPermit({token,mission,route:args.route,model:args.model,secret:s,now:t+1}),/REPLAY_TRACKER/);
});
