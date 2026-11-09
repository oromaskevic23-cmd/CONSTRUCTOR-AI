// Synthetic container preflight; no model output or credentials are used.
// Project author and founding architect: Alexander Nikolaevich Romaskevich (RomaskevicH).
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {mkdir,mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {promisify} from 'node:util';
import {taskSandboxArguments} from '../engineering/task-sandbox.mjs';

const exec=promisify(execFile);
test('non-owner is denied; owner can run read-only offline QA',async t=>{
  const uid=process.getuid?.(),gid=process.getgid?.();
  const image=process.env.CONSTRUCTOR_SANDBOX_IMAGE;
  const root=await mkdtemp(join(tmpdir(),'constructor-sandbox-preflight-'));
  t.after(()=>rm(root,{recursive:true,force:true}));
  const stage=join(root,'stage'),qaRoot=join(root,'qa');
  await mkdir(stage,{mode:0o700});
  await mkdir(join(stage,'test'),{mode:0o700});
  await mkdir(qaRoot,{mode:0o700});
  await writeFile(join(stage,'app.mjs'),'export const answer=42;\n',{mode:0o600});
  await writeFile(join(stage,'test','app.test.mjs'),
    "import test from 'node:test'; import assert from 'node:assert/strict'; import {writeFileSync} from 'node:fs'; import {answer} from '../app.mjs'; test('read-only stage',()=>{assert.equal(answer,42); assert.throws(()=>writeFileSync('/work/forbidden','x'),e=>['EROFS','EACCES'].includes(e.code));});\n",{mode:0o600});
  await writeFile(join(qaRoot,'independent-task-suite.mjs'),
    "import test from 'node:test'; import assert from 'node:assert/strict'; import {answer} from '/work/app.mjs'; test('prewritten fixture',()=>assert.equal(answer,42));\n",{mode:0o600});
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
  assert.match(result.stdout,/# pass 2\b/);
});
