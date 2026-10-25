// Validate local real-model observation without ever executing generated code.
import {readFile} from "node:fs/promises";
import {admitLocalGGUFObservation} from "../engineering/local-model-admission.mjs";
const args=process.argv.slice(2);
const i=args.indexOf("--goal");
if(i<0||i+2!==args.length||typeof args[i+1]!=="string"){
 console.error("Usage: npm run llm:admit -- --goal 'your exact original software goal'");
 process.exit(2);
}
try{
 const file=await readFile("local-model-observation.json");
 if(file.length<50||file.length>80000)throw Error("MODEL_OBSERVATION_SIZE_INVALID");
 const result=admitLocalGGUFObservation(JSON.parse(file.toString("utf8")),{goal:args[i+1]});
 console.log(JSON.stringify({
  status:result.status,
  model_sha256:result.model_sha256,
  validated_draft_sha256:result.validated_draft_sha256,
  draft_files:result.draft.files.map(x=>x.path),
  real_inference_attestation:result.real_inference_attestation,
  source_execution:result.source_execution,
  vm_execution:result.vm_execution,
  release:result.release
 },null,2));
}catch(error){
 // Report shape-only diagnostics; never echo the untrusted generated source or prompts.
 try {
   const {readFileSync} = await import("node:fs");
   const observation=JSON.parse(readFileSync("local-model-observation.json","utf8"));
   let object;
   try{object=JSON.parse(observation.response_text);}
   catch{object=null;}
   console.error("MODEL_DIAGNOSTICS:",JSON.stringify({
     finish_reason:observation.finish_reason,
     raw_response_chars:observation.response_text?.length,
     json_object:object!==null&&typeof object==="object"&&!Array.isArray(object),
     top_level_keys:object&&typeof object==="object"&&!Array.isArray(object)?Object.keys(object).slice(0,10):[],
     steps_count:Array.isArray(object?.steps)?object.steps.length:null,
     files_count:Array.isArray(object?.files)?object.files.length:null,
     step_shapes:Array.isArray(object?.steps)?object.steps.slice(0,3).map(v=>Object.keys(v??{})):[],
     file_shapes:Array.isArray(object?.files)?object.files.slice(0,3).map(v=>Object.keys(v??{})):[]
   }));
 }catch{}
console.error("ADMISSION_BLOCKED:",error.code??error.message);process.exit(1);}
