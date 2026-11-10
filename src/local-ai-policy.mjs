// Never send the local API token from a hosted or non-loopback Studio page.
export function localTaskApiUrl(pageUrl){
  try{
    const url=new URL(pageUrl);
    if(url.protocol!=='http:'||url.hostname!=='127.0.0.1'||!url.port||url.username||url.password)return null;
    return new URL('/api/local-velion/task-draft',url.origin).href;
  }catch{return null;}
}

// This returns plain text only. The caller must use textContent, never HTML.
export function formatQuarantinedCandidate(result){
  const preview=result?.preview;
  if(result?.status!=='QUARANTINED_NOT_EXECUTED'||result.execution!=='NOT_RUN'||
     result.independentQa!=='NOT_RUN'||result.approval!=='NOT_GRANTED'||result.release!=='DENIED'||
     !/^[a-f0-9]{64}$/.test(result.draftSha256)||
     !/^[a-f0-9]{64}$/.test(result.stageManifestSha256)||
     !/^constructor-task-quarantine-[A-Za-z0-9]+$/.test(result.stageId)||
     typeof result.model!=='string'||result.model.length>100||
     !preview||preview.trust!=='UNTRUSTED_MODEL_TEXT'||typeof preview.summary!=='string'||
     preview.summary.length>1500||!Array.isArray(preview.files)||preview.files.length!==2)
    throw Error('INVALID_QUARANTINE_PREVIEW');
  const expected=['app.mjs','test/app.test.mjs'];
  if(preview.files.map(file=>file?.path).sort().join('|')!==expected.join('|')||
     preview.files.some(file=>typeof file.content!=='string'||file.content.length>20000)||
     preview.files.reduce((sum,file)=>sum+new TextEncoder().encode(file.content).length,0)>32768)
    throw Error('INVALID_QUARANTINE_PREVIEW');
  const header='Quarantine: '+result.stageId+'\nDraft SHA-256: '+result.draftSha256+
    '\nModel reported: '+result.model+'\nIndependent QA: not run\nRelease: denied'+
    '\n\nUNTRUSTED MODEL OUTPUT — review only; never executed by this preview.\n'+preview.summary;
  return header+preview.files.map(file=>'\n\n--- '+file.path+' ---\n'+file.content).join('');
}

// The controller accepts elements and fetch explicitly so cancellation and privacy
// behavior can be verified without a model, a browser dependency, or live services.
export function attachLocalAiController({form,goal,token,submit,cancel,status,result,pageUrl,pageEvents,fetchImpl=fetch}){
  let controller=null;
  if(localTaskApiUrl(pageUrl)){
    goal.disabled=false;token.disabled=false;submit.disabled=false;
    status.textContent='Local service must be explicitly configured before use.';
  }
  const errors={LOCAL_AI_DISABLED:'Local AI is not configured on this server.',
    LOCAL_ACCESS_TOKEN_REQUIRED:'The local session token was not accepted.',
    LOCAL_ORIGIN_REQUIRED:'Open Studio using the local 127.0.0.1 address.',
    INVALID_OR_UNSUPPORTED_TASK_REQUEST:'Use a supported Task Manager request.',
    LOCAL_GENERATION_BUSY:'A generation is already in progress.',
    LOCAL_MODEL_UNAVAILABLE:'The local model service is unavailable.',
    LOCAL_MODEL_HTTP_FAILED:'The local model service rejected the request.',
    MODEL_DRAFT_OR_QUARANTINE_REJECTED:'The model output or quarantine check rejected the candidate.'};
  form.addEventListener('submit',async event=>{
    event.preventDefault();
    if(controller)return;
    const endpoint=localTaskApiUrl(pageUrl);
    if(!endpoint){status.textContent='Open the local Studio to use local AI.';return;}
    const tokenValue=token.value,goalValue=goal.value;token.value='';submit.disabled=true;result.textContent='';
    const active=new AbortController();controller=active;cancel.disabled=false;
    status.textContent='Requesting a local candidate; it will remain unexecuted.';
    try{
      const response=await fetchImpl(endpoint,{method:'POST',mode:'same-origin',credentials:'omit',cache:'no-store',
        redirect:'error',referrerPolicy:'no-referrer',signal:AbortSignal.any([active.signal,AbortSignal.timeout(115000)]),
        headers:{'Content-Type':'application/json','Authorization':'Bearer '+tokenValue},body:JSON.stringify({goal:goalValue})});
      const output=await response.json();
      if(active.signal.aborted)throw Error('Local request stopped');
      if(!response.ok){status.textContent=errors[output.code]||'The local request was rejected.';return;}
      if(response.status!==201)throw Error('Unexpected local response');
      result.textContent=formatQuarantinedCandidate(output);
      status.textContent='Candidate saved to local quarantine. No code was executed or approved.';
    }catch{status.textContent=active.signal.aborted?
      'Stop requested. A candidate may already be in local quarantine; no code was executed or approved.':
      'Local AI could not complete the request. Check the local server and model.';}
    finally{controller=null;cancel.disabled=true;submit.disabled=false;}
  });
  cancel.addEventListener('click',()=>{
    if(!controller)return;
    cancel.disabled=true;status.textContent='Requesting stop…';controller.abort();
  });
  pageEvents.addEventListener('pagehide',()=>{controller?.abort();token.value='';});
}
