// Shared untrusted model-response boundary. Byte limits apply to decoded fetch streams.
export class ResponseBoundaryError extends Error {
  constructor(code){super(code);this.name='ResponseBoundaryError';this.code=code;}
}
const fail=code=>new ResponseBoundaryError(code);
// Draft contract: at most 64,000 UTF-16 code units of serialized draft text.
// Outer JSON may escape each code unit as six ASCII bytes; reserve 16 KiB
// for the envelope. A reviewed proposal is a fixed receipt, not source code.
export const MAX_DRAFT_TEXT_UNITS=64000;
export const DRAFT_ENVELOPE_BYTES=MAX_DRAFT_TEXT_UNITS*6+16384;
export const REVIEW_RECEIPT_BYTES=16384;
// Nested trusted bridge emits only these fixed codes; never propagate raw provider messages.
const bridgeCodes=new Set(['VELION_CHAT_MODEL_RESPONSE_REJECTED','VELION_CHAT_MODEL_RESPONSE_INCOMPLETE','VELION_CHAT_MODEL_RESPONSE_SCHEMA_INVALID','VELION_CHAT_FORMAT_DISABLED','VELION_CHAT_BUSY']);
export function parseBoundedJson(text,maxDepth=24){
  if(typeof text!=='string'||!Number.isInteger(maxDepth)||maxDepth<1||maxDepth>64)throw fail('JSON_INVALID');
  let depth=0,quoted=false,escaped=false;
  for(const c of text){
    if(quoted){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c==='"')quoted=false;continue;}
    if(c==='"'){quoted=true;continue;}
    if(c==='{'||c==='['){if(++depth>maxDepth)throw fail('JSON_DEPTH_EXCEEDED');}
    else if(c==='}'||c===']'){if(--depth<0)throw fail('JSON_INVALID');}
  }
  if(depth!==0||quoted)throw fail('JSON_INVALID');
  try{return JSON.parse(text,(key,value)=>{
    if(['__proto__','constructor','prototype'].includes(key))throw fail('JSON_FORBIDDEN_KEY');
    if(typeof value==='string'&&value.length>MAX_DRAFT_TEXT_UNITS)throw fail('JSON_STRING_LIMIT');
    if(Array.isArray(value)&&value.length>128)throw fail('JSON_ARRAY_LIMIT');
    if(value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length>128)throw fail('JSON_KEY_LIMIT');
    return value;
  });}catch(error){if(error instanceof ResponseBoundaryError)throw error;throw fail('JSON_INVALID');}
}

export async function fetchBounded({fetchImpl=fetch,url,options={},maxBytes,timeoutMs,
  ttfbMs=Math.min(timeoutMs,30000),idleMs=Math.min(timeoutMs,10000),readErrorBody=false,requireJson=false}={}){
  if(!Number.isSafeInteger(maxBytes)||maxBytes<1||maxBytes>1000000||
     ![timeoutMs,ttfbMs,idleMs].every(n=>Number.isSafeInteger(n)&&n>0&&n<=180000))
    throw fail('RESPONSE_BOUNDARY_CONFIG_INVALID');
  const controller=new AbortController(),parent=options.signal;
  let reader,response,phaseTimer,totalTimer,reason,bytes=0;
  const stop=code=>{
    if(controller.signal.aborted)return;
    reason=code;
    // Initiate cancellation before abort so synthetic readers also observe cancel.
    try{const p=reader?reader.cancel():response?.body?.cancel();p?.catch(()=>{});}catch{}
    controller.abort(fail(code));
  };
  const onParent=()=>stop('RESPONSE_CANCELLED');
  if(parent?.aborted)throw fail('RESPONSE_CANCELLED');
  parent?.addEventListener('abort',onParent,{once:true});
  const guard=async work=>{
    if(controller.signal.aborted)throw fail(reason||'RESPONSE_CANCELLED');
    let onAbort;
    try{return await Promise.race([work,new Promise((_,reject)=>{
      onAbort=()=>reject(fail(reason||'RESPONSE_CANCELLED'));
      controller.signal.addEventListener('abort',onAbort,{once:true});
      if(controller.signal.aborted)onAbort();
    })]);}finally{if(onAbort)controller.signal.removeEventListener('abort',onAbort);}
  };
  const phase=(ms,code)=>{clearTimeout(phaseTimer);phaseTimer=setTimeout(()=>stop(code),ms);};
  totalTimer=setTimeout(()=>stop('RESPONSE_TOTAL_TIMEOUT'),timeoutMs);
  phase(ttfbMs,'RESPONSE_TTFB_TIMEOUT');
  try{
    response=await guard(Promise.resolve().then(()=>fetchImpl(url,{...options,redirect:'error',headers:{...options.headers,'Accept-Encoding':'gzip, deflate, br'},signal:controller.signal})));
    if(typeof response?.ok!=='boolean')throw fail('RESPONSE_PROTOCOL_INVALID');
    if(response.redirected||response.url&&new URL(response.url).href!==new URL(url).href)throw fail('RESPONSE_ORIGIN_MISMATCH');
    // Actual network fetch supplies a URL. Explicitly injected in-process
    // fixture/bridge responses can have an empty URL, but share byte/JSON checks.
    if(response.url){
      const encoding=(response.headers.get('content-encoding')||'identity').trim().toLowerCase();
      if(!['identity','gzip','deflate','br'].includes(encoding))throw fail('RESPONSE_ENCODING_UNSUPPORTED');
      if(requireJson&&response.ok&&!/^application\/(?:json|[a-z0-9.+-]+\+json)(?:\s*;|$)/i.test(response.headers.get('content-type')||''))throw fail('RESPONSE_CONTENT_TYPE_INVALID');
    }
    if(!response.ok&&!readErrorBody){
      try{response.body?.cancel().catch(()=>{});}catch{}
      return {response,text:null,decodedBytes:0};
    }
    reader=response.body?.getReader?.();
    if(!reader)throw fail('RESPONSE_BODY_UNREADABLE');
    const chunks=[];
    for(;;){
      const {done,value}=await guard(reader.read());
      if(controller.signal.aborted)throw fail(reason);
      if(done)break;
      if(!(value instanceof Uint8Array))throw fail('RESPONSE_BODY_UNREADABLE');
      if(value.byteLength===0)continue; // empty chunks do not renew the idle deadline
      bytes+=value.byteLength;
      if(bytes>maxBytes){stop('RESPONSE_TOO_LARGE');throw fail('RESPONSE_TOO_LARGE');}
      chunks.push(Buffer.from(value)); // own a bounded copy
      phase(idleMs,'RESPONSE_IDLE_TIMEOUT');
    }
    clearTimeout(phaseTimer);
    let text;
    try{text=new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks,bytes));}
    catch{throw fail('RESPONSE_BODY_UNREADABLE');}
    return {response,text,decodedBytes:bytes};
  }catch(error){
    stop(error instanceof ResponseBoundaryError||bridgeCodes.has(error?.code)?error.code:'RESPONSE_TRANSPORT_FAILED');
    const errorOut=fail(reason||'RESPONSE_TRANSPORT_FAILED');errorOut.bytesRead=bytes;throw errorOut;
  }finally{
    clearTimeout(phaseTimer);clearTimeout(totalTimer);
    parent?.removeEventListener('abort',onParent);
    try{reader?.releaseLock();}catch{}
  }
}
