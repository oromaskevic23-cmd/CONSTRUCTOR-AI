// Plan-only mission runner: signed local permit; AI drafts NEVER execute or deploy.
import {validateMission} from "./draft-contract.mjs";
import {verifyLocalDraftPermit} from "./local-permit.mjs";
import {generateGroqDraft} from "./groq-gateway.mjs";
import {generateFreeLLMAPIDraft} from "./freellmapi-gateway.mjs";

export async function runPlanOnlyMission({
  mission, permit, permitSecret, consumedNonces,
  provider="groq", apiKey, model, fetchImpl, timeoutMs=20000, now=Date.now(),
  proxyBaseUrl, proxyApprovedRemoteOrigin,
  proxyFreeChainVerified=false, proxyPaidBillingDisabled=false,
  proxyInternalPrototypeOnly=false, proxyTermsReviewed=false
}) {
  const m=validateMission(mission);
  const authorization=verifyLocalDraftPermit({
    token:permit,missionId:m.id,secret:permitSecret,consumedNonces,now
  });
  let result;
  if(provider==="groq"){
    result=await generateGroqDraft({mission:m,apiKey,model,fetchImpl,timeoutMs});
  }else if(provider==="freellmapi"){
    result=await generateFreeLLMAPIDraft({
      mission:m,apiKey,model,baseUrl:proxyBaseUrl,
      approvedRemoteOrigin:proxyApprovedRemoteOrigin,
      freeChainVerified:proxyFreeChainVerified,
      paidBillingDisabled:proxyPaidBillingDisabled,
      internalPrototypeOnly:proxyInternalPrototypeOnly,
      termsReviewed:proxyTermsReviewed,fetchImpl,timeoutMs
    });
  }else{
    const err=new Error("BLOCKED_PROVIDER_NOT_APPROVED");
    err.code="BLOCKED_PROVIDER_NOT_APPROVED";
    throw err;
  }
  return Object.freeze({
    ...result,
    authorization:{
      stage:"PLAN_ONLY",
      action:authorization.action,
      status:"LOCAL_HMAC_PERMIT_VERIFIED",
      note:"No independent human identity, production approval or sandbox authorization has been verified"
    }
  });
}
