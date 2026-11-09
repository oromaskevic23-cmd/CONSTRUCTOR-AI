/**
 * CONSTRUCTOR AI — first real VELION local-model Task Manager acceptance.
 *
 * Original integration: Alexander Nikolaevich Romaskevich (RomaskevicH).
 *
 * Bounded model-generated candidate -> quarantine -> independent, preauthored
 * QA in no-network Docker. This is ephemeral engineering evidence, NOT an
 * AI Passport, Owner signature, production worker, app deployment or release.
 * Never execute generated application source on the trusted host.
 */
import {randomBytes,createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp,readFile,copyFile,writeFile,lstat} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {issueLocalDraftPermit,ROUTE_LOCAL_TASK} from '../engineering/local-permit.mjs';
import {requestVelionTaskDraft} from '../engineering/velion-task-generator.mjs';
import {stageGeneratedTaskApp} from '../engineering/task-build-quarantine.mjs';
import {taskSandboxArguments,taskSandboxFailureHints,validateTrustedTaskQaTap} from '../engineering/task-sandbox.mjs';

// Failed inference or QA requires offline analysis before another cloud run.
const MAX_ATTEMPTS=1;
const MAX_LOG_BYTES=120000;
const IMAGE_PATTERN=/^node@sha256:[a-f0-9]{64}$/;
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const ensure=(ok,code)=>{if(!ok)throw Error(code);};
const exec=promisify(execFile);
const IMAGE=process.env.CONSTRUCTOR_SANDBOX_IMAGE;
const MODEL='qwen2.5-coder:7b-instruct';
const QA_SUITE=resolve('qa/independent-task-suite.mjs');
const QA_FILES=['qa/independent-task-suite.mjs','qa/task-probe-client.mjs',
  'qa/task-candidate-probe.mjs','engineering/task-sandbox.mjs'];
const formatError=e=>typeof e?.code==='string'?e.code:'CANDIDATE_OR_QA_REJECTED';

async function localModelIdentity(){
  const response=await fetch('http://127.0.0.1:11434/api/tags',{
    redirect:'error',signal:AbortSignal.timeout(15000)
  });
  ensure(response.ok,'LOCAL_MODEL_TAGS_UNAVAILABLE');
  const raw=await response.text();
  ensure(Buffer.byteLength(raw)<160000,'LOCAL_MODEL_TAGS_TOO_LARGE');
  const entries=JSON.parse(raw).models;
  ensure(Array.isArray(entries),'LOCAL_MODEL_TAGS_INVALID');
  const found=entries.find(e=>e?.name===MODEL);
  ensure(found&&/^[a-f0-9]{64}$/.test(found.digest),'REAL_MODEL_NOT_INSTALLED');
  return found.digest;
}

async function validateStage(stage){
  const info=await lstat(stage);
  ensure(info.isDirectory()&&!info.isSymbolicLink()&&info.uid===process.getuid()&&
    (info.mode&0o777)===0o700,'SANDBOX_STAGE_OWNER_OR_MODE_INVALID');
  const doc=await readFile(join(stage,'stage-manifest.json'));
  ensure(doc.length<=16000,'STAGE_MANIFEST_OVER_BUDGET');
  const manifest=JSON.parse(doc.toString('utf8'));
  ensure(manifest.schema==='constructor_task_stage_v1' &&
    manifest.release==='DENIED' && manifest.execution==='NOT_RUN' &&
    manifest.approval==='DENIED' && manifest.independentQa==='NOT_RUN',
    'STAGE_SCOPE_INVALID');
  ensure(Array.isArray(manifest.files)&&manifest.files.length===2&&
    manifest.files.map(f=>f.path).sort().join('|')==='app.mjs|test/app.test.mjs',
    'STAGE_FILE_SET_DENIED');
  for(const file of manifest.files){
    ensure(/^[a-f0-9]{64}$/.test(file.sha256) && Number.isSafeInteger(file.bytes),
      'STAGE_FILE_RECORD_INVALID');
    const bytes=await readFile(join(stage,file.path));
    ensure(bytes.length===file.bytes && sha(bytes)===file.sha256,
      'STAGE_SOURCE_CHANGED');
  }
  return {manifestSha256:sha(doc),files:manifest.files};
}

async function runInSandbox(stage){
  // mkdtemp creates a 0700 directory owned by the non-root runner. Matching
  // that UID lets the container read it without widening host permissions.
  const args=taskSandboxArguments({stage,qaRoot:resolve('qa'),image:IMAGE,
    uid:process.getuid(),gid:process.getgid()});
  try{
    const generated=await exec('docker',args,{
      timeout:90000,maxBuffer:MAX_LOG_BYTES,
      env:{PATH:process.env.PATH||'/usr/bin:/bin'}
    });
    // Trusted preauthored assertions run outside the container. They never
    // import candidate source on the host, and communicate with a fresh
    // restricted container using a bounded, untrusted response protocol.
    const independent=await exec(process.execPath,
      ['--test','--test-reporter=tap',QA_SUITE],{
        timeout:110000,maxBuffer:MAX_LOG_BYTES,
        env:{PATH:process.env.PATH||'/usr/bin:/bin',
          CONSTRUCTOR_TASK_STAGE:stage,CONSTRUCTOR_SANDBOX_IMAGE:IMAGE,
          CONSTRUCTOR_TASK_UID:String(process.getuid()),
          CONSTRUCTOR_TASK_GID:String(process.getgid())}
      });
    validateTrustedTaskQaTap(independent.stdout);
    return {passed:true,exitCode:0,
      generatedStdoutSha256:sha(generated.stdout),
      independentStdoutSha256:sha(independent.stdout),
      independentCases:3,failure:null};
  }catch(e){
    return {passed:false,exitCode:Number.isInteger(e.code)?e.code:null,
      stdoutSha256:sha(e.stdout||''),stderrSha256:sha(e.stderr||''),
      failure:'ISOLATED_QA_FAILED_CLOSED',diagnosticHints:taskSandboxFailureHints(e)};
  }
}

async function main(){
  ensure(process.env.CONSTRUCTOR_REAL_TASK_E2E==='EPHEMERAL_CI_ONLY',
    'EXPLICIT_EPHEMERAL_LLM_OPT_IN_REQUIRED');
  ensure(IMAGE_PATTERN.test(IMAGE||''),'PINNED_DOCKER_IMAGE_REQUIRED');
  ensure(process.env.OLLAMA_NO_CLOUD==='1','LOCAL_ONLY_MODEL_REQUIRED');
  ensure(process.env.GITHUB_ACTIONS==='true','EPHEMERAL_GITHUB_CI_REQUIRED');
  // Reject a root host runner before downloading model output or staging code.
  taskSandboxArguments({stage:resolve('.'),qaRoot:resolve('qa'),image:IMAGE,
    uid:process.getuid?.(),gid:process.getgid?.()});
  const qaHashes=await Promise.all(QA_FILES.map(async path=>({path,sha256:sha(await readFile(path))})));
  const root=await mkdtemp(join(process.env.RUNNER_TEMP||tmpdir(),
    'constructor-real-task-'));
  const outputRoot=process.env.RUNNER_TEMP||tmpdir();
  const modelSha256=await localModelIdentity();
  const report={
    schema:'constructor.real_task_manager_e2e.v1',
    origin:'EPHEMERAL_GITHUB_ACTIONS_REAL_LOCAL_OLLAMA',
    model:MODEL,modelSha256,qaSuiteSha256:qaHashes[0].sha256,qaFiles:qaHashes,
    sandboxImage:IMAGE,network:'NONE',maxAttempts:MAX_ATTEMPTS,
    scope:'TWO_FILE_TASK_DOMAIN_ONLY_NOT_FULL_APPLICATION',
    productionAuthorized:false,aiPassportVerified:false,
    ownerEd25519PermitVerified:false,humanIndependentQa:false,
    approval:'NOT_GRANTED',release:'DENIED',spendUsd:null,
    billingVerification:'NOT_VERIFIED',
    attempts:[],status:'BLOCKED_NO_ACCEPTED_MODEL_BUILD'
  };
  const permitSecret=randomBytes(32).toString('base64url');
  try{
    for(let attempt=1;attempt<=MAX_ATTEMPTS;attempt++){
      const step={attempt,generatedTokens:0,qaPassed:false,
        execution:'NOT_PRODUCTION'};
      report.attempts.push(step);
      try{
        const now=Date.now();
        const mission={
          id:'real-task-'+randomBytes(8).toString('hex'),
          goal:'Build a task manager with immutable completion, strict input validation, and an open-task filter. The application must pass prewritten independent acceptance tests.',
          allowModel:true
        };
        const permit=issueLocalDraftPermit({
          mission,route:ROUTE_LOCAL_TASK,model:MODEL,
          secret:permitSecret,now
        });
        const generated=await requestVelionTaskDraft({
          mission,permit,permitSecret,consumedNonces:new Set(),
          model:MODEL,now,timeoutMs:300000,
          requireRealInferenceEvidence:true
        });
        ensure(generated.realInferenceReceiptObserved===true &&
          generated.generatedTokens>0,'MODEL_EVIDENCE_NOT_OBSERVED');
        const stage=await stageGeneratedTaskApp({receipt:generated,outputRoot});
        const manifest=await validateStage(stage.stage);
        step.generatedTokens=generated.generatedTokens;
        step.missionId=mission.id;
        step.draftSha256=generated.draftSha256;
        step.modelOutputSha256=generated.modelOutputSha256;
        step.stageManifestSha256=manifest.manifestSha256;
        step.files=manifest.files;
        step.qa=await runInSandbox(stage.stage);
        await validateStage(stage.stage);
        for(const file of qaHashes)
          ensure(sha(await readFile(file.path))===file.sha256,'QA_SOURCE_CHANGED');
        step.qaPassed=step.qa.passed;
        if(!step.qaPassed)continue;
        await copyFile(join(stage.stage,'app.mjs'),join(root,'winning-app.mjs'));
        await copyFile(join(stage.stage,'test','app.test.mjs'),
          join(root,'generated-app.test.mjs'));
        report.status='REAL_LOCAL_MODEL_TASK_MANAGER_DOCKER_QA_PASS';
        report.acceptedAttempt=attempt;
        report.acceptedSourceSha256=sha(
          await readFile(join(root,'winning-app.mjs')));
        break;
      }catch(e){
        step.failure=String(formatError(e)).slice(0,80);
      }
    }
  }finally{
    const bytes=JSON.stringify(report,null,2)+'\n';
    await writeFile(join(root,'evidence.json'),bytes,{flag:'wx',mode:0o600});
    console.log(JSON.stringify({
      status:report.status,model:MODEL,
      attempts:report.attempts.length,
      passed:report.status==='REAL_LOCAL_MODEL_TASK_MANAGER_DOCKER_QA_PASS',
      evidenceRoot:root,modelSha256,qaSuiteSha256:report.qaSuiteSha256,
      release:'DENIED',spendUsd:null,billingVerification:'NOT_VERIFIED'
    }));
  }
  ensure(report.status==='REAL_LOCAL_MODEL_TASK_MANAGER_DOCKER_QA_PASS',
    'NO_REAL_MODEL_CANDIDATE_PASSED_INDEPENDENT_SANDBOX_QA');
}

await main();
