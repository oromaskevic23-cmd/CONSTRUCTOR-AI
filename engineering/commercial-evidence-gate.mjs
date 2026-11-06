/**
 * CONSTRUCTOR AI — read-only commercial technical due diligence evidence gate.
 * Architect / original author: Alexander Nikolaevich Romaskevich (RomaskevicH).
 *
 * Does not certify safety, send offers, create buyers, approve payments,
 * sign releases, or authorize model/agent execution.
 */
import {createHash} from 'node:crypto';
import {constants} from 'node:fs';
import {lstat,open,readdir,realpath} from 'node:fs/promises';
import {resolve,join,sep} from 'node:path';

const sha = bytes=>createHash('sha256').update(bytes).digest('hex');
const expect = (check,code)=>{if(!check)throw Error(code);};
const FILES = Object.freeze([
  'README.md','app.mjs','index.html','package.json','project-backup.mjs',
  'project-domain.mjs','project-runtime.mjs','serve.mjs','styles.css',
  'test/app.test.mjs','test/backup.test.mjs','verify.mjs',
]);
const CHECKS = Object.freeze([
  'manifest_independent_hash_review','functional_crm_behavior',
  'independent_backup_recovery_validation','browser_artifact_security_review',
  'isolated_http_server_smoke',
]);
const HEX = /^[a-f0-9]{64}$/;
const COMMIT = /^[a-f0-9]{40}$/;

async function safeDirectory(path){
  const absolute=resolve(path),stat=await lstat(absolute);
  expect(stat.isDirectory()&&!stat.isSymbolicLink(),'EVIDENCE_DIRECTORY_UNSAFE');
  return realpath(absolute);
}
async function safeFile(path,max=350000){
  let fd;
  try{
    fd=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW);
    const stat=await fd.stat();
    expect(stat.isFile()&&stat.size<=max&&stat.size>0,'EVIDENCE_FILE_UNSAFE');
    const bytes=await fd.readFile();
    expect(bytes.length===stat.size,'EVIDENCE_FILE_CHANGED');
    return bytes;
  }finally{await fd?.close();}
}
function parseJson(bytes,code){
  try{return JSON.parse(bytes.toString('utf8'));}
  catch{throw Error(code);}
}
function strictInventory(manifest){
  expect(manifest&&manifest.schema==='constructor-template-export-v1'&&
    manifest.template==='crm'&&Array.isArray(manifest.files)&&
    manifest.files.length===FILES.length,'PRODUCT_MANIFEST_INVALID');
  const sorted=manifest.files.map(f=>f.path).sort();
  expect(JSON.stringify(sorted)===JSON.stringify(FILES),'PRODUCT_INVENTORY_MISMATCH');
  for(const file of manifest.files){
    expect(file&&typeof file.path==='string'&&FILES.includes(file.path)&&
      Number.isSafeInteger(file.bytes)&&file.bytes>0&&file.bytes<=350000&&
      typeof file.sha256==='string'&&HEX.test(file.sha256),
      'PRODUCT_FILE_METADATA_INVALID');
  }
}
function checkBuildProof(proof,manifestBytes){
  expect(proof&&proof.schema==='imperial.constructor.offline_product.v1'&&
    proof.product==='OFFLINE_CLIENT_PIPELINE_CRM'&&proof.template==='crm'&&
    proof.productType==='reviewed_builtin_template'&&
    proof.manifestSha256===sha(manifestBytes)&&
    proof.exportFileCount===13&&
    proof.actualAutonomousAgentExecutions===0&&
    proof.sourceAuthority==='CONSTRUCTOR_AI_GIT_COMMIT_CHECKOUT'&&
    proof.modelInference==='NOT_PERFORMED'&&
    proof.generatedBy==='REVIEWED_DETERMINISTIC_EXPORTER'&&
    proof.independentQA==='PENDING'&&proof.browserE2E==='NOT_RUN'&&
    proof.productionDeployment==='NOT_PERFORMED'&&
    proof.release==='NOT_AUTHORIZED'&&proof.payments===0,
    'BUILD_PROOF_SCOPE_INVALID');
}
function checkAutomatedQa(proof){
  expect(proof&&proof.schema==='imperial.nca.independent_qa.v1'&&
    proof.product==='OFFLINE_CLIENT_PIPELINE_CRM'&&
    proof.status==='AUTOMATED_QA_PASS'&&
    proof.automatedReviewOnly===true&&
    proof.independentHumanAudit===false&&
    proof.externalNetworkCalls===0&&
    proof.productionDeployment===false&&
    proof.permissionGranted===false&&
    proof.productionRelease==='REQUIRES_ARCHITECT_APPROVAL'&&
    proof.review==='AUTOMATED_PROCESS_ISOLATION_ONLY'&&
    Array.isArray(proof.checks)&&proof.checks.length===CHECKS.length,
    'QA_PROOF_SCOPE_INVALID');
  const names=proof.checks.map(x=>x.name).sort();
  expect(JSON.stringify(names)===JSON.stringify([...CHECKS].sort())&&
    proof.checks.every(x=>x.status==='PASS'&&typeof x.detail==='string'),
    'QA_CHECK_MISMATCH');
  const actual=sha(Buffer.from(JSON.stringify({
    checks:proof.checks,status:proof.status
  })));
  expect(proof.sha256===actual,'QA_PROOF_DIGEST_INVALID');
}

/** Binds real local product inventory, independent automated QA report, source
 * revision and explicit non-commercial status without authenticating an issuer.
 */
export async function prepareBuyerReviewEvidence({
  productDirectory,buildProofPath,qaProofPath,outputPath,
  sourceCommit,ciRunId=null
}={}){
  expect(typeof sourceCommit==='string'&&COMMIT.test(sourceCommit),
    'EXACT_SOURCE_COMMIT_REQUIRED');
  expect(ciRunId===null||(
    typeof ciRunId==='string'&&/^[1-9][0-9]{0,19}$/.test(ciRunId)),
    'CI_RUN_ID_INVALID');
  const product=await safeDirectory(productDirectory);
  const output=resolve(outputPath);
  expect(!output.startsWith(product+sep)&&output!==product,
    'OUTPUT_OVERLAPS_PRODUCT');
  const rootFiles=(await readdir(product)).sort();
  expect(JSON.stringify(rootFiles)===
    JSON.stringify([...FILES.filter(x=>!x.startsWith('test/')),'manifest.json','test'].sort()),
    'PRODUCT_ROOT_INVENTORY_MISMATCH');
  const testFiles=(await readdir(join(product,'test'))).sort();
  expect(JSON.stringify(testFiles)===JSON.stringify(['app.test.mjs','backup.test.mjs']),
    'PRODUCT_TEST_INVENTORY_MISMATCH');
  await safeDirectory(join(product,'test'));
  const manifestBytes=await safeFile(join(product,'manifest.json'));
  const manifest=parseJson(manifestBytes,'PRODUCT_MANIFEST_PARSE_FAILED');
  strictInventory(manifest);
  for(const entry of manifest.files){
    const contents=await safeFile(join(product,entry.path));
    expect(contents.length===entry.bytes&&sha(contents)===entry.sha256,
      'PRODUCT_BYTES_MISMATCH');
  }
  const [buildBytes,qaBytes]=await Promise.all([
    safeFile(resolve(buildProofPath)),safeFile(resolve(qaProofPath))
  ]);
  checkBuildProof(parseJson(buildBytes,'BUILD_PROOF_PARSE_FAILED'),manifestBytes);
  checkAutomatedQa(parseJson(qaBytes,'QA_PROOF_PARSE_FAILED'));
  const record={
    schema:'imperial.constructor.buyer_review.v1',
    product:'CONSTRUCTOR_AI_OFFLINE_CLIENT_CRM',
    scope:'SINGLE_USER_OFFLINE_DEMO_ONLY',
    sourceCommit,
    ciRunId,
    artifactType:'REVIEWED_TEMPLATE_NOT_GENERATED_BY_LLM',
    productManifestSha256:sha(manifestBytes),
    buildProofSha256:sha(buildBytes),
    automatedQaProofSha256:sha(qaBytes),
    productFiles:manifest.files.map(x=>({
      path:x.path,bytes:x.bytes,sha256:x.sha256
    })).sort((a,b)=>a.path.localeCompare(b.path)),
    verifiedProductFiles:FILES.length,
    automatedQaChecks:CHECKS.length,
    automatedQaResult:'REPORTED_PASS_NOT_CRYPTO_ATTESTED',
    qaIndependence:'SEPARATE_AUTOMATED_CI_JOB_NOT_INDEPENDENT_HUMAN_AUDIT',
    modelGeneratedFullApplication:false,
    runningNanoCoreAgentsVerified:false,
    buyerIdentityVerified:false,
    customerAcceptanceVerified:false,
    externallyPublished:false,
    customerContactAuthorized:false,
    paymentConfirmed:false,
    realRevenueUsd:0,
    commercialSaleAuthorized:false,
    productionDeploymentAuthorized:false,
    independentSecurityAuditComplete:false,
    allowedNextAction:'OWNER_REVIEW_OF_TECHNICAL_DEMO',
    evidenceSignature:'NOT_SIGNED',
  };
  const report=Buffer.from(JSON.stringify(record,null,2)+'\n');
  expect(report.length<30000,'BUYER_BUNDLE_SIZE_LIMIT');
  const fd=await open(output,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|
    constants.O_NOFOLLOW,0o600);
  try{await fd.writeFile(report);await fd.sync();}
  finally{await fd.close();}
  return Object.freeze({status:'OFFLINE_BUYER_REVIEW_EVIDENCE_READY',
    outputSha256:sha(report),commercialSaleAuthorized:false,
    verifiedProductFiles:FILES.length,
    automatedQaChecks:CHECKS.length});
}
