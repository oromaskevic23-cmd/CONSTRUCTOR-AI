// CONSTRUCTOR AI: signed build -> separately executed QA -> verifier. Reference only.
// Keys are self-issued ephemeral keys. No external auditor identity or CI runner attestation.
import {createHash,createPublicKey,generateKeyPairSync,sign,verify} from "node:crypto";
import {evaluateIntentProofGraph,PROOF_GRAPH_SCHEMA} from "./intent-proof-graph.mjs";
const SHA=/^[a-f0-9]{64}$/;
const SIG=/^[A-Za-z0-9_-]{86}$/;
const BUILDER_SCHEMA="constructor_ci_builder_v1";
const QA_SCHEMA="constructor_ci_qa_v1";
const ENVELOPE_SCHEMA="constructor_ci_signed_envelope_v1";
const ENVELOPE_KEYS=["schema","role","payload","public_key_pem","spki_sha256","signature_b64url"];
const exact=(o,keys)=>!!o&&typeof o==="object"&&!Array.isArray(o)&&Object.getPrototypeOf(o)===Object.prototype&&
 Object.keys(o).length===keys.length&&keys.every(k=>Object.hasOwn(o,k));
const sha256=x=>createHash("sha256").update(x).digest("hex");
export class QAChainError extends Error{constructor(code){super(code);this.name="QAChainError";this.code=code;}}
function readB64(value){
 if(typeof value!=="string"||value.length>60000||!value.length||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value))
    throw new QAChainError("INVALID_BASE64_BYTES");
 const bytes=Buffer.from(value,"base64");
 if(bytes.toString("base64")!==value||bytes.length<1||bytes.length>32768)
    throw new QAChainError("INVALID_BASE64_BYTES");
 return bytes;
}
export const CI_QA_APPEND=[
 "",
 "import {test as independentQATest} from \"node:test\";",
 "import {strict as qaAssert} from \"node:assert\";",
 "independentQATest(\"QA-owned acceptance assertion\",()=>{",
 "  qaAssert.equal(2+2,4);",
 "  qaAssert.equal(process.getuid(),65534);",
 "});"
].join("\n")+"\n";
export function qaSourceFor(source){
 if(typeof source!=="string"||!source.length||
    Buffer.byteLength(source)>32768-Buffer.byteLength(CI_QA_APPEND)-2)
   throw new QAChainError("INVALID_BUILD_SOURCE");
 return source+"\n"+CI_QA_APPEND;
}
const signedBytes=({role,payload})=>Buffer.from(JSON.stringify({schema:ENVELOPE_SCHEMA,role,payload}),"utf8");
export function signCIEnvelope({role,payload,keyPair=generateKeyPairSync("ed25519")}){
 if(!["BUILDER","QA"].includes(role)||!payload||typeof payload!=="object")
   throw new QAChainError("INVALID_ROLE_OR_PAYLOAD");
 const pem=keyPair.publicKey.export({format:"pem",type:"spki"}).toString();
 const spki_sha256=sha256(keyPair.publicKey.export({format:"der",type:"spki"}));
 return {schema:ENVELOPE_SCHEMA,role,payload,public_key_pem:pem,spki_sha256,
   signature_b64url:sign(null,signedBytes({role,payload}),keyPair.privateKey).toString("base64url")};
}
export function verifyCIEnvelope(envelope,expectedRole){
 if(!exact(envelope,ENVELOPE_KEYS)||envelope.schema!==ENVELOPE_SCHEMA||
    envelope.role!==expectedRole||!SHA.test(envelope.spki_sha256??"")||
    typeof envelope.public_key_pem!=="string"||envelope.public_key_pem.length>512||
    !SIG.test(envelope.signature_b64url??""))throw new QAChainError("INVALID_CI_ENVELOPE");
 let key;
 try{key=createPublicKey(envelope.public_key_pem);}
 catch{throw new QAChainError("BAD_PUBLIC_KEY");}
 if(key.asymmetricKeyType!=="ed25519"||
    sha256(key.export({format:"der",type:"spki"}))!==envelope.spki_sha256)
   throw new QAChainError("CI_KEY_PIN_MISMATCH");
 if(!verify(null,signedBytes(envelope),key,Buffer.from(envelope.signature_b64url,"base64url")))
   throw new QAChainError("CI_SIGNATURE_INVALID");
 return true;
}
function checkReceipt(receipt,role){
 if(!receipt||receipt.schema!=="constructor_isolated_execution_receipt_v1"||
    receipt.runner!=="LOCAL_DOCKER_NODE_TEST"||
    receipt.untrusted_code_execution!=="CONTAINER_EXECUTED_NOT_VM_ATTESTED"||
    receipt.release!=="DENIED"||receipt.independent_qa!=="NOT_RUN"||
    receipt.exit_code!==0||receipt.status!=="PASS"||
    !SHA.test(receipt.source_sha256??"")||
    !SHA.test(receipt.stdout_sha256??"")||!SHA.test(receipt.stderr_sha256??"")||
    typeof receipt.stdout!=="string"||typeof receipt.stderr!=="string"||
    Buffer.byteLength(receipt.stdout)>16384||Buffer.byteLength(receipt.stderr)>16384||
    sha256(Buffer.from(receipt.stdout))!==receipt.stdout_sha256||
    sha256(Buffer.from(receipt.stderr))!==receipt.stderr_sha256||
    !/^sha256:[a-f0-9]{64}$/.test(receipt.container_image_id??""))
     throw new QAChainError(role+"_RECEIPT_INCOMPLETE");
 return receipt;
}
export function builderPayloadFromRun(result,source){
 if(!result||result.release!=="DENIED"||!result.graph||!result.receipt||
    !result.artifactBytesById||!Buffer.isBuffer(result.artifactBytesById.get("EVID_SOURCE")))
   throw new QAChainError("BUILDER_RESULT_INCOMPLETE");
 if(!Buffer.from(source??"").equals(result.artifactBytesById.get("EVID_SOURCE")))
   throw new QAChainError("BUILDER_SOURCE_MISMATCH");
 return {schema:BUILDER_SCHEMA,mission_id:result.receipt.mission_id,
   requirement_id:result.receipt.requirement_id,
   acceptance:result.graph.requirements[0].acceptance,
   source_b64:Buffer.from(source).toString("base64"),execution_receipt:result.receipt,graph:result.graph};
}
export function verifyBuilderEnvelope(envelope){
 verifyCIEnvelope(envelope,"BUILDER");
 const p=envelope.payload;
 if(!exact(p,["schema","mission_id","requirement_id","acceptance",
   "source_b64","execution_receipt","graph"])||p.schema!==BUILDER_SCHEMA)
   throw new QAChainError("INVALID_BUILDER_PAYLOAD");
 const bytes=readB64(p.source_b64),r=checkReceipt(p.execution_receipt,"BUILDER");
 if(sha256(bytes)!==r.source_sha256||p.mission_id!==r.mission_id||
    p.requirement_id!==r.requirement_id||
    !exact(p.graph,["schema","mission_id","requirements","evidence"])||
    p.graph.schema!==PROOF_GRAPH_SCHEMA||p.graph.mission_id!==p.mission_id||
    !Array.isArray(p.graph.requirements)||p.graph.requirements.length!==1||
    p.graph.requirements[0].id!==p.requirement_id||
    p.graph.requirements[0].acceptance!==p.acceptance||
    !Array.isArray(p.graph.evidence)||p.graph.evidence.length!==2)
   throw new QAChainError("BUILDER_GRAPH_MISMATCH");
 const src=p.graph.evidence.find(x=>x.id==="EVID_SOURCE");
 const tst=p.graph.evidence.find(x=>x.id==="EVID_TEST");
 if(!src||!tst||src.kind!=="SOURCE"||tst.kind!=="TEST"||
    src.status!=="PASS"||tst.status!=="PASS"||
    src.sha256!==sha256(bytes)||
    tst.sha256!==sha256(Buffer.from(JSON.stringify(r))))
   throw new QAChainError("BUILDER_ARTIFACT_MISMATCH");
 let evaluated;
 try{evaluated=evaluateIntentProofGraph(p.graph);}
 catch{throw new QAChainError("INVALID_BUILDER_GRAPH");}
 if(evaluated.review!=="BLOCKED_MISSING_OR_FAILED_EVIDENCE"||
    !evaluated.gaps.some(g=>g.missing.includes("INDEPENDENT_QA"))||
    evaluated.release!=="DENIED")
   throw new QAChainError("BUILDER_RELEASE_GATE_INCONSISTENT");
 return {source:bytes.toString("utf8"),receipt:r,graph:p.graph,
   builder_sha256:sha256(Buffer.from(JSON.stringify(envelope)))};
}
export function qaPayloadFromRun(builderEnvelope,qaResult,qaSource){
 const b=verifyBuilderEnvelope(builderEnvelope);
 if(qaSource!==qaSourceFor(b.source)||!qaResult||!qaResult.receipt||
    qaResult.release!=="DENIED")throw new QAChainError("INVALID_QA_RUN");
 const r=qaResult.receipt;
 return {schema:QA_SCHEMA,builder_envelope_sha256:b.builder_sha256,
   qa_source_b64:Buffer.from(qaSource).toString("base64"),
   qa_execution_receipt:r,
   graph:{schema:PROOF_GRAPH_SCHEMA,mission_id:builderEnvelope.payload.mission_id,
     requirements:builderEnvelope.payload.graph.requirements,
     evidence:[...builderEnvelope.payload.graph.evidence,
       {id:"EVID_QA01",requirement_id:builderEnvelope.payload.requirement_id,
         kind:"INDEPENDENT_QA",status:r.status,
         sha256:sha256(Buffer.from(JSON.stringify(r)))}]}};
}
export function verifyQAChain(bundle){
 if(!exact(bundle,["schema","builder","qa"])||bundle.schema!=="constructor_ci_chain_v1")
   throw new QAChainError("INVALID_QA_CHAIN");
 const b=verifyBuilderEnvelope(bundle.builder);
 verifyCIEnvelope(bundle.qa,"QA");
 if(bundle.builder.spki_sha256===bundle.qa.spki_sha256)
   throw new QAChainError("QA_KEY_NOT_SEPARATE");
 const p=bundle.qa.payload;
 if(!exact(p,["schema","builder_envelope_sha256","qa_source_b64",
     "qa_execution_receipt","graph"])||p.schema!==QA_SCHEMA||
    p.builder_envelope_sha256!==b.builder_sha256)
   throw new QAChainError("QA_PREDECESSOR_MISMATCH");
 const r=checkReceipt(p.qa_execution_receipt,"QA");
 const qaBytes=readB64(p.qa_source_b64);
 if(qaBytes.toString("utf8")!==qaSourceFor(b.source)||
    r.source_sha256!==sha256(qaBytes)||
    r.mission_id!==b.receipt.mission_id||
    r.requirement_id!==b.receipt.requirement_id||
    r.container_image_id!==b.receipt.container_image_id)
   throw new QAChainError("QA_SOURCE_OR_MISSION_MISMATCH");
 const expected=qaPayloadFromRun(bundle.builder,{receipt:r,release:"DENIED"},qaBytes.toString("utf8")).graph;
 if(JSON.stringify(expected)!==JSON.stringify(p.graph))
   throw new QAChainError("QA_GRAPH_MISMATCH");
 let evaluated;
 try{evaluated=evaluateIntentProofGraph(p.graph);}
 catch{throw new QAChainError("INVALID_QA_GRAPH");}
 if(evaluated.review!=="READY_FOR_HUMAN_EVIDENCE_REVIEW"||
    evaluated.release!=="DENIED")throw new QAChainError("QA_REVIEW_INCOMPLETE");
 return Object.freeze({schema:"constructor_ci_qa_verification_v1",
   builder_receipt_sha256:sha256(Buffer.from(JSON.stringify(b.receipt))),
   qa_receipt_sha256:sha256(Buffer.from(JSON.stringify(r))),
   graph_sha256:evaluated.graph_sha256,
   builder_signature:"VERIFIED_SELF_ISSUED_CI_KEY",qa_signature:"VERIFIED_SELF_ISSUED_CI_KEY",
   separation:"DISTINCT_CI_JOBS_AND_EPHEMERAL_KEYS_NOT_EXTERNAL_AUDIT",
   evidence_review:evaluated.review,release:"DENIED",
   real_model_inference:"NOT_VERIFIED",vm_attestation:"NOT_VERIFIED",
   owner_approval:"NOT_VERIFIED"});
}
