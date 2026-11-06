// Original IMPERIAL Core test implementation — RomaskevicH.
// Synthetic QA fixtures test fail-closed input consistency; only CI can
// independently execute the genuine artifact QA job.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {mkdtemp,readFile,writeFile,rm,symlink} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {prepareBuyerReviewEvidence} from '../engineering/commercial-evidence-gate.mjs';

const sha=x=>createHash('sha256').update(x).digest('hex');
const checks=[
  'manifest_independent_hash_review','functional_crm_behavior',
  'independent_backup_recovery_validation','browser_artifact_security_review',
  'isolated_http_server_smoke',
];
const commit='b'.repeat(40);

async function fixture(t){
  const root=await mkdtemp(join(tmpdir(),'constructor-buyer-gate-'));
  t.after(()=>rm(root,{recursive:true,force:true}));
  const product=join(root,'offline-client-crm');
  execFileSync(process.execPath,['tools/build-offline-client-crm.mjs',product],{
    cwd:process.cwd(),env:{...process.env,IMPERIAL_ISOLATED_TEST:'yes'},
    timeout:12000,
  });
  const qa={
    schema:'imperial.nca.independent_qa.v1',
    product:'OFFLINE_CLIENT_PIPELINE_CRM',
    checks:checks.map(name=>({name,status:'PASS',detail:'synthetic fixture only'})),
    status:'AUTOMATED_QA_PASS',
    automatedReviewOnly:true,independentHumanAudit:false,
    externalNetworkCalls:0,productionDeployment:false,
    permissionGranted:false,
    review:'AUTOMATED_PROCESS_ISOLATION_ONLY',
    productionRelease:'REQUIRES_ARCHITECT_APPROVAL',
  };
  qa.sha256=sha(JSON.stringify({checks:qa.checks,status:qa.status}));
  const qaPath=join(root,'qa.json');
  await writeFile(qaPath,JSON.stringify(qa));
  const build=join(root,'build-proof.json');
  return {root,product,build,qaPath,qa};
}

async function run(x,name='review.json',extra={}){
  return prepareBuyerReviewEvidence({
    productDirectory:x.product,buildProofPath:x.build,qaProofPath:x.qaPath,
    outputPath:join(x.root,name),sourceCommit:commit,ciRunId:'123456789',
    ...extra
  });
}

test('real built template inventory becomes scope-limited unsigned review evidence',async t=>{
  const x=await fixture(t);
  const result=await run(x);
  const report=JSON.parse(await readFile(join(x.root,'review.json'),'utf8'));
  assert.equal(result.status,'OFFLINE_BUYER_REVIEW_EVIDENCE_READY');
  assert.equal(result.verifiedProductFiles,12);
  assert.equal(report.productFiles.length,12);
  assert.equal(report.automatedQaChecks,5);
  assert.equal(report.sourceCommit,commit);
  for(const field of ['buyerIdentityVerified','customerAcceptanceVerified',
    'commercialSaleAuthorized','paymentConfirmed',
    'productionDeploymentAuthorized','runningNanoCoreAgentsVerified']){
    assert.equal(report[field],false,field);
  }
  assert.equal(report.realRevenueUsd,0);
  assert.equal(report.evidenceSignature,'NOT_SIGNED');
  assert.equal(report.automatedQaResult,'REPORTED_PASS_NOT_CRYPTO_ATTESTED');
  assert.equal(report.scope,'SINGLE_USER_OFFLINE_DEMO_ONLY');
  await assert.rejects(run(x),/EEXIST/);
});

test('modified application source fails artifact SHA validation',async t=>{
  const x=await fixture(t);
  const source=join(x.product,'app.mjs');
  await writeFile(source,(await readFile(source))+'\n// tampered\n');
  await assert.rejects(run(x),/PRODUCT_BYTES_MISMATCH/);
});

test('fabricated or stale QA checks cannot be promoted',async t=>{
  const x=await fixture(t);
  const bad={...x.qa,status:'AUTOMATED_QA_FAIL'};
  await writeFile(x.qaPath,JSON.stringify(bad));
  await assert.rejects(run(x),/QA_PROOF_SCOPE_INVALID/);
  await writeFile(x.qaPath,JSON.stringify({...x.qa,sha256:'f'.repeat(64)}));
  await assert.rejects(run(x),/QA_PROOF_DIGEST_INVALID/);
  await writeFile(x.qaPath,JSON.stringify({...x.qa,checks:x.qa.checks.slice(1)}));
  await assert.rejects(run(x),/QA_PROOF_SCOPE_INVALID/);
});

test('altered build or misleading production flags fail closed',async t=>{
  const x=await fixture(t);
  const valid=JSON.parse(await readFile(x.build,'utf8'));
  await writeFile(x.build,JSON.stringify({...valid,release:'AUTHORIZED'}));
  await assert.rejects(run(x),/BUILD_PROOF_SCOPE_INVALID/);
  await writeFile(x.build,JSON.stringify({...valid,modelInference:'REAL_MODEL'}));
  await assert.rejects(run(x),/BUILD_PROOF_SCOPE_INVALID/);
});

test('wrong commit and suspicious run ID cannot produce bundle',async t=>{
  const x=await fixture(t);
  await assert.rejects(run(x,'wrong.json',{sourceCommit:'not-a-commit'}),
    /EXACT_SOURCE_COMMIT_REQUIRED/);
  await assert.rejects(run(x,'other.json',{ciRunId:'../../steal'}),
    /CI_RUN_ID_INVALID/);
});

test('symlinked artifact and added source file are rejected',async t=>{
  const x=await fixture(t);
  const original=join(x.product,'app.mjs');
  const backup=join(x.root,'app-real.mjs');
  const content=await readFile(original);
  // Avoid mutating the pristine file in place: force the rejected symlink path.
  await rm(original);
  await writeFile(backup,content);
  await symlink(backup,original);
  await assert.rejects(run(x),/ELOOP|EVIDENCE_FILE_UNSAFE/);
  await rm(original);
  await writeFile(original,content);
  await writeFile(join(x.product,'extra.js'),'unreviewed source');
  await assert.rejects(run(x),/PRODUCT_ROOT_INVENTORY_MISMATCH/);
});
