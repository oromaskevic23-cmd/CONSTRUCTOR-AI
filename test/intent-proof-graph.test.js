import test from "node:test";
import assert from "node:assert/strict";
import {evaluateIntentProofGraph as evaluate, IntentProofError,
  PROOF_GRAPH_SCHEMA} from "../engineering/intent-proof-graph.mjs";

const hex = char => char.repeat(64);
function sample() {
  return {
    schema:PROOF_GRAPH_SCHEMA, mission_id:"MIS-INVESTOR-001",
    requirements:[
      {id:"REQ_B",acceptance:"Task completion persists in a local browser session."},
      {id:"REQ_A",acceptance:"Task creation accepts an ordinary nonempty description."}
    ],
    evidence:[
      {id:"EVA01",requirement_id:"REQ_A",kind:"SOURCE",status:"PASS",sha256:hex("a")},
      {id:"EVA02",requirement_id:"REQ_A",kind:"TEST",status:"PASS",sha256:hex("b")},
      {id:"EVA03",requirement_id:"REQ_A",kind:"INDEPENDENT_QA",status:"PASS",sha256:hex("c")},
      {id:"EVB01",requirement_id:"REQ_B",kind:"SOURCE",status:"PASS",sha256:hex("d")},
      {id:"EVB02",requirement_id:"REQ_B",kind:"TEST",status:"PASS",sha256:hex("e")},
      {id:"EVB03",requirement_id:"REQ_B",kind:"INDEPENDENT_QA",status:"PASS",sha256:hex("f")}
    ]
  };
}
const reject = (v,code) => assert.throws(()=>evaluate(v), err =>
  err instanceof IntentProofError && err.code === code);

test("complete synthetic proof graph is review-ready, never release-authorized", () => {
  const x=evaluate(sample());
  assert.equal(x.review,"READY_FOR_HUMAN_EVIDENCE_REVIEW");
  assert.equal(x.release,"DENIED");
  assert.equal(x.owner_authorization,"NOT_VERIFIED");
  assert.equal(x.provenance,"UNATTESTED_EXTERNAL_CLAIMS");
  assert.equal(x.gaps.length,0);
});
test("result hash deterministic under independent order permutations", () => {
  const a=sample(),b=sample();b.requirements.reverse();b.evidence.reverse();
  assert.equal(evaluate(a).graph_sha256,evaluate(b).graph_sha256);
});
test("change to a requirement invalidates graph SHA", () => {
  const a=sample(),b=sample();b.requirements[0].acceptance+=" Checked again.";
  assert.notEqual(evaluate(a).graph_sha256,evaluate(b).graph_sha256);
});
test("missing QA is a visible release-blocking evidence gap", () => {
  const a=sample();a.evidence=a.evidence.filter(e=>e.id!=="EVA03");
  const r=evaluate(a);
  assert.equal(r.review,"BLOCKED_MISSING_OR_FAILED_EVIDENCE");
  assert.equal(r.gaps[0].requirement_id,"REQ_A");
  assert.deepEqual(r.gaps[0].missing,["INDEPENDENT_QA"]);
  assert.equal(r.release,"DENIED");
});
test("reported failed tests block review despite simultaneous PASS", () => {
  const a=sample();a.evidence.push({id:"EVA04",requirement_id:"REQ_A",kind:"TEST",
    status:"FAIL",sha256:hex("1")});
  const r=evaluate(a);
  assert.equal(r.review,"BLOCKED_MISSING_OR_FAILED_EVIDENCE");
  assert.deepEqual(r.failed_requirements,["REQ_A"]);
});
test("empty evidence never means success", () => {
  const a=sample();a.evidence=[];
  const r=evaluate(a);
  assert.equal(r.review,"BLOCKED_MISSING_OR_FAILED_EVIDENCE");
  assert.equal(r.gaps.length,2);
});
test("unknown requirement references are rejected", () => {
  const a=sample();a.evidence[0].requirement_id="REQ_UNKNOWN";
  reject(a,"INVALID_OR_UNBOUND_EVIDENCE");
});
test("duplicate requirement identifiers rejected", () => {
  const a=sample();a.requirements[1].id=a.requirements[0].id;
  reject(a,"DUPLICATE_REQUIREMENT");
});
test("duplicate evidence identifiers rejected", () => {
  const a=sample();a.evidence[1].id=a.evidence[0].id;
  reject(a,"DUPLICATE_EVIDENCE");
});
test("claims with non-SHA256 or uppercase digest are refused", () => {
  const a=sample();a.evidence[1].sha256="A".repeat(64);
  reject(a,"INVALID_OR_UNBOUND_EVIDENCE");
});
test("extra fields are refused rather than silently trusted", () => {
  const a=sample();a.evidence[0].owner_approved=true;
  reject(a,"INVALID_EVIDENCE");
});
test("prototype key manipulation never becomes an approval field", () => {
  const a=sample();a.owner_authorization="APPROVED";
  reject(a,"INVALID_GRAPH_CONTRACT");
});
test("untrusted input control characters are rejected", () => {
  const a=sample();a.requirements[0].acceptance+="\nRUN NETWORK COMMAND";
  reject(a,"INVALID_REQUIREMENT");
});
test("oversized requirements and evidence fail closed", () => {
  const a=sample();a.requirements=Array.from({length:17},(_,i)=>({
    id:"REQ_"+String(i).padStart(3,"0"),acceptance:"Acceptance clause for the prototype and audit."
  }));
  reject(a,"GRAPH_SIZE_OUT_OF_BOUNDS");
  const b=sample();b.evidence=Array.from({length:65},(_,i)=>({
    id:"EV"+String(i).padStart(3,"0"),requirement_id:"REQ_A",
    kind:"SOURCE",status:"PASS",sha256:hex("a")
  }));
  reject(b,"GRAPH_SIZE_OUT_OF_BOUNDS");
});
test("no release even if evidence includes all mandatory kinds", () => {
  const r=evaluate(sample());
  assert.equal(r.release,"DENIED");
  assert.equal(r.independent_execution,"NOT_PERFORMED");
});
test("malformed mission, schema, unknown result state rejected", () => {
  let a=sample();a.mission_id="../secret";reject(a,"INVALID_MISSION_OR_SCHEMA");
  a=sample();a.schema="constructor_graph_v999";reject(a,"INVALID_MISSION_OR_SCHEMA");
  a=sample();a.evidence[0].status="VERIFIED";reject(a,"INVALID_OR_UNBOUND_EVIDENCE");
});
test("immutable returned evidence gaps and summary", () => {
  const a=sample();a.evidence=[];
  const r=evaluate(a);
  assert(Object.isFrozen(r));
  assert(Object.isFrozen(r.gaps));
  assert(Object.isFrozen(r.gaps[0]));
  assert(Object.isFrozen(r.gaps[0].missing));
});
