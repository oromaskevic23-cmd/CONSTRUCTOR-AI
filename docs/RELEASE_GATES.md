# CONSTRUCTOR AI — Release Gates and Incident Rollback

**Current target:** Browser Task Manager reference `0.1.0`. Platform v1.0 and verified autonomous generation are **not released**.

## Required acceptance ladder

- **Gate 0 — Review:** source control provenance, scope, IP/license and owner approval for publication.
- **Gate 1 — Syntax / Unit:** `npm run check` and `npm test` must pass on the exact commit.
- **Gate 2 — Reference HTTP:** built-in smoke test checks allowlisted asset responses and denied methods/paths.
- **Gate 3 — Source inventory:** `node tools/verify.mjs` lists SHA-256 inputs, but the inventory is not a signed attestation.
- **Gate 4 — Browser acceptance:** manual or automated browser verification (data persistence, keyboard access, 250-task limit and no HTML execution). **NOT YET VERIFIED**.
- **Gate 5 — AI Pipeline:** verified model response → scoped mission → isolated build → tests → independent QA → authorization. **BLOCKED / NOT YET VERIFIED**.
- **Gate 6 — Production:** operational infrastructure, credential isolation, audit, monitoring, approved rollback, release signature. **NOT YET VERIFIED**.

**Fail closed:** never publish a “verified autonomous app” when Gate 5 has not passed.

## Gate 3a — AI plan-only adapter

Validated LLM response contracts and short-lived local HMAC permits are now implemented as source and covered by tests. They prove input validation and local permission logic only. Mock transport cannot verify external provider authentication, inference cost, real AI output quality or deployment. Live Groq invocation is intentionally blocked when `GROQ_API_KEY`, `GROQ_MODEL` or `PLAN_AUTH_KEY` is absent.

Explicit status: **E2 source and E3 test evidence when CI succeeds; NOT E5 model-integrated runtime.** No arbitrary code execution or release path has been authorized.

## Gate 3b — Quarantine-only packaging (v0.3)

AI-drafted source can be saved without running it. The package includes file SHA-256 checks, a checksum of the manifest and an independent read-back consistency verifier. Static flags can require further QA or block possible secrets; they do not prove safety. Mock provider integration tests do **not** establish real Groq inference or true AI-generated application delivery. All release decisions remain DENIED. Production-ready signatures, hardened isolation and independent audit are NOT IMPLEMENTED.

## Gate 3c — Real bounded container test receipts (review branch only)

`feat/proofgraph-investor-technical-20261025` contains the [isolated Docker executor](../engineering/isolated-executor.mjs) and [isolation runbook](ISOLATED_EXECUTION.md). GitHub Actions run [40192567513](https://github.com/oromaskevic23-cmd/CONSTRUCTOR-AI/actions/runs/40192567513) completed **117/117 tests PASS** and a distinct **real Docker isolation smoke job**. It executes an intentionally synthetic test with network disabled and strict resource limits, then attaches actual output/exit-code receipts to ProofGraph SOURCE/TEST records; the missing independent QA remains visible and release DENIED.

This does **not** satisfy Gate 5: no real LLM-generated application was built and tested through the complete pipeline, no independent QA executor, owner-signed release permit or VM-grade untrusted-code sandbox has been verified. Docker is a host-kernel-sharing isolation reference; proper production isolation and artifact provenance require additional engineering.

## Gate 3d — Separate signed CI QA (reference accepted; Gate 5 remains blocked)

New review-branch modules [QA chain](../engineering/qa-chain.mjs) and [independent CI QA runbook](INDEPENDENT_CI_QA.md) now demonstrate **134/134 tests PASS and 4 GitHub Actions jobs SUCCESS** on [run 40193519823](https://github.com/oromaskevic23-cmd/CONSTRUCTOR-AI/actions/runs/40193519823), with signed builder/QA receipts and an independent third verification job. This is *synthetic evidence in separately executed CI stages*. Self-issued keys do not prove reviewer identity or authorization. Actual LLM generated applications, external trust roots and VM guest execution remain **NOT VERIFIED**. Release stays DENIED.

## Gate 3e — Local GGUF and VM receipt contracts (prototype ONLY)

The [real-model / protected VM engineering path](REAL_LLM_VM_GATES.md) adds a model-weight SHA pin, explicitly authorized local inference command, strict source-admission inspection and a pinned-key VM claim verifier. Contract tests are runnable in CI **without a model download or real VM**, so a PASS here is evidence of fail-closed input contracts only. No Gate 5 acceptance or real full-stack AI-generated app is implied. VM operator signatures are distinct from authenticated guest measurements. The owner release gate remains **DENIED**.

## Rollback

Revert or deploy a previously verified commit SHA, and re-execute the full check suite. Browser-only localStorage data may be incompatible between future releases; preserve data migration design before changing storage schema. Production rollback is not implemented by this reference repo.

## Ownership

Product author attribution: Alexander Romaskevich (RomaskevicH); one-human founder-led project with LLM assistance. This document does not constitute a legal company incorporation, signed auditor report or patent.
