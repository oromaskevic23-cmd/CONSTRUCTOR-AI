import test from 'node:test';
import assert from 'node:assert/strict';
import {attachLocalAiController} from '../src/local-ai-policy.mjs';

class Element extends EventTarget {
  constructor(){super();this.value='';this.textContent='';this.disabled=true;this.dataset={};}
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function setup(pageUrl,fetchImpl){
  const form=new Element(),goal=new Element(),token=new Element(),submit=new Element(),
    cancel=new Element(),status=new Element(),result=new Element(),pageEvents=new EventTarget();
  attachLocalAiController({form,goal,token,submit,cancel,status,result,pageUrl,pageEvents,fetchImpl});
  const send=()=>form.dispatchEvent(new Event('submit',{cancelable:true}));
  return {form,goal,token,submit,cancel,status,result,pageEvents,send};
}
const validResult={status:'QUARANTINED_NOT_EXECUTED',execution:'NOT_RUN',independentQa:'NOT_RUN',
  approval:'NOT_GRANTED',release:'DENIED',release_allowed:false,artifactState:'QUARANTINED_DENIED',draftSha256:'a'.repeat(64),stageManifestSha256:'b'.repeat(64),
  stageId:'constructor-task-quarantine-ABC123',model:'fixture:local',
  preview:{trust:'UNTRUSTED_MODEL_TEXT',summary:'Synthetic result',files:[
    {path:'app.mjs',content:'export const example=true;'},
    {path:'test/app.test.mjs',content:'export const test=true;'}]}};

test('hosted Studio cannot transmit local session credentials',async()=>{
  let calls=0;
  const ui=setup('https://example.com/studio',async()=>{calls++;throw Error('must not send');});
  ui.token.value='fixture-secret';ui.goal.value='Build a task manager';ui.send();
  await tick();
  assert.equal(calls,0);assert.equal(ui.submit.disabled,true);
  assert.match(ui.status.textContent,/Open the local Studio/);
  ui.pageEvents.dispatchEvent(new Event('pagehide'));
  assert.equal(ui.token.value,'');
});

test('stop aborts a pending request and a later candidate remains review-only',async()=>{
  let calls=0,firstSignal;
  const ui=setup('http://127.0.0.1:4173/studio',async(url,options)=>{
    calls++;
    assert.equal(url,'http://127.0.0.1:4173/api/local-velion/task-draft');
    assert.equal(options.headers.Authorization,'Bearer fixture-local-token');
    if(calls===1){
      firstSignal=options.signal;
      return new Promise((_resolve,reject)=>options.signal.addEventListener('abort',()=>reject(Error('aborted')),{once:true}));
    }
    return new Response(JSON.stringify(validResult),{status:201});
  });
  assert.equal(ui.submit.disabled,false);assert.equal(ui.cancel.disabled,true);
  ui.token.value='fixture-local-token';ui.goal.value='Build a task manager';ui.send();
  assert.equal(calls,1);assert.equal(ui.token.value,'');
  assert.equal(ui.submit.disabled,true);assert.equal(ui.cancel.disabled,false);
  ui.send();assert.equal(calls,1);
  ui.cancel.dispatchEvent(new Event('click'));
  assert.equal(firstSignal.aborted,true);
  await tick();
  assert.equal(ui.submit.disabled,false);assert.equal(ui.cancel.disabled,true);
  assert.match(ui.status.textContent,/may already be in local quarantine/);
  assert.equal(ui.result.textContent,'');
  ui.token.value='fixture-local-token';ui.send();await tick();
  assert.equal(calls,2);assert.match(ui.result.textContent,/UNTRUSTED MODEL OUTPUT/);
  assert.match(ui.status.textContent,/No code was executed or approved/);
  assert.equal(ui.token.value,'');assert.equal(ui.cancel.disabled,true);
});

test('leaving the page requests cancellation and clears an entered token',async()=>{
  let signal;
  const ui=setup('http://127.0.0.1:4173/studio',async(_url,options)=>{
    signal=options.signal;
    return new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(Error('aborted')),{once:true}));
  });
  ui.token.value='fixture-local-token';ui.goal.value='Build a task manager';ui.send();
  ui.token.value='another-unsent-token';
  ui.pageEvents.dispatchEvent(new Event('pagehide'));
  assert.equal(signal.aborted,true);assert.equal(ui.token.value,'');
  await tick();assert.match(ui.status.textContent,/Stop requested/);
});

test('local model validation errors have a helpful bounded message',async()=>{
  const ui=setup('http://127.0.0.1:4173/studio',async()=>new Response(
    JSON.stringify({code:'LOCAL_MODEL_RESPONSE_REJECTED'}),{status:502}));
  ui.token.value='fixture-local-token';ui.goal.value='Build a task manager';ui.send();await tick();
  assert.match(ui.status.textContent,/incomplete or did not pass validation/);
  assert.equal(ui.result.textContent,'');assert.equal(ui.token.value,'');
});

test('generation failures distinguish incomplete output from an invalid draft schema',async()=>{
  for(const [code,message] of [
    ['LOCAL_MODEL_RESPONSE_INCOMPLETE',/stopped before finishing.*output limit/],
    ['LOCAL_MODEL_RESPONSE_SCHEMA_INVALID',/did not match the required draft format/],
  ]){
    const ui=setup('http://127.0.0.1:4173/studio',async()=>new Response(JSON.stringify({code}),{status:502}));
    ui.token.value='fixture-local-token';ui.goal.value='Build a task manager';ui.send();await tick();
    assert.match(ui.status.textContent,message);
    assert.match(ui.status.textContent,/No source was executed/);
    assert.equal(ui.result.textContent,'');assert.equal(ui.token.value,'');
  }
});

test('quarantined candidates show source-check failures without claiming independent QA',async()=>{
  for(const [state,issues,message] of [
    ['FAIL',['APP_MISSING_EXPORT_CREATETASK'],/source checks found problems/],
    ['PASS',[],/source checks passed; independent QA has not run/i],
  ]){
    const output={...validResult,artifactState:state==='FAIL'?'QUARANTINED_PREFLIGHT_FAILED':'QUARANTINED_DENIED',preflight:{status:state,scope:'SYNTAX_AND_MODULE_SHAPE_ONLY_NOT_QA',issues}};
    const ui=setup('http://127.0.0.1:4173/studio',async()=>new Response(JSON.stringify(output),{status:201}));
    ui.token.value='fixture-local-token';ui.goal.value='Build a task manager';ui.send();await tick();
    assert.match(ui.status.textContent,message);
    assert.equal(ui.status.dataset.status,output.artifactState);assert.equal(ui.status.dataset.releaseAllowed,'false');
    assert.match(ui.status.textContent,/No code was executed or approved/);
    assert.match(ui.result.textContent,/Independent QA: not run/);
  }
});

