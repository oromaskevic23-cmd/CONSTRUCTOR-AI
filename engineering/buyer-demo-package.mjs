/** CONSTRUCTOR AI — portable, offline buyer evaluation package.
 * Architect: Alexander Nikolaevich Romaskevich (RomaskevicH).
 * Source and QA are verified against the existing buyer review gate;
 * this never grants sales, deployment, payment, outreach or agent permissions.
 */
import {createHash} from 'node:crypto';
import {constants} from 'node:fs';
import {mkdir,mkdtemp,open,readFile,readdir,lstat,realpath,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {prepareBuyerReviewEvidence} from './commercial-evidence-gate.mjs';

const digest=x=>createHash('sha256').update(x).digest('hex');
const assert=(ok,code)=>{if(!ok)throw Error(code);};
const SHA=/^[a-f0-9]{64}$/;
const COMMIT=/^[a-f0-9]{40}$/;
const FILES=Object.freeze([
 'README.md','app.mjs','index.html','package.json','project-backup.mjs',
 'project-domain.mjs','project-runtime.mjs','serve.mjs','styles.css',
 'test/app.test.mjs','test/backup.test.mjs','verify.mjs'
]);
const ARTIFACTS=Object.freeze([
 ...FILES.map(path=>'product/'+path),
 'evidence/build-proof.json','evidence/qa.json','evidence/buyer-evidence.json',
 'BUYER_GUIDE.md'
].sort());

async function safeDirectory(path){
 const abs=resolve(path),st=await lstat(abs);
 assert(st.isDirectory()&&!st.isSymbolicLink(),'PACKAGE_UNSAFE_DIRECTORY');
 return realpath(abs);
}
async function bytesFrom(path,max=350000){
 let fd;
 try{
   fd=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW);
   const st=await fd.stat();
   assert(st.isFile()&&st.size>0&&st.size<=max,'PACKAGE_UNSAFE_FILE');
   const bytes=await fd.readFile();
   assert(bytes.length===st.size,'PACKAGE_FILE_CHANGED');
   return bytes;
 }finally{await fd?.close();}
}
async function exclusive(path,bytes){
 const fd=await open(path,constants.O_WRONLY|constants.O_CREAT|
   constants.O_EXCL|constants.O_NOFOLLOW,0o600);
 try{await fd.writeFile(bytes);await fd.sync();}finally{await fd.close();}
}
function json(bytes,code){
 try{return JSON.parse(bytes.toString('utf8'));}catch{throw Error(code);}
}
function exact(list,expected,code){
 assert(JSON.stringify([...list].sort())===JSON.stringify([...expected].sort()),code);
}
const GUIDE=`# CONSTRUCTOR AI — Offline Buyer Evaluation

Owner / Architect: Alexander Nikolaevich Romaskevich (RomaskevicH)

**Scope:** Reviewed single-user local CRM demonstrator. Not an enterprise SaaS,
production deployment, autonomous agent deliverable, or generated full application.

## Evaluate locally

1. Verify \`buyer-package-manifest.json\` and the SHA-256 of every included file.
   Hashes are checksums, **not** trusted signatures or proof of external provenance.
2. On a trusted machine with Node.js 22+, open \`product/\` and run:
   \`node verify.mjs\`
   \`node --test test/app.test.mjs test/backup.test.mjs\`
   \`node serve.mjs\`
3. Visit \`http://127.0.0.1:4174\` from the same machine.
4. With synthetic data only, inspect CRM lead editing, stage progression,
   pipeline totals, backup export and restore.
5. Review \`evidence/qa.json\`, \`evidence/build-proof.json\` and
   \`evidence/buyer-evidence.json\` before assessing scope.

## Evidence boundaries

- The source was assembled from an existing reviewed template, not produced
  by a full-app AI generation workflow.
- QA reports separate **automated CI** execution, not an independently
  enrolled human reviewer or cryptographically signed auditor.
- There is no multiuser authentication, remote database, cloud backup,
  paid service, verified live NCA worker, sales contract, or customer acceptance.
- No purchaser, price, funding, valuation or production suitability is claimed.
- A successful GitHub Actions run is limited to that exact source revision.
- No real customer information should be entered into this demonstration.
- No purchase, connection or outbound contact is authorized by this package.

## Intended development path

CONSTRUCTOR AI -> bounded VELION codegen -> sandbox -> separate QA ->
ProofGraph -> Approval Gateway -> Owner-controlled release. These are gates
to implement and verify, not claims of current production operation.

SHPAIZMAN is a separate project of the Architect's brother and is excluded.
No SHPAIZMAN data, credentials, agents or business operations are included.
`;

export async function assembleBuyerEvaluation({
  productDirectory,buildProofPath,qaProofPath,buyerEvidencePath,
  outputDirectory,sourceCommit,ciRunId=null
}={}){
 assert(typeof sourceCommit==='string'&&COMMIT.test(sourceCommit),'PACKAGE_SOURCE_COMMIT_REQUIRED');
 const product=await safeDirectory(productDirectory);
 const destination=resolve(outputDirectory);
 assert(destination!==product&&!destination.startsWith(product+sep)&&
   !product.startsWith(destination+sep),'PACKAGE_OVERLAPPING_PATHS');
 // Re-run full existing source + evidence verification using a freshly generated
 // expected report. A supplied self-reported QA JSON cannot elevate privileges.
 const temporary=await mkdtemp(join(tmpdir(),'constructor-buyer-verify-'));
 let evidenceBytes;
 try{
   const expectedPath=join(temporary,'expected-evidence.json');
   await prepareBuyerReviewEvidence({
     productDirectory:product,buildProofPath,qaProofPath,
     outputPath:expectedPath,sourceCommit,ciRunId
   });
   const provided=await bytesFrom(resolve(buyerEvidencePath));
   const expected=await bytesFrom(expectedPath);
   assert(provided.equals(expected),'BUYER_EVIDENCE_CHANGED_OR_UNBOUND');
   evidenceBytes=provided;
 }finally{await rm(temporary,{recursive:true,force:true});}
 const evidence=json(evidenceBytes,'BUYER_EVIDENCE_INVALID');
 assert(evidence.sourceCommit===sourceCommit&&
   evidence.scope==='SINGLE_USER_OFFLINE_DEMO_ONLY'&&
   evidence.verifiedProductFiles===FILES.length&&
   evidence.paymentConfirmed===false&&evidence.commercialSaleAuthorized===false&&
   evidence.runningNanoCoreAgentsVerified===false&&
   evidence.productionDeploymentAuthorized===false,
   'BUYER_EVIDENCE_SCOPE_DENIED');
 exact(evidence.productFiles.map(x=>x.path),FILES,'BUYER_PRODUCT_INVENTORY_INVALID');

 // Destination must be a new directory, never overwrite a prior buyer artifact.
 await mkdir(destination,{recursive:false,mode:0o700});
 await mkdir(join(destination,'product'),{mode:0o700});
 await mkdir(join(destination,'product','test'),{mode:0o700});
 await mkdir(join(destination,'evidence'),{mode:0o700});
 const records=[];
 async function add(path,bytes){
   await exclusive(join(destination,path),bytes);
   records.push({path,bytes:bytes.length,sha256:digest(bytes)});
 }
 for(const path of FILES)await add('product/'+path,await bytesFrom(join(product,path)));
 await add('evidence/build-proof.json',await bytesFrom(resolve(buildProofPath)));
 await add('evidence/qa.json',await bytesFrom(resolve(qaProofPath)));
 await add('evidence/buyer-evidence.json',evidenceBytes);
 await add('BUYER_GUIDE.md',Buffer.from(GUIDE,'utf8'));
 const manifest={
   schema:'imperial.constructor.buyer_evaluation_package.v1',
   product:'CONSTRUCTOR_AI_OFFLINE_CLIENT_CRM',
   sourceCommit,ciRunId,
   scope:'SINGLE_USER_OFFLINE_TECHNICAL_EVALUATION',
   files:records.sort((a,b)=>a.path.localeCompare(b.path)),
   release:'NOT_PRODUCTION_AUTHORIZED',
   evidenceSignature:'NOT_SIGNED',
   customerContactAuthorized:false,commercialSaleAuthorized:false,
   independentHumanReviewComplete:false,
   newPaidProviderCalls:0,
   realRevenueUsd:0
 };
 exact(manifest.files.map(x=>x.path),ARTIFACTS,'PACKAGE_INVENTORY_INVALID');
 await exclusive(join(destination,'buyer-package-manifest.json'),
   Buffer.from(JSON.stringify(manifest,null,2)+'\n'));
 return Object.freeze({
   status:'PORTABLE_BUYER_EVALUATION_ASSEMBLED_NOT_RELEASED',
   sourceCommit,files:manifest.files.length,
   productionAuthorized:false,paidProviderCalls:0
 });
}

export async function verifyBuyerEvaluation({directory,expectedCommit=null}={}){
 const root=await safeDirectory(directory);
 exact(await readdir(root),['BUYER_GUIDE.md','buyer-package-manifest.json',
   'product','evidence'],'PACKAGE_EXTRA_ROOT_ENTRY');
 const product=await safeDirectory(join(root,'product'));
 await safeDirectory(join(product,'test'));
 await safeDirectory(join(root,'evidence'));
 exact(await readdir(product),
   [...FILES.filter(x=>!x.startsWith('test/')),'test'],
   'PACKAGE_PRODUCT_ROOT_INVALID');
 exact(await readdir(join(product,'test')),
   ['app.test.mjs','backup.test.mjs'],'PACKAGE_TEST_INVENTORY_INVALID');
 exact(await readdir(join(root,'evidence')),
   ['build-proof.json','qa.json','buyer-evidence.json'],
   'PACKAGE_EVIDENCE_INVENTORY_INVALID');
 const manifest=json(await bytesFrom(join(root,'buyer-package-manifest.json')),
   'PACKAGE_MANIFEST_INVALID');
 assert(manifest.schema==='imperial.constructor.buyer_evaluation_package.v1'&&
   manifest.scope==='SINGLE_USER_OFFLINE_TECHNICAL_EVALUATION'&&
   manifest.release==='NOT_PRODUCTION_AUTHORIZED'&&
   manifest.evidenceSignature==='NOT_SIGNED'&&
   manifest.commercialSaleAuthorized===false&&
   manifest.customerContactAuthorized===false&&
   manifest.independentHumanReviewComplete===false&&
   manifest.realRevenueUsd===0&&manifest.newPaidProviderCalls===0,
   'PACKAGE_AUTHORITY_DENIED');
 assert(COMMIT.test(manifest.sourceCommit)&&
   (expectedCommit===null||expectedCommit===manifest.sourceCommit),
   'PACKAGE_REVISION_MISMATCH');
 assert(Array.isArray(manifest.files)&&manifest.files.length===ARTIFACTS.length,
   'PACKAGE_FILE_COUNT_INVALID');
 exact(manifest.files.map(x=>x.path),ARTIFACTS,'PACKAGE_FILE_LIST_INVALID');
 for(const file of manifest.files){
   assert(ARTIFACTS.includes(file.path)&&
     Number.isSafeInteger(file.bytes)&&file.bytes>0&&file.bytes<=350000&&
     typeof file.sha256==='string'&&SHA.test(file.sha256),
     'PACKAGE_FILE_METADATA_INVALID');
   const data=await bytesFrom(join(root,file.path));
   assert(data.length===file.bytes&&digest(data)===file.sha256,
     'PACKAGE_FILE_HASH_MISMATCH');
 }
 const evidence=json(await bytesFrom(join(root,'evidence','buyer-evidence.json')),
   'PACKAGE_BUYER_REPORT_INVALID');
 assert(evidence.sourceCommit===manifest.sourceCommit&&
   evidence.scope==='SINGLE_USER_OFFLINE_DEMO_ONLY'&&
   evidence.verifiedProductFiles===FILES.length&&
   evidence.commercialSaleAuthorized===false&&
   evidence.automatedQaResult==='REPORTED_PASS_NOT_CRYPTO_ATTESTED',
   'PACKAGE_EVIDENCE_BOUNDARY_DENIED');
 const map=new Map(manifest.files.map(f=>[f.path,f]));
 for(const e of evidence.productFiles){
   const actual=map.get('product/'+e.path);
   assert(actual&&actual.sha256===e.sha256&&actual.bytes===e.bytes,
     'PACKAGE_PRODUCT_PROOF_MISMATCH');
 }
 assert(map.get('evidence/build-proof.json').sha256===evidence.buildProofSha256&&
   map.get('evidence/qa.json').sha256===evidence.automatedQaProofSha256,
   'PACKAGE_EVIDENCE_HASH_MISMATCH');
 return Object.freeze({
   status:'PORTABLE_PACKAGE_HASHES_VERIFIED_NOT_CRYPTO_ATTESTED',
   files:manifest.files.length,sourceCommit:manifest.sourceCommit,
   productionAuthorized:false
 });
}
