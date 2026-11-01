// Independent read-only HTTP verification of published GitHub Pages Studio assets.
// NO credentials, no browser automation, no production privileges, no continuous monitoring.
import {createHash} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
const BASE='https://oromaskevic23-cmd.github.io/Capital-Core-Public/reference/constructor-ai/studio/';
const SOURCE='6f2e33e582d56e8636a0a2b68ce16bd42b8d071c';
const EXPECTED=['studio.html','studio.css','src/studio.mjs','src/project-domain.mjs','src/project-runtime.mjs','src/project-backup.mjs','src/project-export.mjs','src/project.css','src/zip.mjs'].sort();
const hex=bytes=>createHash('sha256').update(bytes).digest('hex');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function download(path){
  const url=new URL(path,BASE);
  url.searchParams.set('verification',String(Date.now()));
  const r=await fetch(url,{signal:AbortSignal.timeout(12000),headers:{'accept':'*/*','cache-control':'no-cache'}});
  if(!r.ok)throw Error('HTTP_'+r.status+':'+path);
  const raw=Buffer.from(await r.arrayBuffer());
  if(raw.length===0||raw.length>300000)throw Error('BAD_RESPONSE_SIZE:'+path);
  return raw;
}
async function verify(){
  const manifestRaw=await download('deployment-manifest.json');
  const manifest=JSON.parse(manifestRaw.toString('utf8'));
  if(manifest.schema!=='constructor-studio-deployment-v1'||manifest.sourceCommit!==SOURCE||
    manifest.sourceRepo!=='oromaskevic23-cmd/CONSTRUCTOR-AI')throw Error('SOURCE_IDENTITY_MISMATCH');
  if(!Array.isArray(manifest.files)||manifest.files.length!==EXPECTED.length||
    manifest.files.map(f=>f.path).sort().join('|')!==EXPECTED.join('|'))throw Error('FILE_INVENTORY_MISMATCH');
  const results=[];
  for(const entry of manifest.files){
    if(!Number.isSafeInteger(entry.bytes)||entry.bytes<1||entry.bytes>300000||
      typeof entry.sha256!=='string'||!/^[a-f0-9]{64}$/.test(entry.sha256))throw Error('INVALID_MANIFEST_ENTRY');
    const bytes=await download(entry.path);
    const digest=hex(bytes);
    if(bytes.length!==entry.bytes||digest!==entry.sha256)throw Error('PUBLISHED_HASH_MISMATCH:'+entry.path);
    const body=bytes.toString('utf8');
    if(entry.path==='studio.html'&&!body.includes('Capital-Core-Public/reference/'))throw Error('STALE_ECOSYSTEM_LINK');
    if(entry.path==='src/project-runtime.mjs'&&!body.includes('Restore JSON backup'))throw Error('STALE_RUNTIME_NO_RESTORE');
    if(entry.path==='src/project-backup.mjs'&&!body.includes('parseBackup'))throw Error('STALE_BACKUP_MODULE');
    results.push({path:entry.path,bytes:entry.bytes,sha256:digest});
  }
  return {schema:'constructor-public-studio-delivery-v1',verifiedAt:new Date().toISOString(),
    url:BASE+'studio.html',sourceCommit:SOURCE,manifestSha256:hex(manifestRaw),
    verifiedFiles:results.length,files:results,status:'HTTP_DELIVERY_VERIFIED',
    limit:'Read-only live HTTP content and SHA-256, not human E2E, production service, or security audit'};
}
let last;
for(let attempt=1;attempt<=8;attempt++){
  try{
    const evidence=await verify();
    await writeFile('studio-deployment-evidence.json',JSON.stringify(evidence,null,2)+'\n',{flag:'w'});
    console.log(JSON.stringify({status:evidence.status,sourceCommit:SOURCE,verifiedFiles:evidence.verifiedFiles,url:evidence.url}));
    process.exit(0);
  }catch(error){
    last=error;
    console.error('PUBLISHED_STUDIO_NOT_VERIFIED attempt '+attempt+'/8 '+String(error.message||error));
    if(attempt<8)await sleep(7000);
  }
}
throw Error('DEPLOYMENT_GATE_FAILED:'+last?.message);
