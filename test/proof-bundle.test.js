import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp, mkdir, readFile, writeFile, symlink, rm, lstat} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join, dirname} from "node:path";
import {parseModelDraft} from "../engineering/draft-contract.mjs";
import {staticDraftReview} from "../engineering/static-review.mjs";
import {quarantineDraft, verifyProofBundle, ProofError} from "../engineering/proof-bundle.mjs";

const draft = () => ({
  schema:"constructor_draft_v1",
  summary:"Validated but untrusted Task Manager draft",
  steps:[{id:"plan",action:"Design task API",acceptance:"Document API methods"}],
  files:[
    {path:"src/task.js",content:"export const label = 'safe reference';\n"},
    {path:"src/styles.css",content:"body{color:navy}\n"}
  ]
});
const fakeResult = (value=draft()) => ({
  status:"DRAFT_VALIDATED_NOT_EXECUTED",
  mission_id:"mission-123",
  input_sha256:"a".repeat(64),
  model_output_sha256:"b".repeat(64),
  validated_draft_sha256:parseModelDraft(JSON.stringify(value)).sha256,
  model_provider:"groq",model:"test-model",
  sandbox_execution:"NOT_RUN",
  independent_qa:"NOT_RUN",release:"DENIED",
  authorization:{stage:"PLAN_ONLY",action:"model:generate_draft",status:"LOCAL_HMAC_PERMIT_VERIFIED"},
  draft:value
});
async function root(t) {
  const directory=await mkdtemp(join(tmpdir(),"constructor-quarantine-test-"));
  t.after(async()=>{await rm(directory,{force:true,recursive:true});});
  return directory;
}

test("writes a review-only package with valid file and manifest hashes",async t=>{
  const directory=await root(t);
  const result=await quarantineDraft({result:fakeResult(),outputRoot:directory,now:new Date("2026-10-24T00:00:00Z")});
  assert.equal(result.status,"QUARANTINED_NOT_EXECUTED");
  assert.equal(result.release,"DENIED");
  assert.equal(result.files,2);
  assert.match(result.bundle_path,/constructor-quarantine-/);
  const manifest=JSON.parse(await readFile(join(result.bundle_path,"proof-manifest.json"),"utf8"));
  assert.equal(manifest.execution,"NOT_RUN");
  assert.equal(manifest.independent_qa,"NOT_RUN");
  assert.equal(manifest.files.length,2);
  assert.equal(manifest.created_at,"2026-10-24T00:00:00.000Z");
  assert.equal((await readFile(join(result.bundle_path,"src/task.js"),"utf8")),draft().files[0].content);
  const verified=await verifyProofBundle(result.bundle_path);
  assert.equal(verified.status,"INTEGRITY_CHECKED_NOT_ATTESTED");
  assert.equal(verified.manifest_sha256,result.manifest_sha256);
});

test("quarantine never executes dangerous strings inside generated source",async t=>{
  const directory=await root(t);
  const d=draft();
  d.files[0].content="import { writeFileSync } from 'node:fs'; writeFileSync('side-effect.txt','ran')";
  const result=await quarantineDraft({result:fakeResult(d),outputRoot:directory});
  assert.equal(result.static_review,"NEEDS_INDEPENDENT_REVIEW");
  await assert.rejects(lstat(join(result.bundle_path,"side-effect.txt")),{code:"ENOENT"});
  const verified=await verifyProofBundle(result.bundle_path);
  assert.equal(verified.release,"DENIED");
});

test("detects tampering with a previously written source file",async t=>{
  const directory=await root(t);
  const {bundle_path}=await quarantineDraft({result:fakeResult(),outputRoot:directory});
  await writeFile(join(bundle_path,"src/task.js"),"export const label = 'evil reference';\n");
  await assert.rejects(verifyProofBundle(bundle_path),/ARTIFACT_DIGEST_MISMATCH/);
});

test("rejects edited files whose lengths differ before digest comparison",async t=>{
  const directory=await root(t);
  const {bundle_path}=await quarantineDraft({result:fakeResult(),outputRoot:directory});
  await writeFile(join(bundle_path,"src/task.js"),"short");
  await assert.rejects(verifyProofBundle(bundle_path),/ARTIFACT_TYPE_OR_SIZE_MISMATCH/);
});

test("detects manifest edits even when the files were not touched",async t=>{
  const directory=await root(t);
  const {bundle_path}=await quarantineDraft({result:fakeResult(),outputRoot:directory});
  const manifestPath=join(bundle_path,"proof-manifest.json");
  const data=JSON.parse(await readFile(manifestPath,"utf8"));
  data.release_decision="APPROVED";
  await writeFile(manifestPath,JSON.stringify(data));
  await assert.rejects(verifyProofBundle(bundle_path),/INVALID_OR_TAMPERED_MANIFEST/);
});

test("rejects unexpected payload files not covered by manifest",async t=>{
  const directory=await root(t);
  const {bundle_path}=await quarantineDraft({result:fakeResult(),outputRoot:directory});
  await writeFile(join(bundle_path,"unexpected.sh"),"echo hello");
  await assert.rejects(verifyProofBundle(bundle_path),/UNEXPECTED_OR_MISSING_ARTIFACT/);
});

test("rejects replacement source symlinks in bundle",async t=>{
  const directory=await root(t);
  const {bundle_path}=await quarantineDraft({result:fakeResult(),outputRoot:directory});
  const target=join(bundle_path,"src/task.js");
  await rm(target);
  await symlink(join(bundle_path,"proof-manifest.json"),target);
  await assert.rejects(verifyProofBundle(bundle_path),/SYMLINK_IN_BUNDLE/);
});

test("rejects a symlink as the operator-selected output root",async t=>{
  const directory=await root(t);
  await mkdir(join(directory,"actual"));
  await symlink(join(directory,"actual"),join(directory,"linked"));
  await assert.rejects(quarantineDraft({result:fakeResult(),outputRoot:join(directory,"linked")}),/OUTPUT_ROOT_UNSAFE/);
});

test("does not create a quarantine for untrusted planning receipts",async t=>{
  const directory=await root(t);
  const r=fakeResult();
  r.authorization.status="NO_AUTH";
  await assert.rejects(quarantineDraft({result:r,outputRoot:directory}),/UNTRUSTED_OR_INCOMPLETE/);
  assert.deepEqual(await (await import("node:fs/promises")).readdir(directory),[]);
});

test("rejects a forged or inconsistent validated-draft digest",async t=>{
  const directory=await root(t);
  const r=fakeResult();
  r.validated_draft_sha256="0".repeat(64);
  await assert.rejects(quarantineDraft({result:r,outputRoot:directory}),/DRAFT_DIGEST_MISMATCH/);
});

test("blocks probable credential material before writing output",async t=>{
  const directory=await root(t);
  const d=draft();
  d.files[0].content="export const key = 'gsk_"+"X".repeat(28)+"';";
  const r=fakeResult(d);
  assert.equal(staticDraftReview(d).status,"BLOCKED_SUSPECTED_SECRET");
  await assert.rejects(quarantineDraft({result:r,outputRoot:directory}),/POTENTIAL_SECRET_MATERIAL/);
  assert.deepEqual(await (await import("node:fs/promises")).readdir(directory),[]);
});

test("static review labels runtime capabilities as needing independent QA",()=>{
 const d=draft();
 d.files[0].content="import {execSync} from 'node:child_process'; execSync('id');";
 const review=staticDraftReview(d);
 assert.equal(review.status,"NEEDS_INDEPENDENT_REVIEW");
 assert.ok(review.flags.some(f=>f.code==="PROCESS_EXECUTION"));
 assert.equal(review.release,"DENIED");
});

test("clean heuristic result never asserts independent QA or authorizes release",()=>{
 const review=staticDraftReview(draft());
 assert.equal(review.status,"STATIC_HEURISTIC_NO_FLAGS");
 assert.equal(review.independent_qa,"NOT_RUN");
 assert.equal(review.code_execution,"NOT_RUN");
 assert.equal(review.release,"DENIED");
});

test("a draft with zero generated files cannot be quarantined as an application",async t=>{
 const directory=await root(t);
 const d=draft();
 d.files=[];
 await assert.rejects(quarantineDraft({result:fakeResult(d),outputRoot:directory}),/DRAFT_HAS_NO_FILES/);
});

test("bundle verification refuses missing or unsafe path",async t=>{
 const directory=await root(t);
 await assert.rejects(verifyProofBundle(""),/BUNDLE_PATH_REQUIRED/);
 await assert.rejects(verifyProofBundle(directory),{code:"ENOENT"});
});
