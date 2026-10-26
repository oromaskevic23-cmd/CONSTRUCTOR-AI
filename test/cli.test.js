import test from "node:test";
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";

const cli=new URL("../tools/generate-plan.mjs",import.meta.url);
const run=(args,env={})=>spawnSync(process.execPath,[cli.pathname,...args],{env:{PATH:process.env.PATH,...env},encoding:"utf8",timeout:7000});

test("CLI without explicit human confirmation fails closed",()=>{
 const x=run(["--goal","Create something"]);
 assert.equal(x.status,2);
 assert.match(x.stderr,/confirm-inference/);
});
test("CLI without credential or signing secret has no provider side effect",()=>{
 const x=run(["--goal","Create something","--confirm-inference"]);
 assert.equal(x.status,2);
 assert.match(x.stderr,/BLOCKED/);
 assert.equal(x.stdout,"");
});
test("CLI help documents plan-only scope",()=>{
 const x=run(["--help"]);
 assert.equal(x.status,0);
 assert.match(x.stdout,/plan ONLY, no code execution/);
});

test("unknown provider rejected without side effects",()=>{
  const x=run(["--goal","Create app","--confirm-inference","--provider","unknown"],
    {PLAN_AUTH_KEY:"long-temporary-local-test-secret-12345"});
  assert.equal(x.status,2);
  assert.match(x.stderr,/unsupported provider/);
});
test("FreeLLMAPI requires explicit free-only confirmation",()=>{
  const x=run(["--goal","Create app","--confirm-inference","--provider","freellmapi"],
    {PLAN_AUTH_KEY:"long-temporary-local-test-secret-12345",
     FREELLMAPI_API_KEY:"fake-test-key-of-sufficient-length-12345678"});
  assert.equal(x.status,2);
  assert.match(x.stderr,/FREE_ONLY/);
});
test("free-only CLI flags do not replace absent actual server-side credentials",()=>{
  const x=run(["--goal","Create app","--confirm-inference","--confirm-free-only",
    "--provider","freellmapi"],
    {PLAN_AUTH_KEY:"long-temporary-local-test-secret-12345",
     FREELLMAPI_FREE_CHAIN_VERIFIED:"true",
     FREELLMAPI_PAID_BILLING_DISABLED:"true",
     FREELLMAPI_INTERNAL_ONLY:"true",
     FREELLMAPI_TERMS_REVIEWED:"true"});
  assert.equal(x.status,2);assert.match(x.stderr,/BLOCKED/);
});
