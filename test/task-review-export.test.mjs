// Project author and founding architect: Alexander Nikolaevich Romaskevich (RomaskevicH).
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,generateKeyPairSync,sign} from 'node:crypto';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {parseModelDraft} from '../engineering/draft-contract.mjs';
import {stageGeneratedTaskApp} from '../engineering/task-build-quarantine.mjs';
import {exportOwnerApprovedReviewCopy} from '../engineering/task-review-export.mjs';
import {taskQaPayload} from '../engineering/task-qa-attestation.mjs';
import {spawnSync} from 'node:child_process';
const sha=x=>createHash('sha256').update(x).digest('hex');
test('synthetic dual-signed local review records replay persistently and never enables production',async t=>{
 const root=await mkdtemp(join(tmpdir(),'test-owner-review-export-'));
 t.after(()=>rm(root,{recursive:true,force:true}));
 const staging=join(root,'staging'),out=join(root,'out'),replay=join(root,'replay');
 await Promise.all([mkdir(staging),mkdir(out),mkdir(replay)]);
 const draft={schema:'constructor_draft_v1',summary:'Synthetic review-only source',
 steps:[{id:'create',action:'Create source',acceptance:'Verify file inventory'}],
 files:[{path:'app.mjs',content:'export const task = 1;\n'},
        {path:'test/app.test.mjs',content:'export const sample = true;\n'}]};
 const checked=parseModelDraft(JSON.stringify(draft)),missionId='synthetic-export-001';
 const staged=await stageGeneratedTaskApp({outputRoot:staging,receipt:{
  status:'UNTRUSTED_GENERATED_TASK_APP',execution:'NOT_RUN',independentQa:'NOT_RUN',
  release:'DENIED',approval:'DENIED',draft,draftSha256:checked.sha256,
  missionId,goalSha256:sha('synthetic'),model:'fake-model',
  modelOutputSha256:sha(JSON.stringify(draft))}});
 const manifest=await readFile(join(staged.stage,'stage-manifest.json'));
 const qaLog='trusted synthetic fixture only: pass 4, fail 0\n',now=Date.now();
 const qaKeys=generateKeyPairSync('ed25519');
 const qaSuiteSha256=sha(await readFile(new URL('../qa/independent-task-suite.mjs',import.meta.url)));
 const qaMsg=taskQaPayload({schema:'constructor_task_qa_attestation_v1',missionId,
  stageManifestSha256:sha(manifest),qaLogSha256:sha(qaLog),qaSuiteSha256,
  execution:'ISOLATED_DOCKER_NO_NETWORK',result:'INDEPENDENT_QA_PASSED',
  issuedAt:now,expiresAt:now+120000});
 const qaProof={...qaMsg,signature:sign(null,Buffer.from(JSON.stringify(qaMsg)),qaKeys.privateKey).toString('base64url')};
 const [logPath,proofPath,keyPath,qaKeyPath,approvalPath]=['qa.log','qa.json','pub.pem','qa-pub.pem','approval.json'].map(x=>join(root,x));
 const {publicKey,privateKey}=generateKeyPairSync('ed25519');
 const key=publicKey.export({type:'spki',format:'pem'});
 const msg={version:'constructor_owner_local_export_v2',signer:'OWNER',
  action:'export:local-review-only',missionId,stageManifestSha256:sha(manifest),
  qaLogSha256:sha(qaLog),qaAttestationSha256:sha(JSON.stringify(qaProof)),
  issuedAt:now,expiresAt:now+60000,nonce:'synthetic-review-nonce-123'};
 const approval={...msg,signature:sign(null,Buffer.from(JSON.stringify(msg)),privateKey).toString('base64url')};
 await Promise.all([writeFile(logPath,qaLog),writeFile(proofPath,JSON.stringify(qaProof)),
   writeFile(keyPath,key),writeFile(qaKeyPath,qaKeys.publicKey.export({type:'spki',format:'pem'})),
   writeFile(approvalPath,JSON.stringify(approval))]);
 const args={stagePath:staged.stage,qaProofPath:proofPath,qaLogPath:logPath,
  approvalPath,ownerPublicKeyPath:keyPath,qaPublicKeyPath:qaKeyPath,
  replayDirectory:replay,outputDirectory:out,now};
 await writeFile(logPath,'modified log');
 await assert.rejects(exportOwnerApprovedReviewCopy(args),/QA_EVIDENCE_BINDING_FAILED/);
 await writeFile(logPath,qaLog);
 const foreignQa=generateKeyPairSync('ed25519').publicKey.export({type:'spki',format:'pem'});
 await writeFile(qaKeyPath,foreignQa);
 await assert.rejects(exportOwnerApprovedReviewCopy(args),/QA_SIGNATURE_INVALID/);
 await writeFile(qaKeyPath,qaKeys.publicKey.export({type:'spki',format:'pem'}));
 const copy=await exportOwnerApprovedReviewCopy(args);
 assert.equal(copy.status,'LOCAL_REVIEW_COPY_EXPORTED');
 assert.equal(copy.productionRelease,'DENIED');
 assert.equal(await readFile(join(copy.destination,'app.mjs'),'utf8'),draft.files[0].content);
 await assert.rejects(exportOwnerApprovedReviewCopy(args),/EEXIST/);
 const differentKey=generateKeyPairSync('ed25519').publicKey.export({type:'spki',format:'pem'});
 await writeFile(keyPath,differentKey);
 await assert.rejects(exportOwnerApprovedReviewCopy(args),/OWNER_SIGNATURE_INVALID/);
});

test('fabricated text cannot become a signed sandbox QA result',async t=>{
 const root=await mkdtemp(join(tmpdir(),'test-qa-spoof-'));
 t.after(()=>rm(root,{recursive:true,force:true}));
 const stageResult=spawnSync(process.execPath,['tools/prepare-synthetic-task-build.mjs',root],{encoding:'utf8'});
 assert.equal(stageResult.status,0);
 const stage=JSON.parse(stageResult.stdout).stage;
 const log=join(root,'fake.log'),receipt=join(root,'fake.json');
 await writeFile(log,'pass 4\nfail 0\ncompletion is immutable\n');
 const result=spawnSync(process.execPath,['tools/verify-task-sandbox-qa.mjs',stage,log,receipt],{encoding:'utf8'});
 assert.equal(result.status,0);
 const proof=JSON.parse(await readFile(receipt,'utf8'));
 assert.equal(proof.status,'UNATTESTED_QA_LOG_SHAPE_ONLY');
 assert.equal(proof.execution,'NOT_ATTESTED_BY_COLLECTOR');
 assert.equal(proof.release,'DENIED');
 assert.equal(Object.hasOwn(proof,'signature'),false);
});
