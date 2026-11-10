// Project author and founding architect: Alexander Nikolaevich Romaskevich (RomaskevicH).
// Build a non-root, offline sandbox for a private quarantine directory.
import {isAbsolute} from 'node:path';

export function taskSandboxArguments({stage,qaRoot,image,uid,gid,mode='generated-tests',challenge}={}){
  if(!Number.isSafeInteger(uid)||uid<=0||!Number.isSafeInteger(gid)||gid<=0)
    throw Error('NON_ROOT_SANDBOX_IDENTITY_REQUIRED');
  if(typeof image!=='string'||!/^node@sha256:[a-f0-9]{64}$/.test(image))
    throw Error('PINNED_DOCKER_IMAGE_REQUIRED');
  // Docker's --mount syntax treats commas as separators even without a shell.
  if([stage,qaRoot].some(path=>typeof path!=='string'||!isAbsolute(path)||/[\0,]/.test(path)))
    throw Error('SANDBOX_MOUNT_PATH_INVALID');
  if(!['generated-tests','probe'].includes(mode))throw Error('SANDBOX_MODE_INVALID');
  if(mode==='probe' && (typeof challenge!=='string'||Buffer.byteLength(challenge)>4096))
    throw Error('SANDBOX_PROBE_CHALLENGE_INVALID');
  const args=[
    'run','--rm','--pull=never','--network=none','--read-only',
    '--cap-drop=ALL','--security-opt=no-new-privileges',
    '--pids-limit=64','--memory=256m','--cpus=1',
    '--user',`${uid}:${gid}`,'--tmpfs','/tmp:rw,noexec,nosuid,nodev,size=33554432',
    '--mount',`type=bind,src=${stage},dst=/work,readonly`,
  ];
  if(mode==='probe')args.push('--mount',
    `type=bind,src=${qaRoot}/task-candidate-probe.mjs,dst=/probe.mjs,readonly`);
  // Node's permission model adds a best-effort restriction. It is not a
  // substitute for the Docker isolation or an adversarial security review.
  args.push('--workdir','/work',image,'node','--permission','--allow-fs-read=/work');
  if(mode==='probe')args.push('--allow-fs-read=/probe.mjs','--experimental-vm-modules','/probe.mjs',challenge);
  else args.push('--test-reporter=tap','/work/test/app.test.mjs');
  return args;
}

// Only a structural check for the candidate-authored test process. Its output
// is untrusted and never substitutes for preauthored independent assertions.
export function validateGeneratedTaskTap(output){
  if(typeof output!=='string'||Buffer.byteLength(output)>120000)
    throw Error('GENERATED_TEST_REPORT_INVALID');
  const invalid=()=>{throw Error('GENERATED_TEST_REPORT_INVALID');};
  const lines=output.split(/\r?\n/);
  if(lines[0]!=='TAP version 13')invalid();
  const summary=Object.create(null),frames=[{records:0,planned:false}];
  let records=0;
  for(const line of lines){
    const metric=/^# (tests|suites|pass|fail|cancelled|skipped|todo) ([0-9]+)$/.exec(line);
    if(metric){
      if(frames.length!==1||!frames[0].planned||Object.hasOwn(summary,metric[1]))invalid();
      summary[metric[1]]=Number(metric[2]);
      continue;
    }
    if(/^# (?:tests|suites|pass|fail|cancelled|skipped|todo)\b/.test(line)||/^Bail out!/i.test(line))invalid();
    const record=/^( *)(ok|not ok) ([0-9]+) - (.+)$/.exec(line);
    const plan=/^( *)1\.\.([0-9]+)$/.exec(line);
    if(!record&&!plan){
      if(/^ *(?:(?:ok|not ok)\b|1\.\.)/.test(line))invalid();
      continue;
    }
    const indent=(record||plan)[1].length;
    if(indent%4!==0||indent/4>256)invalid();
    const depth=indent/4;
    while(frames.length>depth+1)if(!frames.pop().planned)invalid();
    while(depth>=frames.length){
      if(frames.at(-1).planned)invalid();
      frames.push({records:0,planned:false});
    }
    const frame=frames[depth];
    if(!frame||frame.planned)invalid();
    if(record){
      if(record[2]!=='ok'||Number(record[3])!==frame.records+1||/\s+#\s*(?:SKIP|TODO)(?:\s|$)/i.test(record[4]))invalid();
      frame.records++;records++;
    }else{
      if(Number(plan[2])!==frame.records||frame.records===0)invalid();
      frame.planned=true;
    }
  }
  if(frames.length!==1||!frames[0].planned)invalid();
  for(const key of ['tests','suites','pass','fail','cancelled','skipped','todo'])
    if(!Number.isSafeInteger(summary[key]))invalid();
  if(summary.tests<1||summary.tests>256||summary.suites>256||
    summary.pass!==summary.tests||summary.fail||summary.cancelled||summary.skipped||summary.todo||
    records!==summary.tests+summary.suites)invalid();
  // A coherent TAP string can still be fabricated by candidate code.
  // Only independent host-authored assertions can provide QA evidence.
  return summary.tests;
}

// The candidate controls this output, including coherent TAP records. Preserve
// the reported count for diagnostics without representing it as verified tests.
export function summarizeGeneratedTaskTap(output){
  return Object.freeze({reportedCases:validateGeneratedTaskTap(output),
    status:'UNTRUSTED_CANDIDATE_REPORT',executionVerified:false});
}

// This TAP is produced by the trusted host-side QA process, not by generated
// code. It is an extra fail-closed check, not a substitute for a human review.
export function validateTrustedTaskQaTap(output){
  if(typeof output!=='string'||Buffer.byteLength(output)>120000)throw Error('INDEPENDENT_QA_REPORT_INVALID');
  const names=['model generated real task creation contract',
    'completion is immutable and independently observable',
    'filterOpen is nonmutating with realistic case variation'];
  const lines=output.split(/\r?\n/);
  for(const name of names){
    if(lines.filter(line=>/^ok [0-9]+ - /.test(line)&&line.endsWith(' - '+name)).length!==1)
      throw Error('INDEPENDENT_QA_ASSERTIONS_INCOMPLETE');
  }
  for(const line of ['# fail 0','# cancelled 0','# skipped 0','# todo 0'])
    if(!lines.includes(line))throw Error('INDEPENDENT_QA_REPORT_INVALID');
  if(!lines.includes('# tests 3')||!lines.includes('# pass 3'))
    throw Error('INDEPENDENT_QA_ASSERTIONS_INCOMPLETE');
  return true;
}

// These are untrusted output hints, never an acceptance decision or a raw log.
export function taskSandboxFailureHints(error={}){
  const output=(String(error.stdout||'')+'\n'+String(error.stderr||'')).slice(0,240000);
  const hints=[];
  if(/\bEACCES\b|\bEPERM\b|permission denied/i.test(output)) hints.push('OUTPUT_HINT_PERMISSION');
  if(/\bERR_MODULE_NOT_FOUND\b|cannot find module/i.test(output)) hints.push('OUTPUT_HINT_MISSING_MODULE');
  if(/\bSyntaxError\b/.test(output)) hints.push('OUTPUT_HINT_SYNTAX');
  if(/\bERR_ASSERTION\b|AssertionError/.test(output)) hints.push('OUTPUT_HINT_ASSERTION');
  if(error.killed||error.signal) hints.push('PROCESS_SIGNALED_OR_TIMED_OUT');
  return hints;
}
