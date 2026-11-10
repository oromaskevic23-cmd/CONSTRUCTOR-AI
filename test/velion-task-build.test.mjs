// Project author and founding architect: Alexander Nikolaevich Romaskevich (RomaskevicH).
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,generateKeyPairSync,sign} from 'node:crypto';
import {mkdtemp,readFile,readdir,rm,stat,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {issueLocalDraftPermit,ROUTE_LOCAL_TASK} from '../engineering/local-permit.mjs';
import {requestVelionTaskDraft,validateTaskDraft} from '../engineering/velion-task-generator.mjs';
import {stageGeneratedTaskApp} from '../engineering/task-build-quarantine.mjs';
import {verifyTaskOwnerApproval} from '../engineering/task-approval-gateway.mjs';
import {taskQaPayload} from '../engineering/task-qa-attestation.mjs';
import {taskSandboxArguments,taskSandboxFailureHints,validateGeneratedTaskTap,summarizeGeneratedTaskTap,validateTrustedTaskQaTap} from '../engineering/task-sandbox.mjs';
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
 await assert.rejects(call({input:{...draft,files:[{path:'run.sh',content:'x'}]}}),/TASK_CONTRACT|Disallowed artifact type/);
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
 const info=await stat(output.stage);
 assert.equal(info.mode&0o777,0o700);
 assert.equal(info.uid,process.getuid());
 const manifest=JSON.parse(await readFile(join(output.stage,'stage-manifest.json'),'utf8'));
 assert.equal(manifest.files.length,2);
 assert.equal(manifest.release,'DENIED');
 assert.deepEqual((await readdir(output.stage)).sort(),['app.mjs','stage-manifest.json','test']);
});

test('sandbox reads private quarantine as its non-root owner without weakening isolation',()=>{
 const image='node@sha256:'+'a'.repeat(64);
 const base={stage:'/tmp/private-stage',qaRoot:'/opt/qa',image,uid:1001,gid:1001};
 const args=taskSandboxArguments(base);
 assert.equal(args[args.indexOf('--user')+1],'1001:1001');
 for(const option of ['--network=none','--read-only','--cap-drop=ALL',
   '--security-opt=no-new-privileges','--pull=never']) assert.ok(args.includes(option));
 assert.ok(args.includes('type=bind,src=/tmp/private-stage,dst=/work,readonly'));
 assert.ok(args.includes('--permission'));
 assert.ok(args.includes('--allow-fs-read=/work'));
 assert.ok(!args.includes('--allow-child-process'));
 assert.ok(!args.includes('--test'));
 assert.ok(!args.some(arg=>arg.includes('src=/opt/qa')));
 const probe=taskSandboxArguments({...base,mode:'probe',challenge:'{}'});
 assert.ok(probe.includes('type=bind,src=/opt/qa/task-candidate-probe.mjs,dst=/probe.mjs,readonly'));
 assert.ok(probe.includes('--allow-fs-read=/probe.mjs'));
 assert.equal(probe[probe.length-2],'/probe.mjs');
 assert.equal(probe[probe.length-1],'{}');
 assert.throws(()=>taskSandboxArguments({...base,uid:0}),/NON_ROOT_SANDBOX/);
 assert.throws(()=>taskSandboxArguments({...base,gid:0}),/NON_ROOT_SANDBOX/);
 assert.throws(()=>taskSandboxArguments({...base,uid:undefined}),/NON_ROOT_SANDBOX/);
 assert.throws(()=>taskSandboxArguments({...base,stage:'/tmp/x,readonly=false'}),/MOUNT_PATH_INVALID/);
 assert.throws(()=>taskSandboxArguments({...base,image:'node:latest'}),/PINNED_DOCKER/);
 assert.throws(()=>taskSandboxArguments({...base,mode:'other'}),/MODE_INVALID/);
 assert.throws(()=>taskSandboxArguments({...base,mode:'probe',challenge:'x'.repeat(4097)}),/CHALLENGE_INVALID/);
});

test('trusted QA summary requires all three non-skipped assertions',()=>{
 const names=['model generated real task creation contract',
  'completion is immutable and independently observable',
  'filterOpen is nonmutating with realistic case variation'];
 const tap=names.map((name,i)=>`ok ${i+1} - ${name}`).join('\n')+
  '\n# tests 3\n# pass 3\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n';
 assert.equal(validateTrustedTaskQaTap(tap),true);
 assert.throws(()=>validateTrustedTaskQaTap(tap.replace('ok 2 - ','not ok 2 - ')),/INCOMPLETE/);
 assert.throws(()=>validateTrustedTaskQaTap(tap.replace('# skipped 0','# skipped 1')),/INVALID/);
 assert.throws(()=>validateTrustedTaskQaTap('TAP version 13\nok 1 - file\n# pass 1\n'),/INCOMPLETE/);
});

test('candidate-authored TAP requires individual records and a consistent plan, not just a forged summary',()=>{
 const tap='TAP version 13\n# Subtest: candidate fixture\nok 1 - candidate fixture\n1..1\n# tests 1\n# suites 0\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n';
 const forgedSummary='TAP version 13\n# tests 1\n# suites 0\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n';
 assert.equal(validateGeneratedTaskTap(tap),1);
 const nestedTap=[
   'TAP version 13',
   '# Subtest: parent',
   '    # Subtest: child',
   '    ok 1 - child',
   '    1..1',
   'ok 1 - parent',
   '1..1',
   '# tests 2',
   '# suites 0',
   '# pass 2',
   '# fail 0',
   '# cancelled 0',
   '# skipped 0',
   '# todo 0'
 ].join('\n')+'\n';
 assert.equal(validateGeneratedTaskTap(nestedTap),2);
 for(const invalid of [
   '',forgedSummary,
   tap.replace('1..1','1..2'),
   tap.replace('ok 1 - candidate fixture','ok 2 - candidate fixture'),
   tap.replace('ok 1 - candidate fixture','not ok 1 - candidate fixture'),
   tap.replace('# tests 1','# tests 0'),
   tap.replace('# pass 1','# pass 0'),
   tap.replace('# skipped 0','# skipped 1'),
   tap.replace('TAP version 13','TAP version 12'),
   tap.replace('# pass 1','# pass 1\n# pass 1')
 ])assert.throws(()=>validateGeneratedTaskTap(invalid),/GENERATED_TEST_REPORT_INVALID/);
 // TAP records remain untrusted candidate-authored output: independent QA is mandatory.
});

test('genuine Node TAP accepts nested suites and rejects duplicate nested records',async t=>{
 const root=await mkdtemp(join(tmpdir(),'constructor-real-tap-'));
 t.after(()=>rm(root,{recursive:true,force:true}));
 const fixture=join(root,'suite.mjs'),exec=promisify(execFile);
 async function run(source){
  await writeFile(fixture,source);
  const {stdout}=await exec(process.execPath,['--permission','--allow-fs-read='+root,
   '--test-reporter=tap',fixture],{timeout:10000,maxBuffer:120000,env:{PATH:process.env.PATH||'/usr/bin:/bin'}});
  return stdout;
 }
 const suite=await run("import {describe,it} from 'node:test';describe('suite',()=>{it('first',()=>{});it('second',()=>{});});\n");
 assert.equal(validateGeneratedTaskTap(suite),2);
 const deep=await run("import {describe,it} from 'node:test';describe('outer',()=>{describe('inner',()=>{it('first',()=>{});it('second',()=>{});});it('third',()=>{});});\n");
 assert.equal(validateGeneratedTaskTap(deep),3);
 const nested=await run("import test from 'node:test';test('parent',async t=>{await t.test('first',()=>{});await t.test('second',()=>{});});\n");
 assert.equal(validateGeneratedTaskTap(nested),3);
 assert.ok(nested.includes('    ok 2 - second'));
 for(const bad of [
  nested.replace('    ok 2 - second','    ok 1 - second'),
  nested.replace('    1..2\n',''),
  nested.replace('    1..2\n','    1..2\n    1..2\n'),
  nested.replace('# pass 3','# pass 3\n# pass 999'),
  nested.replace('1..1\n# tests 3','# tests 3\n1..1'),
  nested.replace('ok 1 - first','ok 1 - first # SKIP')
 ])assert.throws(()=>validateGeneratedTaskTap(bad),/GENERATED_TEST_REPORT_INVALID/);
 const fake='TAP version 13\n# Subtest: fabricated\nok 1 - fabricated\n1..1\n# tests 1\n# suites 0\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n';
 const fabricated=await run('process.stdout.write('+JSON.stringify(fake)+');\n');
 assert.deepEqual(summarizeGeneratedTaskTap(fabricated),{reportedCases:1,
  status:'UNTRUSTED_CANDIDATE_REPORT',executionVerified:false});
});

test('sandbox failure hints stay bounded and never include untrusted output',()=>{
 const hints=taskSandboxFailureHints({stdout:'EACCES SyntaxError secret-value',stderr:'ERR_ASSERTION'});
 assert.deepEqual(hints,['OUTPUT_HINT_PERMISSION','OUTPUT_HINT_SYNTAX','OUTPUT_HINT_ASSERTION']);
 assert.ok(!JSON.stringify(hints).includes('secret-value'));
 assert.deepEqual(taskSandboxFailureHints({killed:true}),['PROCESS_SIGNALED_OR_TIMED_OUT']);
 assert.deepEqual(taskSandboxFailureHints({stdout:'arbitrary generated text'}),[]);
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

test('strict real-model acceptance rejects synthetic reply without inference evidence',async()=>{
 const now=Date.now(),model='fixture:task-v1';
 const permit=issueLocalDraftPermit({mission,route:ROUTE_LOCAL_TASK,model,secret,now});
 await assert.rejects(requestVelionTaskDraft({
   mission,permit,permitSecret:secret,model,now,consumedNonces:new Set(),
   requireRealInferenceEvidence:true,
   fetchImpl:async()=>new Response(JSON.stringify({
     done:true,model,response:JSON.stringify(draft)
   }),{status:200})
 }),/REAL_INFERENCE_TOKEN_EVIDENCE_REQUIRED/);
});
test('real inference receipt is scoped evidence, not cryptographic attestation',async()=>{
 const now=Date.now(),model='fixture:task-v1';
 const permit=issueLocalDraftPermit({mission,route:ROUTE_LOCAL_TASK,model,secret,now});
 const result=await requestVelionTaskDraft({
   mission,permit,permitSecret:secret,model,now,consumedNonces:new Set(),
   requireRealInferenceEvidence:true,
   fetchImpl:async()=>new Response(JSON.stringify({
     done:true,done_reason:'stop',model,eval_count:25,total_duration:100000,
     response:JSON.stringify(draft)
   }),{status:200})
 });
 assert.equal(result.generatedTokens,25);
 assert.equal(result.realInferenceReceiptObserved,true);
 assert.equal(result.modelIdentity,'THIRD_PARTY_WEIGHTS_NOT_ATTESTED');
 assert.equal(result.release,'DENIED');
});
