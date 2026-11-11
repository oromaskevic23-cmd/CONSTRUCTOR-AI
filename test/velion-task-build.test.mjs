// Project author and founding architect: Alexander Nikolaevich Romaskevich (RomaskevicH).
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,generateKeyPairSync,sign} from 'node:crypto';
import {mkdtemp,readFile,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {issueLocalDraftPermit,ROUTE_LOCAL_TASK} from '../engineering/local-permit.mjs';
import {requestVelionTaskDraft,validateTaskDraft} from '../engineering/velion-task-generator.mjs';
import {stageGeneratedTaskApp} from '../engineering/task-build-quarantine.mjs';
import {verifyTaskOwnerApproval} from '../engineering/task-approval-gateway.mjs';
import {taskQaPayload} from '../engineering/task-qa-attestation.mjs';
const secret='synthetic-hmac-only-strong-37-characters-not-owner';
const mission={id:'task-build-contract-001',goal:'Build a task manager with completed tasks',allowModel:true};
const draft={schema:'constructor_draft_v1',summary:'Synthetic task manager',
 steps:[{id:'create',action:'Implement domain code',acceptance:'Independent tests'}],
 files:[{path:'app.mjs',content:'export const createTask=(id,title)=>({id,title,done:false});\n'},
        {path:'test/app.test.mjs',content:'export const fixture=true;\n'}]};
async function call({now=Date.now(),input=draft,model='fixture:task-v1',fetchImpl}={}){
 const permit=issueLocalDraftPermit({mission,route:ROUTE_LOCAL_TASK,model,secret,now});
 return requestVelionTaskDraft({mission,permit,permitSecret:secret,model,now,consumedNonces:new Set(),
   fetchImpl:fetchImpl||(async(url,request)=>{
     assert.equal(url,'http://127.0.0.1:11434/api/generate');
     assert.equal(request.redirect,'error');
     const body=JSON.parse(request.body);
     assert.equal(body.options.num_predict,4096);
     assert.equal(body.options.max_predict,undefined);
     assert.match(body.prompt,/schema field must be the string "constructor_draft_v1"/);
     assert.match(body.prompt,/objects with string fields path and content/);
     assert.match(body.prompt,/without Markdown fences/);
     assert.match(body.prompt,/export function createTask\(id,title\)/);
     assert.match(body.prompt,/from '\.\.\/app\.mjs'/);
     assert.match(body.prompt,/Register concise tests by calling test/);
     return new Response(JSON.stringify({done:true,model,response:JSON.stringify(input)}),{status:200});
   })});
}
test('VELION local adapter returns validated UNTRUSTED source only',async()=>{
 const result=await call();
 assert.equal(result.status,'UNTRUSTED_GENERATED_TASK_APP');
 assert.equal(result.provider,'VELION_LOCAL_OLLAMA_ADAPTER');
 assert.equal(result.release,'DENIED');
 assert.equal(result.execution,'NOT_RUN');
 assert.equal(result.independentQa,'NOT_RUN');
});
test('local VELION adapter denies unsupported tasks, model IDs and partial responses',async()=>{
 const now=Date.now();
 const permit=issueLocalDraftPermit({mission,route:ROUTE_LOCAL_TASK,model:'local-v1',secret,now});
 await assert.rejects(requestVelionTaskDraft({mission:{...mission,goal:'Build a banking app'},permit,permitSecret:secret,model:'local-v1',now,consumedNonces:new Set()}),/ONLY_TASK_MANAGER/);
 await assert.rejects(call({model:'https://evil.example/api'}),/INVALID_MODEL_SCOPE|LOCAL_MODEL/);
 await assert.rejects(call({input:{...draft,files:[{path:'run.sh',content:'x'}]}}),/TASK_CONTRACT|LOCAL_MODEL_DRAFT_INVALID/);
 await assert.rejects(call({fetchImpl:async()=>new Response(JSON.stringify({done:false,model:'fixture:task-v1',response:JSON.stringify(draft)}),{status:200})}),/INCOMPLETE/);
 await assert.rejects(call({fetchImpl:async()=>new Response(JSON.stringify({done:true,done_reason:'length',model:'fixture:task-v1',response:JSON.stringify(draft)}),{status:200})}),/INCOMPLETE/);
 await assert.rejects(call({fetchImpl:async()=>{throw Error('offline');}}),/LOCAL_MODEL_UNAVAILABLE/);
});
test('substituted task goal or model cannot reach the local model',async()=>{
 const now=Date.now(),model='fixture:task-v1';
 const permit=issueLocalDraftPermit({mission,route:ROUTE_LOCAL_TASK,model,secret,now});
 let calls=0;
 const base={mission,permit,permitSecret:secret,model,now,consumedNonces:new Set(),
   fetchImpl:async()=>{calls++;throw Error('should not be called');}};
 await assert.rejects(requestVelionTaskDraft({...base,mission:{...mission,goal:'Build a different task manager'}}),/SCOPE/);
 await assert.rejects(requestVelionTaskDraft({...base,model:'other-local-model'}),/SCOPE/);
 assert.equal(calls,0);
});
test('already cancelled model requests never contact the provider',async()=>{
 const now=Date.now(),model='fixture:task-v1',controller=new AbortController();
 controller.abort();
 const permit=issueLocalDraftPermit({mission,route:ROUTE_LOCAL_TASK,model,secret,now});
 let calls=0;
 await assert.rejects(requestVelionTaskDraft({mission,permit,permitSecret:secret,model,now,
   consumedNonces:new Set(),signal:controller.signal,fetchImpl:async()=>{calls++;}}),/LOCAL_MODEL_CANCELLED/);
 assert.equal(calls,0);
});
test('local model response is bounded while streaming, before JSON parsing',async()=>{
 let chunks=0,cancelled=false;
 const stream=new ReadableStream({pull(controller){if(chunks===40){controller.close();return;}chunks++;controller.enqueue(new Uint8Array(8192));},
   cancel(){cancelled=true;}});
 await assert.rejects(call({fetchImpl:async()=>new Response(stream,{status:200})}),/LOCAL_MODEL_BODY_TOO_LARGE/);
 assert.equal(cancelled,true);assert.ok(chunks<30);
});
test('task source is quarantined with exact manifest and no execution',async t=>{
 const root=await mkdtemp(join(tmpdir(),'task-contract-'));
 t.after(()=>rm(root,{recursive:true,force:true}));
 const output=await stageGeneratedTaskApp({receipt:await call(),outputRoot:root});
 assert.equal(output.status,'QUARANTINED_NOT_EXECUTED');
 const manifest=JSON.parse(await readFile(join(output.stage,'stage-manifest.json'),'utf8'));
 assert.equal(manifest.files.length,2);
 assert.equal(manifest.release,'DENIED');
 assert.deepEqual((await readdir(output.stage)).sort(),['app.mjs','stage-manifest.json','test']);
});
test('heuristics deny dangerous generated code; no sandbox bypass',async t=>{
 const root=await mkdtemp(join(tmpdir(),'task-deny-'));
 t.after(()=>rm(root,{recursive:true,force:true}));
 const bad={...draft,files:[{path:'app.mjs',content:'process.env.SECRET; export const a=1;\n'},draft.files[1]]};
 await assert.rejects(stageGeneratedTaskApp({receipt:await call({input:bad}),outputRoot:root}),/STATIC_REVIEW_BLOCKED/);
});
test('Ed25519 Gateway denies absent Owner enrollment, forgery, replay, expiration and wrong QA evidence',()=>{
 const now=Date.now(),hash='a'.repeat(64),other='b'.repeat(64),suite='c'.repeat(64);
 const qaKeys=generateKeyPairSync('ed25519');
 const qaPublic=qaKeys.publicKey.export({format:'pem',type:'spki'});
 const qaMessage=taskQaPayload({schema:'constructor_task_qa_attestation_v1',
  missionId:'synthetic-task-001',stageManifestSha256:hash,qaLogSha256:other,
  qaSuiteSha256:suite,execution:'ISOLATED_DOCKER_NO_NETWORK',
  result:'INDEPENDENT_QA_PASSED',issuedAt:now,expiresAt:now+120000});
 const qaProof={...qaMessage,signature:sign(null,Buffer.from(JSON.stringify(qaMessage)),qaKeys.privateKey).toString('base64url')};
 const qaAttestationSha256=createHash('sha256').update(JSON.stringify(qaProof)).digest('hex');
 const {publicKey,privateKey}=generateKeyPairSync('ed25519');
 const {publicKey:foreign}=generateKeyPairSync('ed25519');
 const pem=publicKey.export({format:'pem',type:'spki'}),foreignPem=foreign.export({format:'pem',type:'spki'});
 const message={version:'constructor_owner_local_export_v2',signer:'OWNER',action:'export:local-review-only',
  missionId:qaProof.missionId,stageManifestSha256:hash,qaLogSha256:other,qaAttestationSha256,
  issuedAt:now,expiresAt:now+60000,nonce:'test-approval-nonce-123'};
 const approval={...message,signature:sign(null,Buffer.from(JSON.stringify(message)),privateKey).toString('base64url')};
 const args={approval,ownerPublicKeyPem:pem,qaProof,qaPublicKeyPem:qaPublic,
  expectedQaSuiteSha256:suite,consumedNonces:new Set(),now};
 assert.throws(()=>verifyTaskOwnerApproval({...args,qaPublicKeyPem:undefined}),/QA_PUBLIC_KEY_NOT_ENROLLED/);
 assert.throws(()=>verifyTaskOwnerApproval({...args,ownerPublicKeyPem:undefined}),/KEY_NOT_ENROLLED/);
 assert.throws(()=>verifyTaskOwnerApproval({...args,ownerPublicKeyPem:foreignPem}),/SIGNATURE_INVALID/);
 assert.throws(()=>verifyTaskOwnerApproval({...args,qaProof:{...qaProof,result:'FAIL'}}),/QA_ATTESTATION/);
 assert.throws(()=>verifyTaskOwnerApproval({...args,qaProof:{...qaProof,qaLogSha256:hash}}),/QA_SIGNATURE_INVALID/);
 assert.throws(()=>verifyTaskOwnerApproval({...args,qaPublicKeyPem:foreignPem}),/QA_SIGNATURE_INVALID/);
 assert.throws(()=>verifyTaskOwnerApproval({...args,expectedQaSuiteSha256:hash}),/QA_SUITE_MISMATCH/);
 assert.throws(()=>verifyTaskOwnerApproval({...args,ownerPublicKeyPem:qaPublic}),/QA_AND_OWNER_KEYS_MUST_DIFFER/);
 assert.throws(()=>verifyTaskOwnerApproval({...args,qaProof:{schema:'constructor_task_qa_v1',
  missionId:qaProof.missionId,status:'SANDBOX_INDEPENDENT_QA_PASS'}}),/QA_ATTESTATION_FORMAT/);
 const reordered=Object.fromEntries(Object.entries(approval).reverse());
 assert.equal(verifyTaskOwnerApproval({...args,approval:reordered,consumedNonces:new Set()}).permission,'EXPORT_REVIEW_COPY_ONLY');
 assert.throws(()=>verifyTaskOwnerApproval({...args,approval:{...approval,version:'constructor_owner_local_export_v1'},
   consumedNonces:new Set()}),/APPROVAL_SCOPE/);
 assert.throws(()=>verifyTaskOwnerApproval({...args,now:now+70000}),/TIME_DENIED/);
 const approved=verifyTaskOwnerApproval(args);
 assert.equal(approved.permission,'EXPORT_REVIEW_COPY_ONLY');
 assert.equal(approved.productionDeployment,'DENIED');
 assert.throws(()=>verifyTaskOwnerApproval(args),/REPLAY_DENIED/);
 assert.throws(()=>verifyTaskOwnerApproval({...args,approval:{...approval,qaLogSha256:hash},consumedNonces:new Set()}),/TIME_DENIED|SCOPE_OR_TIME_DENIED/);
});
