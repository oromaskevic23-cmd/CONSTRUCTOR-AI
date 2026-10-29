import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeProject, validateRecords, saveRecord, changeStatus, removeRecord, summarizeRecords, TEMPLATE_IDS, templateDefinition} from '../src/project-domain.mjs';
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
