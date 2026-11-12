// Shared untrusted model-response boundary. Byte limits apply to decoded fetch streams.
export class ResponseBoundaryError extends Error {
  constructor(code){super(code);this.name='ResponseBoundaryError';this.code=code;}
}
const fail=code=>new ResponseBoundaryError(code);
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
  try{return JSON.parse(text);}catch{throw fail('JSON_INVALID');}
}

export async function fetchBounded({fetchImpl=fetch,url,options={},maxBytes,timeoutMs,
  ttfbMs=Math.min(timeoutMs,30000),idleMs=Math.min(timeoutMs,10000),readErrorBody=false}={}){
  if(!Number.isSafeInteger(maxBytes)||maxBytes<1||maxBytes>1000000||
     ![timeoutMs,ttfbMs,idleMs].every(n=>Number.isSafeInteger(n)&&n>0&&n<=180000))
    throw fail('RESPONSE_BOUNDARY_CONFIG_INVALID');
  const controller=new AbortController(),parent=options.signal;
  let reader,response,phaseTimer,totalTimer,reason;
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
    response=await guard(Promise.resolve().then(()=>fetchImpl(url,{...options,signal:controller.signal})));
    if(typeof response?.ok!=='boolean')throw fail('RESPONSE_PROTOCOL_INVALID');
    if(!response.ok&&!readErrorBody){
      try{response.body?.cancel().catch(()=>{});}catch{}
      return {response,text:null};
    }
    reader=response.body?.getReader?.();
    if(!reader)throw fail('RESPONSE_BODY_UNREADABLE');
    const chunks=[];let bytes=0;
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
    throw fail(reason||'RESPONSE_TRANSPORT_FAILED');
  }finally{
    clearTimeout(phaseTimer);clearTimeout(totalTimer);
    parent?.removeEventListener('abort',onParent);
    try{reader?.releaseLock();}catch{}
  }
}
