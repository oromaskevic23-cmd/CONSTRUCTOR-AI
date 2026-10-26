// SYNTHETIC audit-only demo. Keys are ephemeral; they are NOT owner identities.
import {createHash,generateKeyPairSync,sign} from "node:crypto";
import {strict as assert} from "node:assert";
import {PROOF_GRAPH_SCHEMA,evaluateIntentProofGraph} from "../engineering/intent-proof-graph.mjs";
import {PROOF_WITNESS_SCHEMA,witnessSigningPayload,
  verifyWitnessedArtifactBytes,WitnessError} from "../engineering/proof-witness.mjs";

const builder=generateKeyPairSync("ed25519");
const qa=generateKeyPairSync("ed25519");
const trust={};
for(const [role,pair] of [["builder",builder],["qa",qa]]){
  const publicDer=pair.publicKey.export({type:"spki",format:"der"});
  trust[role]={
    public_key_pem:pair.publicKey.export({type:"spki",format:"pem"}).toString(),
    pinned_spki_sha256:createHash("sha256").update(publicDer).digest("hex")
  };
}
const bytesById=new Map();
const claims=[["EVID_CODE","SOURCE","source-bytes-synthetic"],
              ["EVID_TEST","TEST","test-result-synthetic"],
              ["EVID_QA","INDEPENDENT_QA","qa-result-synthetic"]];
const graph={schema:PROOF_GRAPH_SCHEMA,mission_id:"SYNTHETIC-PASSPORT-001",
  requirements:[{id:"REQ_DEMO",acceptance:"A bound proof record is visibly checked before human review."}],
  evidence:claims.map(([id,kind,data])=>{
    const bytes=Buffer.from(data,"utf8");
    bytesById.set(id,bytes);
    return {id,requirement_id:"REQ_DEMO",kind,status:"PASS",
      sha256:createHash("sha256").update(bytes).digest("hex")};
  })};
const evaluation=evaluateIntentProofGraph(graph);
const now=Date.now();
const witnesses=graph.evidence.map((e,i)=>{
  const signed={schema:PROOF_WITNESS_SCHEMA,mission_id:graph.mission_id,
    graph_sha256:evaluation.graph_sha256,evidence_id:e.id,
    requirement_id:e.requirement_id,kind:e.kind,status:e.status,
    artifact_sha256:e.sha256,role:e.kind==="INDEPENDENT_QA"?"QA":"BUILDER",
    issued_at_ms:now-1000,expires_at_ms:now+60000,
    nonce:"SYNTHETIC_NONCE_"+String(i).padStart(3,"0")};
  const key=e.kind==="INDEPENDENT_QA"?qa.privateKey:builder.privateKey;
  return {...signed,signature_b64url:sign(null,witnessSigningPayload(signed),key).toString("base64url")};
});
const args={graph,witnesses,trust,now,artifactBytesById:bytesById,consumedNonces:new Set()};
const verified=verifyWitnessedArtifactBytes(args);
assert.equal(verified.release,"DENIED");
assert.equal(verified.signatures_verified,3);
assert.equal(verified.artifact_byte_integrity,"CALLER_BYTES_MATCH_SHA256");

const mutatedBytes=new Map(bytesById);
mutatedBytes.set("EVID_TEST",Buffer.from("forged-test-result"));
let tamperBlocked=false;
try {
  verifyWitnessedArtifactBytes({...args,consumedNonces:new Set(),artifactBytesById:mutatedBytes});
}catch(e) {
  if(e instanceof WitnessError && e.code==="ARTIFACT_BYTES_DIGEST_MISMATCH")tamperBlocked=true;
  else throw e;
}
assert.equal(tamperBlocked,true);
console.log(JSON.stringify({
  product:"CONSTRUCTOR AI",demo:"SYNTHETIC_UNTRUSTED_NO_REAL_QA",
  technology:"Intent ProofGraph + pinned Ed25519 witnesses + SHA-256 actual bytes",
  verified_signatures:verified.signatures_verified,
  artifact_consistency:verified.artifact_byte_integrity,
  altered_byte_attack:"BLOCKED",
  graph_review:verified.evidence_review,
  provenance:verified.byte_provenance,
  owner_approval:verified.owner_approval,
  release:verified.release,
  warning:"Ephemeral demo keys are not authorized human identities. NO real QA execution, signed owner release or production app."
},null,2));
