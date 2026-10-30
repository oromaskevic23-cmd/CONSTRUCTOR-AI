# Upstream Analysis Gates — CONSTRUCTOR AI

**Status:** functional, read-only local adapter contracts and synthetic tests;
no external provider installed into CONSTRUCTOR AI production.

## Understand Anything graph import

Source: `engineering/ua-graph-adapter.mjs`
based on upstream
[Egonex-AI/Understand-Anything](https://github.com/Egonex-AI/Understand-Anything)
`KnowledgeGraph` contract; pinned upstream commit
`4e6d3299017a7432da15957874992837a315c5b4` (MIT).

Pass **an exported** `.ua/knowledge-graph.json` as a UTF-8 string and
the **expected full Git commit SHA for the project being analysed**.
The adapter verifies the graph's claimed project commit, validates node IDs,
edge endpoints, allowed types/weights and safe relative paths, and computes
reverse dependency reachability as a **possible change-impact list**.
The result contains a SHA-256 of the supplied graph, not a digital signature
or proof that an LLM's inferred edges are correct.

Untrusted node summaries, code and instructions are never evaluated or
returned. No source repository is uploaded or analyzed automatically.
Node/edge limits are enforced. There is no automatic source rewrite,
deployment, remote fetch, token consumption or claim of verified impact.

## ARTEMIS Android test-only plan

Source: `engineering/artemis-qa-gate.mjs`. Upstream:
[google/artemis](https://github.com/google/artemis), pinned revision
`351ca8422f7b5b54e80a9c1ce03a222e02415b6b`
(Apache-2.0).

An offline plan includes explicit allowlisted QA checks but marks every
device test `BLOCKED_DEVICE_REQUIRED`. No ADB, emulator, MCP, USB, network
or model access is attempted. A real device run requires:
- A dedicated, explicitly authorized Android test device/emulator.
- Isolated workspace and credential-free test account, with no customer data.
- HANTER federated team routing and live AI Passport/Enterprise Skills.
- Guardian Core, Approval Gateway, Owner Kill Switch and Audit Ledger.
- A signed evidence record, independent QA and Architect release decision.

Run `npm run verify`. These new local tests exercise contract acceptance,
stale source/project revision rejection, path and tenant boundaries and
zero-device defaults. They are not equivalent to AndroidWorld benchmarks.

## Attribution and security

Upstream source and licenses are preserved; no third-party source code is
copied. The existing IMPERIAL Public/Private Boundary, ZERO TRUST,
FREE_ONLY and CRYPTO IMPERIAL Ecosystem Boundary are preserved.
Architect → HANTER → Federated Orchestrators → NCA teams remains canonical.
