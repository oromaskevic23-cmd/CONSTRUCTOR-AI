# CONSTRUCTOR AI — Reproducible Competitive Evaluation Contract

**Architect and original author:** Alexander Nikolaevich Romaskevich (RomaskevicH)
**Date:** 2026-11-07
**Status:** BENCHMARK CONTRACT AND OFFLINE SCORER IMPLEMENTED; REAL COMPARATIVE TRIALS NOT PERFORMED.

## Purpose and test inventory

The goal is to measure CONSTRUCTOR AI against Cursor and Hermes Agent, not to claim superiority from feature lists. The first catalog contains **20 original synthetic tasks**: application creation (5), maintenance (5), security (3), recovery (3), integration (2), and accessibility (2). Every prompt contains original IMPERIAL Core acceptance criteria, not customer data or third-party copied source.

The catalog is a **task specification**, not a runnable held-out test suite. Independently authored, hash-locked executable acceptance tests are still needed for each task before a meaningful trial.

- [Task catalog](../benchmarks/locked-tasks-v1.json)
- [Offline validator and scorecard](../engineering/competitive-scorecard.mjs)
- [Read-only CLI](../tools/score-competitors.mjs)
- [Adversarial regression tests](../test/competitive-scorecard.test.mjs)

## Reproducible evaluation contract

1. Hash and freeze the catalog bytes, then independently author and hash hidden acceptance tests **before** candidate execution. Keep tests inaccessible to the model under test.
2. Record actual product version and source revision (where available), selected model, hardware, network policy, tool policy, time budget, total monetary budget and human-intervention limit.
3. Compare identical prompts, data, permissions, and where possible comparable models and resources. Use official software under approved provider terms; do not copy or fork third-party repositories.
4. For each task capture raw artifact SHA-256, independently executed QA log hash, status `PASS`/`FAIL`/`NOT_RUN`, elapsed time, measured micro-USD cost, interventions and unauthorized side effects. Do not invent cost or execution logs.
5. Aggregate costs are bounded across all 20 tasks. A report with any unauthorized effect cannot present passing task outcomes. Missing, duplicate, fabricated-format or out-of-scope task claims fail validation.
6. The initial scorecard **validates input structure only**. A claimed artifact digest does not establish that the artifact exists; `testSuiteIndependent=true` does not prove real independent QA. Every report is marked `STRUCTURALLY_VALID_SELF_REPORTED_NOT_INDEPENDENTLY_ATTESTED`.
7. The comparison output **always** says `NO_VERIFIED_WINNER` and `superiorityClaimAuthorized=false` until a future independent evidence-verification and release process is built.

## Offline use

```sh
node --test test/competitive-scorecard.test.mjs
node tools/score-competitors.mjs benchmarks/locked-tasks-v1.json actual-constructor-run.json
node tools/score-competitors.mjs benchmarks/locked-tasks-v1.json actual-constructor-run.json actual-cursor-run.json
```

The referenced `actual-*.json` reports are intentionally **not included**: no independent real comparative trial results have been provided. Synthetic test fixtures in CI are not a genuine product benchmark.

## Architecture, resources and commercial boundaries

Architect → HANTER Command Center → federated domain orchestrators → professional NCA → VELION → isolated work → independent QA → ProofGraph / Audit Ledger → Owner-controlled Approval Gateway.

AI Passport, Enterprise Skills, Guardian Core, Owner Kill Switch, IntentLock, Zero Trust, Public/Private Boundary and CRYPTO IMPERIAL Ecosystem Boundary remain required for any actual NCA worker or external Skills/Plugins/MCP invocation. The scorer does not implement or bypass those controls.

**FREE_ONLY:** Node.js standard library only, no HTTP requests, no models, no API credits, no scheduled Supabase job, no persistent process and no customer outreach. The path-scoped CI is bounded to four minutes; provider GitHub Actions quotas still require separate monitoring.

**Commercial status:** The founder's USD 5 million acquisition objective is a target, not a proven valuation. No real customer, contract, payment, verified buyer interest, product superiority or release approval is implied by these files.

**Project boundary:** SHPAIZMAN is separate and belongs to the Architect's brother. No SHPAIZMAN data, agents, servers, credentials, repos or customer leads are accessed or connected.

**Next gates:** Implement independently executable acceptance fixtures, run each product and record real raw evidence, repeat trials and obtain independent expert review before any competitive claim or acquisition due-diligence assertion.
