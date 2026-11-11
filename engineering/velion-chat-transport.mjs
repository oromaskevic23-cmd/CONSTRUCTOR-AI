// Project author and founding architect: Alexander Nikolaevich Romaskevich (RomaskevicH).
// Connect the Constructor task contract to an explicitly configured VELION GGUF
// chat on the same machine. No external URL or paid fallback is accepted.
import {createHash} from 'node:crypto';
const TASK_URL='http://127.0.0.1:11434/api/generate';
export const VELION_DRAFT_FORMAT='constructor_draft_v1';
export const VELION_DRAFT_SCHEMA_SHA256='fd4d2ae555076aba433dae990ea9b83fc4405c917af43124deba6ccdf4f3cf4d';
const error=code=>Object.assign(new Error(code),{code});
const hash=value=>createHash('sha256').update(value).digest('hex');

async function readBounded(response){
  const reader=response?.body?.getReader?.();
  if(!reader)throw error('VELION_CHAT_RESPONSE_INVALID');
  const chunks=[];let size=0;
  try{
    for(;;){
      const {value,done}=await reader.read();if(done)break;
      if(!(value instanceof Uint8Array))throw error('VELION_CHAT_RESPONSE_INVALID');
      size+=value.byteLength;
      if(size>65536){try{await reader.cancel();}catch{}throw error('VELION_CHAT_RESPONSE_TOO_LARGE');}
      chunks.push(value);
    }
    return JSON.parse(new TextDecoder('utf8',{fatal:true}).decode(Buffer.concat(chunks)));
  }finally{reader.releaseLock();}
}

export function createVelionChatTransport({port,accessToken,expectedModelSha256,structured=false,fetchImpl=fetch}={}){
  if(!Number.isInteger(port)||port<1||port>65535||
     typeof accessToken!=='string'||!/^[A-Za-z0-9_-]{32,128}$/.test(accessToken)||
     typeof expectedModelSha256!=='string'||!/^[a-f0-9]{64}$/.test(expectedModelSha256)||
     typeof fetchImpl!=='function'||typeof structured!=='boolean')throw error('VELION_CHAT_CONFIGURATION_INVALID');
  const origin='http://127.0.0.1:'+port;
  const expectedModel='gguf-'+expectedModelSha256.slice(0,12);
  return async function transport(url,options={}){
    if(url!==TASK_URL||options.method!=='POST'||typeof options.body!=='string')throw error('VELION_CHAT_REQUEST_INVALID');
    let input;
    try{input=JSON.parse(options.body);}catch{throw error('VELION_CHAT_REQUEST_INVALID');}
    if(input.model!==expectedModel||input.stream!==false||input.format!=='json'||
       typeof input.prompt!=='string'||!input.prompt.trim()||input.prompt.length>4000)
      throw error('VELION_CHAT_REQUEST_INVALID');
    const messages=[{role:'user',content:input.prompt}];
    const response=await fetchImpl(origin+'/api/chat',{method:'POST',redirect:'error',
      headers:{'Content-Type':'application/json','Accept':'application/json',
        'Origin':origin,'Authorization':'Bearer '+accessToken},
      body:JSON.stringify({messages,...(structured?{responseFormat:VELION_DRAFT_FORMAT}:{})}),signal:options.signal});
    if(!response?.ok){
      // Only fixed, bounded diagnostic codes cross the local boundary. Never
      // forward provider text, paths, secrets or arbitrary error properties.
      let detail;
      try{detail=await readBounded(response);}catch{detail=null;}
      const diagnostic={
        '502:CHAT_MODEL_RESPONSE_INVALID':'VELION_CHAT_MODEL_RESPONSE_REJECTED',
        '502:CHAT_MODEL_RESPONSE_INCOMPLETE':'VELION_CHAT_MODEL_RESPONSE_INCOMPLETE',
        '502:CHAT_MODEL_RESPONSE_SCHEMA_INVALID':'VELION_CHAT_MODEL_RESPONSE_SCHEMA_INVALID',
        '502:CHAT_MODEL_RESPONSE_TOO_LARGE':'VELION_CHAT_MODEL_RESPONSE_REJECTED',
        '503:CHAT_FORMAT_DISABLED':'VELION_CHAT_FORMAT_DISABLED',
        '409:CHAT_BUSY':'VELION_CHAT_BUSY',
      }[response?.status+':'+detail?.code];
      throw error(diagnostic||'VELION_CHAT_UNAVAILABLE');
    }
    const output=await readBounded(response),receipt=output?.receipt;
    if(typeof output?.answer!=='string'||!output.answer.trim()||output.answer.length>4000||
       receipt?.provider!=='llama-cpp-local'||receipt.modelSha256!==expectedModelSha256||
       receipt.requestedModel!==expectedModel||receipt.returnedModel!==expectedModel||
       receipt.toolAccess!=='NONE'||receipt.approval!=='NOT_GRANTED'||receipt.outcome!=='MODEL_RESPONSE_RECEIVED'||
       receipt.inputSha256!==hash(JSON.stringify(messages))||receipt.outputSha256!==hash(output.answer)||
       !Number.isFinite(Date.parse(receipt.startedAt))||!Number.isFinite(Date.parse(receipt.finishedAt))||
       Date.parse(receipt.finishedAt)<Date.parse(receipt.startedAt)||
       !Number.isSafeInteger(receipt.latencyMs)||receipt.latencyMs<0||receipt.latencyMs>120000||
       (structured&&(receipt.responseFormat!==VELION_DRAFT_FORMAT||receipt.schemaSha256!==VELION_DRAFT_SCHEMA_SHA256)))
      throw error('VELION_CHAT_RESPONSE_INVALID');
    const modelReceipt={provider:receipt.provider,requestedModel:receipt.requestedModel,
      returnedModel:receipt.returnedModel,modelSha256:receipt.modelSha256,startedAt:receipt.startedAt,
      finishedAt:receipt.finishedAt,latencyMs:receipt.latencyMs,inputSha256:receipt.inputSha256,
      outputSha256:receipt.outputSha256,outcome:receipt.outcome,toolAccess:receipt.toolAccess,approval:receipt.approval};
    if(structured){modelReceipt.responseFormat=receipt.responseFormat;modelReceipt.schemaSha256=receipt.schemaSha256;}
    // This converts the chat's untrusted answer into the existing task contract's
    // transport envelope. The contract and quarantine remain responsible for validation.
    return new Response(JSON.stringify({model:expectedModel,done:true,done_reason:'stop',response:output.answer,modelReceipt}),
      {status:200,headers:{'Content-Type':'application/json'}});
  };
}

