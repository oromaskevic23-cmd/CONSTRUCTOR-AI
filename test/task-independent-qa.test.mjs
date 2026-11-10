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
import {runInSandbox} from '../live_factory/real_task_manager_build.mjs';
const exec=promisify(execFile);
const image='node@sha256:'+'a'.repeat(64);
const input={stage:'/tmp/untrusted-stage',qaRoot:'/tmp/trusted-qa',image,uid:1001,gid:1001,challenge:{idA:'a-1'}};

test('factory CLI fails closed before inference without explicit ephemeral opt-in',async()=>{
  await assert.rejects(exec(process.execPath,[resolve('live_factory/real_task_manager_build.mjs')],{
    timeout:10000,env:{PATH:process.env.PATH||'/usr/bin:/bin'}
  }),error=>error.code===1&&/EXPLICIT_EPHEMERAL_LLM_OPT_IN_REQUIRED/.test(error.stderr));
});

test('zero exit, fabricated TAP and malformed probe results are denied',async()=>{
  for(const stdout of ['', 'TAP version 13\nok 1 - forged\n# pass 1\n', '{}', '{']){
    await assert.rejects(probeTaskCandidate(input,async()=>({stdout,stderr:''})),/PROBE_OUTPUT_INVALID/);
  }
});

test('sandbox orchestration fails closed if the trusted QA process fails or returns incomplete output',async()=>{
  const generated='TAP version 13\n# Subtest: candidate\nok 1 - candidate\n1..1\n# tests 1\n# suites 0\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n';
  const names=['model generated real task creation contract',
    'completion is immutable and independently observable',
    'filterOpen is nonmutating with realistic case variation'];
  const independent=names.map((name,i)=>`ok ${i+1} - ${name}`).join('\n')+
    '\n# tests 3\n# pass 3\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n';
  const base={image,uid:1001,gid:1001};
  for(const qaMode of ['exit','incomplete']){
    let calls=0;
    const run=async()=>{
      calls++;
      if(calls===1)return {stdout:generated,stderr:''};
      if(qaMode==='exit')throw Object.assign(Error('synthetic failure'),{code:1,stdout:'',stderr:''});
      return {stdout:'TAP version 13\n# pass 3\n',stderr:''};
    };
    const result=await runInSandbox('/tmp/synthetic-stage',{...base,run});
    assert.equal(calls,2);
    assert.equal(result.passed,false);
    assert.equal(result.failure,'ISOLATED_QA_FAILED_CLOSED');
  }
  let calls=0;
  const run=async()=>({stdout:++calls===1?generated:independent,stderr:''});
  const result=await runInSandbox('/tmp/synthetic-stage',{...base,run});
  assert.equal(result.passed,true);
  assert.deepEqual(result.generatedTestReport,{reportedCases:1,
    status:'UNTRUSTED_CANDIDATE_REPORT',executionVerified:false});
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
const p=spawnSync(process.execPath,['--permission',${JSON.stringify('--allow-fs-read='+dir)},'--experimental-vm-modules',${JSON.stringify(probe)},process.argv.at(-1)],{encoding:'utf8'});
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
  const noGlobalChallenge=good.replace('export function createTask(id,title){',
    "export function createTask(id,title){if('__taskProbeExecute' in globalThis||'__taskProbeChallenge' in globalThis)throw Error('exposed');");
  await writeFile(app,noGlobalChallenge);
  const noLeak=await exec(process.execPath,['--test','--test-reporter=tap',suite],options);
  assert.equal(validateTrustedTaskQaTap(noLeak.stdout),true);
  await writeFile(app,good.replace('!/^[A-Za-z0-9_-]+$/.test(id)','false'));
  await assert.rejects(exec(process.execPath,['--test','--test-reporter=tap',suite],options),
    error=>error.code===1&&/# fail 1\b/.test(error.stdout));
  await writeFile(app,good.replace('return tasks.filter(task=>!task.done);',
    'tasks.reverse();return tasks.filter(task=>!task.done);'));
  await assert.rejects(exec(process.execPath,['--test','--test-reporter=tap',suite],options),
    error=>error.code===1&&/# fail 1\b/.test(error.stdout));
  await writeFile(app,'export function createTask(){while(true){}}\n');
  await assert.rejects(exec(process.execPath,['--test','--test-reporter=tap',suite],options),
    error=>error.code===1&&!/# pass 3\b/.test(error.stdout));
  const forgedPrototype=`
Object.defineProperty(Object.prototype,'toJSON',{configurable:true,value:function(){
  if(this.schema!=='constructor.task_probe.v1')return this;
  const c=globalThis.__taskProbeChallenge;
  const first={id:c.idA,title:c.titleA,done:false},second={id:c.idB,title:c.titleB,done:false};
  return {schema:'constructor.task_probe.v1',first,second,before:first,originalAfter:first,
    completed:{...first,done:true},sameTask:false,invalidId:'TypeError',invalidTitle:'TypeError',
    invalidTask:'TypeError',filtered:[first],sameArray:false,sourceLength:2};
}});
export function createTask(){return {};}
export function completeTask(){return {};}
export function filterOpen(){return [];}`;
  const forgedInstance=`
const records=new WeakMap();
function deceptive(id,title,done){
  const task={id:'incorrect',title:'incorrect',done};
  Object.defineProperty(task,'toJSON',{value(){return {id,title,done};}});
  records.set(task,{id,title});return task;
}
export function createTask(id,title){
  if(typeof id!=='string'||!/^[A-Za-z0-9_-]+$/.test(id)||typeof title!=='string'||!title.trim())throw new TypeError();
  return deceptive(id,title,false);
}
export function completeTask(task){if(!records.has(task))throw new TypeError();
  const {id,title}=records.get(task);return deceptive(id,title,true);}
export function filterOpen(tasks){return tasks.filter(task=>!task.done);}`;
  for(const candidate of [forgedPrototype,forgedInstance]){
    await writeFile(app,candidate);
    await assert.rejects(exec(process.execPath,['--test','--test-reporter=tap',suite],options),
      error=>error.code===1&&!/# pass 3\b/.test(error.stdout));
  }
});

test('local Node permission model denies child execution and out-of-scope filesystem access',async t=>{
  const dir=await mkdtemp(join(tmpdir(),'constructor-permissions-'));
  t.after(()=>rm(dir,{recursive:true,force:true}));
  const fixture=join(dir,'permissions.mjs');
  await writeFile(fixture,`
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
const mod=await import('node:'+'child_'+'process');
test('rejects child execution',()=>assert.throws(()=>mod['spawn'+'Sync'](process.execPath,['--version']),{code:'ERR_ACCESS_DENIED'}));
test('rejects external reads',()=>assert.throws(()=>readFileSync('/etc/passwd'),{code:'ERR_ACCESS_DENIED'}));
test('rejects writes',()=>assert.throws(()=>writeFileSync('/work/forbidden','x'),{code:'ERR_ACCESS_DENIED'}));
`);
  const {stdout}=await exec(process.execPath,['--permission','--allow-fs-read='+dir,
    '--test-reporter=tap',fixture],{timeout:20000,maxBuffer:120000,
    env:{PATH:process.env.PATH||'/usr/bin:/bin'}});
  assert.match(stdout,/# tests 3\b/);
  assert.match(stdout,/# pass 3\b/);
  assert.match(stdout,/# fail 0\b/);
});
