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
