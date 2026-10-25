# ProofGraph v1 + Pinned Ed25519 Witness v1

## Architecture boundary

This branch introduces **two first-party libraries**:
- [Intent Proof Graph](../engineering/intent-proof-graph.mjs): exact bounded requirement/evidence contract, deterministic graph SHA-256, missing proof/failed evidence map. It accepts **untrusted evidence claims** and always returns `release: "DENIED"`.
- [Pinned Proof Witness](../engineering/proof-witness.mjs): verifies an Ed25519 signature over a short-lived canonical envelope that binds a specific claim to the graph hash, mission, requirement, evidence ID, evidence kind, verdict, artifact hash, role, time window and nonce. Independent trusted key pins are externally supplied.

No application execution, source-byte verification, server-side identity, key issuance or release authority is implemented here. All demonstration fixtures are synthetic.

## Contract and trust input

Graph schema: `constructor_intent_proof_graph_v1`. Witness schema: `constructor_proof_witness_v1`. Each signed envelope has 12 canonical payload fields plus `signature_b64url` and requires the exact order-independent canonical serialization defined in `witnessSigningPayload`.

The caller passes:
- the **entire original graph** (not just a claimed hash);
- one signed witness for each graph evidence claim;
- two independently **pre-pinned** Ed25519 public keys with explicit roles `builder` and `qa`;
- a trusted local clock and a mutable nonce set.

SOURCE and TEST witnesses must validate under the builder's pinned key; INDEPENDENT_QA under the QA key. Reusing a key is rejected. The module checks signatures, exact graph binding, expiration, duplicate evidence and nonce replay, then consumes nonces **only after all checks pass**.

An out-of-band trust process must pin the public keys; accepting a caller's own arbitrary pins does not establish authorized personnel. Different keypairs do not establish different human reviewers.

## Return states

When all signatures validate, the result reads `cryptographic_status: "PINNED_ED25519_SIGNATURES_VERIFIED"`. Missing coverage and reported failures still block evidence review through the graph.

**Always:**
```json
{"release":"DENIED","independent_qa_execution":"NOT_VERIFIED","artifact_byte_integrity":"NOT_VERIFIED","owner_approval":"NOT_VERIFIED","replay_protection":"IN_MEMORY_ONLY"}
```

A graph can be `READY_FOR_HUMAN_EVIDENCE_REVIEW`; it is never `READY_FOR_RELEASE` under this protocol.

## Real threat model

| Threat | Current deterministic control | Missing for production |
|---|---|---|
| Reordered / edited graph | Canonical SHA-256 graph fingerprint; signed graph binding | Signed owner IntentLock / immutable intake |
| Forged evidence field | Signature check with externally pinned Ed25519 key | Trusted QA execution and file/log hash capture |
| QA and builder same signing key | Distinct pinned key requirement | Organizational / human independence attestation |
| Replay | Per-process nonce Set; 5-minute max envelope TTL | Durable shared transactional nonce registry |
| Wrong requirement / artifact | ID, kind, status and SHA bound to exact graph | Real byte-stream verification and signed test logs |
| Manipulated release claim | Reject unknown keys; release always denied | Explicit owner-signed release permit + audited gateway |
| Arbitrary untrusted code | No code execution in either module | Hardened sandbox with independent security review |

## Acceptance and reproducibility

```bash
node --test test/intent-proof-graph.test.js test/proof-witness.test.js
npm run proof:graph:demo
npm run verify
```

Negative-path suites cover altered SHA, wrong graph, forged approval fields, duplicate IDs/nonces, missing signatures, wrong key, wrong role, expired/future timestamps and failed evidence.

The code is **reference software**, not production cryptographic identity infrastructure. It does not handle key revocation, filesystem races, durability or audit-ledger retention. Use it only for authorized offline engineering until those gaps are closed.
