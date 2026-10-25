// CONSTRUCTOR AI: bounded, signed witness verification for existing ProofGraph.
// Signature != actual test execution, trusted human identity or release authorization.
import {createHash, createPublicKey, verify, timingSafeEqual} from "node:crypto";
import {evaluateIntentProofGraph, IntentProofError} from "./intent-proof-graph.mjs";

export const PROOF_WITNESS_SCHEMA = "constructor_proof_witness_v1";
const SHA256=/^[a-f0-9]{64}$/;
const NONCE=/^[A-Za-z0-9_-]{16,96}$/;
const B64URL=/^[A-Za-z0-9_-]{86}$/;
const FIELDS=["schema","mission_id","graph_sha256","evidence_id",
  "requirement_id","kind","status","artifact_sha256","role",
  "issued_at_ms","expires_at_ms","nonce","signature_b64url"];
const SIGNED_FIELDS=FIELDS.filter(x=>x!=="signature_b64url");
const WINDOW_MS=300000;

export class WitnessError extends Error {
  constructor(code){super(code);this.name="WitnessError";this.code=code;}
}
function exact(obj, keys, code) {
  if(!obj || typeof obj!=="object" || Array.isArray(obj) ||
     Object.getPrototypeOf(obj)!==Object.prototype ||
     Object.keys(obj).length!==keys.length || keys.some(k=>!Object.hasOwn(obj,k)))
    throw new WitnessError(code);
}
function fingerprint(key) {
  return createHash("sha256").update(key.export({type:"spki",format:"der"})).digest("hex");
}
function trustedKey(record) {
  exact(record,["public_key_pem","pinned_spki_sha256"],"INVALID_TRUST_RECORD");
  if(typeof record.public_key_pem!=="string" || record.public_key_pem.length>4096 ||
     !SHA256.test(record.pinned_spki_sha256??""))throw new WitnessError("INVALID_TRUST_RECORD");
  let key;
  try {key=createPublicKey(record.public_key_pem);}
  catch {throw new WitnessError("INVALID_PUBLIC_KEY");}
  if(key.asymmetricKeyType!=="ed25519")throw new WitnessError("ED25519_KEY_REQUIRED");
  const actual=Buffer.from(fingerprint(key),"hex");
  const claimed=Buffer.from(record.pinned_spki_sha256,"hex");
  if(!timingSafeEqual(actual,claimed))throw new WitnessError("PUBLIC_KEY_PIN_MISMATCH");
  return {key,pin:record.pinned_spki_sha256};
}

// Exposes canonical bytes for separately trusted signer clients.
// No private signing key is held, generated or requested by this module.
export function witnessSigningPayload(envelope) {
  exact(envelope,SIGNED_FIELDS,"INVALID_SIGNING_PAYLOAD");
  if(envelope.schema!==PROOF_WITNESS_SCHEMA ||
     !SHA256.test(envelope.graph_sha256??"") ||
     !SHA256.test(envelope.artifact_sha256??"") ||
     !NONCE.test(envelope.nonce??"") ||
     !["BUILDER","QA"].includes(envelope.role) ||
     !Number.isSafeInteger(envelope.issued_at_ms) ||
     !Number.isSafeInteger(envelope.expires_at_ms) ||
     envelope.expires_at_ms <= envelope.issued_at_ms ||
     envelope.expires_at_ms-envelope.issued_at_ms>WINDOW_MS)
    throw new WitnessError("INVALID_SIGNING_PAYLOAD");
  return Buffer.from(JSON.stringify(SIGNED_FIELDS.reduce((p,k)=>{
    p[k]=envelope[k];return p;
  },{})),"utf8");
}

/**
 * Caller must independently provision/pin both public keys. Distinct key bytes
 * only prove cryptographic separation, not separate people or genuine QA work.
 * Nonces are memory-only: restarting loses replay state.
 * No raw source files or logs are opened, no arbitrary commands are run.
 */
export function verifyProofWitnesses({graph,witnesses,trust,now=Date.now(),consumedNonces}={}) {
  let assessed;
  try {assessed=evaluateIntentProofGraph(graph);}
  catch(err){if(err instanceof IntentProofError)throw new WitnessError("INVALID_GRAPH");throw err;}
  exact(trust,["builder","qa"],"TRUST_POLICY_REQUIRED");
  const builder=trustedKey(trust.builder);
  const qa=trustedKey(trust.qa);
  if(builder.pin===qa.pin)throw new WitnessError("INDEPENDENT_KEY_REQUIRED");
  if(!(consumedNonces instanceof Set))throw new WitnessError("REPLAY_STATE_REQUIRED");
  if(!Number.isSafeInteger(now) || !Array.isArray(witnesses) ||
     witnesses.length!==graph.evidence.length || witnesses.length>64)
    throw new WitnessError("WITNESS_COUNT_MISMATCH");
  const mapped=new Map(graph.evidence.map(e=>[e.id,e]));
  const seenIds=new Set(),seenNonces=new Set();
  for(const w of witnesses) {
    exact(w,FIELDS,"INVALID_WITNESS_ENVELOPE");
    const original=mapped.get(w.evidence_id);
    if(!original || seenIds.has(w.evidence_id))throw new WitnessError("UNBOUND_OR_DUPLICATE_WITNESS");
    seenIds.add(w.evidence_id);
    if(w.mission_id!==graph.mission_id || w.graph_sha256!==assessed.graph_sha256 ||
       w.requirement_id!==original.requirement_id || w.kind!==original.kind ||
       w.status!==original.status || w.artifact_sha256!==original.sha256)
      throw new WitnessError("WITNESS_GRAPH_BINDING_MISMATCH");
    const expectedRole=w.kind==="INDEPENDENT_QA"?"QA":"BUILDER";
    if(w.role!==expectedRole)throw new WitnessError("WITNESS_ROLE_MISMATCH");
    if(!Number.isSafeInteger(w.issued_at_ms) ||
       w.issued_at_ms>now+5000 || w.expires_at_ms<=now)
      throw new WitnessError("WITNESS_EXPIRED_OR_FUTURE");
    const payload=witnessSigningPayload(Object.fromEntries(SIGNED_FIELDS.map(k=>[k,w[k]])));
    if(!B64URL.test(w.signature_b64url??""))throw new WitnessError("INVALID_SIGNATURE_FORMAT");
    const sig=Buffer.from(w.signature_b64url,"base64url");
    if(sig.length!==64)throw new WitnessError("INVALID_SIGNATURE_FORMAT");
    const verifier=(w.role==="QA"?qa:builder).key;
    if(!verify(null,payload,verifier,sig))throw new WitnessError("INVALID_WITNESS_SIGNATURE");
    if(seenNonces.has(w.nonce) || consumedNonces.has(w.nonce))
      throw new WitnessError("WITNESS_NONCE_REPLAY");
    seenNonces.add(w.nonce);
  }
  if(seenIds.size!==mapped.size)throw new WitnessError("INCOMPLETE_WITNESS_COVERAGE");
  // Replay state changes only after every envelope passes signature and scope checks.
  for(const n of seenNonces)consumedNonces.add(n);
  return Object.freeze({
    schema:"constructor_witness_verification_result_v1",
    mission_id:graph.mission_id,
    graph_sha256:assessed.graph_sha256,
    signatures_verified:seenIds.size,
    cryptographic_status:"PINNED_ED25519_SIGNATURES_VERIFIED",
    role_separation:"DISTINCT_PINNED_KEYS_NOT_INDEPENDENT_PEOPLE",
    evidence_review:assessed.review,
    release:"DENIED",
    independent_qa_execution:"NOT_VERIFIED",
    artifact_byte_integrity:"NOT_VERIFIED",
    owner_approval:"NOT_VERIFIED",
    replay_protection:"IN_MEMORY_ONLY"
  });
}
