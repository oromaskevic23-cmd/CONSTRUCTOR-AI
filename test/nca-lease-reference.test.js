import test from "node:test";
import assert from "node:assert/strict";
import { createQueue, enqueue, claim, complete, ownerStop } from "../src/nca-lease-reference.js";

test("duplicate id is idempotent", () => {
  const q = createQueue();
  assert.equal(enqueue(q, {id:"t1",payload:"first"}), true);
  assert.equal(enqueue(q, {id:"t1",payload:"second"}), false);
  assert.equal(q.tasks.get("t1").payload, "first");
});
test("one live lease per task", () => {
  const q = createQueue(); enqueue(q, {id:"t1",payload:null});
  assert.deepEqual(claim(q,"t1","a",100,50), {id:"t1",worker:"a",epoch:1});
  assert.equal(claim(q,"t1","b",101,50), null);
});
test("stale fencing token cannot publish after lease expiry", () => {
  const q = createQueue(); enqueue(q,{id:"t1",payload:null});
  const old = claim(q,"t1","a",100,50);
  const fresh = claim(q,"t1","b",150,50);
  assert.equal(fresh.epoch,2);
  assert.throws(() => complete(q,old,151,"stale"),/STALE_LEASE/);
  assert.equal(complete(q,fresh,151,"new"),true);
  assert.equal(q.tasks.get("t1").state,"VERIFYING");
});
test("worker cannot self-certify completion", () => {
  const q = createQueue(); enqueue(q,{id:"t1",payload:null});
  const token = claim(q,"t1","a",100);
  complete(q,token,101,"output");
  assert.notEqual(q.tasks.get("t1").state,"COMPLETED");
});
test("owner stop denies claims and publication", () => {
  const q = createQueue(); enqueue(q,{id:"t1",payload:null});
  const token = claim(q,"t1","a",100);
  ownerStop(q);
  assert.throws(() => complete(q,token,101,"result"),/OWNER_STOP/);
  assert.throws(() => claim(q,"t1","b",102),/OWNER_STOP/);
  assert.equal(q.tasks.get("t1").state,"STOPPED");
});
test("invalid lease and identifiers fail closed", () => {
  const q = createQueue();
  assert.throws(() => enqueue(q,{id:"../bad",payload:null}),TypeError);
  enqueue(q,{id:"t1",payload:null});
  assert.throws(() => claim(q,"t1","worker",100,0),TypeError);
});
