// Project author and founding architect: Alexander Nikolaevich Romaskevich (RomaskevicH).
// Optional local control plane; no production authority or execution of generated code.
import {randomBytes,timingSafeEqual} from 'node:crypto';
import {basename,isAbsolute} from 'node:path';
import {issueLocalDraftPermit,ROUTE_LOCAL_TASK,ROUTE_LOCAL_APPLICATION} from './local-permit.mjs';
import {requestVelionTaskDraft,requestVelionFullApplicationDraft} from './velion-task-generator.mjs';
import {stageGeneratedTaskApp,stageGeneratedFullApplication} from './task-build-quarantine.mjs';

export function createLocalTaskService({accessToken,permitSecret,model,outputRoot,fetchImpl=fetch}={}){
  if(typeof accessToken!=='string'||!/^[A-Za-z0-9_-]{32,128}$/.test(accessToken)||
     typeof permitSecret!=='string'||Buffer.byteLength(permitSecret)<32||
     Buffer.byteLength(permitSecret)>2048||permitSecret===accessToken||
     typeof model!=='string'||!model||typeof outputRoot!=='string'||!isAbsolute(outputRoot)||
     typeof fetchImpl!=='function')throw Error('LOCAL_AI_CONFIGURATION_INVALID');
  const expected=Buffer.from(accessToken,'utf8');
  let busy=false;
  return Object.freeze({
    authenticate(header){
      if(typeof header!=='string'||!header.startsWith('Bearer ')||header.length>135)return false;
      const supplied=Buffer.from(header.slice(7),'utf8');
      return supplied.length===expected.length&&timingSafeEqual(supplied,expected);
    },
    async generate(goal,{mode='task-module',signal}={}){
      if(!['task-module','full-application'].includes(mode))throw Error('LOCAL_MODE_INVALID');
      if(busy){const error=Error('LOCAL_GENERATION_BUSY');error.code='LOCAL_GENERATION_BUSY';throw error;}
      busy=true;
      try{
        const now=Date.now();
        const mission={id:'local-task-'+randomBytes(12).toString('hex'),goal,allowModel:true};
        const full=mode==='full-application';
        const permit=issueLocalDraftPermit({mission,route:full?ROUTE_LOCAL_APPLICATION:ROUTE_LOCAL_TASK,
          model,secret:permitSecret,now});
        const candidate=await (full?requestVelionFullApplicationDraft:requestVelionTaskDraft)({mission,permit,permitSecret,
          consumedNonces:new Set(),model,fetchImpl,now,signal,
          ...(full?{timeoutMs:300000,requireRealInferenceEvidence:true}:{})});
        if(signal?.aborted){const error=Error('LOCAL_GENERATION_CANCELLED');error.code=error.message;throw error;}
        const staged=await (full?stageGeneratedFullApplication:stageGeneratedTaskApp)({receipt:candidate,outputRoot});
        return Object.freeze({status:staged.status,missionId:candidate.missionId,
          stageId:basename(staged.stage),stageManifestSha256:staged.stageManifestSha256,
          draftSha256:candidate.draftSha256,provider:candidate.provider,model:candidate.model,
          modelIdentity:candidate.modelIdentity,contract:full?'FULL_APPLICATION_V1':'TASK_DOMAIN_V1',
          execution:'NOT_RUN',independentQa:'NOT_RUN',
          approval:'NOT_GRANTED',release:'DENIED'});
      }finally{busy=false;}
    }
  });
}

export function localTaskServiceFromEnv(env=process.env){
  if(env.IMPERIAL_TASK_LOCAL_ONLY!=='YES')return null;
  return createLocalTaskService({accessToken:env.CONSTRUCTOR_LOCAL_AI_TOKEN,
    permitSecret:env.VELION_LOCAL_PERMIT_SECRET,model:env.VELION_LOCAL_MODEL,
    outputRoot:env.CONSTRUCTOR_LOCAL_QUARANTINE});
}
