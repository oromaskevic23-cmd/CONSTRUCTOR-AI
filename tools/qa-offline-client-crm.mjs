/** Separate QA gate for an already-built CRM artifact.
 * This module imports no buildProject or Template Studio generator code.
 * It directly checks the actual product files, functional domain and HTTP server.
 */
import {readFile,writeFile,readdir,lstat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';

const root=resolve(process.argv[2]||'');
const output=process.argv[3];
if (process.argv.length!==4||!output)throw Error('Usage: node tools/qa-offline-client-crm.mjs PRODUCT_DIR QA_OUTPUT_JSON');
const result={schema:'imperial.nca.independent_qa.v1',product:'OFFLINE_CLIENT_PIPELINE_CRM',
  checks:[],status:'FAIL',automatedReviewOnly:true,independentHumanAudit:false,
  externalNetworkCalls:0,productionDeployment:false,permissionGranted:false};
const step=async(name,fn)=>{
  try {const detail=await fn();result.checks.push({name,status:'PASS',detail:detail||''});}
  catch(error){result.checks.push({name,status:'FAIL',detail:String(error?.message||error).slice(0,700)});}
};
const digest=b=>createHash('sha256').update(b).digest('hex');
const filename=name=>resolve(root,name);
await step('manifest_independent_hash_review',async()=>{
 const manifest=JSON.parse(await readFile(filename('manifest.json'),'utf8'));
 assert.equal(manifest.schema,'constructor-template-export-v1');
 assert.equal(manifest.template,'crm');
 assert.equal(manifest.files.length,10);
 const expected=new Set(['index.html','app.mjs','project-domain.mjs','project-runtime.mjs','styles.css','package.json','serve.mjs','verify.mjs','test/app.test.mjs','README.md']);
 for(const file of manifest.files){
   assert(expected.delete(file.path),'UNEXPECTED_OR_DUPLICATE_MANIFEST_PATH');
   const path=filename(file.path);
   assert(path.startsWith(root+sep),'PATH_ESCAPE');
   const st=await lstat(path);
   assert(st.isFile()&&!st.isSymbolicLink(),'UNSAFE_FILE_TYPE');
   const bytes=await readFile(path);
   assert.equal(bytes.length,file.bytes);
   assert.equal(digest(bytes),file.sha256);
 }
 assert.equal(expected.size,0,'MISSING_PRODUCT_FILE');
 const files=await readdir(root);
 assert.equal(files.length,11,'EXTRA_ROOT_FILES');
 return '10 file hashes independently verified; product manifest separate';
});
await step('functional_crm_behavior',async()=>{
 const domain=await import(pathToFileURL(filename('project-domain.mjs')).href);
 const template='crm';
 const a={id:'deal-a',title:'Acme',detail:'Lead',value:125.25,status:'New'};
 const b={id:'deal-b',title:'Beta',detail:'Prospect',value:79.99,status:'Qualified'};
 const first=domain.saveRecord([],a,template);
 const two=domain.saveRecord(first,b,template);
 assert.equal(two.length,2);
 assert.equal(first.length,1,'IMMUTABILITY_BROKEN');
 const qualified=domain.changeStatus(first,'deal-a',template);
 assert.equal(qualified[0].status,'Qualified');
 const won=domain.changeStatus(qualified,'deal-a',template);
 assert.equal(won[0].status,'Won');
 const sum=domain.summarizeRecords([...won,b],template);
 assert.equal(sum[0][1],2);
 assert.equal(sum[2][1],125.25);
 assert.equal(domain.removeRecord([...won,b],'deal-b',template).length,1);
 assert.throws(()=>domain.saveRecord([], {...a,value:-1},template));
 assert.throws(()=>domain.saveRecord([], {...a,title:'<XSS>\0'},template));
 return 'create, update-stage, totals, delete, invalid-value and invalid-title checks';
});
await step('browser_artifact_security_review',async()=>{
 const html=await readFile(filename('index.html'),'utf8');
 const runtime=await readFile(filename('project-runtime.mjs'),'utf8');
 const packageInfo=JSON.parse(await readFile(filename('package.json'),'utf8'));
 assert(html.includes("default-src 'none'")&&html.includes("connect-src 'none'"),'CSP_MISSING');
 assert(!/https?:\/\//i.test(html),'REMOTE_HTML_REFERENCE');
 assert(runtime.includes('textContent'),'DOM_TEXT_SAFETY_MISSING');
 assert(!runtime.includes('innerHTML'),'DANGEROUS_DOM_SINK');
 assert.equal(packageInfo.private,true);
 assert.equal(Object.hasOwn(packageInfo,'dependencies'),false);
 return 'CSP, no remote browser imports, textContent, no runtime dependencies';
});
await step('isolated_http_server_smoke',async()=>{
 const child=spawn(process.execPath,['serve.mjs'],{cwd:root,env:{PATH:process.env.PATH||''},stdio:'ignore'});
 let ready=false;
 try{
   for(let i=0;i<35;i++){
     if(child.exitCode!==null)throw Error('SERVER_EXITED');
     try{const r=await fetch('http://127.0.0.1:4174/',{signal:AbortSignal.timeout(250)});if(r.status===200){ready=true;break;}}
     catch{}
     await new Promise(resolve=>setTimeout(resolve,100));
   }
   assert(ready,'HTTP_SERVER_NOT_READY');
   const origin='http://127.0.0.1:4174';
   const home=await fetch(origin+'/');
   assert.equal(home.status,200);
   assert((await home.text()).includes('Offline Client Pipeline'));
   const js=await fetch(origin+'/project-domain.mjs');
   assert.equal(js.status,200);
   assert((await js.text()).includes('saveRecord'));
   assert.equal((await fetch(origin+'/not-allowed')).status,404);
   assert.equal((await fetch(origin+'/',{method:'POST'})).status,405);
   assert.equal((await fetch(origin+'/',{method:'HEAD'})).status,200);
   return 'GET 200, JS 200, HEAD 200, POST 405, blocked route 404';
 }finally{child.kill('SIGTERM');}
});
result.status=result.checks.every(check=>check.status==='PASS')?'AUTOMATED_QA_PASS':'AUTOMATED_QA_FAIL';
result.review='AUTOMATED_PROCESS_ISOLATION_ONLY';
result.productionRelease='REQUIRES_ARCHITECT_APPROVAL';
result.sha256=digest(JSON.stringify({checks:result.checks,status:result.status}));
await writeFile(resolve(output),JSON.stringify(result,null,2)+'\n',{flag:'wx',mode:0o644});
console.log(JSON.stringify({status:result.status,checks:result.checks.map(x=>({name:x.name,status:x.status})),qaSha256:result.sha256}));
if(result.status!=='AUTOMATED_QA_PASS')process.exitCode=1;
