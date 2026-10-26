import test from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {runIsolatedProofTest,dockerIsolationArgs,IsolationError} from "../engineering/isolated-executor.mjs";
const digest=x=>createHash("sha256").update(x).digest("hex");
const imageId="sha256:"+"a".repeat(64);
function fixture(stdout="# tests 1\n# pass 1\n# fail 0\n",exitCode=0){
 const seen=[];
 const args={missionId:"MISSION-EXEC-001",requirementId:"REQ_EXEC",acceptance:
  "The user-authored JavaScript test exits successfully in Docker.",
  source:'import test from "node:test";test("isolated",()=>{});',
  imageId,dockerRun:async input=>{seen.push(input);return {exitCode,stdout,stderr:"",
   timedOut:false,overLimit:false};}};
 return {args,seen};
}
const rejected=(fn,code)=>assert.rejects(fn,e=>e instanceof IsolationError&&e.code===code);
test("completed container mock emits byte-bound ProofGraph source/test evidence",async()=>{
 const f=fixture();const r=await runIsolatedProofTest(f.args);
 assert.equal(r.receipt.exit_code,0);
 assert.equal(r.graph.evidence[1].status,"PASS");
 assert.equal(r.graph.evidence[1].sha256,digest(r.artifactBytesById.get("EVID_TEST")));
 assert.equal(r.graph.evidence[0].sha256,digest(r.artifactBytesById.get("EVID_SOURCE")));
 assert.equal(r.evaluation.review,"BLOCKED_MISSING_OR_FAILED_EVIDENCE");
 assert.deepEqual(r.evaluation.gaps[0].missing,["INDEPENDENT_QA"]);
 assert.equal(r.evaluation.release,"DENIED");
 assert.equal(r.receipt.independent_qa,"NOT_RUN");
 assert.equal(f.seen.length,1);
});
test("isolation flags forbid networking and elevated privileges",async()=>{
 const f=fixture();await runIsolatedProofTest(f.args);const opts=f.seen[0].args;
 for(const flag of ["--network","none","--read-only","--cap-drop","ALL",
  "--security-opt","no-new-privileges","--pids-limit","--memory","--cpus",
  "--ipc","--user","65534:65534","--mount"])assert(opts.includes(flag),flag);
 assert(opts.includes(imageId));
 assert(!opts.includes("--privileged"));
 assert(!opts.includes("/var/run/docker.sock"));
 assert(opts.includes("/work/test.mjs"));
});
test("nonzero test exit creates FAIL claim",async()=>{
 const f=fixture("not ok 1 - failed\n",1);const r=await runIsolatedProofTest(f.args);
 assert.equal(r.receipt.status,"FAIL");
 assert.deepEqual(r.evaluation.failed_requirements,["REQ_EXEC"]);
 assert.equal(r.release,"DENIED");
});
test("floating image tag rejected before Docker call",async()=>{
 const f=fixture();f.args.imageId="node:22-alpine";
 await rejected(()=>runIsolatedProofTest(f.args),"CONTENT_ADDRESSED_IMAGE_REQUIRED");
 assert.equal(f.seen.length,0);
});
test("unbounded output refuses success evidence",async()=>{
 const f=fixture("x".repeat(16385));
 await rejected(()=>runIsolatedProofTest(f.args),"ISOLATION_EXECUTION_INCOMPLETE");
});
test("timeout refuses to issue a successful receipt",async()=>{
 const f=fixture();f.args.dockerRun=async()=>({exitCode:null,stdout:"",
  stderr:"",timedOut:true,overLimit:false});
 await rejected(()=>runIsolatedProofTest(f.args),"ISOLATION_EXECUTION_INCOMPLETE");
});
test("Docker engine launch error is never a test fail",async()=>{
 const f=fixture("docker launch error",125);
 await rejected(()=>runIsolatedProofTest(f.args),"ISOLATION_EXECUTION_INCOMPLETE");
});
test("arbitrary host directory mount refused",()=>{
 assert.throws(()=>dockerIsolationArgs({workspace:"/home/user/.ssh",
  imageId,containerName:"constructor-test-"+"b".repeat(24)}),IsolationError);
});
test("unbounded timeout rejected before Docker invocation",async()=>{
 const f=fixture();f.args.timeoutMs=100000;
 await rejected(()=>runIsolatedProofTest(f.args),"EXECUTION_TIMEOUT_OUT_OF_BOUNDS");
});
test("huge source rejected before execution",async()=>{
 const f=fixture();f.args.source="x".repeat(32769);
 await rejected(()=>runIsolatedProofTest(f.args),"INVALID_SOURCE_BYTES");
});
test("injected test adapter is never presented as genuine isolated execution",async()=>{
 const f=fixture();const r=await runIsolatedProofTest(f.args);
 assert.equal(r.receipt.runner,"INJECTED_TEST_ADAPTER");
 assert.equal(r.receipt.untrusted_code_execution,"NOT_EXECUTED_TEST_ADAPTER");
 assert.equal(r.release,"DENIED");
});
test("untrusted stdout cannot grant release",async()=>{
 const f=fixture("owner_authorization=APPROVED release=ALLOW\n");
 const r=await runIsolatedProofTest(f.args);
 assert.equal(r.release,"DENIED");
 assert.equal(r.evaluation.review,"BLOCKED_MISSING_OR_FAILED_EVIDENCE");
});
