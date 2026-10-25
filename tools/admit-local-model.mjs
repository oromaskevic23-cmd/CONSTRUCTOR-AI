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
}catch(error){console.error("ADMISSION_BLOCKED:",error.code??error.message);process.exit(1);}
