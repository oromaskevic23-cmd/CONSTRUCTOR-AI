# CONSTRUCTOR AI — Competitive Parity & Five-Year Engineering Moat

**Owner:** Alexander Romaskevich (RomaskevicH) · IMPERIAL Core  
**Review date:** 2026-10-24  
**Status:** Competitive product research and feature acceptance plan, **not a claim CONSTRUCTOR AI outperforms any competitor**.

## Strategy

The objective is to reach and eventually exceed the legitimate, tested user-facing engineering capability of Cursor, Replit Agent, OpenAI Codex, Lovable, Bolt, Devin, Windsurf and other leading software agents. **No proprietary code copying, no deceptive product comparisons, no unverifiable “five-year lead” claims.**

A strong moat must be repeatedly demonstrated by: **quality**, **verified correctness**, **security isolation**, **human governance**, **cost efficiency**, **reproducibility**, and **end-to-end ability to deliver real applications**.

## Publicly documented incumbent capabilities — not exhaustive

| Competitor | Observed published capabilities (Oct 2026, source-linked) | CONSTRUCTOR AI parity gate |
|---|---|---|
| Cursor | IDE and cloud coding agents; terminal/edits; multi-agent coordination; remote environments, PRs, test/demo artifacts | Real repo-aware coder, isolated execution, PR flow, evidence artifacts |
| Replit Agent | Text-to-app construction, backend/database/auth, browser-based automated testing and iterative fixes | Natural-language → working multi-file app, persistence, browser tests, deployment |
| OpenAI Codex | Cloud coding workspaces, code editing and verification, desktop/web/mobile tasks | Reproducible isolated coding task and authorized review workflow |
| Lovable / Bolt / Devin / Windsurf | Relevant app-builder and agent workflows require current per-feature verification | Source-backed specification and independently repeated user-task benchmark required |

**Primary original sources:**  
Cursor: https://cursor.com/product ; https://prod.cursor.com/help/ai-features/background-agents  
Replit Agent: https://replit.com/products/agent  
Codex: https://help.openai.com/en/articles/20001545-using-codex-cloud ; https://openai.com/index/codex-for-almost-everything/

### Current CONSTRUCTOR AI verified-source status

- **E2 source implemented:** locally running dependency-free Task Manager **reference**, human-reviewed static source, not AI-generated proof.
- **E3 checks defined in repository:** Node test suite + CI workflow, pending successful execution evidence on the exact commit.
- **E4–E6 autonomous pipeline:** **NOT VERIFIED**. Do not mark any competitor parity feature “shipped” based on this document.

## Proposed differentiators beyond ordinary code completion

| Engineering advantage | Proposed unique verification requirement | Current state |
|---|---|---|
| **Proof-Carrying Release** | Each artifact bears reproducible tests, source hashes, approval signature and environment provenance | Review-stage ProofGraph, Ed25519 witnesses, Sigstore-bound CI artifacts TESTED; owner release signature NOT IMPLEMENTED |
| **Independent multi-agent QA** | Separate agent models/roles independently inspect generated source and test results | Distinct CI Docker QA and Sigstore/OIDC-attested proof audit TESTED on a synthetic sample; model diversity / human QA NOT VERIFIED |
| **Time-Machine Replay** | Deterministic re-run of tasks, snapshots, diffs and full rollback verification | DESIGN ONLY |
| **Architecture Twin** | Living traceable contract linking requirements ↔ interfaces ↔ tests ↔ runtime evidence | DESIGN ONLY |
| **Context & Cost Shield** | Deterministic minimal context, denied secret paths, measured token/latency budget | DESIGN ONLY here |
| **Zero-Trust Agent Passport** | Revocable scoped cryptographic permits, replay-resistant and audited operations | DESIGN ONLY here |
| **Federated NCA Teams** | Portable general agent identity with task-specific professions, independent runtime domains | DESIGN ONLY |
| **Provider-agnostic Model Gateway** | At least two tested model adapters, safe fallbacks, permission-checked model routing | Groq mock contract + local Qwen GGUF observation gate implemented; two LIVE model adapters NOT VERIFIED |

**The differentiators above are proposed architectural targets.** Previous separately reported local implementations do not count as verified features in this repo unless their source, tests and evidence are attached and independently checked.

## Objective benchmark before public superiority claims

1. **Benchmark set:** at least 20 representative projects (task tracker, business CRM, dashboard, auth, API, unit migration, debugging, tests, full-stack deployment) with prewritten acceptance tests.
2. **Comparable budget and task context:** same prompt, time/resource budget, repository state, permissions, hardware/provider constraints, and human-intervention rules.
3. **Measurement:** pass@1 end-to-end task completion, security violations, manual interventions, number of retries, elapsed wall-clock time, inference+compute cost, generated code maintainability, rollback correctness.
4. **Independent validation:** blind human QA on outputs; hash-anchored test logs and versioned tool/competitor settings.
5. **Reproducibility:** publish safe benchmark inputs, exact tested product versions/dates, and negative results.
6. **Success threshold (planning):** task completion >= baseline within comparable resources, no unauthorized tool execution, security regression rate no worse than baseline; differentiated Proof-Carrying Release measurable. Revisit criteria after pilot evidence.

## Product delivery milestones

- **B0 (reference):** real Task Manager source + reproducible checks. **Current scope.**
- **B1 (model):** genuine LLM inference, plan → generated source files, scoped model gateway, actual logs.
- **B2 (build):** owner-authorized isolated sandbox, build and real test result.
- **B3 (verification):** independent agent QA, ProofGraph/Proof Passport, recoverable error handling.
- **B4 (products):** independently verified Task Manager + CRM + Dashboard, real user-facing previews and exports.
- **B5 (competitive trials):** external benchmark comparison and published limitations, iteration on deficits.
- **B6 (production):** security review, operational SLAs and verified customer-ready deployment.

## One-screen experience

Begin with a simple user prompt: **“Здравствуйте! Какую программу создать?”** Let the user describe a project. Keep rich engineering controls behind an optional verification inspector; do not hide genuine errors or human approval requests.

**Product motto:** Build software. Verify everything.  
**Evidence principle:** No evidence → no superiority claim.  
**Five-year objective:** hard-to-replicate *verified engineering fabric*, not an unprovable guaranteed lead.
