// Project author and founding architect: Alexander Nikolaevich Romaskevich (RomaskevicH).
// Optional local control plane; no production authority or execution of generated code.
import {randomBytes,timingSafeEqual} from 'node:crypto';
import {basename,isAbsolute} from 'node:path';
import {issueLocalDraftPermit,ROUTE_LOCAL_TASK} from './local-permit.mjs';
import {requestVelionTaskDraft} from './velion-task-generator.mjs';
import {stageGeneratedTaskApp} from './task-build-quarantine.mjs';
import {createVelionChatTransport} from './velion-chat-transport.mjs';

export function createLocalTaskService({accessToken,permitSecret,model,outputRoot,fetchImpl=fetch,
  provider='VELION_LOCAL_OLLAMA_ADAPTER',requireStructured=false}={}){
  if(typeof accessToken!=='string'||!/^[A-Za-z0-9_-]{32,128}$/.test(accessToken)||
     typeof permitSecret!=='string'||Buffer.byteLength(permitSecret)<32||
     Buffer.byteLength(permitSecret)>2048||permitSecret===accessToken||
     typeof model!=='string'||!model||typeof outputRoot!=='string'||!isAbsolute(outputRoot)||
     typeof fetchImpl!=='function'||!['VELION_LOCAL_OLLAMA_ADAPTER','VELION_LOCAL_GGUF_CHAT_ADAPTER'].includes(provider)||
     typeof requireStructured!=='boolean'||(requireStructured&&provider!=='VELION_LOCAL_GGUF_CHAT_ADAPTER'))
    throw Error('LOCAL_AI_CONFIGURATION_INVALID');
  const expected=Buffer.from(accessToken,'utf8');
  let busy=false;
  return Object.freeze({
    authenticate(header){
      if(typeof header!=='string'||!header.startsWith('Bearer ')||header.length>135)return false;
      const supplied=Buffer.from(header.slice(7),'utf8');
      return supplied.length===expected.length&&timingSafeEqual(supplied,expected);
    },
    async generate(goal,{signal}={}){
      if(busy){const error=Error('LOCAL_GENERATION_BUSY');error.code='LOCAL_GENERATION_BUSY';throw error;}
      busy=true;
      try{
        const now=Date.now();
        const mission={id:'local-task-'+randomBytes(12).toString('hex'),goal,allowModel:true};
        const permit=issueLocalDraftPermit({mission,route:ROUTE_LOCAL_TASK,model,secret:permitSecret,now});
        const candidate=await requestVelionTaskDraft({mission,permit,permitSecret,
          consumedNonces:new Set(),model,fetchImpl,provider,requireStructured,now,signal});
        if(signal?.aborted){const error=Error('LOCAL_MODEL_CANCELLED');error.code='LOCAL_MODEL_CANCELLED';throw error;}
        const staged=await stageGeneratedTaskApp({receipt:candidate,outputRoot});
        return Object.freeze({status:staged.status,missionId:candidate.missionId,
          stageId:basename(staged.stage),stageManifestSha256:staged.stageManifestSha256,
          preflight:staged.preflight,
          draftSha256:candidate.draftSha256,provider:candidate.provider,model:candidate.model,
          ...(candidate.modelReceipt?{modelReceipt:candidate.modelReceipt}:{}),
          modelIdentity:candidate.modelIdentity,
          preview:{trust:'UNTRUSTED_MODEL_TEXT',summary:candidate.draft.summary,
            files:candidate.draft.files.map(({path,content})=>({path,content}))},
          execution:'NOT_RUN',independentQa:'NOT_RUN',
          approval:'NOT_GRANTED',release:'DENIED'});
      }finally{busy=false;}
    }
  });
}

export function localTaskServiceFromEnv(env=process.env){
  if(env.IMPERIAL_TASK_LOCAL_ONLY!=='YES')return null;
  const route=env.CONSTRUCTOR_LOCAL_MODEL_ROUTE??'ollama';
  if(!['ollama','velion-gguf'].includes(route))throw Error('LOCAL_AI_CONFIGURATION_INVALID');
  if(env.CONSTRUCTOR_LOCAL_GGUF_STRUCTURED!==undefined&&
     !['YES','NO'].includes(env.CONSTRUCTOR_LOCAL_GGUF_STRUCTURED))throw Error('LOCAL_AI_CONFIGURATION_INVALID');
  const requireStructured=env.CONSTRUCTOR_LOCAL_GGUF_STRUCTURED==='YES';
  if(requireStructured&&route!=='velion-gguf')throw Error('LOCAL_AI_CONFIGURATION_INVALID');
  let fetchImpl=fetch,provider='VELION_LOCAL_OLLAMA_ADAPTER';
  if(route==='velion-gguf'){
    if(env.CONSTRUCTOR_LOCAL_AI_TOKEN===env.VELION_CHAT_TOKEN||
       env.VELION_LOCAL_PERMIT_SECRET===env.VELION_CHAT_TOKEN||
       env.VELION_LOCAL_MODEL!=='gguf-'+String(env.VELION_GGUF_SHA256||'').slice(0,12))
      throw Error('LOCAL_AI_CONFIGURATION_INVALID');
    fetchImpl=createVelionChatTransport({port:Number(env.VELION_CHAT_PORT),accessToken:env.VELION_CHAT_TOKEN,
      expectedModelSha256:env.VELION_GGUF_SHA256,structured:requireStructured});
    provider='VELION_LOCAL_GGUF_CHAT_ADAPTER';
  }
  return createLocalTaskService({accessToken:env.CONSTRUCTOR_LOCAL_AI_TOKEN,
    permitSecret:env.VELION_LOCAL_PERMIT_SECRET,model:env.VELION_LOCAL_MODEL,
    outputRoot:env.CONSTRUCTOR_LOCAL_QUARANTINE,fetchImpl,provider,requireStructured});
}
