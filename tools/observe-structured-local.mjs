// One bounded, synthetic local request. It never executes or releases model output.
import {once} from 'node:events';
import {createAppServer} from './serve.mjs';
import {localTaskServiceFromEnv} from '../engineering/local-task-service.mjs';

if(process.env.IMPERIAL_TASK_LOCAL_ONLY!=='YES'||
   process.env.CONSTRUCTOR_LOCAL_MODEL_ROUTE!=='velion-gguf'||
   process.env.CONSTRUCTOR_LOCAL_GGUF_STRUCTURED!=='YES')
  throw Error('EXPLICIT_LOCAL_STRUCTURED_CONFIGURATION_REQUIRED');
const service=localTaskServiceFromEnv();
const server=createAppServer({localTaskService:service});
server.listen(0,'127.0.0.1');await once(server,'listening');
const origin='http://127.0.0.1:'+server.address().port,started=Date.now();
try{
  const response=await fetch(origin+'/api/local-velion/task-draft',{method:'POST',
    headers:{Origin:origin,'Content-Type':'application/json',
      Authorization:'Bearer '+process.env.CONSTRUCTOR_LOCAL_AI_TOKEN},
    body:JSON.stringify({goal:'Build a task manager with completed tasks'}),
    signal:AbortSignal.timeout(115000)});
  const result=await response.json();
  const staged=response.status===201&&result.status==='QUARANTINED_NOT_EXECUTED';
  console.log(JSON.stringify({schema:'constructor_local_structured_observation_v1',
    observedAt:new Date().toISOString(),elapsedMs:Date.now()-started,httpStatus:response.status,
    outcome:staged?result.status:(result.code||'REQUEST_FAILED'),
    model:staged?result.model:process.env.VELION_LOCAL_MODEL,
    modelReceipt:staged?result.modelReceipt:null,stageId:staged?result.stageId:null,
    preflight:staged?result.preflight:null,
    stageManifestSha256:staged?result.stageManifestSha256:null,
    execution:'NOT_RUN',independentQa:'NOT_RUN',approval:'NOT_GRANTED',release:'DENIED',
    scope:'SYNTHETIC_LOCAL_STRUCTURED_TASK_NOT_A_FINISHED_APPLICATION'},null,2));
  if(!staged)process.exitCode=1;
}finally{server.close();await once(server,'close');}
