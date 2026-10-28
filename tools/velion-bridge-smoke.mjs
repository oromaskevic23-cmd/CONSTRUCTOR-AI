// Only for reviewed, LOCAL real-model end-to-end CI; never customer-facing.
import {randomBytes} from "node:crypto";
import {issueLocalDraftPermit} from "../engineering/local-permit.mjs";
import {runApprovedVelionProposal,REVIEWED_MISSION_ID,REVIEWED_GOAL} from "../engineering/velion-proposal-client.mjs";
const bridgeSecret=process.env.VELION_LOCAL_HMAC_SECRET;
const permitSecret=process.env.VELION_LOCAL_PERMIT_SECRET;
if(!bridgeSecret || !permitSecret)throw new Error("LOCAL_TEST_SECRETS_UNAVAILABLE");
const now=Date.now();
const permit=issueLocalDraftPermit({missionId:REVIEWED_MISSION_ID,
  secret:permitSecret,now,nonce:randomBytes(20).toString("base64url")});
const result=await runApprovedVelionProposal({
  mission:{id:REVIEWED_MISSION_ID,goal:REVIEWED_GOAL,allowModel:true},
  permit,permitSecret,consumedNonces:new Set(),bridgeSecret,now,timeoutMs:170000
});
if(result.status!=="VERIFIED_PROPOSAL_NOT_EXECUTED" || result.release!=="DENIED" ||
   result.sandbox_execution!=="NOT_RUN" || result.payment_confirmed!==false)
  throw new Error("REAL_INFERENCE_NOT_VERIFIED");
console.log(JSON.stringify({
  status:"REAL_VELION_TO_CONSTRUCTOR_BRIDGE_PASS",
  mission_id:result.mission_id,model:result.model,
  decision:result.decision,recommendation:result.recommendation,
  generated_tokens:result.generated_tokens,
  output_sha256:result.output_sha256,
  release:result.release,execution:result.sandbox_execution
}));
