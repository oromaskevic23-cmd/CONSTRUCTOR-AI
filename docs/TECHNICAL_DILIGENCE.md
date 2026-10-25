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
# Requires reviewed local Docker image ID:
npm run isolated:demo
```

Compare the checked-out HEAD SHA with [PR #5](https://github.com/oromaskevic23-cmd/CONSTRUCTOR-AI/pull/5) and the [PR CI run list](https://github.com/oromaskevic23-cmd/CONSTRUCTOR-AI/actions). If the branch is modified after a cited test, rerun CI and cite the new exact SHA. No customer credentials or external model key is required.

## Independently replayed QA — separate CI process

The [signed QA-chain run 40193519823](https://github.com/oromaskevic23-cmd/CONSTRUCTOR-AI/actions/runs/40193519823) contains four passing jobs, including a separate `independent-qa` Docker execution and `proof-audit` verification. [Reproduce and inspect the receipt chain](INDEPENDENT_CI_QA.md). Signature correctness and role separation are verified. A newer [run 40194038803](https://github.com/oromaskevic23-cmd/CONSTRUCTOR-AI/actions/runs/40194038803) also confirms GitHub OIDC/Sigstore workflow provenance for both artifacts. **The GitHub workflow identity is authenticated; a separate human reviewer or VM guest attestation is not.**

## Additional real-container engineering evidence

[GitHub Actions run 40192567513](https://github.com/oromaskevic23-cmd/CONSTRUCTOR-AI/actions/runs/40192567513) on `aeb7451c728dddc09442fb21b7083683fbc66b5a` completed successfully: **117/117 Node tests PASS** and separate **docker-isolation SUCCESS**. The actual container test executed a synthetic arithmetic check and checked runtime restrictions: non-root UID, root/source write failures, missing Docker socket and blocked outbound network. The Actions artifact `isolated-execution-evidence.json` records the local immutable image ID, process exit code, output SHA-256, graph digest, missing QA and release DENIED. It is bounded execution evidence, **not a privileged-host-independent attestation or hostile-code VM certification**.

## Diligence layers

| Gate | Reproduction / artifact | What this does not prove |
|---|---|---|
| Working UI | [Task Manager](../index.html), [task logic](../src/tasks.js), HTTP tests | Backend multi-tenancy or deployability |
| Planning model contract | [AI gateway](../engineering/groq-gateway.mjs) and mock tests | Live provider inference, output quality or model cost |
| Quarantined source | [Artifact verifier](../engineering/proof-bundle.mjs) and tamper tests | Executable sandbox, authentic origin |
| Acceptance-to-proof traceability | [ProofGraph](../engineering/intent-proof-graph.mjs) and adversarial tests | Evidence is genuine or independently reviewed |
| Cryptographically bound witness | [Proof Witness](../engineering/proof-witness.mjs), Ed25519 tests | Separate human QA, owner identity or durable replay protection |
| Actual bounded Docker test | [Isolated executor](../engineering/isolated-executor.mjs), [real Docker CI](../.github/workflows/ci.yml) | VM-grade hardened sandbox, durable signed logs or independent QA |
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

## Experimental model and VM gates — do not overstate

[Technical requirements and strictly opt-in commands](REAL_LLM_VM_GATES.md). The Qwen adapter and externally pinned VM operator-claim verifier are present with negative-path tests. No real model weight was run in the evidenced CI jobs; no separate hardened VM guest was booted. Synthetic admission and operator-signature fixture tests cannot be used to claim full app-generation acceptance.

## Planned milestone ladder — NOT shipped

B1 real model inference → B2 authorized isolated executor → B3 independent signed QA / trusted proof bytes → B4 owner-signed release permit & durable audit → B5 complete Task Manager, CRM and Dashboard acceptance → B6 real-world pilots, paid customer acceptance, verified settlement and production operations.

**Zero Trust · FREE_ONLY · Provenance before claims · Final architectural authority remains with the owner.**
