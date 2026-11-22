// Independent browser QA, authored before model output. Not included in LLM prompt.
// Executed in a disposable, offline, read-only Docker browser container.
const {chromium}=require('/qa_modules/playwright');
const assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const fs=require('node:fs');
const tests=[];
const t=(name,fn)=>tests.push({name,fn});
const target='file:///work/index.html';

async function openPage(browser){
 const context=await browser.newContext({acceptDownloads:false,serviceWorkers:'block'});
 const page=await context.newPage();
 const external=[];
 page.on('request',request=>{
  if(!request.url().startsWith('file:///work/'))external.push(request.url());
 });
 await page.goto(target,{waitUntil:'load',timeout:10000});
 return {page,context,external};
}
async function add(page,qty,cents){
 await page.locator('#qty').fill(String(qty));
 await page.locator('#unitCents').fill(String(cents));
 await page.locator('#add').click();
}
async function values(page){
 return {
  total:(await page.locator('#total').innerText()).trim(),
  count:(await page.locator('#lineCount').innerText()).trim(),
  error:(await page.locator('#error').innerText()).trim(),
  items:await page.locator('#items li').count()
 };
}

t('page renders heading and labeled inputs',async(browser)=>{
 const {page,context}=await openPage(browser);
 try{
  assert.equal(await page.getByRole('heading',{name:'Invoice Lab'}).count(),1);
  assert.equal(await page.getByLabel('Quantity').count(),1);
  assert.equal(await page.getByLabel('Unit cents').count(),1);
  assert.equal(await page.getByRole('button',{name:'Add line'}).count(),1);
  assert.equal(await page.getByRole('button',{name:'Clear'}).count(),1);
  assert.equal(await page.locator('#error[role="alert"]').count(),1);
 }finally{await context.close();}
});

t('starts with zero cents and zero lines',async(browser)=>{
 const {page,context}=await openPage(browser);
 try{assert.deepEqual(await values(page),{total:'0',count:'0',error:'',items:0});}
 finally{await context.close();}
});

t('one line is correctly totaled',async(browser)=>{
 const {page,context}=await openPage(browser);
 try{await add(page,2,125);const x=await values(page);
  assert.equal(x.total,'250');assert.equal(x.count,'1');
  assert.equal(x.items,1);assert.equal(x.error,'');
 }finally{await context.close();}
});

t('multiple lines sum accurately',async(browser)=>{
 const {page,context}=await openPage(browser);
 try{await add(page,2,125);await add(page,3,10);
  const x=await values(page);
  assert.equal(x.total,'280');assert.equal(x.count,'2');assert.equal(x.items,2);
 }finally{await context.close();}
});

t('clear resets total and count',async(browser)=>{
 const {page,context}=await openPage(browser);
 try{await add(page,2,150);await page.locator('#clear').click();
  const x=await values(page);
  assert.equal(x.total,'0');assert.equal(x.count,'0');assert.equal(x.items,0);
  assert.equal(x.error,'');
 }finally{await context.close();}
});

t('zero quantity is rejected with visible error',async(browser)=>{
 const {page,context}=await openPage(browser);
 try{await add(page,0,5);const x=await values(page);
  assert.equal(x.total,'0');assert.equal(x.count,'0');assert.ok(x.error.length>0);
 }finally{await context.close();}
});

t('negative unit cents is rejected',async(browser)=>{
 const {page,context}=await openPage(browser);
 try{await add(page,2,-1);const x=await values(page);
  assert.equal(x.total,'0');assert.equal(x.count,'0');assert.ok(x.error.length>0);
 }finally{await context.close();}
});

t('fractional quantity is rejected',async(browser)=>{
 const {page,context}=await openPage(browser);
 try{await add(page,1.5,100);const x=await values(page);
  assert.equal(x.total,'0');assert.equal(x.count,'0');assert.ok(x.error.length>0);
 }finally{await context.close();}
});

t('unsafe multiplication is rejected',async(browser)=>{
 const {page,context}=await openPage(browser);
 try{await add(page,2,Number.MAX_SAFE_INTEGER);const x=await values(page);
  assert.equal(x.total,'0');assert.equal(x.count,'0');assert.ok(x.error.length>0);
 }finally{await context.close();}
});

t('unsafe aggregate sum is rejected',async(browser)=>{
 const {page,context}=await openPage(browser);
 try{await add(page,1,Number.MAX_SAFE_INTEGER);await add(page,1,1);
  const x=await values(page);
  assert.equal(x.total,String(Number.MAX_SAFE_INTEGER));assert.equal(x.count,'1');
  assert.equal(x.items,1);assert.ok(x.error.length>0);
 }finally{await context.close();}
});

t('no remote network requests',async(browser)=>{
 const {page,context,external}=await openPage(browser);
 try{
  await add(page,1,100);
  assert.deepEqual(external,[]);
  const sources=await page.locator('script[src]').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('src')));
  assert.deepEqual(sources,['app.js']);
  assert.equal(await page.locator('script:not([src])').count(),0);
 }finally{await context.close();}
});

(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 let failed=0;
 try{
  for(const test of tests){
   try{await test.fn(browser);console.log('PASS '+test.name);}
   catch(error){failed++;console.log('FAIL '+test.name+' :: '+String(error).slice(0,400));}
  }
  console.log('browser_qa_cases='+tests.length+' browser_qa_failed='+failed);
  if(tests.length!==11||failed)process.exitCode=1;
 }finally{await browser.close();}
})().catch(e=>{console.error('BROWSER_INFRASTRUCTURE_ERROR '+String(e).slice(0,350));process.exitCode=2;});
