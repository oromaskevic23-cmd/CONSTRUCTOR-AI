// Separate CI job: fresh Docker run, QA-owned assertions and ephemeral signing key.
// Never releases software or grants owner authority.
import {readFile,writeFile} from "node:fs/promises";
import {runIsolatedProofTest} from "../engineering/isolated-executor.mjs";
import {verifyBuilderEnvelope,qaSourceFor,qaPayloadFromRun,signCIEnvelope,
  verifyQAChain} from "../engineering/qa-chain.mjs";
const imageId=process.env.CONSTRUCTOR_DOCKER_IMAGE_ID;
if(!/^sha256:[a-f0-9]{64}$/.test(imageId??"")){
 console.error("BLOCKED: immutable local Docker image required");
 process.exit(2);
}
try{
 const raw=await readFile("ci-builder-evidence.json");
 if(raw.length<100||raw.length>160000)throw Error("INVALID_BUILDER_ARTIFACT_SIZE");
 const builder=JSON.parse(raw.toString("utf8"));
 const reviewed=verifyBuilderEnvelope(builder);
 if(reviewed.receipt.container_image_id!==imageId)
   throw Error("CONTAINER_IMAGE_CHANGED_BETWEEN_BUILDER_AND_QA");
 const acceptance=builder.payload.acceptance;
 const qaSource=qaSourceFor(reviewed.source);
 const run=await runIsolatedProofTest({
  missionId:builder.payload.mission_id,requirementId:builder.payload.requirement_id,
  acceptance,source:qaSource,imageId,timeoutMs:15000
 });
 if(run.receipt.status!=="PASS"||run.receipt.exit_code!==0)
   throw Error("INDEPENDENT_QA_EXECUTION_FAILED");
 const qa=signCIEnvelope({role:"QA",
  payload:qaPayloadFromRun(builder,run,qaSource)});
 const bundle={schema:"constructor_ci_chain_v1",builder,qa};
 const result=verifyQAChain(bundle);
 if(result.release!=="DENIED"||
    result.evidence_review!=="READY_FOR_HUMAN_EVIDENCE_REVIEW")
   throw Error("FAIL_CLOSED_QA_REVIEW_GATE");
 await writeFile("ci-qa-chain.json",JSON.stringify(bundle,null,2)+"\n",{flag:"wx",mode:0o600});
 console.log(JSON.stringify({stage:"INDEPENDENT_CI_JOB_DOCKER_QA",
  qa_test_exit:run.receipt.exit_code,qa_stdout_sha256:run.receipt.stdout_sha256,
  qa_receipt_sha256:result.qa_receipt_sha256,
  graph_sha256:result.graph_sha256,
  qa_signature:result.qa_signature,signature_trust:"SELF_ISSUED_EPHEMERAL",
  result:result.evidence_review,release:result.release,vm_attestation:result.vm_attestation,
  scope:"SYNTHETIC_SOURCE_REPLAY_PLUS_QA_AUTHORED_ASSERTION_NOT_EXTERNAL_AUDIT"},null,2));
}catch(error){
 console.error("QA BLOCKED:",error.code??error.message);
 process.exit(1);
}
