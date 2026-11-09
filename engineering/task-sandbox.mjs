// Project author and founding architect: Alexander Nikolaevich Romaskevich (RomaskevicH).
// Build a non-root, offline sandbox for a private quarantine directory.
import {isAbsolute} from 'node:path';

export function taskSandboxArguments({stage,qaRoot,image,uid,gid}={}){
  if(!Number.isSafeInteger(uid)||uid<=0||!Number.isSafeInteger(gid)||gid<=0)
    throw Error('NON_ROOT_SANDBOX_IDENTITY_REQUIRED');
  if(typeof image!=='string'||!/^node@sha256:[a-f0-9]{64}$/.test(image))
    throw Error('PINNED_DOCKER_IMAGE_REQUIRED');
  // Docker's --mount syntax treats commas as separators even without a shell.
  if([stage,qaRoot].some(path=>typeof path!=='string'||!isAbsolute(path)||/[\0,]/.test(path)))
    throw Error('SANDBOX_MOUNT_PATH_INVALID');
  return [
    'run','--rm','--pull=never','--network=none','--read-only',
    '--cap-drop=ALL','--security-opt=no-new-privileges',
    '--pids-limit=64','--memory=256m','--cpus=1',
    '--user',`${uid}:${gid}`,'--tmpfs','/tmp:rw,noexec,nosuid,nodev,size=33554432',
    '--mount',`type=bind,src=${stage},dst=/work,readonly`,
    '--mount',`type=bind,src=${qaRoot},dst=/qa,readonly`,
    '--workdir','/work',image,'node','--test','--test-reporter=tap',
    '/work/test/app.test.mjs','/qa/independent-task-suite.mjs'
  ];
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
