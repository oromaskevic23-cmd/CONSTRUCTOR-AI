// Local, synthetic regressions. No model output is executed on the host.
// Project author and founding architect: Alexander Nikolaevich Romaskevich (RomaskevicH).
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {promisify} from 'node:util';
import {validateTrustedTaskQaTap} from '../engineering/task-sandbox.mjs';
import {probeTaskCandidate} from '../qa/task-probe-client.mjs';
const exec=promisify(execFile);
const image='node@sha256:'+'a'.repeat(64);
const input={stage:'/tmp/untrusted-stage',qaRoot:'/tmp/trusted-qa',image,uid:1001,gid:1001,challenge:{idA:'a-1'}};

test('zero exit, fabricated TAP and malformed probe results are denied',async()=>{
  for(const stdout of ['', 'TAP version 13\nok 1 - forged\n# pass 1\n', '{}', '{']){
    await assert.rejects(probeTaskCandidate(input,async()=>({stdout,stderr:''})),/PROBE_OUTPUT_INVALID/);
  }
});

test('preauthored QA fails on a synthetic zero-exit candidate and accepts valid probe responses',async t=>{
  const dir=await mkdtemp(join(tmpdir(),'constructor-qa-local-'));
  t.after(()=>rm(dir,{recursive:true,force:true}));
  const docker=join(dir,'docker');
  const app=join(dir,'synthetic-app.mjs'),probe=join(dir,'synthetic-probe.mjs');
  const suite=resolve('qa/independent-task-suite.mjs');
  const options={cwd:resolve('.'),timeout:20000,maxBuffer:120000,
    env:{PATH:dir,CONSTRUCTOR_TASK_STAGE:'/tmp/synthetic-stage',CONSTRUCTOR_SANDBOX_IMAGE:image,
      CONSTRUCTOR_TASK_UID:'1001',CONSTRUCTOR_TASK_GID:'1001'}};
  // Execute only this test's own synthetic fixture, using the real probe with
  // its container-only import redirected to that fixture in a temporary copy.
  // This does not test Docker and never runs generated model code on the host.
  const probeSource=await readFile(resolve('qa/task-candidate-probe.mjs'),'utf8');
  assert.equal(probeSource.split("'/work/app.mjs'").length,2);
  await writeFile(probe,probeSource.replace("'/work/app.mjs'",JSON.stringify(app)));
  const fake=`#!${process.execPath}\nconst {spawnSync}=require('node:child_process');
const p=spawnSync(process.execPath,['--experimental-vm-modules',${JSON.stringify(probe)},process.argv.at(-1)],{encoding:'utf8'});
process.stdout.write(p.stdout||'');process.stderr.write(p.stderr||'');process.exit(p.status??1);\n`;
  await writeFile(docker,fake,{mode:0o700});
  await writeFile(app,'process.exit(0);\n');
  await assert.rejects(exec(process.execPath,['--test','--test-reporter=tap',suite],options),
    error=>error.code===1&&!/# pass 3\b/.test(error.stdout));
  await writeFile(app,"globalThis.constructor.constructor('return process')().exit(0);\n");
  await assert.rejects(exec(process.execPath,['--test','--test-reporter=tap',suite],options),
    error=>error.code===1&&!/# pass 3\b/.test(error.stdout));
  await writeFile(app,"await import('node:fs');\n");
  await assert.rejects(exec(process.execPath,['--test','--test-reporter=tap',suite],options),
    error=>error.code===1&&!/# pass 3\b/.test(error.stdout));
  const good=[
    "export function createTask(id,title){if(typeof id!=='string'||!/^[A-Za-z0-9_-]+$/.test(id)||typeof title!=='string'||!title.trim())throw new TypeError();return {id,title,done:false};}",
    "export function completeTask(task){if(!task||typeof task.id!=='string'||typeof task.title!=='string'||typeof task.done!=='boolean')throw new TypeError();return {...task,done:true};}",
    "export function filterOpen(tasks){return tasks.filter(task=>!task.done);}",''
  ].join('\n');
  await writeFile(app,good);
  const accepted=await exec(process.execPath,['--test','--test-reporter=tap',suite],options);
  assert.equal(validateTrustedTaskQaTap(accepted.stdout),true);
  await writeFile(app,good.replace('!/^[A-Za-z0-9_-]+$/.test(id)','false'));
  await assert.rejects(exec(process.execPath,['--test','--test-reporter=tap',suite],options),
    error=>error.code===1&&/# fail 1\b/.test(error.stdout));
});
