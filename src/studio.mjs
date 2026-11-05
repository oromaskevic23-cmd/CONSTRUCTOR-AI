import {normalizeProject,templateDefinition} from './project-domain.mjs';
import {mountApplication} from './project-runtime.mjs';
import {buildProject,SOURCE_PATHS} from './project-export.mjs';
import {createZip} from './zip.mjs';
import {localTaskApiUrl} from './local-ai-policy.mjs';
const form=document.querySelector('#project-form');
const preview=document.querySelector('#preview');
const status=document.querySelector('#studio-status');
const download=document.querySelector('#download');
let current=null, sources=null;
function build(){
  try{
    const config=normalizeProject(Object.fromEntries(new FormData(form)));
    mountApplication(preview,config,{persist:false}); current=config;
    document.querySelector('#preview-kind').textContent=templateDefinition(config.template).label;
    download.disabled=!sources;status.textContent='Preview ready. Try the app, then download its source.';
  }catch(error){status.textContent=error.message;download.disabled=true;current=null;}
}
form.addEventListener('submit',event=>{event.preventDefault();build();});
form.addEventListener('input',()=>{download.disabled=true;status.textContent='Settings changed. Build a fresh preview before exporting.';});
download.addEventListener('click',async()=>{
  if(!current||!sources)return;download.disabled=true;
  try{
    const {files}=await buildProject(current,sources);const zip=createZip(files);
    const url=URL.createObjectURL(new Blob([zip],{type:'application/zip'}));
    const link=document.createElement('a');link.href=url;link.download='constructor-'+current.template+'.zip';link.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);status.textContent='Project ZIP prepared. Unzip, run npm run verify, npm test, then npm start.';
  }catch{status.textContent='Export could not be completed. Reload this page and try again.';}
  finally{download.disabled=!current||!sources;}
});
build();
try{
  sources=Object.fromEntries(await Promise.all(SOURCE_PATHS.map(async path=>{
    const response=await fetch(new URL(path,import.meta.url),{cache:'no-store'});
    if(!response.ok)throw Error('Template unavailable');return [path,await response.text()];
  })));
  download.disabled=!current;
}catch{status.textContent='Preview works, but template files could not be loaded for export. Reload to retry.';}

// Local-only candidate generation. The browser never receives a permit secret,
// executes a draft, or sends a local token to the hosted static Studio.
const aiForm=document.querySelector('#local-ai-form');
const aiGoal=document.querySelector('#local-ai-goal');
const aiToken=document.querySelector('#local-ai-token');
const aiSubmit=document.querySelector('#local-ai-submit');
const aiStatus=document.querySelector('#local-ai-status');
const aiResult=document.querySelector('#local-ai-result');
if(localTaskApiUrl(window.location.href)){
  aiGoal.disabled=false;aiToken.disabled=false;aiSubmit.disabled=false;
  aiStatus.textContent='Local service must be explicitly configured before use.';
}
const aiErrors={LOCAL_AI_DISABLED:'Local AI is not configured on this server.',
  LOCAL_ACCESS_TOKEN_REQUIRED:'The local session token was not accepted.',
  LOCAL_ORIGIN_REQUIRED:'Open Studio using the local 127.0.0.1 address.',
  INVALID_OR_UNSUPPORTED_TASK_REQUEST:'Use a supported Task Manager request.',
  LOCAL_GENERATION_BUSY:'A generation is already in progress.',
  LOCAL_MODEL_UNAVAILABLE:'The local model service is unavailable.',
  LOCAL_MODEL_HTTP_FAILED:'The local model service rejected the request.',
  MODEL_DRAFT_OR_QUARANTINE_REJECTED:'The model output or quarantine check rejected the candidate.'};
aiForm.addEventListener('submit',async event=>{
  event.preventDefault();
  const endpoint=localTaskApiUrl(window.location.href);
  if(!endpoint){aiStatus.textContent='Open the local Studio to use local AI.';return;}
  const token=aiToken.value,goal=aiGoal.value;aiToken.value='';aiSubmit.disabled=true;aiResult.textContent='';
  aiStatus.textContent='Requesting a local candidate; it will remain unexecuted.';
  try{
    const response=await fetch(endpoint,{method:'POST',mode:'same-origin',credentials:'omit',cache:'no-store',
      redirect:'error',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(115000),
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},body:JSON.stringify({goal})});
    const result=await response.json();
    if(!response.ok){aiStatus.textContent=aiErrors[result.code]||'The local request was rejected.';return;}
    if(response.status!==201||result.status!=='QUARANTINED_NOT_EXECUTED'||result.execution!=='NOT_RUN'||
       result.independentQa!=='NOT_RUN'||result.approval!=='NOT_GRANTED'||result.release!=='DENIED'||
       !/^[a-f0-9]{64}$/.test(result.draftSha256)||!/^constructor-task-quarantine-[A-Za-z0-9]+$/.test(result.stageId)){
      throw Error('Unexpected local response');
    }
    aiStatus.textContent='Candidate saved to local quarantine. No code was executed or approved.';
    aiResult.textContent='Quarantine: '+result.stageId+'\nDraft SHA-256: '+result.draftSha256+
      '\nModel reported: '+result.model+'\nIndependent QA: not run\nRelease: denied';
  }catch{aiStatus.textContent='Local AI could not complete the request. Check the local server and model.';}
  finally{aiSubmit.disabled=false;}
});
