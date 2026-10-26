// Deterministic synthetic showcase. Does NOT claim any real evidence or QA.
import {evaluateIntentProofGraph, PROOF_GRAPH_SCHEMA} from "../engineering/intent-proof-graph.mjs";
const requirements=[{id:"REQ_CREATE",acceptance:"A user can create a valid local task in the demo."}];
const make=(id,kind,digest)=>({id,kind,requirement_id:"REQ_CREATE",status:"PASS",sha256:digest.repeat(64)});
const base={schema:PROOF_GRAPH_SCHEMA,mission_id:"SYNTHETIC-DEMO-001",requirements,
  evidence:[make("EVID_SOURCE","SOURCE","a"),make("EVID_TEST","TEST","b")]};
const missingQa=evaluateIntentProofGraph(base);
const full=evaluateIntentProofGraph({...base,evidence:[...base.evidence,make("EVID_QA","INDEPENDENT_QA","c")]});
console.log(JSON.stringify({
  disclaimer:"SYNTHETIC FIXTURES ONLY — no real QA, execution, release or customer",
  before:{review:missingQa.review,gaps:missingQa.gaps,release:missingQa.release},
  after:{review:full.review,gaps:full.gaps,release:full.release,
    provenance:full.provenance,owner_authorization:full.owner_authorization},
  conclusion:"Even complete self-reported proof remains RELEASE_DENIED pending genuine independent verification and owner-controlled release engineering."
},null,2));
