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
  args.push('--workdir','/work',image,'node');
  if(mode==='probe')args.push('--experimental-vm-modules','/probe.mjs',challenge);
  else args.push('--test','--test-reporter=tap','/work/test/app.test.mjs');
  return args;
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
