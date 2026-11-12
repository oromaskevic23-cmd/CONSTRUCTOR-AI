import test from 'node:test';import assert from 'node:assert/strict';import {exportValidatedDraftZip} from '../engineering/draft-zip-export.mjs';
const draft=JSON.stringify({schema:'constructor_draft_v1',summary:'Task manager draft',steps:[{id:'build',action:'Create app',acceptance:'File exists'}],files:[{path:'index.html',content:'<!doctype html><title>Task Manager</title>'},{path:'app.js',content:'console.log("ready")'}]});
test('exports deterministic ZIP with manifest and explicit unverified state',()=>{
 const a=exportValidatedDraftZip(draft),b=exportValidatedDraftZip(draft);
 assert.equal(a.zip.toString('hex'),b.zip.toString('hex'));
 assert.equal(a.zip.readUInt32LE(0),0x04034b50);
 assert.equal(a.zip.readUInt32LE(a.zip.length-22),0x06054b50);
 assert.equal(a.manifest.mode,'UNTRUSTED_DRAFT_NOT_EXECUTED');
 assert.equal(a.manifest.files.length,2);
});
test('rejects unsafe paths and reserved filenames',()=>{
 const obj=JSON.parse(draft);obj.files[0].path='../escape.js';
 assert.throws(()=>exportValidatedDraftZip(JSON.stringify(obj)));
 obj.files[0].path='manifest.json';
 assert.throws(()=>exportValidatedDraftZip(JSON.stringify(obj)),/Reserved/);
});
