import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,generateKeyPairSync,sign} from 'node:crypto';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {parseModelDraft} from '../engineering/draft-contract.mjs';
import {stageGeneratedTaskApp} from '../engineering/task-build-quarantine.mjs';
import {exportOwnerApprovedReviewCopy} from '../engineering/task-review-export.mjs';
const sha=x=>createHash('sha256').update(x).digest('hex');
test('local signed export requires actual evidence, records replay persistently and never enables production',async t=>{
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
 const qaProof={schema:'constructor_task_qa_v1',missionId,
  status:'SANDBOX_INDEPENDENT_QA_PASS',execution:'ISOLATED_DOCKER_NO_NETWORK',
  manifestSha256:sha(manifest),qaLogSha256:sha(qaLog),release:'DENIED'};
 const [logPath,proofPath,keyPath,approvalPath]=['qa.log','qa.json','pub.pem','approval.json'].map(x=>join(root,x));
 const {publicKey,privateKey}=generateKeyPairSync('ed25519');
 const key=publicKey.export({type:'spki',format:'pem'});
 const msg={version:'constructor_owner_local_export_v1',signer:'OWNER',
  action:'export:local-review-only',missionId,stageManifestSha256:sha(manifest),
  qaLogSha256:sha(qaLog),issuedAt:now,expiresAt:now+60000,nonce:'synthetic-review-nonce-123'};
 const approval={...msg,signature:sign(null,Buffer.from(JSON.stringify(msg)),privateKey).toString('base64url')};
 await Promise.all([writeFile(logPath,qaLog),writeFile(proofPath,JSON.stringify(qaProof)),
   writeFile(keyPath,key),writeFile(approvalPath,JSON.stringify(approval))]);
 const args={stagePath:staged.stage,qaProofPath:proofPath,qaLogPath:logPath,
  approvalPath,ownerPublicKeyPath:keyPath,replayDirectory:replay,outputDirectory:out,now};
 const copy=await exportOwnerApprovedReviewCopy(args);
 assert.equal(copy.status,'LOCAL_REVIEW_COPY_EXPORTED');
 assert.equal(copy.productionRelease,'DENIED');
 assert.equal(await readFile(join(copy.destination,'app.mjs'),'utf8'),draft.files[0].content);
 await assert.rejects(exportOwnerApprovedReviewCopy(args),/EEXIST/);
 const differentKey=generateKeyPairSync('ed25519').publicKey.export({type:'spki',format:'pem'});
 await writeFile(keyPath,differentKey);
 await assert.rejects(exportOwnerApprovedReviewCopy(args),/OWNER_SIGNATURE_INVALID/);
});
