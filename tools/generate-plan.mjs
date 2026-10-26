#!/usr/bin/env node
// Owner-operated plan-only CLI. Source produced by AI never executes or deploys.
import {randomUUID} from "node:crypto";
import {issueLocalDraftPermit} from "../engineering/local-permit.mjs";
import {runPlanOnlyMission} from "../engineering/plan-only.mjs";
import {quarantineDraft} from "../engineering/proof-bundle.mjs";

const args=process.argv.slice(2);
function option(name){const pos=args.indexOf(name);return pos>=0?args[pos+1]:undefined;}
const approved=args.includes("--confirm-inference");
const provider=option("--provider")||"groq";
const root=option("--quarantine-root");
const quarantineApproved=args.includes("--confirm-quarantine");
if(args.includes("--help")){
  process.stdout.write(
    'Usage: npm run plan -- --goal "Build a task tracker" --confirm-inference [--provider groq|freellmapi] [--confirm-free-only] [--quarantine-root DIR --confirm-quarantine]\n'+
    'groq requires GROQ_API_KEY, GROQ_MODEL and PLAN_AUTH_KEY.\n'+
    'freellmapi requires FREELLMAPI_API_KEY, PLAN_AUTH_KEY and FREE_ONLY flags; see docs/FREELLMAPI_INTEGRATION.md.\n'+
    'FreeLLMAPI is an owner-only internal prototype and MUST be separately hosted/configured; no live backend is implied.\n'+
    'plan ONLY, no code execution, no deployment.\n'
  );
}else if(!approved){
  process.stderr.write("BLOCKED: explicit --confirm-inference is required.\n");process.exitCode=2;
}else if(provider!=="groq"&&provider!=="freellmapi"){
  process.stderr.write("BLOCKED: unsupported provider.\n");process.exitCode=2;
}else if((root&&!quarantineApproved)||(quarantineApproved&&!root)){
  process.stderr.write("BLOCKED: --quarantine-root requires --confirm-quarantine (and vice versa).\n");process.exitCode=2;
}else if(!option("--goal")||!process.env.PLAN_AUTH_KEY){
  process.stderr.write("BLOCKED: goal and PLAN_AUTH_KEY required.\n");process.exitCode=2;
}else if(provider==="groq"&&(!process.env.GROQ_API_KEY||!process.env.GROQ_MODEL)){
  process.stderr.write("BLOCKED: GROQ_API_KEY and GROQ_MODEL required.\n");process.exitCode=2;
}else if(provider==="freellmapi"&&(!args.includes("--confirm-free-only")||
  !process.env.FREELLMAPI_API_KEY||
  process.env.FREELLMAPI_FREE_CHAIN_VERIFIED!=="true"||
  process.env.FREELLMAPI_PAID_BILLING_DISABLED!=="true"||
  process.env.FREELLMAPI_INTERNAL_ONLY!=="true"||
  process.env.FREELLMAPI_TERMS_REVIEWED!=="true")){
  process.stderr.write("BLOCKED: proxy key, --confirm-free-only and all FREE_ONLY owner confirmations required.\n");
  process.exitCode=2;
}else{
  const mission={id:"plan-"+randomUUID(),goal:option("--goal"),allowModel:true};
  const now=Date.now();
  try{
    const permit=issueLocalDraftPermit({missionId:mission.id,secret:process.env.PLAN_AUTH_KEY,now});
    const isProxy=provider==="freellmapi";
    const result=await runPlanOnlyMission({
      mission,permit,permitSecret:process.env.PLAN_AUTH_KEY,
      consumedNonces:new Set(),provider,
      apiKey:isProxy?process.env.FREELLMAPI_API_KEY:process.env.GROQ_API_KEY,
      model:isProxy?(process.env.FREELLMAPI_MODEL||"auto"):process.env.GROQ_MODEL,
      proxyBaseUrl:process.env.FREELLMAPI_BASE_URL||"http://127.0.0.1:3001/v1",
      proxyApprovedRemoteOrigin:process.env.FREELLMAPI_ALLOWED_REMOTE_ORIGIN,
      proxyFreeChainVerified:isProxy&&process.env.FREELLMAPI_FREE_CHAIN_VERIFIED==="true",
      proxyPaidBillingDisabled:isProxy&&process.env.FREELLMAPI_PAID_BILLING_DISABLED==="true",
      proxyInternalPrototypeOnly:isProxy&&process.env.FREELLMAPI_INTERNAL_ONLY==="true",
      proxyTermsReviewed:isProxy&&process.env.FREELLMAPI_TERMS_REVIEWED==="true",
      now
    });
    if(root){
      const receipt=await quarantineDraft({result,outputRoot:root});
      process.stdout.write(JSON.stringify(receipt,null,2)+"\n");
    }else process.stdout.write(JSON.stringify(result,null,2)+"\n");
  }catch(error){
    const safe=typeof error.code==="string"&&/^[A-Z][A-Z_]{2,70}$/.test(error.code)
      ?error.code:"PLAN_FAILED";
    process.stderr.write("BLOCKED: "+safe+"\n");process.exitCode=1;
  }
}
