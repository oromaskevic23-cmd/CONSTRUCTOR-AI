// FreeLLMAPI compatibility adapter for CONSTRUCTOR AI. Reference-only, gated, no tool execution.
// Does not vendor or deploy the upstream proxy. Never routes automatically to paid service.
import {createHash} from "node:crypto";
import {validateMission,parseModelDraft} from "./draft-contract.mjs";

const MODEL_RE=/^[A-Za-z0-9][A-Za-z0-9._/:+-]{0,119}$/;
const KEY_RE=/^[\x21-\x7e]{32,512}$/;
const MAX_BYTES=96000;
const MESSAGE=[
  "You are VELEON's CONSTRUCTOR AI engineering draft generator.",
  "Return exactly one JSON object without markdown or tool calls.",
  "Schema constructor_draft_v1: keys schema, summary, steps and files.",
  "Steps: 1-12 items (id, action, acceptance). Files: at most 8 (path,content), total under 32768 bytes.",
  "No credentials, secrets, destructive actions, test-pass claims or release authorization.",
  "This is UNTRUSTED planning text, not permission to build, execute, pay or deploy."
].join(" ");
const hash=s=>createHash("sha256").update(s,"utf8").digest("hex");
export class FreeLLMAPIError extends Error {
  constructor(code){super(code);this.name="FreeLLMAPIError";this.code=code;}
}
function blocked(code){throw new FreeLLMAPIError(code);}

export function resolveFreeLLMAPIEndpoint(baseUrl,{approvedRemoteOrigin}={}){
  if(typeof baseUrl!=="string"||baseUrl.length>256)blocked("PROXY_ENDPOINT_INVALID");
  let url;
  try{url=new URL(baseUrl);}catch{blocked("PROXY_ENDPOINT_INVALID");}
  if(url.username||url.password||url.search||url.hash||
     !["/v1","/v1/"].includes(url.pathname))blocked("PROXY_ENDPOINT_INVALID");
  const loopback=url.protocol==="http:"&&url.hostname==="127.0.0.1"&&url.port==="3001";
  // Remote is explicit HTTPS only, with exact independent owner-set origin pin.
  const remote=url.protocol==="https:"&&url.port===""&&
    /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])$/i.test(url.hostname)&&
    url.hostname.includes(".")&&!url.hostname.endsWith(".local")&&
    !url.hostname.endsWith(".internal")&&
    typeof approvedRemoteOrigin==="string"&&
    approvedRemoteOrigin===url.origin;
  if(!loopback&&!remote)blocked("PROXY_ENDPOINT_NOT_APPROVED");
  return url.origin+"/v1/chat/completions";
}

async function limitedJSON(response){
  if(!response||typeof response.ok!=="boolean")blocked("PROXY_PROTOCOL_INVALID");
  if(!response.ok){
    if(response.status===401||response.status===403)blocked("PROXY_AUTH_DENIED");
    if(response.status===429)blocked("PROXY_RATE_LIMITED");
    blocked("PROXY_HTTP_FAILED");
  }
  const ct=response.headers?.get?.("content-type");
  if(ct&&!/^application\/json(?:\s*;|\s*$)/i.test(ct))blocked("PROXY_CONTENT_TYPE_INVALID");
  const declared=response.headers?.get?.("content-length");
  if(declared!==null&&declared!==undefined&&
    Number.isFinite(Number(declared))&&Number(declared)>MAX_BYTES)blocked("PROXY_BODY_TOO_LARGE");
  if(!response.body||typeof response.body.getReader!=="function")blocked("PROXY_BODY_INVALID");
  let n=0;const chunks=[];const reader=response.body.getReader();
  try {
    for(;;){
      const {value,done}=await reader.read();if(done)break;
      if(!(value instanceof Uint8Array))blocked("PROXY_BODY_INVALID");
      n+=value.length;if(n>MAX_BYTES)blocked("PROXY_BODY_TOO_LARGE");
      chunks.push(value);
    }
  }catch(e){
    if(e instanceof FreeLLMAPIError)throw e;
    blocked("PROXY_BODY_UNREADABLE");
  }finally{try{await reader.cancel();}catch{}}
  let text;
  try{text=new TextDecoder("utf-8",{fatal:true}).decode(Buffer.concat(chunks,n));}
  catch{blocked("PROXY_BODY_ENCODING_INVALID");}
  try{return JSON.parse(text);}catch{blocked("PROXY_JSON_INVALID");}
}

/** Requires an owner-verified, non-billable chain and internal-prototype-only policy.
 * Attestation flags are NOT independent proof of the provider's billing or terms.
 */
export async function generateFreeLLMAPIDraft({
  mission,apiKey,model="auto",baseUrl="http://127.0.0.1:3001/v1",
  approvedRemoteOrigin,freeChainVerified=false,paidBillingDisabled=false,
  internalPrototypeOnly=false,termsReviewed=false,
  fetchImpl=globalThis.fetch,timeoutMs=20000
}={}){
  const m=validateMission(mission);
  if(freeChainVerified!==true||paidBillingDisabled!==true||
    internalPrototypeOnly!==true||termsReviewed!==true)blocked("PROXY_FREE_ONLY_POLICY_DENIED");
  if(typeof apiKey!=="string"||!KEY_RE.test(apiKey))blocked("PROXY_KEY_MISSING_OR_INVALID");
  if(typeof model!=="string"||!MODEL_RE.test(model)||model.includes("://"))blocked("PROXY_MODEL_INVALID");
  if(typeof fetchImpl!=="function")blocked("PROXY_TRANSPORT_UNAVAILABLE");
  if(!Number.isInteger(timeoutMs)||timeoutMs<1000||timeoutMs>30000)blocked("PROXY_TIMEOUT_INVALID");
  const endpoint=resolveFreeLLMAPIEndpoint(baseUrl,{approvedRemoteOrigin});
  const body={
    model,stream:false,temperature:0.1,max_completion_tokens:4000,
    messages:[
      {role:"system",content:MESSAGE},
      {role:"user",content:"Mission ID: "+m.id+"\nRequested software: "+m.goal}
    ]
  };
  let response;
  try{
    response=await fetchImpl(endpoint,{
      method:"POST",redirect:"error",
      headers:{"Authorization":"Bearer "+apiKey,"Content-Type":"application/json","Accept":"application/json"},
      body:JSON.stringify(body),signal:AbortSignal.timeout(timeoutMs)
    });
  }catch{blocked("PROXY_TRANSPORT_FAILED");}
  const payload=await limitedJSON(response);
  const choice=payload?.choices?.[0],message=choice?.message;
  if(choice?.finish_reason!=="stop"||
     typeof message?.content!=="string"||message.tool_calls||
     message.function_call||payload?.error)blocked("PROXY_INCOMPLETE_OR_TOOL_RESPONSE");
  const validated=parseModelDraft(message.content);
  return Object.freeze({
    status:"DRAFT_VALIDATED_NOT_EXECUTED",
    mission_id:m.id,
    input_sha256:hash(JSON.stringify({id:m.id,goal:m.goal})),
    model_provider:"freellmapi-proxy",
    model:model,
    upstream_reported_model:typeof payload.model==="string"?payload.model.slice(0,128):null,
    model_response_id:typeof payload.id==="string"?payload.id.slice(0,128):null,
    model_output_sha256:hash(message.content),
    validated_draft_sha256:validated.sha256,
    free_chain_status:"OWNER_DECLARATION_NOT_PROVIDER_ATTESTATION",
    route_verification:"NOT_INDEPENDENTLY_VERIFIED",
    evidence_level:"E2_CONTRACT_ONLY",
    independent_qa:"NOT_RUN",
    sandbox_execution:"NOT_RUN",
    release:"DENIED",
    draft:validated.draft
  });
}
