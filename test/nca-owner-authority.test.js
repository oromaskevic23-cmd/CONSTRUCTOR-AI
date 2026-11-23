import test from "node:test";
import assert from "node:assert/strict";
import {generateKeyPairSync,sign} from "node:crypto";
import {createOwnerGate,applyOwnerDirective,assertOwnerAllowed,ownerDirectiveMessage} from "../src/nca-owner-authority.mjs";
const setup=()=>{
 const {publicKey,privateKey}=generateKeyPairSync("ed25519");
 const gate=createOwnerGate(publicKey.export({type:"spki",format:"pem"}));
 const signed=d=>sign(null,Buffer.from(ownerDirectiveMessage(d)),privateKey).toString("base64");
 return {gate,signed};
};
const directive=(action,epoch,nonce="1234567890abcdef")=>({action,epoch,issuedAt:100,nonce});
test("valid signed STOP blocks execution",()=>{
 const {gate,signed}=setup(),d=directive("STOP",1);
 assert.deepEqual(applyOwnerDirective(gate,d,signed(d)),{epoch:1,stopped:true});
 assert.throws(()=>assertOwnerAllowed(gate),/OWNER_STOP/);
});
test("unsigned and forged STOP are rejected",()=>{
 const {gate}=setup(),attacker=setup(),d=directive("STOP",1);
 assert.throws(()=>applyOwnerDirective(gate,d,attacker.signed(d)),/OWNER_SIGNATURE_INVALID/);
 assert.equal(gate.epoch,0);
});
test("replay and lower epochs are rejected",()=>{
 const {gate,signed}=setup(),stop=directive("STOP",3);
 applyOwnerDirective(gate,stop,signed(stop));
 assert.throws(()=>applyOwnerDirective(gate,stop,signed(stop)),/OWNER_DIRECTIVE_REJECTED/);
 const old=directive("RESUME",2,"different_nonce_1234");
 assert.throws(()=>applyOwnerDirective(gate,old,signed(old)),/OWNER_DIRECTIVE_REJECTED/);
 assert.equal(gate.stopped,true);
});
test("only newer signed RESUME clears STOP",()=>{
 const {gate,signed}=setup(),stop=directive("STOP",1),resume=directive("RESUME",2,"different_nonce_1234");
 applyOwnerDirective(gate,stop,signed(stop));
 assert.throws(()=>assertOwnerAllowed(gate),/OWNER_STOP/);
 applyOwnerDirective(gate,resume,signed(resume));
 assert.equal(assertOwnerAllowed(gate),true);
});
test("tampering with signed directive invalidates signature",()=>{
 const {gate,signed}=setup(),d=directive("STOP",1);
 assert.throws(()=>applyOwnerDirective(gate,{...d,action:"RESUME"},signed(d)),/OWNER_SIGNATURE_INVALID/);
});
