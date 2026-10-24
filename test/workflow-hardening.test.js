import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read = path => readFileSync(new URL("../"+path,import.meta.url),"utf8");
const workflow = read(".github/workflows/ci.yml");
const uses = [...workflow.matchAll(/^\s*uses:\s*(\S+)/gm)].map(m=>m[1]);

test("CI third-party actions all reference immutable full SHA",()=>{
 assert.equal(uses.length,3);
 for(const ref of uses) assert.match(ref,/^actions\/[a-z-]+@[a-f0-9]{40}$/);
});
test("checkout explicitly disables credential persistence",()=>{
 assert.match(workflow,/uses: actions\/checkout@[a-f0-9]{40}[^\n]*\n\s+with:\n\s+persist-credentials: false/);
});
test("GitHub token is explicitly read only",()=>{
 assert.match(workflow,/(?:^|\n)permissions:\n\s+contents: read(?:\n|$)/);
 assert.doesNotMatch(workflow,/^\s*(?:contents|actions|packages|issues):\s*write\b/m);
});
test("test-only mock Groq keys are constructed, not stored as provider-shaped literals",()=>{
 for(const path of ["test/groq-gateway.test.js","test/offline-integration.test.js"]){
  const content=read(path);
  assert.doesNotMatch(content,/gsk_[A-Za-z0-9_-]{20,}/);
  assert.match(content,/"gsk_"\s*\+\s*"a"\.repeat\(42\)/);
 }
});
test("quality gates remain enabled for push and pull request",()=>{
 assert.match(workflow,/\bpush:/);
 assert.match(workflow,/\bpull_request:/);
 assert.match(workflow,/run: npm test/);
});
