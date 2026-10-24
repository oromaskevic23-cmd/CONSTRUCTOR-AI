import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,rm,readFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {issueLocalDraftPermit} from "../engineering/local-permit.mjs";
import {runPlanOnlyMission} from "../engineering/plan-only.mjs";
import {quarantineDraft,verifyProofBundle} from "../engineering/proof-bundle.mjs";

const secret="test-local-hmac-secret-0123456789-not-production";
const mission={id:"e2e-mission-001",goal:"Build Task Manager",allowModel:true};
const draft={
 schema:"constructor_draft_v1",
 summary:"Generated example Task Manager structure",
 steps:[{id:"plan",action:"Create task module",acceptance:"Task source is present"}],
 files:[{path:"src/task.js",content:"export const task = () => ({done:false});\n"}]
};

test("full OFFLINE mocked model→permit→draft→quarantine→proof roundtrip",async t=>{
 const root=await mkdtemp(join(tmpdir(),"constructor-offline-e2e-"));
 t.after(async()=>{await rm(root,{recursive:true,force:true});});
 const now=1750000000000;
 const permit=issueLocalDraftPermit({missionId:mission.id,secret,now,nonce:"e2e-nonce-123456"});
 let requests=0;
 const fakeProvider=async (_url,request)=>{
   requests++;
   assert.match(request.headers.Authorization,/^Bearer gsk_/);
   return new Response(JSON.stringify({id:"mock-only",choices:[{finish_reason:"stop",message:{role:"assistant",content:JSON.stringify(draft)}}]}),{status:200});
 };
 const plan=await runPlanOnlyMission({mission,permit,permitSecret:secret,
   consumedNonces:new Set(),apiKey:"gsk_TEST_ONLY_VALID_LENGTH_NOT_REAL_TOKEN_1234",
   model:"model-testing-only",fetchImpl:fakeProvider,now:now+1});
 assert.equal(requests,1);
 assert.equal(plan.release,"DENIED");
 const receipt=await quarantineDraft({result:plan,outputRoot:root});
 const proof=await verifyProofBundle(receipt.bundle_path);
 assert.equal(proof.status,"INTEGRITY_CHECKED_NOT_ATTESTED");
 assert.equal(proof.execution,"NOT_RUN");
 assert.equal(proof.release,"DENIED");
 assert.equal(await readFile(join(receipt.bundle_path,"src/task.js"),"utf8"),draft.files[0].content);
});
