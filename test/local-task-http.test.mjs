// Loopback-only, synthetic model tests for the optional local Studio gateway.
import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {request as httpRequest} from 'node:http';
import {mkdtemp,readFile,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createAppServer} from '../tools/serve.mjs';
import {createLocalTaskService,localTaskServiceFromEnv} from '../engineering/local-task-service.mjs';
import {localTaskApiUrl} from '../src/local-ai-policy.mjs';
import {FULL_APP_FILES,FULL_APP_SCHEMA} from '../engineering/full-application-contract.mjs';

const token='local-session-example-0123456789ABCDEF';
const permitSecret='local-permit-example-0123456789ABCDEF';
const model='fixture:local-v1';
const path='/api/local-velion/task-draft';
const draft={schema:'constructor_draft_v1',summary:'Synthetic candidate',
  steps:[{id:'create',action:'Create domain API',acceptance:'Separate QA required'}],
  files:[{path:'app.mjs',content:'export const createTask=(id,title)=>({id,title,done:false});\n'},
    {path:'test/app.test.mjs',content:'export const testFixture=true;\n'}]};
const fullSources={
  'README.md':'Node.js 22. No build required. npm test and npm start at http://127.0.0.1:4174.\n',
  'app.mjs':'globalThis.__localFullAppMustNotRun=true;\n',
  'index.html':'<!doctype html><title>Synthetic only</title>',
  'package.json':JSON.stringify({name:'synthetic-app',version:'1.0.0',private:true,type:'module',
    scripts:{start:'node serve.mjs',test:'node --test test/app.test.mjs'},engines:{node:'>=22'}}),
  'serve.mjs':'// synthetic server\n', 'storage.mjs':'// synthetic storage\n',
  'styles.css':'body { color: white; }\n', 'test/app.test.mjs':'// candidate test\n',
  'validation.mjs':'// synthetic validation\n'
};
const fullDraft={schema:FULL_APP_SCHEMA,summary:'Synthetic full app',
  steps:[{id:'build',action:'Draft files',acceptance:'Review required'}],
  files:FULL_APP_FILES.map(path=>({path,content:fullSources[path]}))};

async function setup(t,fetchImpl){
  const outputRoot=await mkdtemp(join(tmpdir(),'constructor-local-ui-'));
  t.after(()=>rm(outputRoot,{recursive:true,force:true}));
  let calls=0;
  const fake=fetchImpl|| (async (url,request)=>{
    calls++;
    assert.equal(url,'http://127.0.0.1:11434/api/generate');
    assert.equal(request.redirect,'error');
    return new Response(JSON.stringify({model,done:true,response:JSON.stringify(draft)}),{status:200});
  });
  const service=createLocalTaskService({accessToken:token,permitSecret,model,outputRoot,fetchImpl:fake});
  const server=createAppServer({localTaskService:service});
  server.listen(0,'127.0.0.1');await once(server,'listening');
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const origin='http://127.0.0.1:'+server.address().port;
  const post=(body,headers={})=>fetch(origin+path,{method:'POST',headers:{
    'content-type':'application/json','origin':origin,'authorization':'Bearer '+token,...headers},body});
  return {origin,post,outputRoot,calls:()=>calls};
}

test('public or non-loopback Studio never sends local credentials',()=>{
  assert.equal(localTaskApiUrl('https://example.com/studio'),null);
  assert.equal(localTaskApiUrl('https://127.0.0.1:4173/studio'),null);
  assert.equal(localTaskApiUrl('http://localhost:4173/studio'),null);
  assert.equal(localTaskApiUrl('http://127.0.0.1.example.com:4173/studio'),null);
  assert.equal(localTaskApiUrl('http://127.0.0.1:4173/studio'),'http://127.0.0.1:4173'+path);
});

test('local AI service is disabled by default and rejects weak configuration',()=>{
  assert.equal(localTaskServiceFromEnv({}),null);
  assert.throws(()=>localTaskServiceFromEnv({IMPERIAL_TASK_LOCAL_ONLY:'YES'}),/LOCAL_AI_CONFIGURATION_INVALID/);
  assert.throws(()=>createLocalTaskService({accessToken:'short',permitSecret,model,outputRoot:'/tmp'}),/LOCAL_AI_CONFIGURATION_INVALID/);
  assert.throws(()=>createLocalTaskService({accessToken:token,permitSecret:token,model,outputRoot:'/tmp'}),/LOCAL_AI_CONFIGURATION_INVALID/);
  assert.throws(()=>createLocalTaskService({accessToken:token,permitSecret,model,outputRoot:'relative'}),/LOCAL_AI_CONFIGURATION_INVALID/);
});

test('default local server has no model endpoint enabled',async t=>{
  const server=createAppServer();server.listen(0,'127.0.0.1');await once(server,'listening');
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const origin='http://127.0.0.1:'+server.address().port;
  const res=await fetch(origin+path,{method:'POST',headers:{origin,'content-type':'application/json'},body:'{}'});
  assert.equal(res.status,503);assert.equal((await res.json()).code,'LOCAL_AI_DISABLED');
});

test('bad credentials, foreign origin, and spoofed Host cannot call the model',async t=>{
  const s=await setup(t);const body=JSON.stringify({goal:'Build a task manager'});
  assert.equal((await s.post(body,{authorization:'Bearer wrong'})).status,401);
  assert.equal((await s.post(body,{origin:'https://outside.example'})).status,403);
  const spoofed=await new Promise((resolve,reject)=>{
    const req=httpRequest(s.origin+path,{method:'POST',headers:{host:'localhost:'+new URL(s.origin).port,
      origin:s.origin,authorization:'Bearer '+token,'content-type':'application/json'}},res=>{
      res.resume();res.on('end',()=>resolve(res.statusCode));
    });
    req.on('error',reject);req.end(body);
  });
  assert.equal(spoofed,403);
  assert.equal(s.calls(),0);assert.deepEqual(await readdir(s.outputRoot),[]);
});

test('invalid requests fail before inference and cannot create artifacts',async t=>{
  const s=await setup(t);
  assert.equal((await s.post('{')).status,400);
  assert.equal((await s.post(JSON.stringify({goal:'Build a task manager',extra:true}))).status,400);
  assert.equal((await s.post(JSON.stringify({goal:'Build a task manager',mode:'other'}))).status,400);
  assert.equal((await s.post(JSON.stringify({goal:'Build a task manager'}),{'content-type':'text/plain'})).status,415);
  assert.equal((await s.post(JSON.stringify({goal:'x'.repeat(5000)}))).status,413);
  assert.equal((await s.post(JSON.stringify({goal:'Create a banking app'}))).status,422);
  assert.equal(s.calls(),0);assert.deepEqual(await readdir(s.outputRoot),[]);
});

test('explicit full-application mode quarantines nine synthetic files without execution',async t=>{
  let calls=0;
  const s=await setup(t,async(url,request)=>{
    calls++;
    const body=JSON.parse(request.body);
    assert.equal(body.options.num_predict,8192);
    return new Response(JSON.stringify({model,done:true,done_reason:'stop',eval_count:25,total_duration:1,
      response:JSON.stringify(fullDraft)}),{status:200});
  });
  const res=await s.post(JSON.stringify({goal:'Build a task manager',mode:'full-application'}));
  assert.equal(res.status,201);
  const result=await res.json();
  assert.equal(calls,1);
  assert.equal(result.contract,'FULL_APPLICATION_V1');
  assert.match(result.stageId,/^constructor-full-app-quarantine-/);
  assert.equal(result.execution,'NOT_RUN');
  assert.equal(result.independentQa,'NOT_RUN');
  assert.equal(result.release,'DENIED');
  const manifest=JSON.parse(await readFile(join(s.outputRoot,result.stageId,'stage-manifest.json'),'utf8'));
  assert.deepEqual(manifest.files.map(file=>file.path),FULL_APP_FILES);
  assert.equal(await readFile(join(s.outputRoot,result.stageId,'app.mjs'),'utf8'),fullSources['app.mjs']);
  assert.equal(globalThis.__localFullAppMustNotRun,undefined);
});

test('disconnect requests cancellation and never stages a cancelled model response',async t=>{
  let started,aborted,calls=0;
  const ready=new Promise(resolve=>{started=resolve;});
  const cancelled=new Promise(resolve=>{aborted=resolve;});
  const s=await setup(t,async(url,options)=>{
    calls++;
    if(calls===1)return new Promise((resolve,reject)=>{
      started();
      options.signal.addEventListener('abort',()=>{aborted();const e=Error('aborted');e.name='AbortError';reject(e);},{once:true});
    });
    return new Response(JSON.stringify({model,done:true,response:JSON.stringify(draft)}),{status:200});
  });
  const req=httpRequest(s.origin+path,{method:'POST',headers:{origin:s.origin,
    authorization:'Bearer '+token,'content-type':'application/json'}});
  req.on('error',()=>{});
  req.end(JSON.stringify({goal:'Build a task manager'}));
  await ready;
  req.destroy();
  await cancelled;
  await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(await readdir(s.outputRoot),[]);
  const next=await s.post(JSON.stringify({goal:'Build a task manager'}));
  assert.equal(next.status,201);
  assert.equal(calls,2);
});

test('synthetic request reaches the model adapter and creates quarantine only',async t=>{
  const s=await setup(t);const res=await s.post(JSON.stringify({goal:'Build a task manager'}));
  assert.equal(res.status,201);const result=await res.json();
  assert.equal(result.status,'QUARANTINED_NOT_EXECUTED');
  assert.equal(result.execution,'NOT_RUN');assert.equal(result.independentQa,'NOT_RUN');
  assert.equal(result.approval,'NOT_GRANTED');assert.equal(result.release,'DENIED');
  assert.match(result.draftSha256,/^[a-f0-9]{64}$/);
  assert.match(result.stageId,/^constructor-task-quarantine-/);
  assert.equal(JSON.stringify(result).includes(s.outputRoot),false);
  assert.equal(JSON.stringify(result).includes(token),false);
  assert.equal(s.calls(),1);
  const manifest=JSON.parse(await readFile(join(s.outputRoot,result.stageId,'stage-manifest.json'),'utf8'));
  assert.equal(manifest.release,'DENIED');assert.equal(manifest.independentQa,'NOT_RUN');
});

test('model transport errors are sanitized and do not create quarantine',async t=>{
  const s=await setup(t,async()=>{throw Error('secret transport detail');});
  const res=await s.post(JSON.stringify({goal:'Build a task manager'}));const result=await res.json();
  assert.equal(res.status,502);assert.equal(result.code,'LOCAL_MODEL_UNAVAILABLE');
  assert.equal(JSON.stringify(result).includes('secret transport detail'),false);
  assert.deepEqual(await readdir(s.outputRoot),[]);
});

test('dangerous model output is blocked before quarantine',async t=>{
  const unsafe={...draft,files:[{path:'app.mjs',content:'process.env.SECRET; export const x=1;'},draft.files[1]]};
  const s=await setup(t,async()=>new Response(JSON.stringify({model,done:true,response:JSON.stringify(unsafe)}),{status:200}));
  const res=await s.post(JSON.stringify({goal:'Build a task manager'}));
  assert.equal(res.status,422);assert.equal((await res.json()).code,'MODEL_DRAFT_OR_QUARANTINE_REJECTED');
  assert.deepEqual(await readdir(s.outputRoot),[]);
});

test('chunked request size is bounded even without Content-Length',async t=>{
  const s=await setup(t);
  const result=await new Promise((resolve,reject)=>{
    const req=httpRequest(s.origin+path,{method:'POST',headers:{origin:s.origin,
      authorization:'Bearer '+token,'content-type':'application/json'}},res=>{
      res.resume();res.on('end',()=>resolve(res.statusCode));
    });
    req.on('error',reject);req.write('x'.repeat(3000));req.end('x'.repeat(3000));
  });
  assert.equal(result,413);assert.equal(s.calls(),0);
});

test('only one generation per local server may run at a time',async t=>{
  let release;let started;
  const ready=new Promise(resolve=>{started=resolve;});
  const hold=new Promise(resolve=>{release=resolve;});
  const s=await setup(t,async()=>{started();await hold;return new Response(JSON.stringify({model,done:true,response:JSON.stringify(draft)}),{status:200});});
  const first=s.post(JSON.stringify({goal:'Build a task manager'}));await ready;
  try {
    const second=await s.post(JSON.stringify({goal:'Build a task manager'}));
    assert.equal(second.status,409);assert.equal((await second.json()).code,'LOCAL_GENERATION_BUSY');
  } finally {release();}
  assert.equal((await first).status,201);
});
