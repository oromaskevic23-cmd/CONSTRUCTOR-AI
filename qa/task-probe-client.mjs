// Trusted host-side adapter. Never import or execute generated files here.
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {taskSandboxArguments} from '../engineering/task-sandbox.mjs';
const exec=promisify(execFile);

export async function probeTaskCandidate({stage,qaRoot,image,uid,gid,challenge},run=exec){
  const encoded=JSON.stringify(challenge);
  const args=taskSandboxArguments({stage,qaRoot,image,uid,gid,mode:'probe',challenge:encoded});
  const {stdout}=await run('docker',args,{
    timeout:90000,maxBuffer:120000,env:{PATH:process.env.PATH||'/usr/bin:/bin'}
  });
  // A zero exit code, fake TAP, or an empty/partial response is never QA.
  if(typeof stdout!=='string'||Buffer.byteLength(stdout)>120000)
    throw Error('INDEPENDENT_QA_PROBE_OUTPUT_INVALID');
  let result;
  try{result=JSON.parse(stdout);}catch{throw Error('INDEPENDENT_QA_PROBE_OUTPUT_INVALID');}
  if(!result||typeof result!=='object'||Array.isArray(result)||
    result.schema!=='constructor.task_probe.v1')throw Error('INDEPENDENT_QA_PROBE_OUTPUT_INVALID');
  return result;
}
