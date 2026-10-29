import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,writeFile,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {spawnSync} from 'node:child_process';
import {buildProject,SOURCE_PATHS} from '../src/project-export.mjs';
const sources=Object.fromEntries(await Promise.all(SOURCE_PATHS.map(async p=>[p,await readFile(new URL('../src/'+p,import.meta.url),'utf8')])));
for(const template of ['tasks','crm','dashboard']) test(`${template}: exported project passes its own tests and integrity check`,async t=>{
  const project=await buildProject({template,name:'My business'},sources);const dir=await mkdtemp(join(tmpdir(),'constructor-export-'));t.after(()=>rm(dir,{recursive:true,force:true}));
  for(const f of project.files){const p=join(dir,f.path);await mkdir(dirname(p),{recursive:true});await writeFile(p,f.content);}
  for(const args of [['verify.mjs'],['--test','test/app.test.mjs']]){const r=spawnSync(process.execPath,args,{cwd:dir,encoding:'utf8',timeout:10000});assert.equal(r.status,0,r.stderr+r.stdout);}
  await writeFile(join(dir,'app.mjs'),'tampered');assert.notEqual(spawnSync(process.execPath,['verify.mjs'],{cwd:dir,timeout:10000}).status,0);
});
test('export escapes HTML while preserving user text as JavaScript string data',async()=>{
  const name='</title><script>alert(1)</script>';
  const a=await buildProject({template:'tasks',name},sources),b=await buildProject({template:'tasks',name},sources);
  assert.deepEqual(a,b);const html=a.files.find(f=>f.path==='index.html').content;
  assert.ok(html.includes('&lt;/title&gt;'));assert.ok(!html.includes('<script>alert'));
  assert.ok(a.files.find(f=>f.path==='app.mjs').content.includes(JSON.stringify(name)));
});
test('export requires the complete bounded built-in source set',async()=>{
  await assert.rejects(buildProject({template:'tasks',name:'A'},{}));
  await assert.rejects(buildProject({template:'tasks',name:'A'},{...sources,extra:'x'}));
  await assert.rejects(buildProject({template:'tasks',name:'A'},{...sources,'project.css':'x'.repeat(100001)}));
});
