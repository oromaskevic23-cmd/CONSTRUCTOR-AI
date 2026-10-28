import {test} from "node:test";
import assert from "node:assert/strict";
import {createHash,createHmac} from "node:crypto";
import {issueLocalDraftPermit} from "../engineering/local-permit.mjs";
import {runApprovedVelionProposal,REVIEWED_MISSION_ID,REVIEWED_GOAL} from "../engineering/velion-proposal-client.mjs";
const BRIDGE="never-use-this-for-production-velion-test-key";
const PERMIT="never-use-this-for-production-permit-secret";
const NOW=1761658900000;
function args(){
  return {mission:{id:REVIEWED_MISSION_ID,goal:REVIEWED_GOAL,allowModel:true},
    permit:issueLocalDraftPermit({missionId:REVIEWED_MISSION_ID,secret:PERMIT,now:NOW,
      nonce:"permitNonce123456789"}),permitSecret:PERMIT,consumedNonces:new Set(),
    bridgeSecret:BRIDGE,now:NOW,nonce:"bridgeNonce123456789"};
}
function receipt(){
  return {schema:"imperial_velion_receipt_v1",task_id:REVIEWED_MISSION_ID,
    origin:"CONSTRUCTOR_AI",capability:"code:review",
    status:"VERIFIED_PROPOSAL_ONLY",model:"nemotron-3-nano:4b",
    decision:"ORDER_LOSS",recommendation:"PRESERVE_INSERTION_ORDER",
    execute_allowed:false,payment_confirmed:false,execution:"NOT_EXECUTED",
    human_approval:"NOT_GRANTED_BY_ROUTER",request_sha256:"a".repeat(64),
    output_sha256:"b".repeat(64),model_size_bytes:2837597147,generated_tokens:33};
}
const fake=(r)=>async()=>({ok:true,text:async()=>JSON.stringify(r)});
test("permit-backed signed request is bound to reviewed VELION task",async()=>{
  const result=await runApprovedVelionProposal({...args(),fetchImpl:async(url,options)=>{
    assert.equal(url,"http://127.0.0.1:8765/v1/model/proposals");
    assert.equal(options.redirect,"error");
    assert.deepEqual(JSON.parse(options.body),{schema:"velion_private_request_v1",
      task_id:REVIEWED_MISSION_ID,origin:"CONSTRUCTOR_AI"});
    const h=options.headers;
    const canonical=["POST","/v1/model/proposals",h["X-Velion-Timestamp"],h["X-Velion-Nonce"],
      createHash("sha256").update(options.body).digest("hex")].join("\n");
    assert.equal(h["X-Velion-Signature"],createHmac("sha256",BRIDGE).update(canonical).digest("hex"));
    return {ok:true,text:async()=>JSON.stringify(receipt())};
  }});
  assert.equal(result.status,"VERIFIED_PROPOSAL_NOT_EXECUTED");
  assert.equal(result.release,"DENIED");
});
test("cannot substitute a customer mission",async()=>{
  await assert.rejects(runApprovedVelionProposal({...args(),
    mission:{...args().mission,goal:"Handle private paid customer issue"},
    fetchImpl:fake(receipt())}),/ONLY_REVIEWED_PUBLIC_MISSION_ALLOWED/);
});
test("forged permit denied",async()=>{
  await assert.rejects(runApprovedVelionProposal({...args(),permit:"forged",fetchImpl:fake(receipt())}));
});
test("permit is one-time, including across repeated calls",async()=>{
  const a={...args(),fetchImpl:fake(receipt())};
  await runApprovedVelionProposal(a);
  await assert.rejects(runApprovedVelionProposal(a),/PERMIT_REPLAY_DETECTED/);
});
test("remote response cannot claim execution, payment or other task",async()=>{
  for(const mutation of [{execution:"EXECUTED"},{payment_confirmed:true},
    {status:"PAYMENT_CONFIRMED"},{task_id:"IC-NCA-HTTP429-001"},
    {generated_tokens:0},{decision:"DANGEROUS"}]){
    await assert.rejects(runApprovedVelionProposal({...args(),fetchImpl:fake({...receipt(),...mutation})}),
      /REMOTE_RECEIPT_CONTRACT_REJECTED/);
  }
});
test("no fake result when connection is absent",async()=>{
  await assert.rejects(runApprovedVelionProposal({...args(),
    fetchImpl:async()=>{throw new Error("down");}}),/LOCAL_BRIDGE_UNAVAILABLE/);
});
