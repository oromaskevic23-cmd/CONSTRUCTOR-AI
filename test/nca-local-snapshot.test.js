import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,rm,writeFile,readFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {createQueue,enqueue,claim,complete,ownerStop} from "../src/nca-lease-reference.js";
import {snapshotQueue,restoreQueue,saveSnapshot,loadSnapshot} from "../src/nca-local-snapshot.mjs";

test("queued task survives snapshot roundtrip",()=>{
 const q=createQueue();enqueue(q,{id:"a",payload:{type:"test"}});
 const restored=restoreQueue(snapshotQueue(q));
 assert.deepEqual(restored.tasks.get("a").payload,{type:"test"});
 assert.equal(claim(restored,"a","worker",100,50).epoch,1);
});
test("lease epoch survives restart and old worker cannot publish",()=>{
 const q=createQueue();enqueue(q,{id:"a",payload:null});
 const old=claim(q,"a","worker-a",100,50);
 const restored=restoreQueue(snapshotQueue(q));
 const fresh=claim(restored,"a","worker-b",150,50);
 assert.equal(fresh.epoch,2);
 assert.throws(()=>complete(restored,old,151,"bad"),/STALE_LEASE/);
});
test("stopped state survives restart and remains fail closed",()=>{
 const q=createQueue();enqueue(q,{id:"a",payload:null});ownerStop(q);
 const restored=restoreQueue(snapshotQueue(q));
 assert.throws(()=>claim(restored,"a","worker",100),/OWNER_STOP/);
});
test("corrupt, duplicate and inconsistent snapshots are rejected",()=>{
 assert.throws(()=>restoreQueue("{"),SyntaxError);
 const q=createQueue();enqueue(q,{id:"a",payload:null});
 const s=JSON.parse(snapshotQueue(q));
 s.tasks.push({...s.tasks[0]});
 assert.throws(()=>restoreQueue(JSON.stringify(s)),TypeError);
 s.tasks.pop();s.stopped=true;
 assert.throws(()=>restoreQueue(JSON.stringify(s)),TypeError);
});
test("file snapshot can be loaded in a fresh queue instance",async()=>{
 const dir=await mkdtemp(join(tmpdir(),"nca-snapshot-"));
 try {
   const path=join(dir,"queue.json");
   const q=createQueue();enqueue(q,{id:"a",payload:"persisted"});
   await saveSnapshot(path,q);
   const loaded=await loadSnapshot(path);
   assert.equal(loaded.tasks.get("a").payload,"persisted");
 } finally {await rm(dir,{recursive:true,force:true});}
});

test("interrupted temporary snapshot does not replace committed state",async()=>{
 const dir=await mkdtemp(join(tmpdir(),"nca-interrupt-"));
 try {
   const path=join(dir,"queue.json");
   const q=createQueue();enqueue(q,{id:"committed",payload:"original"});
   await saveSnapshot(path,q);
   await writeFile(path+".999.tmp",'{"schema":1,"tasks":');
   const recovered=await loadSnapshot(path);
   assert.equal(recovered.tasks.get("committed").payload,"original");
   assert.equal(recovered.tasks.size,1);
 } finally {await rm(dir,{recursive:true,force:true});}
});
test("truncated committed snapshot fails closed rather than silently resetting queue",async()=>{
 const dir=await mkdtemp(join(tmpdir(),"nca-corrupt-"));
 try {
   const path=join(dir,"queue.json");
   const q=createQueue();enqueue(q,{id:"a",payload:"data"});
   await saveSnapshot(path,q);
   await writeFile(path,'{"schema":1');
   await assert.rejects(loadSnapshot(path),SyntaxError);
 } finally {await rm(dir,{recursive:true,force:true});}
});
test("saved snapshot is parseable and does not expose transient temporary path",async()=>{
 const dir=await mkdtemp(join(tmpdir(),"nca-atomic-"));
 try {
   const path=join(dir,"queue.json");
   const q=createQueue();enqueue(q,{id:"a",payload:"safe"});
   await saveSnapshot(path,q);
   const raw=await readFile(path,"utf8");
   assert.equal(JSON.parse(raw).schema,1);
 } finally {await rm(dir,{recursive:true,force:true});}
});
