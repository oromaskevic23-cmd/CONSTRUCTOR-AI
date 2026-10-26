// Local model output admission is an integrity filter, not trusted inference proof.
import {createHash} from "node:crypto";
import {parseModelDraft} from "./draft-contract.mjs";
import {staticDraftReview} from "./static-review.mjs";
const PIN="9739055e046d62a937e5b7879012209ef40ebea8a1569a96028de491f3f091d5";
const K=["schema","model_id","model_sha256","input_sha256","response_sha256",
  "finish_reason","response_text","provider","inference_attempted",
  "model_generated_files_executed","release"];
const sha=s=>createHash("sha256").update(s,"utf8").digest("hex");
export class LocalModelError extends Error{
 constructor(code){super(code);this.name="LocalModelError";this.code=code;}
}
export function admitLocalGGUFObservation(report,{goal}={}){
 if(!report||typeof report!=="object"||Array.isArray(report)||
    Object.getPrototypeOf(report)!==Object.prototype||
    Object.keys(report).length!==K.length||K.some(k=>!Object.hasOwn(report,k))||
    report.schema!=="constructor_local_gguf_observation_v1"||
    report.model_id!=="Qwen/Qwen2.5-Coder-0.5B-Instruct-GGUF:q4_0"||
    report.model_sha256!==PIN||report.provider!=="LOCAL_LLAMA_CPP_PYTHON"||
    report.inference_attempted!==true||report.model_generated_files_executed!==false||
    report.release!=="DENIED")
   throw new LocalModelError("UNTRUSTED_MODEL_REPORT");
 if(typeof goal!=="string"||goal.length<12||goal.length>300||
    sha(goal)!==report.input_sha256||
    typeof report.response_text!=="string"||
    report.response_text.length>64000||
    sha(report.response_text)!==report.response_sha256||
    report.finish_reason!=="stop")
   throw new LocalModelError("INCOMPLETE_MODEL_OUTPUT");
 let draft;
 try{draft=parseModelDraft(report.response_text);}
 catch{throw new LocalModelError("MODEL_DRAFT_CONTRACT_REJECTED");}
 if(!draft.draft.files.length)throw new LocalModelError("NO_GENERATED_FILES");
 const review=staticDraftReview(draft.draft);
 if(review.forbidden.length||review.flags.length)
   throw new LocalModelError("UNSAFE_UNTRUSTED_SOURCE");
 return Object.freeze({status:"UNTRUSTED_LOCAL_MODEL_DRAFT_FOR_REVIEW",
   model_sha256:PIN,raw_output_sha256:report.response_sha256,
   validated_draft_sha256:draft.sha256,draft:draft.draft,
   real_inference_attestation:"NOT_EXTERNALLY_VERIFIED",
   source_execution:"NOT_RUN",vm_execution:"NOT_VERIFIED",
   independent_qa:"NOT_RUN",release:"DENIED"});
}
