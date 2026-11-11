import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp,readdir,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';
import {createServer} from 'node:http';
import {createVelionChatTransport} from '../engineering/velion-chat-transport.mjs';
import {createLocalTaskService,localTaskServiceFromEnv} from '../engineering/local-task-service.mjs';
import {createAppServer} from '../tools/serve.mjs';

const hash='a'.repeat(64),model='gguf-'+hash.slice(0,12),
  chatToken='fixture-velion-chat-token-0123456789abc',
  appToken='fixture-constructor-token-0123456789abc',
  permitSecret='fixture-permit-secret-0123456789abcdefghi',
  taskUrl='http://127.0.0.1:11434/api/generate';
const draft={schema:'constructor_draft_v1',summary:'Synthetic candidate',
  steps:[{id:'create',action:'Create task API',acceptance:'Independent QA required'}],
  files:[{path:'app.mjs',content:'export const createTask=(id,title)=>({id,title,done:false});\n'},
    {path:'test/app.test.mjs',content:'export const fixture=true;\n'}]};
const receipt={provider:'llama-cpp-local',modelSha256:hash,requestedModel:model,returnedModel:model,
  toolAccess:'NONE',approval:'NOT_GRANTED',outcome:'MODEL_RESPONSE_RECEIVED',
  startedAt:'2026-11-10T00:00:00.000Z',finishedAt:'2026-11-10T00:00:01.000Z',latencyMs:1000};
const input={model,stream:false,format:'json',prompt:'Build a task manager'};
const options={method:'POST',body:JSON.stringify(input)};
const digest=value=>createHash('sha256').update(value).digest('hex');
const fakeResponse=(changes={},prompt=input.prompt)=>new Response(JSON.stringify({answer:JSON.stringify(draft),
  receipt:{...receipt,inputSha256:digest(JSON.stringify([{role:'user',content:prompt}])),
    outputSha256:digest(JSON.stringify(draft))},...changes}),{status:200});

test('GGUF bridge requires explicit loopback configuration and rejects unrelated requests',async()=>{
  let calls=0;const fetchImpl=async()=>{calls++;return fakeResponse();};
  for(const config of [{port:0,accessToken:chatToken,expectedModelSha256:hash},
    {port:4174,accessToken:'short',expectedModelSha256:hash},
    {port:4174,accessToken:chatToken,expectedModelSha256:'bad'}])
    assert.throws(()=>createVelionChatTransport({...config,fetchImpl}),/VELION_CHAT_CONFIGURATION_INVALID/);
  const bridge=createVelionChatTransport({port:4174,accessToken:chatToken,expectedModelSha256:hash,fetchImpl});
  await assert.rejects(bridge('https://outside.example',options),/VELION_CHAT_REQUEST_INVALID/);
  await assert.rejects(bridge(taskUrl,{...options,body:JSON.stringify({...input,model:'other'})}),/VELION_CHAT_REQUEST_INVALID/);
  await assert.rejects(bridge(taskUrl,{...options,body:JSON.stringify({...input,prompt:'x'.repeat(4001)})}),/VELION_CHAT_REQUEST_INVALID/);
  assert.equal(calls,0);
});

test('VELION chat transport preserves strict task and quarantine boundaries',async t=>{
  const root=await mkdtemp(join(tmpdir(),'velion-chat-bridge-'));t.after(()=>rm(root,{recursive:true,force:true}));
  let calls=0;
  const bridge=createVelionChatTransport({port:4174,accessToken:chatToken,expectedModelSha256:hash,
    fetchImpl:async(url,request)=>{
      calls++;assert.equal(url,'http://127.0.0.1:4174/api/chat');
      assert.equal(request.redirect,'error');assert.equal(request.headers.Origin,'http://127.0.0.1:4174');
      assert.equal(request.headers.Authorization,'Bearer '+chatToken);
      const payload=JSON.parse(request.body);assert.equal(payload.messages.length,1);
      assert.equal(payload.messages[0].role,'user');assert.match(payload.messages[0].content,/task manager/i);
      return fakeResponse({},payload.messages[0].content);
    }});
  const service=createLocalTaskService({accessToken:appToken,permitSecret,model,outputRoot:root,
    fetchImpl:bridge,provider:'VELION_LOCAL_GGUF_CHAT_ADAPTER'});
  const result=await service.generate('Build a task manager');
  assert.equal(calls,1);assert.equal(result.provider,'VELION_LOCAL_GGUF_CHAT_ADAPTER');
  assert.equal(result.status,'QUARANTINED_NOT_EXECUTED');assert.equal(result.release,'DENIED');
  assert.equal(result.independentQa,'NOT_RUN');assert.equal(JSON.stringify(result).includes(chatToken),false);
  assert.equal(result.modelReceipt.modelSha256,hash);assert.equal((await readdir(root)).length,1);
});

test('two loopback HTTP servers carry a synthetic VELION response to quarantine',async t=>{
  const root=await mkdtemp(join(tmpdir(),'velion-bridge-http-'));t.after(()=>rm(root,{recursive:true,force:true}));
  const velion=createServer(async(req,res)=>{
    assert.equal(req.method,'POST');assert.equal(req.url,'/api/chat');
    assert.equal(req.headers.authorization,'Bearer '+chatToken);
    assert.equal(req.headers.origin,'http://127.0.0.1:'+velion.address().port);
    let raw='';for await(const chunk of req)raw+=chunk;
    const body=JSON.parse(raw);assert.equal(body.messages[0].role,'user');
    const answer=JSON.stringify(draft);
    res.writeHead(200,{'Content-Type':'application/json'});
    res.end(JSON.stringify({answer,receipt:{...receipt,inputSha256:digest(JSON.stringify(body.messages)),
      outputSha256:digest(answer)}}));
  });
  velion.listen(0,'127.0.0.1');await once(velion,'listening');
  t.after(()=>new Promise(resolve=>velion.close(resolve)));
  const bridge=createVelionChatTransport({port:velion.address().port,accessToken:chatToken,expectedModelSha256:hash});
  const service=createLocalTaskService({accessToken:appToken,permitSecret,model,outputRoot:root,
    fetchImpl:bridge,provider:'VELION_LOCAL_GGUF_CHAT_ADAPTER'});
  const constructor=createAppServer({localTaskService:service});
  constructor.listen(0,'127.0.0.1');await once(constructor,'listening');
  t.after(()=>new Promise(resolve=>constructor.close(resolve)));
  const origin='http://127.0.0.1:'+constructor.address().port;
  const response=await fetch(origin+'/api/local-velion/task-draft',{method:'POST',
    headers:{'Content-Type':'application/json','Origin':origin,'Authorization':'Bearer '+appToken},
    body:JSON.stringify({goal:'Build a task manager'})});
  assert.equal(response.status,201);const result=await response.json();
  assert.equal(result.status,'QUARANTINED_NOT_EXECUTED');assert.equal(result.release,'DENIED');
  assert.equal(result.modelReceipt.modelSha256,hash);
  const manifest=JSON.parse(await readFile(join(root,result.stageId,'stage-manifest.json'),'utf8'));
  assert.equal(manifest.modelReceipt.modelSha256,hash);assert.equal(manifest.execution,'NOT_RUN');
});

test('bridge refuses incorrect model identity, privileges, oversized bodies and failures',async()=>{
  for(const response of [
    fakeResponse({receipt:{...receipt,modelSha256:'b'.repeat(64)}}),
    fakeResponse({receipt:{...receipt,provider:'ollama-local'}}),
    fakeResponse({receipt:{...receipt,toolAccess:'ENABLED'}}),
    new Response('x'.repeat(65537),{status:200}),new Response('',{status:503})
  ]){
    const bridge=createVelionChatTransport({port:4174,accessToken:chatToken,expectedModelSha256:hash,
      fetchImpl:async()=>response});
    await assert.rejects(bridge(taskUrl,options));
  }
});

test('bridge propagates cancellation to the VELION request',async()=>{
  const cancel=new AbortController();let seen;
  const bridge=createVelionChatTransport({port:4174,accessToken:chatToken,expectedModelSha256:hash,
    fetchImpl:async(_url,request)=>{
      seen=request.signal;
      return new Promise((_resolve,reject)=>seen.addEventListener('abort',()=>reject(Error('cancelled')),{once:true}));
    }});
  const pending=bridge(taskUrl,{...options,signal:cancel.signal});
  cancel.abort();await assert.rejects(pending,/cancelled/);assert.equal(seen.aborted,true);
});

test('local GGUF route fails closed on bad configuration and secret reuse',()=>{
  const env={IMPERIAL_TASK_LOCAL_ONLY:'YES',CONSTRUCTOR_LOCAL_MODEL_ROUTE:'velion-gguf',
    CONSTRUCTOR_LOCAL_AI_TOKEN:appToken,VELION_LOCAL_PERMIT_SECRET:permitSecret,
    VELION_CHAT_TOKEN:chatToken,VELION_CHAT_PORT:'4174',VELION_GGUF_SHA256:hash,
    VELION_LOCAL_MODEL:model,CONSTRUCTOR_LOCAL_QUARANTINE:'/tmp'};
  assert.ok(localTaskServiceFromEnv(env));
  for(const change of [{VELION_CHAT_TOKEN:appToken},{VELION_LOCAL_MODEL:'different'},
    {VELION_CHAT_PORT:'0'},{VELION_GGUF_SHA256:'bad'},{CONSTRUCTOR_LOCAL_MODEL_ROUTE:'https://outside.example'}])
    assert.throws(()=>localTaskServiceFromEnv({...env,...change}),/CONFIGURATION_INVALID/);
});
