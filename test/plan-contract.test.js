import test from "node:test";
import assert from "node:assert/strict";
import {parseModelDraft,validateMission,DraftContractError} from "../engineering/draft-contract.mjs";

const sample = () => ({
  schema:"constructor_draft_v1",summary:"Two tasks",
  steps:[{id:"design",action:"Plan functions",acceptance:"Functions described"}],
  files:[{path:"src/main.js",content:"export const ok = true;"}]
});
const parse = p => parseModelDraft(JSON.stringify(p));

test("accepts a bounded draft with reproducible digest",()=>{
  const a=parse(sample()),b=parse(sample());
  assert.equal(a.sha256,b.sha256);
  assert.equal(a.draft.files[0].path,"src/main.js");
  assert.match(a.sha256,/^[a-f0-9]{64}$/);
});
test("requires strict JSON rather than markdown fences",()=>{
  assert.throws(()=>parseModelDraft("```json\n{}\n```"),DraftContractError);
  assert.throws(()=>parseModelDraft(""),DraftContractError);
});
test("rejects output schema and extra root fields",()=>{
  assert.throws(()=>parse({...sample(),schema:"bad"}),/schema/);
  assert.throws(()=>parse({...sample(),success:true}),/top-level/);
});
test("rejects missing, duplicate, or invalid steps",()=>{
  assert.throws(()=>parse({...sample(),steps:[]}),/Plan/);
  assert.throws(()=>parse({...sample(),steps:[sample().steps[0],sample().steps[0]]}),/duplicate/);
  assert.throws(()=>parse({...sample(),steps:[{...sample().steps[0],shell:"rm -rf"}]}),/Invalid/);
});
test("rejects file traversal and dangerous path types",()=>{
  for(const path of ["../.env","a/../secrets.txt","/tmp/out.js","src/.env","src/node_modules/f.js","src/run.sh","C:\\secret.js",".github/workflows/new.yml","src//bad.js"]) {
    assert.throws(()=>parse({...sample(),files:[{path,content:"x"}]}),DraftContractError,path);
  }
});
test("rejects repeated names across case variants",()=>{
  assert.throws(()=>parse({...sample(),files:[{path:"app.js",content:"x"},{path:"APP.js",content:"y"}]}),/Duplicate/);
});
test("rejects excessive response and file content",()=>{
  assert.throws(()=>parseModelDraft("x".repeat(64001)),/excessive/);
  assert.throws(()=>parse({...sample(),files:[{path:"a.js",content:"x".repeat(20001)}]}),/Excessive/);
  assert.throws(()=>parse({...sample(),files:Array.from({length:9},(_,i)=>({path:"file"+i+".js",content:"hi"}))}),/8/);
});
test("rejects oversized cumulative UTF-8 bytes",()=>{
  assert.throws(()=>parse({...sample(),files:[{path:"a.js",content:"Ж".repeat(17000)},{path:"b.js",content:"test"}]}),/budget/);
});
test("validates mission and requires explicit inference authorization",()=>{
  assert.deepEqual(validateMission({id:"valid-123",goal:"Build a task tracker",allowModel:true}),{id:"valid-123",goal:"Build a task tracker",allowModel:true});
  assert.throws(()=>validateMission({id:"valid-123",goal:"Do it"}),/authorize/);
  assert.throws(()=>validateMission({id:"../path",goal:"Do it",allowModel:true}),/ID/);
  assert.throws(()=>validateMission({id:"valid-123",goal:"x".repeat(2001),allowModel:true}),/goal/);
});
test("artifact contents are treated as inert strings at contract boundary",()=>{
 const x=parse({...sample(),files:[{path:"example.html",content:"<script>alert(1)</script>"}]});
 assert.equal(x.draft.files[0].content,"<script>alert(1)</script>");
 // These drafts MUST NOT be executed or deployed. Test validates a data contract, not sandbox safety.
});
