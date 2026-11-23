import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,rm,readFile,writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {appendJournal,loadJournal,verifyJournal,EMPTY_JOURNAL_HEAD} from "../src/nca-evidence-journal.mjs";
const fixture=async fn=>{const dir=await mkdtemp(join(tmpdir(),"nca-journal-"));try{await fn(join(dir,"journal.jsonl"));}finally{await rm(dir,{recursive:true,force:true});}};
test("append and recover two fsynced hash-linked events",async()=>fixture(async file=>{
 const a=await appendJournal(file,{kind:"ENQUEUED",at:100,data:{id:"a"}},EMPTY_JOURNAL_HEAD);
 const b=await appendJournal(file,{kind:"CLAIMED",at:101,data:{id:"a",epoch:1}},a.hash);
 const recovered=await loadJournal(file);
 assert.equal(recovered.entries.length,2);
 assert.equal(recovered.head,b.hash);
 assert.equal(recovered.nextSeq,3);
}));
test("stale expected head fails closed",async()=>fixture(async file=>{
 await appendJournal(file,{kind:"ENQUEUED",at:1,data:{id:"a"}},EMPTY_JOURNAL_HEAD);
 await assert.rejects(appendJournal(file,{kind:"CLAIMED",at:2,data:{id:"a"}},EMPTY_JOURNAL_HEAD),/JOURNAL_HEAD_CONFLICT/);
 assert.equal((await loadJournal(file)).entries.length,1);
}));
test("modified event data breaks hash verification",async()=>fixture(async file=>{
 await appendJournal(file,{kind:"ENQUEUED",at:1,data:{id:"a"}},EMPTY_JOURNAL_HEAD);
 const raw=await readFile(file,"utf8");
 await writeFile(file,raw.replace('"id":"a"','"id":"b"'));
 await assert.rejects(loadJournal(file),/JOURNAL_TAMPERED/);
}));
test("truncated journal fails closed",()=>assert.throws(()=>verifyJournal('{"seq":1'),/JOURNAL_CORRUPT/));
test("invalid event rejected before writing",async()=>fixture(async file=>{
 await assert.rejects(appendJournal(file,{kind:"bad-kind",at:1,data:{}},EMPTY_JOURNAL_HEAD),TypeError);
}));
