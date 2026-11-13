# CONSTRUCTOR AI — Sprint 2026-10-31: Real LLM → three-file browser app → Chromium

**Owner / Final Architectural Decision Authority:** Alexander Nikolaevich Romaskevich (RomaskevicH).  
**Mode:** FREE_ONLY; synthetic offline invoice calculator; dedicated disposable CI environment; no customer data, external connections, or commercial credentials.

## Milestone

Move beyond the verified single-source module checkpoint (PR #22) to **real model generation of three application files**: HTML, JavaScript and CSS. Use Qwen2.5-Coder 7B as a **third-party local model through Ollama**, not as proprietary VELION model weights. The model must produce all three files. No trusted template substitution or mocked inference is allowed.

The independent browser test suite uses Chromium and verifies rendering and semantics, adding one/multiple invoice lines, reset, invalid values, arithmetic overflow and absence of external requests. The model does **not** see the test code. Bounded repair may receive allowlisted failed test names and its own previous generated JavaScript; three attempts maximum.

## Workflow architecture

- [Real source-generation harness](../browser_factory/live_browser_app.py) validates output schema and per-file limits, stages model files and invokes Docker with `--network none`, read-only container and mounts, non-root UID, no extra capabilities, CPU/PID/memory limits and a short timeout.
- [Independent Chromium QA](../browser_factory_qa/browser-qa.cjs) uses trusted pinned Playwright libraries prepared on the runner; generated JavaScript executes **only within the browser container**, not as privileged host code.
- [Offline harness tests](../browser_factory_tests/test_live_browser_app.py) cover strict three-file contract, no-network/static policies, path and shell isolation, denial of script injection, and bounded test feedback.
- [Live GitHub CI workflow](../.github/workflows/constructor-browser-app.yml) installs checksum-checked Ollama, public Qwen weights, pinned Playwright 1.56.1 and Docker image identified by digest. The runner has internet for dependency installation; the generated app sandbox has none.
- Each attempt produces SHA-256 for model prompt/response, the three generated files, browser QA source and log, plus a pass/fail decision and real token counts. Evidence and model-generated application are uploaded as 14-day GitHub artifacts only if the source exists.

## Exact acceptance threshold

A verified **synthetic browser app** requires: an actual model inference receipt, three generated files passing static source checks, browser startup inside Docker without a network, **11/11 prewritten browser cases**, exact-commit GitHub Actions success, and a source/evidence artifact. Any missing requirement is FAIL. Passing this small test is not a complete business software product.

## Known technical and security limits

- Static regex checks are only a preventive preflight, **not a secure HTML/CSS/JS parser, DLP product, or guaranteed mitigation of prompt injection**. The isolated container reduces but cannot eliminate browser/container escape risks.
- Browser uses `--no-sandbox` within a restrictive Docker container because some CI environments disable unprivileged user namespaces; this weakens Chromium internal isolation. Do not use this configuration with attacker-controlled content or on a host with production credentials.
- GitHub CI is ephemeral, not a permanent VELION/HANTER backend, streaming code editor, multi-user auth, task scheduler or general AI software factory.
- No full independent human QA, customer tenancy, private model training, persistent database, live production deployment, real-world NCA/LEGION professional accreditation or commercial authorization.
- Separate synthetic invoice-module checkpoint has known non-plain-object and inherited-property gaps; that artifact is not a production-ready invoice library.

## Next enterprise gates

After a reproducible three-file browser result, add deterministic multi-file patch planning, protected sandbox executor, backend/database migrations, a real isolated worker with signed HANTER → federated orchestrator → NCA messages, independently authored holdout benchmarks, ProofGraph, signed Proof Passport, rollback, AI Passport, Enterprise Skills, Guardian Core, Approval Gateway, Audit Ledger and Owner Kill Switch. Maintain Zero Trust, Public/Private Boundary and CRYPTO IMPERIAL Ecosystem Boundary.

**VELION is the canonical model platform; MAX is a mode only.** No product parity or superiority claim is justified by one synthetic app experiment.

**Build software. Verify everything.**