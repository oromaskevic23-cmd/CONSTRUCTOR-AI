// Synthetic offline contract tests: no real model, generated code execution or Docker.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp,readFile,rm,stat,symlink,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createServer} from 'node:http';
import {FULL_APP_FILES,FULL_APP_SCHEMA,parseFullApplicationDraft} from '../engineering/full-application-contract.mjs';
import {issueLocalDraftPermit,ROUTE_LOCAL_TASK,ROUTE_LOCAL_APPLICATION} from '../engineering/local-permit.mjs';
import {requestVelionTaskDraft,requestVelionFullApplicationDraft} from '../engineering/velion-task-generator.mjs';
import {stageGeneratedFullApplication} from '../engineering/task-build-quarantine.mjs';

const secret='synthetic-local-secret-0123456789abcdef';
const model='fixture:full-app-v1';
const mission={id:'full-app-contract-001',goal:'Build a task manager with search',allowModel:true};
const packageObject={name:'smart-task-manager',version:'1.0.0',private:true,type:'module',
  scripts:{start:'node serve.mjs',test:'node --test test/app.test.mjs'},engines:{node:'>=22'}};
const source={
  'README.md':'# Synthetic fixture\nNode.js 22. No build required. Run npm test and npm start at http://127.0.0.1:4174.\n',
  'app.mjs':'globalThis.__untrustedCandidateExecuted = true;\n',
  'index.html':'<!doctype html><title>Fixture</title>\n',
  'package.json':JSON.stringify(packageObject,null,2)+'\n',
  'serve.mjs':'// synthetic server; never executed\n',
  'storage.mjs':'// synthetic storage\n',
  'styles.css':'body { color: black; }\n',
  'test/app.test.mjs':'// synthetic candidate-authored test\n',
  'validation.mjs':'// synthetic validation\n'
};
const makeDraft=()=>({schema:FULL_APP_SCHEMA,summary:'Untrusted fixture',
  steps:[{id:'build',action:'Generate source',acceptance:'Independent review required'}],
  files:FULL_APP_FILES.map(path=>({path,content:source[path]}))});
const sha=text=>createHash('sha256').update(text).digest('hex');
const issue=(route,now)=>issueLocalDraftPermit({mission,route,model,secret,now});
async function request({draft=makeDraft(),permit,now=Date.now(),consumedNonces=new Set(),fetchImpl,requireRealInferenceEvidence=false}={}){
  return requestVelionFullApplicationDraft({mission,permit:permit??issue(ROUTE_LOCAL_APPLICATION,now),
    permitSecret:secret,consumedNonces,model,now,requireRealInferenceEvidence,
    fetchImpl:fetchImpl??(async()=>new Response(JSON.stringify({done:true,model,response:JSON.stringify(draft)}),{status:200}))});
}

test('full application contract is versioned, bounded and canonical across file ordering',()=>{
  const draft=makeDraft(),parsed=parseFullApplicationDraft(JSON.stringify(draft));
  assert.equal(parsed.draft.schema,FULL_APP_SCHEMA);
  assert.deepEqual(parsed.draft.files.map(file=>file.path),FULL_APP_FILES);
  assert.equal(parsed.sha256,parseFullApplicationDraft(JSON.stringify({...draft,files:[...draft.files].reverse()})).sha256);
  assert.ok(Object.isFrozen(parsed.draft.files[0]));
  assert.equal(parsed.sourceBytes,FULL_APP_FILES.reduce((total,path)=>total+Buffer.byteLength(source[path]),0));
  assert.throws(()=>parseFullApplicationDraft('x'.repeat(120001)),/FULL_APP_RESPONSE_INVALID/);
  assert.throws(()=>parseFullApplicationDraft('{'),/FULL_APP_JSON_INVALID/);
});

test('full application file inventory rejects missing, duplicate, extra and unsafe paths',()=>{
  const draft=makeDraft();
  for(const files of [draft.files.slice(1),[...draft.files,{path:'extra.mjs',content:'x'}],
    draft.files.map((file,i)=>i===0?{...file,path:'../README.md'}:file),
    draft.files.map((file,i)=>i===0?{...file,path:'readme.md'}:file),
    draft.files.map((file,i)=>i===0?draft.files[1]:file)])
    assert.throws(()=>parseFullApplicationDraft(JSON.stringify({...draft,files})),/FULL_APP_FILE_SET_DENIED/);
  for(const content of ['', '\u0000', 'x'.repeat(20001)]) {
    const files=draft.files.map((file,i)=>i===0?{...file,content}:file);
    assert.throws(()=>parseFullApplicationDraft(JSON.stringify({...draft,files})),/FULL_APP_FILE_CONTENT_INVALID/);
  }
});

test('manifest rejects dependency installation, lifecycle hooks and substituted scripts',()=>{
  const draft=makeDraft();
  for(const pkg of [
    {...packageObject,dependencies:{arbitrary:'1.0.0'}},
    {...packageObject,scripts:{...packageObject.scripts,pretest:'node run.mjs'}},
    {...packageObject,scripts:{...packageObject.scripts,start:'sh -c evil'}},
    {...packageObject,engines:{node:'>=18'}},
    {...packageObject,private:false}
  ]) {
    const files=draft.files.map(file=>file.path==='package.json'?{...file,content:JSON.stringify(pkg)}:file);
    assert.throws(()=>parseFullApplicationDraft(JSON.stringify({...draft,files})),/FULL_APP_(?:PACKAGE_|NODE_REQUIREMENT_)/);
  }
});

test('full application contract requires reproducible startup and test instructions',()=>{
  const draft=makeDraft();
  const files=draft.files.map(file=>file.path==='README.md'?{...file,content:'# No instructions\n'}:file);
  assert.throws(()=>parseFullApplicationDraft(JSON.stringify({...draft,files})),/FULL_APP_INSTRUCTIONS_INCOMPLETE/);
});

test('duplicate and prototype-manipulating JSON fields are rejected without executing source',()=>{
  const draft=makeDraft(),text=JSON.stringify(draft);
  assert.throws(()=>parseFullApplicationDraft(text.replace('"schema":','"schema":"bogus","schema":')),
    /FULL_APP_DUPLICATE_KEY/);
  const duplicates='{"name":"smart-task-manager","version":"1.0.0","private":true,"type":"module",'+
    '"scripts":{"start":"evil","st\\u0061rt":"node serve.mjs","test":"node --test test/app.test.mjs"},'+
    '"engines":{"node":">=22"}}';
  const files=draft.files.map(file=>file.path==='package.json'?{...file,content:duplicates}:file);
  assert.throws(()=>parseFullApplicationDraft(JSON.stringify({...draft,files})),/FULL_APP_PACKAGE_DUPLICATE_KEY/);
  assert.throws(()=>parseFullApplicationDraft(text.replace('"schema":','"__proto__":{},"schema":')),
    /FULL_APP_SCHEMA_INVALID/);
  assert.equal(globalThis.__untrustedCandidateExecuted,undefined);
});

test('full application requires a separately scoped permit and never retries inference',async()=>{
  const now=Date.now();let calls=0;
  const fetchImpl=async()=>{calls++;throw Error('synthetic unavailable');};
  await assert.rejects(request({now,permit:issue(ROUTE_LOCAL_TASK,now),fetchImpl}),/SCOPE/);
  assert.equal(calls,0);
  await assert.rejects(requestVelionTaskDraft({mission,permit:issue(ROUTE_LOCAL_APPLICATION,now),
    permitSecret:secret,model,now,consumedNonces:new Set(),fetchImpl}),/SCOPE/);
  assert.equal(calls,0);
  const permit=issue(ROUTE_LOCAL_APPLICATION,now),used=new Set();
  await assert.rejects(request({now,permit,fetchImpl,consumedNonces:used}),/LOCAL_MODEL_UNAVAILABLE/);
  await assert.rejects(request({now,permit,fetchImpl,consumedNonces:used}),/REPLAY/);
  assert.equal(calls,1);
});

test('synthetic model response yields only an unattested, unreleased application draft',async()=>{
  let calls=0;
  const receipt=await request({requireRealInferenceEvidence:true,fetchImpl:async(url,options)=>{
    calls++;
    assert.equal(url,'http://127.0.0.1:11434/api/generate');
    assert.equal(options.redirect,'error');
    const body=JSON.parse(options.body);
    assert.equal(body.options.num_predict,8192);
    assert.match(body.prompt,/constructor_full_application_v1/);
    return new Response(JSON.stringify({done:true,done_reason:'stop',model,eval_count:25,total_duration:99,
      response:JSON.stringify(makeDraft())}),{status:200});
  }});
  assert.equal(calls,1);
  assert.equal(receipt.status,'UNTRUSTED_GENERATED_FULL_APPLICATION');
  assert.equal(receipt.receiptTrust,'PROVIDER_REPORTED_NOT_INDEPENDENTLY_ATTESTED');
  assert.equal(receipt.execution,'NOT_RUN');assert.equal(receipt.independentQa,'NOT_RUN');
  assert.equal(receipt.approval,'DENIED');assert.equal(receipt.release,'DENIED');
  assert.equal(receipt.modelOutputSha256,sha(receipt.draftJson));
  assert.match(receipt.requirementsSha256,/^[a-f0-9]{64}$/);
  assert.equal(globalThis.__untrustedCandidateExecuted,undefined);
});

test('missing model receipt and oversized or malformed responses fail closed',async()=>{
  await assert.rejects(request({requireRealInferenceEvidence:true}),/REAL_INFERENCE_TOKEN_EVIDENCE_REQUIRED/);
  await assert.rejects(request({fetchImpl:async()=>new Response('x'.repeat(250001),{status:200})}),/LOCAL_MODEL_BODY_TOO_LARGE/);
  await assert.rejects(request({fetchImpl:async()=>new Response('{',{status:200})}),/LOCAL_MODEL_ENVELOPE_INVALID/);
  await assert.rejects(request({draft:{...makeDraft(),approval:'PASS'}}),/FULL_APP_SCHEMA_INVALID/);
});

test('full application CLI refuses inference without explicit local opt-in',async()=>{
  const exec=promisify(execFile);
  await assert.rejects(exec(process.execPath,['tools/local-velion-task-build.mjs','--full-app',
    'Build a task manager','/tmp'],{timeout:10000,env:{PATH:process.env.PATH||'/usr/bin:/bin'}}),
    error=>error.code===1&&/LOCAL_INFERENCE_EXPLICIT_OPT_IN_REQUIRED/.test(error.stderr));
});

test('CLI sends one synthetic loopback request and quarantines its exact source without execution',async t=>{
  const root=await mkdtemp(join(tmpdir(),'constructor-cli-full-fixture-'));
  t.after(()=>rm(root,{recursive:true,force:true}));
  const marker=join(root,'must-not-exist');
  const draft=makeDraft();
  const app=draft.files.find(file=>file.path==='app.mjs');
  app.content="import {writeFileSync} from 'node:fs'; writeFileSync("+JSON.stringify(marker)+",'executed');\n";
  let calls=0;
  const server=createServer((req,res)=>{
    calls++;
    req.resume();
    req.on('end',()=>{res.writeHead(200,{'Content-Type':'application/json'});
      res.end(JSON.stringify({done:true,done_reason:'stop',model,eval_count:20,total_duration:99,response:JSON.stringify(draft)}));});
  });
  try {await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(11434,'127.0.0.1',resolve);});}
  catch(error){if(error.code==='EADDRINUSE'){t.skip('Local model port already in use; no request sent');return;}throw error;}
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const {stdout}=await promisify(execFile)(process.execPath,['tools/local-velion-task-build.mjs','--full-app',mission.goal,root],{
    timeout:10000,env:{PATH:process.env.PATH||'/usr/bin:/bin',IMPERIAL_TASK_LOCAL_ONLY:'YES',
      VELION_LOCAL_MODEL:model,VELION_LOCAL_PERMIT_SECRET:secret}});
  const result=JSON.parse(stdout);
  assert.equal(calls,1);assert.equal(result.contract,'FULL_APPLICATION_V1');
  assert.equal(result.execution,'NOT_RUN');assert.equal(result.release,'DENIED');
  assert.equal(await readFile(join(result.stage,'app.mjs'),'utf8'),app.content);
  await assert.rejects(stat(marker),{code:'ENOENT'});
});

test('full application quarantine contains exact unexecuted bytes and denies evidence substitution',async t=>{
  const root=await mkdtemp(join(tmpdir(),'constructor-full-contract-'));
  t.after(()=>rm(root,{recursive:true,force:true}));
  const receipt=await request(),staged=await stageGeneratedFullApplication({receipt,outputRoot:root});
  assert.equal(staged.status,'QUARANTINED_NOT_EXECUTED');assert.equal(staged.release,'DENIED');
  assert.equal((await stat(staged.stage)).mode&0o777,0o700);
  const manifestText=await readFile(join(staged.stage,'stage-manifest.json'),'utf8');
  assert.equal(staged.stageManifestSha256,sha(manifestText));
  const manifest=JSON.parse(manifestText);
  assert.equal(manifest.staticReview,'NOT_RUN');assert.equal(manifest.independentQa,'NOT_RUN');
  assert.equal(manifest.approval,'DENIED');assert.equal(manifest.release,'DENIED');
  assert.equal(manifest.requirementsSha256,receipt.requirementsSha256);
  assert.equal(manifest.requirements.goalSha256,receipt.goalSha256);
  assert.deepEqual(manifest.files.map(file=>file.path),FULL_APP_FILES);
  for(const file of manifest.files){
    const bytes=await readFile(join(staged.stage,file.path));
    assert.equal(bytes.toString('utf8'),source[file.path]);assert.equal(sha(bytes),file.sha256);
  }
  assert.equal(globalThis.__untrustedCandidateExecuted,undefined);
  await assert.rejects(stageGeneratedFullApplication({receipt:{...receipt,draftJson:receipt.draftJson+' '},outputRoot:root}),/MODEL_OUTPUT_HASH_MISMATCH/);
  await assert.rejects(stageGeneratedFullApplication({receipt:{...receipt,draftSha256:'a'.repeat(64)},outputRoot:root}),/DRAFT_HASH_MISMATCH/);
  await assert.rejects(stageGeneratedFullApplication({receipt:{...receipt,requirementsSha256:'b'.repeat(64)},outputRoot:root}),/REQUIREMENTS_HASH_MISMATCH/);
  await assert.rejects(stageGeneratedFullApplication({receipt:{...receipt,release:'PASS'},outputRoot:root}),/RECEIPT_NOT_UNTRUSTED/);
  const link=join(root,'linked-root');await symlink(staged.stage,link);
  await assert.rejects(stageGeneratedFullApplication({receipt,outputRoot:link}),/UNSAFE_OUTPUT_ROOT/);
  assert.equal((await readdir(root)).filter(name=>name.startsWith('constructor-full-app-quarantine-')).length,1);
});
