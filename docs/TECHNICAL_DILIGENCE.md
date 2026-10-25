# Independent technical diligence — CONSTRUCTOR AI

This is a checklist of verifiable capabilities and gaps for technical evaluators, partners and investors. This file is not an investment solicitation, external audit, incorporation statement or independently certified security assessment.

## Verify at exact review revision

```bash
git clone https://github.com/oromaskevic23-cmd/CONSTRUCTOR-AI.git
cd CONSTRUCTOR-AI
git fetch origin pull/5/head:review-proofgraph
git switch review-proofgraph
node --version     # 22+
npm run verify
npm run proof:graph:demo
npm run proof:passport:demo
```

Compare the checked-out HEAD SHA with [PR #5](https://github.com/oromaskevic23-cmd/CONSTRUCTOR-AI/pull/5) and the [PR CI run list](https://github.com/oromaskevic23-cmd/CONSTRUCTOR-AI/actions). If the branch is modified after a cited test, rerun CI and cite the new exact SHA. No customer credentials or external model key is required.

## Diligence layers

| Gate | Reproduction / artifact | What this does not prove |
|---|---|---|
| Working UI | [Task Manager](../index.html), [task logic](../src/tasks.js), HTTP tests | Backend multi-tenancy or deployability |
| Planning model contract | [AI gateway](../engineering/groq-gateway.mjs) and mock tests | Live provider inference, output quality or model cost |
| Quarantined source | [Artifact verifier](../engineering/proof-bundle.mjs) and tamper tests | Executable sandbox, authentic origin |
| Acceptance-to-proof traceability | [ProofGraph](../engineering/intent-proof-graph.mjs) and adversarial tests | Evidence is genuine or independently reviewed |
| Cryptographically bound witness | [Proof Witness](../engineering/proof-witness.mjs), Ed25519 tests | Separate human QA, owner identity or durable replay protection |
| Release approval | All new components return DENIED | Owner-authorized production shipping |
| Public adoption / business | No verified customer metrics in this repository | Market traction, net revenue, legal incorporation |

## Investor-specific falsification tests

1. Alter a requirement without changing a witness: signature/graph binding must reject it.
2. Use the same Ed25519 key as both builder and QA: verification must fail.
3. Attach a second FAIL alongside a PASS: review must remain blocked.
4. Delete an INDEPENDENT_QA record: a graph can never be accepted as release-ready.
5. Reuse a verified nonce inside the same process: reject replay.
6. Send a spoofed `owner_approved: true` field: reject noncanonical input.
7. Show an independently reviewed customer application with real signed logs: **not yet possible under this reference**.

## Planned milestone ladder — NOT shipped

B1 real model inference → B2 authorized isolated executor → B3 independent signed QA / trusted proof bytes → B4 owner-signed release permit & durable audit → B5 complete Task Manager, CRM and Dashboard acceptance → B6 real-world pilots, paid customer acceptance, verified settlement and production operations.

**Zero Trust · FREE_ONLY · Provenance before claims · Final architectural authority remains with the owner.**
