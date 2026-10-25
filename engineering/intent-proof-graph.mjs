// CONSTRUCTOR AI — first-party requirement-to-evidence traceability.
// No execution, attestation, model inference, authorization or release is performed.
import {createHash} from "node:crypto";

export const PROOF_GRAPH_SCHEMA = "constructor_intent_proof_graph_v1";
const REQUIREMENT_ID = /^[A-Z][A-Z0-9_-]{2,39}$/;
const MISSION_ID = /^[A-Za-z0-9_-]{6,72}$/;
const SHA256 = /^[a-f0-9]{64}$/;
const KINDS = Object.freeze(["SOURCE", "TEST", "INDEPENDENT_QA"]);
const REQUIRED = Object.freeze(["SOURCE", "TEST", "INDEPENDENT_QA"]);

export class IntentProofError extends Error {
  constructor(code) { super(code); this.name = "IntentProofError"; this.code = code; }
}

function shape(obj, keys, code) {
  if (!obj || typeof obj !== "object" || Array.isArray(obj) ||
      Object.getPrototypeOf(obj) !== Object.prototype ||
      Object.keys(obj).length !== keys.length ||
      keys.some(key => !Object.hasOwn(obj, key))) {
    throw new IntentProofError(code);
  }
}
const digest = data => createHash("sha256").update(data, "utf8").digest("hex");
const isText = (value, max) => typeof value === "string" &&
  value.length >= 12 && value.length <= max &&
  !/[\u0000-\u001f\u007f]/.test(value) && value.trim() === value;

export function evaluateIntentProofGraph(input) {
  shape(input, ["schema", "mission_id", "requirements", "evidence"], "INVALID_GRAPH_CONTRACT");
  if (input.schema !== PROOF_GRAPH_SCHEMA ||
      !MISSION_ID.test(input.mission_id ?? "")) {
    throw new IntentProofError("INVALID_MISSION_OR_SCHEMA");
  }
  if (!Array.isArray(input.requirements) ||
      input.requirements.length < 1 || input.requirements.length > 16 ||
      !Array.isArray(input.evidence) || input.evidence.length > 64) {
    throw new IntentProofError("GRAPH_SIZE_OUT_OF_BOUNDS");
  }
  const requirements = input.requirements.map(item => {
    shape(item, ["id", "acceptance"], "INVALID_REQUIREMENT");
    if (!REQUIREMENT_ID.test(item.id ?? "") || !isText(item.acceptance, 300)) {
      throw new IntentProofError("INVALID_REQUIREMENT");
    }
    return {id:item.id, acceptance:item.acceptance};
  }).sort((a,b) => a.id.localeCompare(b.id, "en"));
  const ids = new Set(requirements.map(r => r.id));
  if (ids.size !== requirements.length) throw new IntentProofError("DUPLICATE_REQUIREMENT");
  const seenEvidence = new Set();
  const evidence = input.evidence.map(item => {
    shape(item, ["id", "requirement_id", "kind", "status", "sha256"], "INVALID_EVIDENCE");
    if (!REQUIREMENT_ID.test(item.id ?? "") || !ids.has(item.requirement_id) ||
        !KINDS.includes(item.kind) || !["PASS", "FAIL"].includes(item.status) ||
        !SHA256.test(item.sha256 ?? "")) {
      throw new IntentProofError("INVALID_OR_UNBOUND_EVIDENCE");
    }
    if (seenEvidence.has(item.id)) throw new IntentProofError("DUPLICATE_EVIDENCE");
    seenEvidence.add(item.id);
    return {id:item.id, requirement_id:item.requirement_id, kind:item.kind,
      status:item.status, sha256:item.sha256};
  }).sort((a,b) => a.id.localeCompare(b.id, "en"));

  const requirementsWithGaps = [];
  const failures = [];
  for (const r of requirements) {
    const related = evidence.filter(x => x.requirement_id === r.id);
    const passedKinds = new Set(related.filter(x => x.status === "PASS").map(x => x.kind));
    const missing = REQUIRED.filter(kind => !passedKinds.has(kind));
    if (missing.length) requirementsWithGaps.push(Object.freeze({
      requirement_id:r.id, missing:Object.freeze(missing)
    }));
    if (related.some(x => x.status === "FAIL")) failures.push(r.id);
  }
  const normalized = JSON.stringify({schema:PROOF_GRAPH_SCHEMA,mission_id:input.mission_id,
    requirements,evidence});
  const review = requirementsWithGaps.length === 0 && failures.length === 0
    ? "READY_FOR_HUMAN_EVIDENCE_REVIEW" : "BLOCKED_MISSING_OR_FAILED_EVIDENCE";
  // A caller-supplied PASS label or SHA-256 is never a trusted execution or QA attestation.
  return Object.freeze({
    schema:PROOF_GRAPH_SCHEMA, mission_id:input.mission_id,
    graph_sha256:digest(normalized),
    requirements:requirements.length, evidence_items:evidence.length,
    review, release:"DENIED",
    gaps:Object.freeze(requirementsWithGaps),
    failed_requirements:Object.freeze([...new Set(failures)].sort()),
    provenance:"UNATTESTED_EXTERNAL_CLAIMS",
    independent_execution:"NOT_PERFORMED",
    owner_authorization:"NOT_VERIFIED"
  });
}
