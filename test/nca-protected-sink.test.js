import test from "node:test";
import assert from "node:assert/strict";
import {generateKeyPairSync,sign} from "node:crypto";
import {createQueue,enqueue,claim,complete,ownerStop} from "../src/nca-lease-reference.js";
import {createOwnerGate,applyOwnerDirective,ownerDirectiveMessage} from "../src/nca-owner-authority.mjs";
import {createProtectedSink,publishVerified} from "../src/nca-protected-sink.mjs";
function setup() {
 const keys=generateKeyPairSync("ed25519");
 const gate=createOwnerGate(keys.publicKey.export({type:"spki",format:"pem"}));
 const q=createQueue();enqueue(q,{id:"a",payload:null});
 const token=claim(q,"worker-task-does-not-exist","worker",100,50);
 const active=claim(q,"a","worker",100,50);
 const sink=createProtectedSink({gate,queue:q});
 const directive=(action,epoch,nonce)=>({action,epoch,issuedAt:100,nonce});
 const apply=d=>applyOwnerDirective(gate,d,sign(null,Buffer.from(ownerDirectiveMessage(d)),keys.privateKey).toString("base64"));
 return {q,gate,sink,active,apply,directive};
}
test("verified candidate publishes once with correct epoch",()=>{
 const {q,sink,active}=setup();complete(q,active,101,"candidate");
 const record=publishVerified(sink,{taskId:"a",expectedEpoch:1,verificationId:"verified_123",result:"approved"});
 assert.equal(record.epoch,1);assert.equal(q.tasks.get("a").state,"COMPLETED");
 assert.throws(()=>publishVerified(sink,{taskId:"a",expectedEpoch:1,verificationId:"verified_123",result:"again"}),/UNVERIFIED_OR_STALE/);
});
test("signed Owner STOP denies publishing candidate",()=>{
 const {q,sink,active,apply,directive}=setup();complete(q,active,101,"candidate");
 apply(directive("STOP",1,"1234567890abcdef"));
 assert.throws(()=>publishVerified(sink,{taskId:"a",expectedEpoch:1,verificationId:"verified_123",result:"bad"}),/OWNER_STOP/);
});
test("stale epoch is rejected at sink",()=>{
 const {q,sink,active}=setup();complete(q,active,101,"candidate");
 assert.throws(()=>publishVerified(sink,{taskId:"a",expectedEpoch:2,verificationId:"verified_123",result:"bad"}),/UNVERIFIED_OR_STALE/);
});
test("queue-level STOP denies publication",()=>{
 const {q,sink,active}=setup();complete(q,active,101,"candidate");ownerStop(q);
 assert.throws(()=>publishVerified(sink,{taskId:"a",expectedEpoch:1,verificationId:"verified_123",result:"bad"}),/OWNER_STOP/);
});
