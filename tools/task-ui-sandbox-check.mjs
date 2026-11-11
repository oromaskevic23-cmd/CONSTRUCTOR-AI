// Run only inside the isolated no-network container with mounted /work and /ui.
// This test intentionally imports the staged candidate and must never run on the host.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Window} from '/deps/happy-dom/lib/index.js';
import {mountTaskUi} from '/ui/ui.mjs';
import * as candidate from '/work/app.mjs';

const html=await readFile('/ui/index.html','utf8');
function setup(){
  let raw=null,sequence=0;
  const storage={getItem:()=>raw,setItem:(_key,value)=>{raw=value;}};
  const win=new Window({url:'http://127.0.0.1/',settings:{disableJavaScriptEvaluation:true,
    disableJavaScriptFileLoading:true,disableCSSFileLoading:true}});
  win.document.write(html);win.confirm=()=>true;
  const root=win.document.querySelector('#task-workspace');
  mountTaskUi(root,candidate,{storage,idGenerator:()=>`candidate-${++sequence}`});
  const el=selector=>root.querySelector(selector);
  const add=value=>{el('#task-title').value=value;el('#task-form').dispatchEvent(new win.Event('submit',{bubbles:true,cancelable:true}));};
  return {root,el,add,storage};
}

test('revised candidate powers task UI creation, status, filters and persistence',()=>{
  const app=setup();app.add('First task');app.add('Second task');
  assert.equal(app.el('#count-all').textContent,'2');
  app.el('button[aria-label="Complete: Second task"]').click();
  assert.equal(app.el('#count-done').textContent,'1');
  app.el('button[data-filter="open"]').click();
  assert.equal(app.el('.task-title').textContent,'First task');
  app.el('button[data-filter="done"]').click();
  app.el('button[aria-label="Reopen: Second task"]').click();
  assert.equal(app.el('#count-done').textContent,'0');
  assert.deepEqual(JSON.parse(app.storage.getItem()),[
    {id:'candidate-2',title:'Second task',done:false},
    {id:'candidate-1',title:'First task',done:false}]);
});

test('revised candidate and UI keep synthetic markup as text',()=>{
  const app=setup();app.add('<img src=x onerror=alert(1)>');
  assert.equal(app.el('.task-title').textContent,'<img src=x onerror=alert(1)>');
  assert.equal(app.root.querySelector('img'),null);
});
