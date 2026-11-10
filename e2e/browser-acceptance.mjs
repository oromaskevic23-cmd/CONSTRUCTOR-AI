// Real Chromium acceptance: exports three ZIPs via Studio UI, then drives each app.
// The suite never connects to customer services or grants runtime authority.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, mkdir, readFile, stat, lstat, copyFile, writeFile, rm } from 'node:fs/promises';
import {constants} from 'node:fs';
import {createHash} from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, isAbsolute } from 'node:path';
import { createAppServer } from '../tools/serve.mjs';
import { createLocalTaskService } from '../engineering/local-task-service.mjs';
import { FULL_APP_FILES, FULL_APP_SCHEMA } from '../engineering/full-application-contract.mjs';

const evidenceDirectory=process.env.CONSTRUCTOR_BROWSER_EVIDENCE_DIR||null;
let testedCommit=null;
if(evidenceDirectory){
  assert.ok(isAbsolute(evidenceDirectory),'Evidence directory must be an absolute existing directory');
  const info=await lstat(evidenceDirectory);
  assert.ok(info.isDirectory()&&!info.isSymbolicLink(),'Evidence directory must not be a symlink');
  const expected=process.env.CONSTRUCTOR_TESTED_COMMIT||'';
  assert.match(expected,/^[a-f0-9]{40}$/,'A full tested commit SHA is required');
  const revision=spawnSync('git',['rev-parse','--verify','HEAD'],{encoding:'utf8',timeout:10000});
  const status=spawnSync('git',['status','--porcelain','--untracked-files=all'],{encoding:'utf8',timeout:10000});
  assert.equal(revision.status,0,'A Git checkout is required for screenshot evidence');
  assert.equal(revision.stdout.trim(),expected,'Tested commit does not match checkout');
  assert.equal(status.status,0,'Cannot inspect checkout status');
  assert.equal(status.stdout.trim(),'','Screenshot evidence requires a clean checkout');
  testedCommit=expected;
}
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
  await studioPage.locator('#accent').fill(kind.id==='tasks'?'#000000':'#66e3c4');
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
    const context=await browser.newContext({acceptDownloads:true});
    const page=await context.newPage();
    try{
      const unexpectedRequests=[],consoleErrors=[];
      async function guardPage(target){
        target.on('pageerror',error=>consoleErrors.push(error.message));
        target.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text());});
        await target.route('**/*',route=>{
          const url=new URL(route.request().url());
          if(url.origin!=='http://127.0.0.1:4174'){
            unexpectedRequests.push(url.origin);return route.abort();
          }
          return route.continue();
        });
      }
      await guardPage(page);
      await page.goto('http://127.0.0.1:4174/',{waitUntil:'load'});
      check(await page.locator('h1').first().innerText()==='Browser Acceptance '+kind.id,'Wrong exported app');
      const form=page.locator('.record-form');
      if(kind.id==='tasks'){
        const colors=await form.getByRole('button',{name:kind.add}).evaluate(button=>{
          const style=getComputedStyle(button);return {text:style.color,background:style.backgroundColor};
        });
        assert.deepEqual(colors,{text:'rgb(255, 255, 255)',background:'rgb(0, 0, 0)'});
      }
      await form.locator('input[type=text]').first().fill('Original '+kind.id);
      await form.locator('input[type=text]').nth(1).fill('Customer follow-up');
      if(kind.id!=='tasks')await form.locator('input[type=number]').fill('125.50');
      await form.getByRole('button',{name:kind.add}).click();
      await page.locator('.record-list h2').filter({hasText:'Original '+kind.id}).waitFor();
      check(await page.locator('.record-list li:not(.empty)').count()===1,'Create failed');
      const changeStatus=page.getByRole('button',{name:'Change status: Original '+kind.id});
      if(kind.id==='tasks'){
        await changeStatus.focus();
        await page.keyboard.press('Space');
        await changeStatus.filter({hasText:'Done'}).waitFor();
        assert.equal(await changeStatus.innerText(),'Done');
        assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('aria-label')),'Change status: Original tasks');
        await page.keyboard.press('Space');
        await changeStatus.filter({hasText:'Open'}).waitFor();
        assert.equal(await changeStatus.innerText(),'Open');
        await page.keyboard.press('Space');
        await changeStatus.filter({hasText:'Done'}).waitFor();
        assert.equal(await changeStatus.innerText(),'Done');
      }else {
        await changeStatus.click();
        await changeStatus.filter({hasText:kind.id==='crm'?'Qualified':'At risk'}).waitFor();
      }
      if(kind.id==='tasks'){
        await page.getByLabel('Search').focus();
        await page.keyboard.press('Tab');
        assert.equal(await page.evaluate(()=>document.activeElement?.tagName),'SELECT');
        await page.getByRole('combobox',{name:'Status',exact:true}).selectOption('Done');
        check(await page.locator('.record-list li:not(.empty)').count()===1,'Done status filter failed');
        await page.getByRole('combobox',{name:'Status',exact:true}).selectOption('Open');
        check(await page.locator('.record-list li.empty').count()===1,'Open status filter failed');
        await page.getByRole('combobox',{name:'Status',exact:true}).selectOption('all');
      }
      await page.getByRole('button',{name:'Edit: Original '+kind.id}).click();
      await form.locator('input[type=text]').first().fill('Edited '+kind.id);
      await form.getByRole('button',{name:'Save changes'}).click();
      await page.locator('.record-list h2').filter({hasText:'Edited '+kind.id}).waitFor();
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
      await page.locator('.record-list li.empty').waitFor();
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
      if(kind.id==='tasks'){
        const second=await page.context().newPage();
        try{
          await guardPage(second);
          await second.goto('http://127.0.0.1:4174/',{waitUntil:'load'});
          await second.locator('.record-list h2').filter({hasText:'Edited tasks'}).waitFor();
          await form.locator('input[type=text]').first().fill('First tab record');
          await form.getByRole('button',{name:kind.add}).click();
          await page.locator('.record-list h2').filter({hasText:'First tab record'}).waitFor();
          const secondForm=second.locator('.record-form');
          await secondForm.locator('input[type=text]').first().fill('Second tab record');
          await secondForm.getByRole('button',{name:kind.add}).click();
          await second.getByRole('alert').filter({hasText:'not been overwritten'}).waitFor();
          await second.locator('.record-list h2').filter({hasText:'Second tab record'}).waitFor();
          const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('constructor-app-v1:tasks:Browser Acceptance tasks')));
          assert(saved.some(record=>record.title==='First tab record'));
          assert(!saved.some(record=>record.title==='Second tab record'));
        }finally{await second.close();}
        const firstRecordDelete=page.getByRole('button',{name:'Delete: First tab record'});
        await firstRecordDelete.click();
        await firstRecordDelete.waitFor({state:'detached'});
        const payload='<img src=x onerror=alert(1)>';
        await form.locator('input[type=text]').first().fill(payload);
        await form.getByRole('button',{name:kind.add}).click();
        await page.locator('.record-list h2').filter({hasText:payload}).waitFor();
        assert.equal(await page.locator('.record-list h2').filter({hasText:payload}).count(),1);
        assert.equal(await page.locator('.record-list img').count(),0,'User text must not become markup');
        const maliciousDelete=page.getByRole('button',{name:'Delete: '+payload});
        await maliciousDelete.click();
        await maliciousDelete.waitFor({state:'detached'});
        assert.equal(await page.locator('.record-list h2').count(),1);
        const isolated=await browser.newContext();
        const corrupt=await isolated.newPage();
        try{
          await guardPage(corrupt);
          await corrupt.addInitScript(()=>localStorage.setItem('constructor-app-v1:tasks:Browser Acceptance tasks',''));
          await corrupt.goto('http://127.0.0.1:4174/',{waitUntil:'load'});
          await corrupt.getByRole('alert').filter({hasText:'not been replaced'}).waitFor();
          await corrupt.locator('.record-form input[type=text]').first().fill('Session only');
          await corrupt.getByRole('button',{name:kind.add}).click();
          assert.equal(await corrupt.evaluate(()=>localStorage.getItem('constructor-app-v1:tasks:Browser Acceptance tasks')),'');
          assert.equal(await corrupt.getByRole('alert').isVisible(),true);
        }finally{await isolated.close();}
      }
      if(kind.id==='crm'){
        const volatile=await browser.newPage();
        try{
          await guardPage(volatile);
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
      if(kind.id==='tasks'){
        const phone=await browser.newContext({viewport:{width:375,height:812},isMobile:true,hasTouch:true,acceptDownloads:true});
        try{
          const mobile=await phone.newPage();
          await guardPage(mobile);
          await mobile.goto('http://127.0.0.1:4174/',{waitUntil:'load'});
          const mobileForm=mobile.locator('.record-form');
          await mobileForm.locator('input[type=text]').first().fill('Mobile task');
          await mobileForm.getByRole('button',{name:kind.add}).tap();
          await mobile.locator('.record-list h2').filter({hasText:'Mobile task'}).waitFor();
          await mobile.getByRole('button',{name:'Change status: Mobile task'}).tap();
          await mobile.getByRole('button',{name:'Change status: Mobile task'}).filter({hasText:'Done'}).waitFor();
          await mobile.reload();
          await mobile.locator('.record-list h2').filter({hasText:'Mobile task'}).waitFor();
          assert.equal(await mobile.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true,'Mobile layout overflows horizontally');
        }finally{await phone.close();}
      }
      assert.deepEqual(unexpectedRequests,[],'Unexpected external request was blocked');
      assert.deepEqual(consoleErrors,[],'Unexpected browser console error');
      outcomes.push({template:kind.id,status:'PASS',checks:['studio-preview','browser-zip','clean-extract','integrity','exported-tests','crud','status','edit','search','backup','malformed-reject','type-reject','cancel','restore','reload',...(kind.id==='tasks'?['keyboard-reopen','safe-rendering','corrupt-storage','stale-tab-conflict','mobile-chromium-crud']:[]),'no-external-requests','no-console-errors']});
      await page.screenshot({path:join(root,kind.id+'-browser.png'),fullPage:true});
    }finally{await context.close();}
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
  const fullSource={
    'README.md':'Node.js 22. No build required. npm test and npm start at http://127.0.0.1:4174.',
    'app.mjs':'globalThis.__browserFixtureExecuted=true;',
    'index.html':'<!doctype html><title>Synthetic fixture</title>',
    'package.json':JSON.stringify({name:'synthetic-app',version:'1.0.0',private:true,type:'module',
      scripts:{start:'node serve.mjs',test:'node --test test/app.test.mjs'},engines:{node:'>=22'}}),
    'serve.mjs':'// fixture server', 'storage.mjs':'// fixture storage', 'styles.css':'body { color: white; }',
    'test/app.test.mjs':'// candidate tests', 'validation.mjs':'// fixture validation'
  };
  const fullDraft={schema:FULL_APP_SCHEMA,summary:'Synthetic full app',
    steps:[{id:'build',action:'Draft files',acceptance:'Separate review required'}],
    files:FULL_APP_FILES.map(path=>({path,content:fullSource[path]}))};
  let markStarted,markCancelled;
  const modelStarted=new Promise(resolve=>{markStarted=resolve;});
  const modelCancelled=new Promise(resolve=>{markCancelled=resolve;});
  const service=createLocalTaskService({accessToken,permitSecret,model,outputRoot:quarantine,
    fetchImpl:async(url,options)=>{
      const prompt=JSON.parse(options.body).prompt;
      if(prompt.includes('cancel test'))return new Promise((resolve,reject)=>{
        markStarted();
        options.signal.addEventListener('abort',()=>{markCancelled();const error=Error('aborted');error.name='AbortError';reject(error);},{once:true});
      });
      const isFull=prompt.includes(FULL_APP_SCHEMA);
      return new Response(JSON.stringify({model,done:true,done_reason:'stop',eval_count:25,total_duration:1,
        response:JSON.stringify(isFull?fullDraft:draft)}),{status:200});
    }});
  const server=createAppServer({localTaskService:service});server.listen(0,'127.0.0.1');await once(server,'listening');
  const localOrigin='http://127.0.0.1:'+server.address().port;
  const page=await browser.newPage({viewport:{width:375,height:812},isMobile:true,hasTouch:true});
  try{
    await page.goto(localOrigin+'/studio',{waitUntil:'load'});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);
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
    await page.locator('#local-ai-mode').selectOption('full-application');
    await page.locator('#local-ai-token').fill(accessToken);
    const [fullResponse]=await Promise.all([
      page.waitForResponse(r=>r.url().endsWith('/api/local-velion/task-draft')),
      page.getByRole('button',{name:'Generate candidate'}).click()
    ]);
    assert.equal(fullResponse.status(),201);
    const fullReceipt=await fullResponse.json();
    assert.equal(fullReceipt.contract,'FULL_APPLICATION_V1');
    assert.equal(fullReceipt.execution,'NOT_RUN');
    assert.equal(fullReceipt.release,'DENIED');
    const fullManifest=JSON.parse(await readFile(join(quarantine,fullReceipt.stageId,'stage-manifest.json'),'utf8'));
    assert.deepEqual(fullManifest.files.map(file=>file.path),FULL_APP_FILES);
    assert.equal(globalThis.__browserFixtureExecuted,undefined);
    assert.equal(await page.locator('#local-ai-token').inputValue(),'');
    await page.locator('#local-ai-goal').fill('Build a task manager cancel test');
    await page.locator('#local-ai-token').fill(accessToken);
    await page.getByRole('button',{name:'Generate candidate'}).click();
    await modelStarted;
    await page.getByRole('button',{name:'Stop request'}).click();
    await Promise.race([modelCancelled,new Promise((_,reject)=>setTimeout(()=>reject(Error('Model cancellation not propagated')),3000))]);
    await page.getByRole('status').filter({hasText:'Request stopped'}).waitFor();
    assert.equal(await page.locator('#local-ai-token').inputValue(),'');
    outcomes.push({template:'local-ai-fixture',status:'PASS',checks:['mobile-studio','browser-request','loopback-auth','two-and-nine-file-quarantine','no-execution','token-cleared','cancel-propagated']});
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
    assert.equal(await page.locator('#local-ai-mode').isDisabled(),true);
    assert.equal(apiRequests,0);
    outcomes.push({template:'hosted-boundary',status:'PASS',checks:['local-token-disabled','no-api-request']});
  }finally{await page.close();}
}
try{
  const executablePath=process.env.CONSTRUCTOR_CHROMIUM_EXECUTABLE;
  if(executablePath&&!isAbsolute(executablePath))throw Error('Browser executable must be an absolute path');
  const launchOptions={headless:true};
  if(executablePath)launchOptions.executablePath=executablePath;
  if(process.env.CONSTRUCTOR_BROWSER_NO_SANDBOX==='YES')launchOptions.args=[
    '--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--disable-software-rasterizer','--no-zygote'];
  browser=await chromium.launch(launchOptions);
  const studioPage=await browser.newPage({acceptDownloads:true});
  await studioPage.goto(origin+'/studio',{waitUntil:'load'});
  await studioPage.waitForFunction(()=>!document.querySelector('#download').disabled);
  for(const kind of TYPES)await run(kind,studioPage);
  await runLocalAi();await runHostedBoundary();
  assert.equal(outcomes.length,5);
  if(evidenceDirectory){
    const name='constructor-tasks-'+testedCommit+'.png';
    const screenshot=await readFile(join(root,'tasks-browser.png'));
    const evidence={schema:'constructor-browser-evidence-v1',commit:testedCommit,
      screenshot:name,sha256:createHash('sha256').update(screenshot).digest('hex'),
      node:process.version,browser:browser.version(),platform:process.platform,architecture:process.arch,
      recordedAt:new Date().toISOString(),scope:'TEMPLATE_REFERENCE_NOT_MODEL_GENERATED',
      integrity:'UNSIGNED_LOCAL_OBSERVATION_NOT_INDEPENDENT_ATTESTATION',outcomes};
    await copyFile(join(root,'tasks-browser.png'),join(evidenceDirectory,name),constants.COPYFILE_EXCL);
    await writeFile(join(evidenceDirectory,'constructor-browser-'+testedCommit+'.json'),
      JSON.stringify(evidence,null,2)+'\n',{flag:'wx'});
  }
  console.log(JSON.stringify({schema:'constructor-chromium-acceptance-v1',commit:process.env.GITHUB_SHA||null,status:'PASS',outcomes}));
}catch(error){
  console.error('BROWSER_ACCEPTANCE_FAIL: '+(error?.stack||error));
  process.exitCode=1;
}finally{
  if(browser)await browser.close();
  await new Promise(resolve=>studioServer.close(resolve));
  await rm(root,{recursive:true,force:true});
}
