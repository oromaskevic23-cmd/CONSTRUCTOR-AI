// Real Chromium acceptance: exports three ZIPs via Studio UI, then drives each app.
// The suite never connects to customer services or grants runtime authority.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, mkdir, readFile, stat, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createAppServer } from '../tools/serve.mjs';
import { createLocalTaskService } from '../engineering/local-task-service.mjs';

const root=await mkdtemp(join(tmpdir(),'constructor-real-browser-'));
const outcomes=[];
const TYPES=[
  {id:'tasks',title:'Task Manager',add:/Add task/i},
  {id:'crm',title:'Business CRM',add:/Add opportunity/i},
  {id:'dashboard',title:'Business Dashboard',add:/Add metric/i}
];
const studioServer=createAppServer();
studioServer.listen(0,'127.0.0.1');
await once(studioServer,'listening');
const origin='http://127.0.0.1:'+studioServer.address().port;
let browser;
function check(value,msg){assert.ok(value,msg);}
function verifyCommand(cwd,args){
  const result=spawnSync(process.execPath,args,{cwd,encoding:'utf8',timeout:30000});
  assert.equal(result.status,0,args.join(' ')+'\n'+result.stdout+'\n'+result.stderr);
}
async function waitForApp(child){
  for(let i=0;i<70;i++){
    if(child.exitCode!==null)throw Error('Exported server exited early');
    try{
      const response=await fetch('http://127.0.0.1:4174/',{signal:AbortSignal.timeout(250)});
      if(response.ok)return;
    }catch{}
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  throw Error('Exported app HTTP server not ready');
}
async function run(kind,studioPage){
  const output=join(root,kind.id);
  await mkdir(output);
  await studioPage.locator('#template').selectOption(kind.id);
  await studioPage.locator('#project-name').fill('Browser Acceptance '+kind.id);
  await studioPage.getByRole('button',{name:'Build preview'}).click();
  await studioPage.waitForFunction(()=>!document.querySelector('#download').disabled);
  check(await studioPage.locator('#preview-kind').innerText()===kind.title,'Wrong studio template');
  const preview=studioPage.locator('#preview');
  await preview.locator('.record-form input[type=text]').first().fill('Preview '+kind.id);
  if(kind.id!=='tasks')await preview.locator('.record-form input[type=number]').fill('30');
  await preview.getByRole('button',{name:kind.add}).click();
  check(await preview.locator('.record-list li:not(.empty)').count()===1,'Preview CRUD failed');
  const [archive]=await Promise.all([studioPage.waitForEvent('download'),studioPage.locator('#download').click()]);
  assert.equal(archive.suggestedFilename(),'constructor-'+kind.id+'.zip');
  const zipPath=join(root,kind.id+'.zip');
  await archive.saveAs(zipPath);
  check((await stat(zipPath)).size>5000,'ZIP appears empty');
  const unzip=spawnSync('unzip',['-q',zipPath,'-d',output],{encoding:'utf8',timeout:30000});
  assert.equal(unzip.status,0,unzip.stderr);
  verifyCommand(output,['verify.mjs']);
  verifyCommand(output,['--test']);
  const app=spawn(process.execPath,['serve.mjs'],{cwd:output,stdio:'ignore'});
  try{
    await waitForApp(app);
    const page=await browser.newPage({acceptDownloads:true});
    try{
      await page.goto('http://127.0.0.1:4174/',{waitUntil:'load'});
      check(await page.locator('h1').first().innerText()==='Browser Acceptance '+kind.id,'Wrong exported app');
      const form=page.locator('.record-form');
      await form.locator('input[type=text]').first().fill('Original '+kind.id);
      await form.locator('input[type=text]').nth(1).fill('Customer follow-up');
      if(kind.id!=='tasks')await form.locator('input[type=number]').fill('125.50');
      await form.getByRole('button',{name:kind.add}).click();
      check(await page.locator('.record-list li:not(.empty)').count()===1,'Create failed');
      await page.getByRole('button',{name:'Change status: Original '+kind.id}).click();
      if(kind.id==='tasks'){
        await page.getByLabel('Search').focus();
        await page.keyboard.press('Tab');
        assert.equal(await page.evaluate(()=>document.activeElement?.tagName),'SELECT');
        await page.getByLabel('Status').selectOption('Done');
        check(await page.locator('.record-list li:not(.empty)').count()===1,'Done status filter failed');
        await page.getByLabel('Status').selectOption('Open');
        check(await page.locator('.record-list li.empty').count()===1,'Open status filter failed');
        await page.getByLabel('Status').selectOption('all');
      }
      await page.getByRole('button',{name:'Edit: Original '+kind.id}).click();
      await form.locator('input[type=text]').first().fill('Edited '+kind.id);
      await form.getByRole('button',{name:'Save changes'}).click();
      await page.locator('input[type=search]').fill('Edited '+kind.id);
      check(await page.locator('.record-list h2').innerText()==='Edited '+kind.id,'Edit/search failed');
      await page.locator('input[type=search]').fill('');
      const [backupDownload]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'Export data'}).click()]);
      const backupFile=join(root,kind.id+'-backup.json');
      await backupDownload.saveAs(backupFile);
      const json=JSON.parse(await readFile(backupFile,'utf8'));
      assert.equal(json.template,kind.id);
      assert.equal(json.records.length,1);
      await page.getByRole('button',{name:'Delete: Edited '+kind.id}).click();
      check(await page.locator('.record-list li.empty').count()===1,'Delete failed');
      const picker=page.locator('input[type=file]');
      await picker.setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from('{invalid')});
      await page.getByRole('status').filter({hasText:'Restore rejected'}).waitFor();
      check(await page.locator('.record-list li.empty').count()===1,'Invalid restore modified records');
      await picker.setInputFiles({name:'wrong.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({...json,template:kind.id==='tasks'?'crm':'tasks'}))});
      await page.getByRole('status').filter({hasText:'Restore rejected'}).waitFor();
      check(await page.locator('.record-list li.empty').count()===1,'Mismatched restore modified records');
      page.once('dialog',dialog=>dialog.dismiss());
      await picker.setInputFiles(backupFile);
      await page.getByRole('status').filter({hasText:'Restore cancelled'}).waitFor();
      check(await page.locator('.record-list li.empty').count()===1,'Cancelled restore modified records');
      page.once('dialog',dialog=>dialog.accept());
      await picker.setInputFiles(backupFile);
      await page.getByRole('status').filter({hasText:'Restored 1 records'}).waitFor();
      check(await page.locator('.record-list h2').innerText()==='Edited '+kind.id,'Restore failed');
      await page.reload();
      check(await page.locator('.record-list h2').innerText()==='Edited '+kind.id,'Persistence failed');
      if(kind.id==='crm'){
        const volatile=await browser.newPage();
        try{
          await volatile.addInitScript(()=>{
            Storage.prototype.setItem=function(){throw new DOMException('Blocked','QuotaExceededError');};
          });
          await volatile.goto('http://127.0.0.1:4174/',{waitUntil:'load'});
          const form=volatile.locator('.record-form');
          await form.locator('input[type=text]').first().fill('Unsaved opportunity');
          await form.getByRole('button',{name:kind.add}).click();
          await volatile.getByRole('alert').filter({hasText:'only in this session'}).waitFor();
          await volatile.getByRole('status').filter({hasText:'for this session'}).waitFor();
          volatile.once('dialog',dialog=>dialog.accept());
          await volatile.locator('input[type=file]').setInputFiles(backupFile);
          await volatile.getByRole('status').filter({hasText:'for this session only'}).waitFor();
          check(await volatile.getByRole('alert').isVisible(),'Storage warning must persist after restore');
          await volatile.getByRole('button',{name:'Change status: Edited '+kind.id}).click();
          check(await volatile.getByRole('alert').isVisible(),'Storage warning must persist after later changes');
        }finally{await volatile.close();}
      }
      outcomes.push({template:kind.id,status:'PASS',checks:['studio-preview','browser-zip','clean-extract','integrity','exported-tests','crud','status','edit','search','backup','malformed-reject','type-reject','cancel','restore','reload']});
      await page.screenshot({path:join(root,kind.id+'-browser.png'),fullPage:true});
    }finally{await page.close();}
  }finally{
    app.kill('SIGTERM');
    if(app.exitCode===null)await once(app,'exit');
  }
}
async function runLocalAi(){
  const quarantine=join(root,'ai-quarantine');await mkdir(quarantine);
  const accessToken='browser-fixture-token-0123456789ABCDEF';
  const permitSecret='browser-fixture-permit-0123456789ABCDEF';
  const model='fixture:browser-v1';
  const draft={schema:'constructor_draft_v1',summary:'Synthetic browser fixture',
    steps:[{id:'create',action:'Prepare a task API',acceptance:'Independent QA remains separate'}],
    files:[{path:'app.mjs',content:'export const fixture=true;\n'},
      {path:'test/app.test.mjs',content:'export const fixtureTest=true;\n'}]};
  const service=createLocalTaskService({accessToken,permitSecret,model,outputRoot:quarantine,
    fetchImpl:async()=>new Response(JSON.stringify({model,done:true,response:JSON.stringify(draft)}),{status:200})});
  const server=createAppServer({localTaskService:service});server.listen(0,'127.0.0.1');await once(server,'listening');
  const localOrigin='http://127.0.0.1:'+server.address().port;
  const page=await browser.newPage();
  try{
    await page.goto(localOrigin+'/studio',{waitUntil:'load'});
    await page.locator('#local-ai-goal').fill('Build a task manager with completed tasks');
    await page.locator('#local-ai-token').fill(accessToken);
    const [response]=await Promise.all([
      page.waitForResponse(r=>r.url().endsWith('/api/local-velion/task-draft')),
      page.getByRole('button',{name:'Generate candidate'}).click()
    ]);
    assert.equal(response.status(),201);const receipt=await response.json();
    await page.getByRole('status').filter({hasText:'Candidate saved to local quarantine'}).waitFor();
    assert.equal(await page.locator('#local-ai-token').inputValue(),'');
    check((await page.locator('#local-ai-result').innerText()).includes(receipt.draftSha256),'Missing digest');
    assert.equal((await page.locator('body').innerText()).includes(accessToken),false);
    assert.equal(receipt.execution,'NOT_RUN');assert.equal(receipt.release,'DENIED');
    const manifest=JSON.parse(await readFile(join(quarantine,receipt.stageId,'stage-manifest.json'),'utf8'));
    assert.equal(manifest.independentQa,'NOT_RUN');
    outcomes.push({template:'local-ai-fixture',status:'PASS',checks:['browser-request','loopback-auth','quarantine','no-execution','token-cleared']});
  }finally{await page.close();await new Promise(resolve=>server.close(resolve));}
}
async function runHostedBoundary(){
  const page=await browser.newPage();let apiRequests=0;
  try{
    await page.route('https://studio-test.invalid/**',async route=>{
      const url=new URL(route.request().url());
      if(url.pathname.startsWith('/api/')){apiRequests++;await route.abort();return;}
      const response=await fetch(origin+url.pathname);
      await route.fulfill({status:response.status,contentType:response.headers.get('content-type')||'text/plain',
        body:Buffer.from(await response.arrayBuffer())});
    });
    await page.goto('https://studio-test.invalid/studio',{waitUntil:'load'});
    await page.waitForFunction(()=>!document.querySelector('#download').disabled);
    assert.equal(await page.locator('#local-ai-token').isDisabled(),true);
    assert.equal(await page.locator('#local-ai-submit').isDisabled(),true);
    assert.equal(apiRequests,0);
    outcomes.push({template:'hosted-boundary',status:'PASS',checks:['local-token-disabled','no-api-request']});
  }finally{await page.close();}
}
try{
  browser=await chromium.launch({headless:true});
  const studioPage=await browser.newPage({acceptDownloads:true});
  await studioPage.goto(origin+'/studio',{waitUntil:'load'});
  await studioPage.waitForFunction(()=>!document.querySelector('#download').disabled);
  for(const kind of TYPES)await run(kind,studioPage);
  await runLocalAi();await runHostedBoundary();
  assert.equal(outcomes.length,5);
  console.log(JSON.stringify({schema:'constructor-chromium-acceptance-v1',commit:process.env.GITHUB_SHA||null,status:'PASS',outcomes}));
}catch(error){
  console.error('BROWSER_ACCEPTANCE_FAIL: '+(error?.stack||error));
  process.exitCode=1;
}finally{
  if(browser)await browser.close();
  await new Promise(resolve=>studioServer.close(resolve));
  await rm(root,{recursive:true,force:true});
}
