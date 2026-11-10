import {normalizeProject,templateDefinition} from './project-domain.mjs';
import {mountApplication} from './project-runtime.mjs';
import {buildProject,SOURCE_PATHS} from './project-export.mjs';
import {createZip} from './zip.mjs';
import {attachLocalAiController} from './local-ai-policy.mjs';
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
attachLocalAiController({
  form:document.querySelector('#local-ai-form'),goal:document.querySelector('#local-ai-goal'),
  token:document.querySelector('#local-ai-token'),submit:document.querySelector('#local-ai-submit'),
  cancel:document.querySelector('#local-ai-cancel'),status:document.querySelector('#local-ai-status'),
  result:document.querySelector('#local-ai-result'),pageUrl:window.location.href,pageEvents:window,
});
