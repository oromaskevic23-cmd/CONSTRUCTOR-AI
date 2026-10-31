# CONSTRUCTOR AI — First Real LLM → Build → Test → Proof experiment

**Architect / Final Architectural Decision Authority:** Alexander Nikolaevich Romaskevich (RomaskevicH)  
**Mode:** FREE_ONLY, one public synthetic experiment, ephemeral GitHub runner, no customer secrets or real production actions.  
**Status:** the workflow is an executable verification experiment; **only exact workflow logs/artifacts can establish a PASS**.

## Why this milestone is meaningful

A model merely proposing code is not equivalent to building and validating software. This limited experiment draws a strict measurable boundary around one artifact: a dependency-free JavaScript ES module that calculates integer-cent invoice totals. It includes negative validation and overflow requirements, and must pass **ten independent, pre-authored acceptance tests**.

This is a **microcomponent**, not a complete business CRM, IDE, autonomous full-stack developer or deployed commercial application. It does not imply superiority to Hermes Agent, Cursor, Devin, Replit Agent or other products.

## Implementation and trust boundaries

- [Generator](../live_factory/first_real_llm_build.py): sends a fixed public task to local Ollama at **127.0.0.1**, using the third-party model **qwen2.5-coder:3b-instruct**. The model is used as an available backend for CONSTRUCTOR AI / future VELION routing, **not** claimed as proprietary VELION weights.
- LLM must return JSON with exactly a source field. Only model-provided source is accepted; there is no pre-written source fallback, hidden replacement, or claiming a mocked response as genuine inference.
- Static source-policy preflight denies explicit filesystem/network/process imports and other risky patterns before staging; **regex matching is not a hardened security sandbox**.
- [Independent QA](../live_qa/invoice-acceptance.mjs): ten authored checks, not included in inference prompt, covering exact integer arithmetic, empty inputs, immutability, invalid inputs and unsafe integer overflow.
- **Only the generated source is executed** in a disposable Node.js container. Docker flags: `--network none`, read-only filesystem, no extra capabilities, non-root UID, no-new-privileges, PID/memory/CPU limits and read-only synthetic source volume. Image is pulled by trusted CI and invoked by resolved digest.
- Model may repair within **three total attempts**; every attempt and its hash-backed outcome is recorded. Failed test results cannot be turned into a PASS. QA never gives the model a file tool or commercial account.
- [Workflow](../.github/workflows/constructor-live-llm.yml): checks the Ollama installer SHA-256, downloads a public local coder model, runs the bounded build, records real model token usage and execution receipts, uploads evidence and winning source as GitHub artifacts (14-day retention).
- [Offline negative tests](../live_tests/test_first_real_llm_build.py): static contract and host-execution boundary without real model downloads.

## Reproduction and evidence

This experiment must run in a dedicated authorized Linux environment with a Docker daemon and CPU/RAM sufficient for a local model. The GitHub Actions workflow is the exact reproducible reference. Dependencies are downloaded only in the **trusted runner setup**; generated source has no network.

Evidence includes: exact workflow revision/run, model identity, prompt/response/source SHA-256, inferred token counts from a genuine Ollama completion, Docker image digest, independent QA SHA-256, sandbox exit code, and pass/fail for each attempt.

**Integrity is not authenticity:** hashes alone are not a signed ProofGraph or an independent human certification. The Docker isolation is a practical risk reduction, **not proof against container escape, CPU side channels, all host compromise, or malicious dependency attacks**. Test code can access the synthetic artifact within its sandbox. No privileged sandbox sockets or host secrets should be mounted.

## Acceptance and NO-PASS rules

For this first **bounded local microcomponent**, require all of:

1. A real Ollama inference receipt with positive generated-token count.
2. Model-produced JavaScript source hash and strict output schema; no handcrafted substitution.
3. Real Node syntax check inside an isolated network-disabled Docker execution environment.
4. All ten independent pre-authored acceptance tests passing on actual generated source.
5. A machine-readable report with exact source/test image hashes, no production or commercial authorization, plus downloadable source artifact.
6. Exact-commit GitHub Actions success and inspection of run logs.

Absent any point above, report **NOT VERIFIED** with failure reason. Do not convert demo results into VELION weights training, autonomous NCA competence, real full-stack delivery, secured multi-tenant execution, continuously running worker, production deployment or PAID revenue.

## Next architecture after this gate

Evolve from one fixed artifact to a real verified engineering mission: IntentLock → scoped context from Context Shield → VELION Model Engine/Router → HANTER delegated task → federated orchestrator + professional LEGION/NCA squads → isolated build → independent QA → ProofGraph → Guardian Core / Approval Gateway → human-approved Proof-Carrying Release.

Preserve AI Passport, Enterprise Skills, Audit Ledger, Owner Kill Switch, Zero Trust, Public/Private Boundary and CRYPTO IMPERIAL Ecosystem Boundary. No human final approval can be simulated with a boolean. No payment or customer account can be enabled by this test.

**Build software. Verify everything.**
## Model quality checkpoint (31 October 2026)

The first actual experiment with Qwen2.5-Coder **1.5B** was honestly recorded as **NOT VERIFIED**: real inference and Docker ran, but 10/10 QA did not pass despite attempted repair. See [failed exact-run evidence](https://github.com/oromaskevic23-cmd/CONSTRUCTOR-AI/actions/runs/41196133405). No application was released. The same independent QA requirements remain unchanged for the 3B follow-up; the implementation does not substitute handcrafted working source on failures.
