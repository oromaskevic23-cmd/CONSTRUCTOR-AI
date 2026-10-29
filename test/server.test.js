import test from "node:test";
import assert from "node:assert/strict";
import {once} from "node:events";
import {createAppServer} from "../tools/serve.mjs";

test("local reference server serves only allowlisted assets with security headers",async t=>{
  const server=createAppServer();
  server.listen(0,"127.0.0.1");
  await once(server,"listening");
  t.after(()=>server.close());
  const origin="http://127.0.0.1:"+server.address().port;
  for(const url of ["/","/index.html","/styles.css","/src/app.js","/src/tasks.js","/studio","/studio.html","/studio.css","/src/project-domain.mjs","/src/project-runtime.mjs","/src/project-export.mjs","/src/project.css","/src/zip.mjs","/src/studio.mjs"]){
    const res=await fetch(origin+url);
    assert.equal(res.status,200,"asset "+url);
    assert.equal(res.headers.get("x-content-type-options"),"nosniff");
    assert.match(res.headers.get("content-security-policy"),/script-src 'self'/);
    assert.ok((await res.text()).length>100);
  }
  const missing=await fetch(origin+"/.env");
  assert.equal(missing.status,404);
  const badPath=await fetch(origin+"/private/key.pem");
  assert.equal(badPath.status,404);
  const invalidMethod=await fetch(origin+"/",{method:"POST"});
  assert.equal(invalidMethod.status,405);
  const head=await fetch(origin+"/index.html",{method:"HEAD"});
  assert.equal(head.status,200);
  assert.equal((await head.text()).length,0);
});
