// Synthetic container preflight; no model output or credentials are used.
// Project author and founding architect: Alexander Nikolaevich Romaskevich (RomaskevicH).
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {mkdir,mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {promisify} from 'node:util';
import {taskSandboxArguments,validateGeneratedTaskTap,validateTrustedTaskQaTap} from '../engineering/task-sandbox.mjs';

const exec=promisify(execFile);
test('non-owner is denied; owner can run read-only offline QA',async t=>{
  const uid=process.getuid?.(),gid=process.getgid?.();
  const image=process.env.CONSTRUCTOR_SANDBOX_IMAGE;
  const root=await mkdtemp(join(tmpdir(),'constructor-sandbox-preflight-'));
  t.after(()=>rm(root,{recursive:true,force:true}));
  const stage=join(root,'stage'),qaRoot=resolve('qa');
  await mkdir(stage,{mode:0o700});
  await mkdir(join(stage,'test'),{mode:0o700});
  await writeFile(join(stage,'app.mjs'),[
    "export function createTask(id,title){if(typeof id!=='string'||!/^[A-Za-z0-9_-]+$/.test(id)||typeof title!=='string'||!title.trim())throw new TypeError();return {id,title,done:false};}",
    "export function completeTask(task){if(!task||typeof task.id!=='string'||typeof task.title!=='string'||typeof task.done!=='boolean')throw new TypeError();return {...task,done:true};}",
    "export function filterOpen(tasks){return tasks.filter(task=>!task.done);}",
    ''
  ].join('\n'),{mode:0o600});
  await writeFile(join(stage,'test','app.test.mjs'),
    "import test from 'node:test'; import assert from 'node:assert/strict'; import {writeFileSync,readFileSync} from 'node:fs'; import {spawnSync} from 'node:child_process'; import {createTask} from '../app.mjs'; test('restricted resources',()=>{assert.equal(createTask('a','A').done,false); assert.throws(()=>writeFileSync('/work/forbidden','x'),e=>['EROFS','EACCES','ERR_ACCESS_DENIED'].includes(e.code)); assert.throws(()=>readFileSync('/etc/passwd'),{code:'ERR_ACCESS_DENIED'}); assert.throws(()=>spawnSync(process.execPath,['--version']),{code:'ERR_ACCESS_DENIED'});});\n",{mode:0o600});
  const options={timeout:60000,maxBuffer:120000,env:{PATH:process.env.PATH||'/usr/bin:/bin'}};
  const otherUid=uid===65534?65533:65534;
  const otherGid=gid===65534?65533:65534;
  const denied=taskSandboxArguments({stage,qaRoot,image,uid:otherUid,gid:otherGid});
  await assert.rejects(exec('docker',denied,options),error=>{
    assert.match(String(error.stdout||'')+'\n'+String(error.stderr||''),/EACCES|permission denied/i);
    return true;
  });
  const accepted=taskSandboxArguments({stage,qaRoot,image,uid,gid});
  const result=await exec('docker',accepted,options);
  assert.equal(validateGeneratedTaskTap(result.stdout),1);
  const qa=await exec(process.execPath,['--test','--test-reporter=tap',
    join(qaRoot,'independent-task-suite.mjs')],{...options,timeout:110000,
    env:{...options.env,CONSTRUCTOR_TASK_STAGE:stage,CONSTRUCTOR_SANDBOX_IMAGE:image,
      CONSTRUCTOR_TASK_UID:String(uid),CONSTRUCTOR_TASK_GID:String(gid)}});
  assert.equal(validateTrustedTaskQaTap(qa.stdout),true);
});
