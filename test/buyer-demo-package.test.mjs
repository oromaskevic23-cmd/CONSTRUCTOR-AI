// CONSTRUCTOR AI — portable buyer pack adversarial, entirely offline tests.
// Copyright (c) 2026 Alexander Nikolaevich Romaskevich (RomaskevicH).
// QA fixtures are synthetic; the actual CI uses a separately executed QA job.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {mkdtemp,readFile,writeFile,rm,symlink,mkdir,readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {prepareBuyerReviewEvidence} from '../engineering/commercial-evidence-gate.mjs';
import {assembleBuyerEvaluation,verifyBuyerEvaluation} from '../engineering/buyer-demo-package.mjs';

const sha=x=>createHash('sha256').update(x).digest('hex');
const revision='e'.repeat(40);
const CHECKS=[
 'manifest_independent_hash_review','functional_crm_behavior',
 'independent_backup_recovery_validation','browser_artifact_security_review',
 'isolated_http_server_smoke'
];
async function fixture(t){
 const root=await mkdtemp(join(tmpdir(),'imperial-buyer-evaluation-'));
 t.after(()=>rm(root,{recursive:true,force:true}));
 const product=join(root,'crm');
 execFileSync(process.execPath,['tools/build-offline-client-crm.mjs',product],{
   cwd:process.cwd(),env:{...process.env,IMPERIAL_ISOLATED_TEST:'yes'},
   timeout:15000
 });
 const qa={
  schema:'imperial.nca.independent_qa.v1',
  product:'OFFLINE_CLIENT_PIPELINE_CRM',
  checks:CHECKS.map(name=>({name,status:'PASS',detail:'synthetic test fixture only'})),
  status:'AUTOMATED_QA_PASS',automatedReviewOnly:true,
  independentHumanAudit:false,externalNetworkCalls:0,
  productionDeployment:false,permissionGranted:false,
  review:'AUTOMATED_PROCESS_ISOLATION_ONLY',
  productionRelease:'REQUIRES_ARCHITECT_APPROVAL'
 };
 qa.sha256=sha(JSON.stringify({checks:qa.checks,status:qa.status}));
 const qaFile=join(root,'qa.json'),buildFile=join(root,'build-proof.json');
 const evidenceFile=join(root,'buyer-evidence.json');
 await writeFile(qaFile,JSON.stringify(qa)+'\n');
 await prepareBuyerReviewEvidence({
   productDirectory:product,buildProofPath:buildFile,qaProofPath:qaFile,
   outputPath:evidenceFile,sourceCommit:revision,ciRunId:'123456'
 });
 return {root,product,qaFile,buildFile,evidenceFile,
   output:join(root,'buyer-package')};
}
function pack(f,overrides={}){
 return assembleBuyerEvaluation({
  productDirectory:f.product,buildProofPath:f.buildFile,
  qaProofPath:f.qaFile,buyerEvidencePath:f.evidenceFile,
  outputDirectory:f.output,sourceCommit:revision,ciRunId:'123456',
  ...overrides
 });
}
test('builds real source, synthetic QA evidence and 16 hashed evaluation files',async t=>{
 const f=await fixture(t);
 const result=await pack(f);
 assert.equal(result.files,16);
 assert.equal(result.productionAuthorized,false);
 assert.equal(result.paidProviderCalls,0);
 const checked=await verifyBuyerEvaluation({
   directory:f.output,expectedCommit:revision
 });
 assert.equal(checked.status,'PORTABLE_PACKAGE_HASHES_VERIFIED_NOT_CRYPTO_ATTESTED');
 const manifest=JSON.parse(await readFile(join(f.output,'buyer-package-manifest.json')));
 assert.equal(manifest.release,'NOT_PRODUCTION_AUTHORIZED');
 assert.equal(manifest.commercialSaleAuthorized,false);
 assert.equal(manifest.independentHumanReviewComplete,false);
 assert(manifest.files.some(x=>x.path==='product/serve.mjs'));
 assert(manifest.files.some(x=>x.path==='evidence/qa.json'));
 assert((await readFile(join(f.output,'BUYER_GUIDE.md'),'utf8')).includes('Node.js 22+'));
 await assert.rejects(pack(f),/EEXIST/);
});
test('requires genuine consistency of provided evidence with newly checked source',async t=>{
 const f=await fixture(t);
 const old=await readFile(f.evidenceFile,'utf8');
 await writeFile(f.evidenceFile,old.replace('SINGLE_USER_OFFLINE_DEMO_ONLY','PRODUCTION'));
 await assert.rejects(pack(f),/BUYER_EVIDENCE_CHANGED_OR_UNBOUND/);
});
test('tampered product cannot be packed despite stale valid-looking QA',async t=>{
 const f=await fixture(t);
 await writeFile(join(f.product,'app.mjs'),'// tampered\n');
 await assert.rejects(pack(f),/PRODUCT_BYTES_MISMATCH/);
});
test('QA failure or changed QA report is never promoted to buyer package',async t=>{
 const f=await fixture(t);
 const qa=JSON.parse(await readFile(f.qaFile,'utf8'));
 qa.checks[0].status='FAIL';
 await writeFile(f.qaFile,JSON.stringify(qa));
 await assert.rejects(pack(f),/QA_CHECK_MISMATCH/);
});
test('wrong source commit is denied',async t=>{
 const f=await fixture(t);
 await assert.rejects(pack(f,{sourceCommit:'f'.repeat(40)}),
   /BUYER_EVIDENCE_CHANGED_OR_UNBOUND/);
});
test('no symlinked buyer source is copied',async t=>{
 const f=await fixture(t);
 const source=join(f.product,'app.mjs');
 const bytes=await readFile(source);
 await rm(source);
 const external=join(f.root,'outside.mjs');
 await writeFile(external,bytes);
 await symlink(external,source);
 await assert.rejects(pack(f),/ELOOP|EVIDENCE_FILE_UNSAFE/);
});
test('independently verifies package and rejects unexpected files',async t=>{
 const f=await fixture(t);
 await pack(f);
 await writeFile(join(f.output,'injected.js'),'unreviewed');
 await assert.rejects(verifyBuyerEvaluation({directory:f.output}),
   /PACKAGE_EXTRA_ROOT_ENTRY/);
});
test('independently verifies file and evidence hashes',async t=>{
 const f=await fixture(t);
 await pack(f);
 const path=join(f.output,'product','app.mjs');
 await writeFile(path,(await readFile(path))+'\n// modified');
 await assert.rejects(verifyBuyerEvaluation({directory:f.output}),
   /PACKAGE_FILE_HASH_MISMATCH/);
});
test('no arbitrary output path inside product source tree',async t=>{
 const f=await fixture(t);
 await assert.rejects(pack(f,{outputDirectory:join(f.product,'buyer-output')}),
   /PACKAGE_OVERLAPPING_PATHS/);
});
test('copy is not a production release, buyer contact or payment authorization',async t=>{
 const f=await fixture(t);
 await pack(f);
 const r=JSON.parse(await readFile(join(f.output,'evidence','buyer-evidence.json')));
 for(const key of ['commercialSaleAuthorized','paymentConfirmed',
   'buyerIdentityVerified','modelGeneratedFullApplication',
   'runningNanoCoreAgentsVerified','customerContactAuthorized']){
  assert.equal(r[key],false,key);
 }
 const m=JSON.parse(await readFile(join(f.output,'buyer-package-manifest.json')));
 assert.equal(m.realRevenueUsd,0);
 assert.equal(m.evidenceSignature,'NOT_SIGNED');
});
