import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Window} from 'happy-dom';
import {mountTaskUi} from '../qa/task-ui/ui.mjs';
import * as fixture from './fixtures/task-ui-domain.mjs';

const html=await readFile(new URL('../qa/task-ui/index.html',import.meta.url),'utf8');
function memoryStorage(initial=null){
  let raw=initial;
  return {getItem(){return raw;},setItem(_key,value){raw=value;},snapshot(){return raw;}};
}
function setup(storage=memoryStorage(),domain=fixture,ids=['task-1','task-2','task-3']){
  const win=new Window({url:'http://127.0.0.1:4173/',settings:{disableJavaScriptEvaluation:true,
    disableJavaScriptFileLoading:true,disableCSSFileLoading:true}});
  win.document.write(html);win.confirm=()=>true;
  const root=win.document.querySelector('#task-workspace');
  mountTaskUi(root,domain,{storage,idGenerator:()=>ids.shift()});
  const el=selector=>root.querySelector(selector);
  const add=value=>{el('#task-title').value=value;el('#task-form').dispatchEvent(new win.Event('submit',{bubbles:true,cancelable:true}));};
  const click=selector=>el(selector).click();
  return {win,root,el,add,click,storage};
}

test('task UI creates, filters, completes, reopens, deletes and reloads synthetic tasks',()=>{
  const s=setup();s.add('First');s.add('Second');
  assert.equal(s.el('#count-all').textContent,'2');
  s.click('button[aria-label="Complete: Second"]');
  assert.equal(s.el('#count-done').textContent,'1');
  s.click('button[data-filter="open"]');
  assert.equal(s.root.querySelectorAll('.task-row').length,1);
  assert.equal(s.el('.task-title').textContent,'First');
  s.click('button[data-filter="done"]');
  assert.equal(s.el('.task-title').textContent,'Second');
  s.click('button[aria-label="Reopen: Second"]');
  assert.equal(s.el('#count-done').textContent,'0');
  s.click('button[data-filter="all"]');s.click('button[aria-label="Delete: First"]');
  assert.equal(s.el('#count-all').textContent,'1');
  const restored=setup(s.storage);assert.equal(restored.el('.task-title').textContent,'Second');
  assert.equal(restored.el('#count-open').textContent,'1');
});

test('task titles render as text and invalid domain output cannot overwrite data',()=>{
  const storage=memoryStorage();const s=setup(storage);
  s.add('<img src=x onerror=alert(1)>');
  assert.equal(s.el('.task-title').textContent,'<img src=x onerror=alert(1)>');
  assert.equal(s.root.querySelector('img'),null);
  const before=storage.snapshot();
  const bad=setup(storage,{...fixture,createTask:()=>({id:'wrong',title:'wrong',done:false})},['new-id']);
  bad.add('Valid');assert.equal(storage.snapshot(),before);
  assert.match(bad.el('#notice').textContent,/Unable to add/);
});

test('invalid stored data and stale tabs never overwrite previously saved data',()=>{
  const corrupt=memoryStorage('{invalid-json'),a=setup(corrupt);a.add('Only in memory');
  assert.equal(corrupt.snapshot(),'{invalid-json');assert.equal(a.el('#storage-warning').hidden,false);
  const shared=memoryStorage(),first=setup(shared,fixture,['first']),second=setup(shared,fixture,['second']);
  first.add('First tab');const stored=shared.snapshot();second.add('Second tab');
  assert.equal(shared.snapshot(),stored);assert.match(second.el('#storage-warning').textContent,/another tab/);
  assert.equal(second.el('.task-title').textContent,'Second tab');
});

test('a bad model filter result does not hide the display error after saving',()=>{
  const storage=memoryStorage();
  const s=setup(storage,{...fixture,filterOpen:()=>[]});
  s.click('button[data-filter="open"]');s.add('Saved task');
  assert.match(s.el('#notice').textContent,/could not be displayed/);
  assert.match(storage.snapshot(),/Saved task/);
});
