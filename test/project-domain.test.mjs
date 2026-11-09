import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeProject, accentPalette, createGuardedStorageWriter, validateRecords, saveRecord, changeStatus, removeRecord, filterRecords, summarizeRecords, TEMPLATE_IDS, templateDefinition} from '../src/project-domain.mjs';
import {createZip, crc32} from '../src/zip.mjs';
for (const template of TEMPLATE_IDS) test(`${template}: create, edit, status, totals and delete preserve input`, () => {
  const record = {id:'record-1',title:'First',detail:'Customer',value:12.34,status:templateDefinition(template).statuses[0]};
  const first=saveRecord([],record,template), changed=saveRecord(first,{...record,title:'Updated'},template);
  assert.equal(first[0].title,'First'); assert.equal(changed[0].title,'Updated');
  assert.notEqual(changeStatus(changed,'record-1',template)[0].status,record.status);
  assert.equal(summarizeRecords(first,template)[0][1],1);
  assert.deepEqual(removeRecord(changed,'record-1',template),[]);
});
test('project and stored records reject invalid configuration and duplicate identities',()=>{
  assert.equal(normalizeProject({template:'crm',name:'  Sales   desk  '}).name,'Sales desk');
  for(const input of [{template:'other',name:'a'},{template:'crm',name:''},{template:'crm',name:'a',accent:'url(x)'},{template:'crm',name:'a',extra:true}]) assert.throws(()=>normalizeProject(input));
  const r={id:'x',title:'t',detail:'',value:0,status:'Open'};
  assert.throws(()=>validateRecords([r,r],'tasks'),/duplicate/);
  assert.throws(()=>validateRecords([{...r,value:Infinity}],'tasks'));
  assert.throws(()=>validateRecords([{...r,status:'Unknown'}],'tasks'));
  assert.throws(()=>removeRecord([r],'missing','tasks'));
});
test('custom accents select readable text and visible focus colors',()=>{
 assert.deepEqual(accentPalette('#000000'),{onAccent:'#ffffff',textAccent:'#66e3c4',focusAccent:'#66e3c4'});
 assert.deepEqual(accentPalette('#ffffff'),{onAccent:'#000000',textAccent:'#ffffff',focusAccent:'#ffffff'});
 assert.deepEqual(accentPalette('#3469db'),{onAccent:'#ffffff',textAccent:'#66e3c4',focusAccent:'#3469db'});
 assert.deepEqual(accentPalette('#66e3c4'),{onAccent:'#000000',textAccent:'#66e3c4',focusAccent:'#66e3c4'});
 assert.throws(()=>accentPalette('url(https://invalid.test)'),/Accent/);
});
test('guarded storage saves only under an exclusive lock and refuses stale snapshots', async()=>{
 const storage={raw:null,writes:0,getItem(){return this.raw;},setItem(_key,value){this.raw=value;this.writes++;}};
 const locks={async request(name,options,callback){assert.equal(name,'constructor-storage:workspace');
   assert.deepEqual(options,{mode:'exclusive',ifAvailable:true});return callback({name});}};
 const first=createGuardedStorageWriter({storage,locks,key:'workspace',initialRaw:null});
 const stale=createGuardedStorageWriter({storage,locks,key:'workspace',initialRaw:null});
 assert.deepEqual(await first.write('first'),{status:'SAVED'});
 assert.deepEqual(await stale.write('second'),{status:'SESSION_ONLY',reason:'EXTERNAL_CHANGE'});
 assert.equal(storage.raw,'first');assert.equal(storage.writes,1);
 assert.deepEqual(await stale.write('third'),{status:'SESSION_ONLY',reason:'EXTERNAL_CHANGE'});
 assert.equal(storage.raw,'first');
});
test('guarded storage fails closed for unavailable locks, contention and storage failure', async()=>{
 const storage={raw:null,writes:0,getItem(){return this.raw;},setItem(_key,value){this.raw=value;this.writes++;}};
 const missing=createGuardedStorageWriter({storage,key:'workspace',initialRaw:null});
 assert.equal(missing.reason,'LOCKS_UNAVAILABLE');
 assert.deepEqual(await missing.write('x'),{status:'SESSION_ONLY',reason:'LOCKS_UNAVAILABLE'});
 const busy=createGuardedStorageWriter({storage,locks:{request:async(_name,_options,callback)=>callback(null)},key:'workspace',initialRaw:null});
 assert.deepEqual(await busy.write('x'),{status:'BUSY'});assert.equal(storage.writes,0);
 const rejected=createGuardedStorageWriter({storage,locks:{request:async()=>{throw Error('unavailable');}},key:'workspace',initialRaw:null});
 assert.deepEqual(await rejected.write('x'),{status:'SESSION_ONLY',reason:'LOCKS_UNAVAILABLE'});
 let lateCallback;
 const brokenLocks={request:async(_name,_options,callback)=>{lateCallback=callback;return {status:'SAVED'};}};
 const malformed=createGuardedStorageWriter({storage,locks:brokenLocks,key:'workspace',initialRaw:null});
 assert.deepEqual(await malformed.write('x'),{status:'SESSION_ONLY',reason:'LOCKS_UNAVAILABLE'});
 lateCallback({});assert.equal(storage.writes,0,'late callbacks must not write');
 const spoofed=createGuardedStorageWriter({storage,locks:{request:async(_name,_options,callback)=>{callback(null);return {status:'SAVED'};}},key:'workspace',initialRaw:null});
 assert.deepEqual(await spoofed.write('x'),{status:'SESSION_ONLY',reason:'LOCKS_UNAVAILABLE'});
 const broken={getItem(){throw Error('blocked');},setItem(){assert.fail('must not write');}};
 const writer=createGuardedStorageWriter({storage:broken,locks:{request:async(_name,_options,callback)=>callback({})},key:'workspace',initialRaw:null});
 assert.deepEqual(await writer.write('x'),{status:'SESSION_ONLY',reason:'STORAGE_UNAVAILABLE'});
 assert.throws(()=>createGuardedStorageWriter({storage,locks:null,key:'',initialRaw:null}),/configuration/);
 assert.equal(storage.writes,0);
});
test('task search and status filters combine without changing stored records',()=>{
 const records=[
  {id:'a',title:'Review Contract',detail:'Quarterly report',value:0,status:'Open'},
  {id:'b',title:'Ship release',detail:'Contract checked',value:0,status:'Done'},
  {id:'c',title:'Call client',detail:'',value:0,status:'Open'}
 ];
 const original=structuredClone(records);
 assert.deepEqual(filterRecords(records,'tasks',{query:'  CONTRACT  '}).map(r=>r.id),['a','b']);
 assert.deepEqual(filterRecords(records,'tasks',{query:'contract',status:'Done'}).map(r=>r.id),['b']);
 assert.deepEqual(filterRecords(records,'tasks',{status:'Open'}).map(r=>r.id),['a','c']);
 assert.deepEqual(filterRecords(records,'tasks',{query:'not present'}),[]);
 assert.throws(()=>filterRecords(records,'tasks',{status:'Unknown'}),/status filter/);
 assert.throws(()=>filterRecords(records,'tasks',{query:'x'.repeat(241)}),/Search/);
 assert.deepEqual(records,original);
});
test('ZIP rejects traversal, duplicates and excessive bytes',()=>{
  for(const path of ['../x','a/../x','/x','.env','a//b','a\\b'])assert.throws(()=>createZip([{path,content:'x'}]));
  assert.throws(()=>createZip([{path:'A.txt',content:'a'},{path:'a.txt',content:'b'}]),/duplicate/);
  assert.throws(()=>createZip([{path:'a.txt',content:'x'.repeat(5*1024*1024+1)}]),/budget/);
});
test('ZIP uses standard CRC32 and deterministic STORE headers',()=>{
  assert.equal(crc32(new TextEncoder().encode('123456789')),0xcbf43926);
  const files=[{path:'hello.txt',content:'Hello'}]; const a=createZip(files),b=createZip(files);
  assert.deepEqual(a,b); const d=new DataView(a.buffer); assert.equal(d.getUint32(0,true),0x04034b50);
  assert.equal(d.getUint16(8,true),0);assert.equal(d.getUint32(14,true),crc32(new TextEncoder().encode('Hello')));
  assert.equal(d.getUint32(a.length-22,true),0x06054b50);
});
