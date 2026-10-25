// Runs an actual Docker container on a host with Docker installed.
// No LLM provider, account credentials, external infrastructure or production release.
import {writeFile} from "node:fs/promises";
import {runIsolatedProofTest} from "../engineering/isolated-executor.mjs";
const imageId=process.env.CONSTRUCTOR_DOCKER_IMAGE_ID;
if(!/^sha256:[a-f0-9]{64}$/.test(imageId??"")){
 console.error("BLOCKED: set CONSTRUCTOR_DOCKER_IMAGE_ID to local docker image inspect immutable ID.");
 process.exit(2);
}
const source='import test from "node:test";import assert from "node:assert/strict";'+
 'test("2 + 2",()=>assert.equal(2+2,4));';
try{
 const result=await runIsolatedProofTest({
  missionId:"MISSION-DOCKER-DEMO-001",requirementId:"REQ_ARITH",
  acceptance:"The arithmetic test executes successfully inside the isolated Docker container.",
  source,imageId,timeoutMs:15000
 });
 const summary={
  schema:"constructor_isolated_demo_report_v1",
  demonstration:"REAL_DOCKER_TEST_WITH_SYNTHETIC_SOURCE",
  image_id:imageId,execution_exit_code:result.receipt.exit_code,
  executed_test_report_sha256:result.receipt.stdout_sha256,
  evidence_graph_sha256:result.evaluation.graph_sha256,
  requirement_coverage:result.evaluation.review,qa_missing:result.evaluation.gaps,
  release:result.release,vm_attestation:"NOT_VERIFIED",
  owner_authorization:"NOT_VERIFIED"
 };
 if(result.receipt.exit_code!==0 || result.evaluation.release!=="DENIED" ||
    result.evaluation.gaps.length!==1)
  throw Error("INVALID_DEMO_VERIFICATION_STATE");
 console.log(JSON.stringify(summary,null,2));
 if(process.env.CONSTRUCTOR_EVIDENCE_OUTPUT){
  if(process.env.CONSTRUCTOR_EVIDENCE_OUTPUT!=="isolated-execution-evidence.json")
   throw Error("OUTPUT_PATH_NOT_ALLOWLISTED");
  await writeFile("isolated-execution-evidence.json",JSON.stringify(summary,null,2)+"\n",
   {flag:"wx",mode:0o600});
 }
}catch(err){console.error("FAIL:",err.code??err.message);process.exit(1);}
