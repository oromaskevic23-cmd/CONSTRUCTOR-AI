// Real Chromium UI smoke using only the trusted synthetic task-domain fixture.
// This does not run a model-generated candidate or prove iOS compatibility.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,writeFile} from 'node:fs/promises';
import {once} from 'node:events';
import {createRequire} from 'node:module';
import {isAbsolute,join} from 'node:path';

const require=createRequire(import.meta.url);
const {chromium}=require('playwright');
const executablePath=process.env.TASK_UI_CHROMIUM;
if(executablePath&&!isAbsolute(executablePath))throw Error('CHROMIUM_PATH_MUST_BE_ABSOLUTE');
const files=new Map([
  ['/', ['../qa/task-ui/index.html','text/html; charset=utf-8']],
  ['/index.html', ['../qa/task-ui/index.html','text/html; charset=utf-8']],
  ['/style.css', ['../qa/task-ui/style.css','text/css; charset=utf-8']],
  ['/ui.mjs', ['../qa/task-ui/ui.mjs','text/javascript; charset=utf-8']],
  ['/start.mjs', ['../qa/task-ui/start.mjs','text/javascript; charset=utf-8']],
  ['/app.mjs', ['../test/fixtures/task-ui-domain.mjs','text/javascript; charset=utf-8']],
]);
const server=createServer(async(req,res)=>{
  const route=files.get(req.url);
  if(req.method!=='GET'||!route){res.writeHead(404);res.end();return;}
  try{const data=await readFile(new URL(route[0],import.meta.url));res.writeHead(200,{
    'Content-Type':route[1],'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(data);}
  catch{res.writeHead(500);res.end();}
});
server.listen(0,'127.0.0.1');await once(server,'listening');
let browser;
const checks=[];
try{
  const options={headless:true};if(executablePath)options.executablePath=executablePath;
  if(process.env.TASK_UI_BROWSER_NO_SANDBOX==='YES')options.args=['--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--no-zygote'];
  browser=await chromium.launch(options);
  const origin='http://127.0.0.1:'+server.address().port;
  for(const viewport of [{width:320,height:568},{width:375,height:812},{width:1280,height:900}]){
    const context=await browser.newContext({viewport});
    try{
      const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
      await page.goto(origin,{waitUntil:'load'});
      await page.locator('#task-title').fill('Plan the week');await page.getByRole('button',{name:'Add task'}).click();
      await page.locator('#task-title').fill('Review milestones');await page.getByRole('button',{name:'Add task'}).click();
      assert.equal(await page.locator('#count-all').innerText(),'2');
      await page.getByRole('button',{name:'Complete: Review milestones'}).click();
      assert.equal(await page.locator('#count-done').innerText(),'1');
      await page.getByRole('button',{name:'To do',exact:true}).click();
      assert.deepEqual(await page.locator('.task-title').allTextContents(),['Plan the week']);
      await page.getByRole('button',{name:'Done',exact:true}).click();
      assert.deepEqual(await page.locator('.task-title').allTextContents(),['Review milestones']);
      await page.getByRole('button',{name:'Reopen: Review milestones'}).click();
      assert.equal(await page.locator('#count-done').innerText(),'0');
      await page.getByRole('button',{name:'All',exact:true}).click();await page.reload();
      assert.equal(await page.locator('#count-all').innerText(),'2');
      await page.locator('#task-title').fill('<img src=x onerror=alert(1)>');await page.getByRole('button',{name:'Add task'}).click();
      assert.equal(await page.locator('.task-list img').count(),0);
      assert.ok((await page.locator('.task-title').allTextContents()).includes('<img src=x onerror=alert(1)>'));
      page.once('dialog',dialog=>dialog.dismiss());await page.getByRole('button',{name:'Delete: Plan the week'}).click();
      assert.equal(await page.locator('#count-all').innerText(),'3');
      page.once('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'Delete: Plan the week'}).click();
      assert.equal(await page.locator('#count-all').innerText(),'2');
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);
      assert.deepEqual(errors,[]);
      if(process.env.TASK_UI_SCREENSHOT_DIR){
        if(!isAbsolute(process.env.TASK_UI_SCREENSHOT_DIR))throw Error('SCREENSHOT_DIRECTORY_MUST_BE_ABSOLUTE');
        const screenshot=await page.screenshot({fullPage:true});
        await writeFile(join(process.env.TASK_UI_SCREENSHOT_DIR,'task-ui-'+viewport.width+'.png'),screenshot);
      }
      checks.push({viewport,result:'PASS',model:'SYNTHETIC_FIXTURE',overflow:'NONE'});
    }finally{await context.close();}
  }
  const context=await browser.newContext();
  try{
    const first=await context.newPage(),second=await context.newPage();
    await first.goto(origin);await second.goto(origin);
    await first.locator('#task-title').fill('First tab');await first.getByRole('button',{name:'Add task'}).click();
    await second.locator('#task-title').fill('Second tab');await second.getByRole('button',{name:'Add task'}).click();
    assert.match(await second.locator('#storage-warning').innerText(),/another tab/);
    await first.reload();assert.deepEqual(await first.locator('.task-title').allTextContents(),['First tab']);
    checks.push({storage:'STALE_TAB_NO_OVERWRITE_PASS'});
  }finally{await context.close();}
  console.log(JSON.stringify({browser:browser.version(),checks,device:'CHROMIUM_EMULATION_ONLY',model:'SYNTHETIC_FIXTURE',ios:'NOT_TESTED'}));
}finally{
  if(browser)await browser.close();
  await new Promise(resolve=>server.close(resolve));
}
