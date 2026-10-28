// CONSTRUCTOR AI -> VELION reviewed private proposal. No general-purpose model access.
// Local-only shared-secret HMAC + existing single-use local draft permit.
import {createHash,createHmac,randomBytes} from "node:crypto";
import {validateMission} from "./draft-contract.mjs";
import {verifyLocalDraftPermit} from "./local-permit.mjs";
export const REVIEWED_MISSION_ID = "IC-CONSTRUCTOR-ORDER-001";
export const REVIEWED_GOAL = "Review order-preserving deduplication for a public synthetic Python example.";
const URL="http://127.0.0.1:8765/v1/model/proposals";
const HASH=/^[a-f0-9]{64}$/;
export class VelionProposalError extends Error {
  constructor(code){super(code);this.name="VelionProposalError";this.code=code;}
}
export function verifyReceipt(r){
  if (!r || typeof r!=="object" || Array.isArray(r) ||
      r.schema!=="imperial_velion_receipt_v1" ||
      r.task_id!==REVIEWED_MISSION_ID || r.origin!=="CONSTRUCTOR_AI" ||
      r.capability!=="code:review" || r.status!=="VERIFIED_PROPOSAL_ONLY" ||
      r.model!=="nemotron-3-nano:4b" ||
      r.decision!=="ORDER_LOSS" || r.recommendation!=="PRESERVE_INSERTION_ORDER" ||
      r.execute_allowed!==false || r.payment_confirmed!==false ||
      r.execution!=="NOT_EXECUTED" ||
      r.human_approval!=="NOT_GRANTED_BY_ROUTER" ||
      !HASH.test(r.request_sha256||"") || !HASH.test(r.output_sha256||"") ||
      !Number.isSafeInteger(r.generated_tokens) || r.generated_tokens<1 ||
      !Number.isSafeInteger(r.model_size_bytes) || r.model_size_bytes<1500000000)
    throw new VelionProposalError("REMOTE_RECEIPT_CONTRACT_REJECTED");
  return Object.freeze({
    mission_id:REVIEWED_MISSION_ID,stage:"PLAN_ONLY",
    status:"VERIFIED_PROPOSAL_NOT_EXECUTED",
    provider:"VELION_NVIDIA_NEMOTRON_LOCAL",model:r.model,
    decision:r.decision,recommendation:r.recommendation,
    input_sha256:r.request_sha256,output_sha256:r.output_sha256,
    generated_tokens:r.generated_tokens,
    independent_qa:"BOUNDED_SEMANTIC_CHECK",sandbox_execution:"NOT_RUN",
    release:"DENIED",payment_confirmed:false
  });
}
export async function runApprovedVelionProposal({
  mission,permit,permitSecret,consumedNonces,bridgeSecret,
  fetchImpl=fetch,now=Date.now(),timeoutMs=150000,
  nonce=randomBytes(18).toString("base64url")
}={}){
  const m=validateMission(mission);
  if(m.id!==REVIEWED_MISSION_ID || m.goal!==REVIEWED_GOAL)
    throw new VelionProposalError("ONLY_REVIEWED_PUBLIC_MISSION_ALLOWED");
  const permitData=verifyLocalDraftPermit({
    token:permit,missionId:m.id,secret:permitSecret,consumedNonces,now
  });
  if(permitData.action!=="model:generate_draft")
    throw new VelionProposalError("PERMIT_ACTION_REJECTED");
  if(typeof bridgeSecret!=="string" || Buffer.byteLength(bridgeSecret)<32 ||
     Buffer.byteLength(bridgeSecret)>4096)
    throw new VelionProposalError("STRONG_BRIDGE_SECRET_REQUIRED");
  if(!Number.isSafeInteger(timeoutMs)||timeoutMs<1000||timeoutMs>180000)
    throw new VelionProposalError("INVALID_TIMEOUT");
  if(!Number.isSafeInteger(now)||!(/^[A-Za-z0-9_-]{12,80}$/).test(nonce))
    throw new VelionProposalError("INVALID_REQUEST_NONCE_OR_CLOCK");
  if(typeof fetchImpl!=="function")throw new VelionProposalError("FETCH_UNAVAILABLE");
  const payload=JSON.stringify({schema:"velion_private_request_v1",
    task_id:REVIEWED_MISSION_ID,origin:"CONSTRUCTOR_AI"});
  const timestamp=String(Math.floor(now/1000));
  const signed=["POST","/v1/model/proposals",timestamp,nonce,
    createHash("sha256").update(payload).digest("hex")].join("\n");
  const signature=createHmac("sha256",bridgeSecret).update(signed).digest("hex");
  let response;
  try{
    response=await fetchImpl(URL,{
      method:"POST",redirect:"error",
      headers:{"Content-Type":"application/json","Accept":"application/json",
        "X-Velion-Timestamp":timestamp,"X-Velion-Nonce":nonce,
        "X-Velion-Signature":signature},
      body:payload,signal:AbortSignal.timeout(timeoutMs)
    });
  }catch{throw new VelionProposalError("LOCAL_BRIDGE_UNAVAILABLE");}
  if(!response?.ok)throw new VelionProposalError("LOCAL_BRIDGE_REFUSED");
  let text;
  try{text=await response.text();}
  catch{throw new VelionProposalError("LOCAL_BRIDGE_BODY_UNREADABLE");}
  if(typeof text!=="string"||text.length>16000)
    throw new VelionProposalError("LOCAL_BRIDGE_RESPONSE_TOO_LARGE");
  let parsed;
  try{parsed=JSON.parse(text);}
  catch{throw new VelionProposalError("LOCAL_BRIDGE_JSON_INVALID");}
  return verifyReceipt(parsed);
}
