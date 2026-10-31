// CONSTRUCTOR AI — offline, limited IP metadata gate, NOT a legal opinion.
import {readFile, readdir, stat} from 'node:fs/promises';
import {resolve, relative, join, sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const CATEGORIES=new Set(['SOURCE_CODE','DOCUMENTATION_AND_SKILLS','RUNTIME','MODEL_WEIGHTS','TRADEMARK']);
const STATUSES=new Set(['REFERENCE_ONLY','BLOCKED_PENDING_REVIEW']);
const EXPECTED=new Map([
 ['nvidia-bionemo-agent-code','SOURCE_CODE'],
 ['nvidia-bionemo-agent-skills','DOCUMENTATION_AND_SKILLS'],
 ['nvidia-nim-runtime','RUNTIME'],
 ['nvidia-model-weights','MODEL_WEIGHTS'],
 ['nvidia-trademarks','TRADEMARK']
]);
const FALSE_FLAGS=['copied_into_repository','redistribution_authorized','commercial_use_approved','training_velion_approved','brand_assets_approved'];
const RESTRICTED_PREFIXES=[
 'vendor/nvidia/','vendor/bionemo/','third_party/nvidia/','third_party/bionemo/',
 'nim-skills/','bionemo-agent-toolkit/','model_weights/','nvidia-logos/'
];
const RESTRICTED_MEDIA=/\.(?:safetensors|gguf|ggml|onnx|pt|pth|ckpt|engine|trt|tensor|tflite)$/i;
const BRAND_MEDIA=/(?:^|\/)[^\/]*(?:nvidia|bionemo)[^\/]*\.(?:svg|png|jpg|jpeg|webp|gif|ico)$/i;
const repoRoot=fileURLToPath(new URL('../',import.meta.url));
const fail=code=>{throw new Error('IP_RIGHTS_GATE:'+code);};

export function validateRightsManifest(data){
 if(!data || typeof data!=='object' || Array.isArray(data) ||
    data.schema!=='imperial.constructor.third_party_rights.v1' ||
    data.policy!=='DENY_BY_DEFAULT' || !Array.isArray(data.entries) ||
    data.entries.length!==EXPECTED.size) fail('INVALID_MANIFEST_SCHEMA');
 const ids=new Set();
 for(const e of data.entries){
  if(!e || typeof e!=='object'||Array.isArray(e) ||
     typeof e.id!=='string' || !EXPECTED.has(e.id) || ids.has(e.id) ||
     !CATEGORIES.has(e.category)||EXPECTED.get(e.id)!==e.category||
     !STATUSES.has(e.status)) fail('UNKNOWN_OR_DUPLICATED_RIGHTS_ENTRY');
  ids.add(e.id);
  for(const k of FALSE_FLAGS)if(e[k]!==false)fail('UNAUTHORIZED_GRANT_'+k);
  for(const k of ['name','license','url','license_url']){
   if(typeof e[k]!=='string'||!e[k].trim())fail('MISSING_PROVENANCE_'+k);
  }
  if(!e.url.startsWith('https://')||!e.license_url.startsWith('https://'))
   fail('UNTRUSTED_LICENSE_REFERENCE');
  if(e.upstream_notice_url!==null&&
     (typeof e.upstream_notice_url!=='string'||!e.upstream_notice_url.startsWith('https://')))
   fail('INVALID_NOTICE_REFERENCE');
  if(!Array.isArray(e.required_before_integration)||e.required_before_integration.length<2||
     e.required_before_integration.some(x=>typeof x!=='string'||!x.trim()))
   fail('INCOMPLETE_REVIEW_CHECKLIST');
  if(e.id==='nvidia-nim-runtime'||e.id==='nvidia-model-weights'||e.id==='nvidia-trademarks'){
   if(e.status!=='BLOCKED_PENDING_REVIEW')fail('PREMATURE_RUNTIME_MODEL_BRAND_RELEASE');
  }
  if(e.id==='nvidia-bionemo-agent-code'&&!e.license.startsWith('Apache-2.0'))
   fail('INCORRECT_CODE_LICENSE');
  if(e.id==='nvidia-bionemo-agent-skills'&&!e.license.startsWith('CC-BY-4.0'))
   fail('MISSING_SKILLS_ATTRIBUTION_LICENSE');
 }
 if(ids.size!==EXPECTED.size)fail('REQUIRED_RIGHTS_ENTRY_MISSING');
 return {status:'POLICY_METADATA_VALID_NOT_LICENSE_CLEARANCE',checkedEntries:ids.size,
  integrationApproved:false,commercialReleaseApproved:false,legalReviewComplete:false};
}

export function inspectTrackedPaths(paths){
 if(!Array.isArray(paths))fail('INVALID_PATH_LIST');
 const violations=[];
 for(const path of paths){
  if(typeof path!=='string'||path.includes('\\')||path.startsWith('/')||path.includes('..')){
   violations.push('INVALID_REPO_PATH');continue;
  }
  const p=path.toLowerCase();
  if(RESTRICTED_PREFIXES.some(prefix=>p.startsWith(prefix)) ||
     RESTRICTED_MEDIA.test(p)||BRAND_MEDIA.test(p))
   violations.push(path);
 }
 if(violations.length)fail('UNREVIEWED_BINARY_OR_VENDOR_MATERIAL:'+violations.slice(0,5).join(','));
 return {trackedFiles:paths.length,prohibitedMediaFound:0};
}

export async function auditThirdPartyRights(root=repoRoot){
 const manifest=JSON.parse(await readFile(join(root,'governance/THIRD_PARTY_RIGHTS.json'),'utf8'));
 const policy=validateRightsManifest(manifest);
 const files=[];
 async function walk(dir){
  const entries=await readdir(dir,{withFileTypes:true});
  for(const entry of entries){
   if(entry.name==='.git'||entry.name==='node_modules')continue;
   if(entry.isSymbolicLink())fail('UNREVIEWED_SYMLINK');
   const file=join(dir,entry.name);
   if(entry.isDirectory())await walk(file);
   else if(entry.isFile()){
    const p=relative(root,file).split(sep).join('/');
    files.push(p);
   }
  }
 }
 await walk(root);
 const checked=inspectTrackedPaths(files);
 const rootLicense=await readFile(join(root,'LICENSE'),'utf8');
 if(!rootLicense.includes('ORIGINAL SOURCE PROPRIETARY LICENSE')||
    !rootLicense.includes('THIRD-PARTY RIGHTS PREVAIL') &&
    !rootLicense.includes('EXISTING THIRD-PARTY RIGHTS PREVAIL'))
  fail('ROOT_PROPRIETARY_LICENSE_NOT_PRESERVED');
 const report={
  gate:'constructor-ai-preliminary-third-party-ip-governance-v1',
  ...policy,...checked,source:'OWNER_REVIEW_REQUIRED',
  rightsVerifiedIndependently:false,
  noCopyrightInfringementCertified:false,
  nvidiaRuntimeInstalled:false,nvidiaModelWeightsInstalled:false,
  nvidiaTrademarkPermissionVerified:false,
  velionModelTrainingFromNvidiaOutputsApproved:false,
  customerCommercialRelease:'DENIED',
  notes:'Technical metadata checks cannot determine copyrights or grant vendor permissions.'
 };
 return report;
}

if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{process.stdout.write(JSON.stringify(await auditThirdPartyRights(),null,2)+'\n');}
 catch(e){process.stderr.write(String(e)+'\n');process.exitCode=1;}
}
