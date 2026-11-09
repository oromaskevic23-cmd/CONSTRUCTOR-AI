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
  const lines=output.split(/\r?\n/);
  if(lines[0]!=='TAP version 13')throw Error('GENERATED_TEST_REPORT_INVALID');
  const counts=lines.filter(line=>/^# tests [0-9]+$/.test(line));
  if(counts.length!==1)throw Error('GENERATED_TEST_REPORT_INVALID');
  const count=Number(counts[0].slice(8));
  if(!Number.isSafeInteger(count)||count<1||count>256)
    throw Error('GENERATED_TEST_REPORT_INVALID');
  // The candidate-authored suite is always untrusted. Requiring a coherent
  // TAP plan and individual records only rejects truncated/fabricated summaries.
  // Independent host-authored assertions are the separate acceptance gate.
  // Node TAP may count nested subtests in # tests, while the root plan
  // counts only top-level test records. Preserve valid nested test suites.
  const plans=lines.filter(line=>/^1\.\.[0-9]+$/.test(line));
  const topLevel=lines.filter(line=>/^ok [1-9][0-9]* - .+/.test(line));
  if(plans.length!==1||topLevel.length<1||plans[0]!==`1..${topLevel.length}`)
    throw Error('GENERATED_TEST_REPORT_INVALID');
  if(topLevel.some((line,i)=>!line.startsWith(`ok ${i+1} - `)))
    throw Error('GENERATED_TEST_REPORT_INVALID');
  const oks=lines.filter(line=>/^\s*ok [1-9][0-9]* - .+/.test(line));
  if(oks.length!==count||lines.some(line=>/^\s*not ok [0-9]+ - /.test(line)))
    throw Error('GENERATED_TEST_REPORT_INVALID');
  for(const item of [`# pass ${count}`,'# fail 0','# cancelled 0','# skipped 0','# todo 0']){
    if(lines.filter(line=>line===item).length!==1)throw Error('GENERATED_TEST_REPORT_INVALID');
  }
  return count;
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
