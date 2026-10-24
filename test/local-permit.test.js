import test from "node:test";
import assert from "node:assert/strict";
import {issueLocalDraftPermit,verifyLocalDraftPermit} from "../engineering/local-permit.mjs";
const s="development-secret-not-for-production-12345678",t=1770000000000;
const args={missionId:"mission-123",secret:s,now:t,ttlMs:10000,nonce:"nonce-test-001"};

test("valid local plan-only HMAC permit works once",()=>{
 const token=issueLocalDraftPermit(args),used=new Set();
 assert.match(token,/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
 const ok=verifyLocalDraftPermit({token,missionId:args.missionId,secret:s,consumedNonces:used,now:t+1});
 assert.equal(ok.action,"model:generate_draft");
 assert.throws(()=>verifyLocalDraftPermit({token,missionId:args.missionId,secret:s,consumedNonces:used,now:t+2}),/REPLAY/);
});
test("rejects missing or weak local secret",()=>{
 assert.throws(()=>issueLocalDraftPermit({...args,secret:"short"}),/WEAK/);
});
test("rejects altered token and wrong mission",()=>{
 const token=issueLocalDraftPermit(args);
 assert.throws(()=>verifyLocalDraftPermit({token:token.slice(0,-1)+"!",missionId:args.missionId,secret:s,consumedNonces:new Set(),now:t+1}),/FORMAT/);
 assert.throws(()=>verifyLocalDraftPermit({token,missionId:"different-012",secret:s,consumedNonces:new Set(),now:t+1}),/SCOPE/);
});
test("rejects expired tokens and invalid issuance parameters",()=>{
 const token=issueLocalDraftPermit(args);
 assert.throws(()=>verifyLocalDraftPermit({token,missionId:args.missionId,secret:s,consumedNonces:new Set(),now:t+10000}),/EXPIRED/);
 assert.throws(()=>issueLocalDraftPermit({...args,ttlMs:300001}),/EXPIRATION/);
});
test("replay store is required by default",()=>{
 const token=issueLocalDraftPermit(args);
 assert.throws(()=>verifyLocalDraftPermit({token,missionId:args.missionId,secret:s,now:t+1}),/REPLAY_TRACKER/);
});
