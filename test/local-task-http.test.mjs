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
import {localTaskApiUrl,formatQuarantinedCandidate} from '../src/local-ai-policy.mjs';

const token='local-session-example-0123456789ABCDEF';
const permitSecret='local-permit-example-0123456789ABCDEF';
const model='fixture:local-v1';
const path='/api/local-velion/task-draft';
const draft={schema:'constructor_draft_v1',summary:'Synthetic candidate',
  steps:[{id:'create',action:'Create domain API',acceptance:'Separate QA required'}],
  files:[{path:'app.mjs',content:'export const createTask=(id,title)=>({id,title,done:false});\n'},
    {path:'test/app.test.mjs',content:'export const testFixture=true;\n'}]};

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
  assert.equal((await s.post(JSON.stringify({goal:'Build a task manager'}),{'content-type':'text/plain'})).status,415);
  assert.equal((await s.post(JSON.stringify({goal:'x'.repeat(5000)}))).status,413);
  assert.equal((await s.post(JSON.stringify({goal:'Create a banking app'}))).status,422);
  assert.equal(s.calls(),0);assert.deepEqual(await readdir(s.outputRoot),[]);
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
  assert.equal(result.preview.trust,'UNTRUSTED_MODEL_TEXT');
  assert.deepEqual(result.preview.files,draft.files);
  const shown=formatQuarantinedCandidate(result);
  assert.match(shown,/UNTRUSTED MODEL OUTPUT/);
  assert.match(shown,/app\.mjs/);
  assert.match(shown,/createTask/);
  assert.equal(s.calls(),1);
  const manifest=JSON.parse(await readFile(join(s.outputRoot,result.stageId,'stage-manifest.json'),'utf8'));
  assert.equal(manifest.release,'DENIED');assert.equal(manifest.independentQa,'NOT_RUN');
});

test('candidate preview fails closed on changed state, unexpected files and excessive text',()=>{
  const base={status:'QUARANTINED_NOT_EXECUTED',execution:'NOT_RUN',independentQa:'NOT_RUN',
    approval:'NOT_GRANTED',release:'DENIED',draftSha256:'a'.repeat(64),
    stageManifestSha256:'b'.repeat(64),stageId:'constructor-task-quarantine-Ab12',model:'fixture:local-v1',
    preview:{trust:'UNTRUSTED_MODEL_TEXT',summary:'Example',files:draft.files}};
  assert.match(formatQuarantinedCandidate(base),/review only/);
  for(const change of [
    {release:'ALLOWED'},
    {stageId:'../outside'},
    {preview:{...base.preview,files:[draft.files[0],{path:'other.mjs',content:'x'}]}},
    {preview:{...base.preview,files:[draft.files[0],{...draft.files[1],content:'x'.repeat(20001)}]}},
  ])assert.throws(()=>formatQuarantinedCandidate({...base,...change}),/INVALID_QUARANTINE_PREVIEW/);
  const markup={...base,preview:{...base.preview,summary:'<img src=x onerror=alert(1)>'}};
  assert.match(formatQuarantinedCandidate(markup),/<img src=x/); // Caller uses textContent.
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

test('disconnect cancels the local model request and frees the generation slot',async t=>{
  let started, cancelled, calls=0;
  const ready=new Promise(resolve=>{started=resolve;});
  const stopped=new Promise(resolve=>{cancelled=resolve;});
  const s=await setup(t,async (_url,{signal})=>{
    calls++;
    if(calls>1)return new Response(JSON.stringify({model,done:true,response:JSON.stringify(draft)}),{status:200});
    started();
    return new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>{
      cancelled();reject(Error('local provider aborted'));
    },{once:true}));
  });
  const abort=new AbortController();
  const first=fetch(s.origin+path,{method:'POST',signal:abort.signal,headers:{
    'content-type':'application/json','origin':s.origin,'authorization':'Bearer '+token
  },body:JSON.stringify({goal:'Build a task manager'})});
  await ready;
  abort.abort();
  await assert.rejects(first,{name:'AbortError'});
  await stopped;
  assert.deepEqual(await readdir(s.outputRoot),[]);
  const second=await s.post(JSON.stringify({goal:'Build a task manager'}));
  assert.equal(second.status,201);
  assert.equal(calls,2);
});
