# CONSTRUCTOR AI — Buyer Technical Review Gate (Offline CRM)

**Architect / Original Author:** Alexander Nikolaevich Romaskevich (RomaskevicH)  
**Date:** 2026-11-06  
**Status:** Implemented source; CI evidence is scoped to exact committed revision.  
**Commercial target:** Explore licensing, pilots and an eventual high-value acquisition; the owner's USD 5,000,000 acquisition objective is **not an established valuation**.

## Purpose

Produce an inspectable, automatically verified technical evidence packet for the existing **Offline Client Pipeline CRM**, not a marketing assertion or an autonomous sales agent. The current product is a local, single-user, browser-storage application exported from reviewed CONSTRUCTOR AI templates, with no remote customer data, model-generated application, hosted multi-tenant runtime, actual payments or client commitments.

**Build software. Verify everything. Keep humans in control.**

## Evidence path (implemented)

```text
Source revision (GitHub SHA)
        |
Reviewed deterministic CONSTRUCTOR AI offline CRM exporter
        |        Built in pinned Node container, --network=none,
        |        CPU <= 1, memory <= 256 MiB, no privileged execution
        v
Product files + manifest.json + build-proof.json
        |
Different CI job: independently authored automated CRM QA tests
        |  File inventory, CRM behavior, backup recovery, CSP and localhost HTTP
        v
qa.json -- AUTOMATED_QA_PASS, no human security certification
        |
Buyer technical review gate -- rehash 12 product files + 3 evidence digests
        |  Reject missing files, symlinks, extra files, modified code,
        |  failed/fabricated QA shape, changing build-proof scope
        v
buyer-evidence.json (single-user demo, unsigned, not sale authorized)
        |
Owner review; any actual commercial offer remains a separate authorization
```

CI: [Offline CRM product build, independent QA and buyer proof](../.github/workflows/offline-client-crm.yml)  
Code: [Commercial evidence gate](../engineering/commercial-evidence-gate.mjs)  
Negative tests: [Evidence scope and tamper tests](../test/commercial-evidence-gate.test.mjs)

The handoff binds source revision, product-file hashes, build-proof hashes, exact QA report bytes and QA check names. It rejects an absent or failed QA report but **does not cryptographically prove that a reviewer was independent**. Authentication of a QA signer, Owner signing service, and immutable external Audit Ledger remain future gates. A green CI result is not proof of independent human certification.

## Example technical buyer discovery (proposal, NOT external outreach)

For a potential corporate customer, ask about the target workflow, business data classification, expected tests, accessibility, deployment and authentication requirements, integration permission boundaries, procurement expectations and support needs. A buyer may first inspect the portable, no-network CRM and a narrowly defined synthetic-data pilot. A company name, contact, deal, accepted price or payment must be grounded in actual external evidence before being recorded.

No outbound contact, paid advertising, billing or buyer list creation is performed by this workflow.

### HANTER / Universal NCA integration boundary

```text
Architect
   |  signed scope and commercial approval (not yet deployed)
HANTER Command Center + emergency stop
   |
Federated Commercial Orchestrator (qualification + CRM-SOFFT)
   |
NCA Intake -- deterministic requirements draft -- separate QA
   |
Approval Gateway (check identity, IntentLock, approved action + kill)
   |
CONSTRUCTOR AI deliverable + VELION bounded model invocation
   |
ProofGraph / Audit Ledger / reviewed Skills, Plugins, MCP
   |
Owner-approved buyer demo and contract workflow
```

The current NCA laboratory supports bounded intake, rate limits and an Owner review stage, but it **does not provide** authenticated customer outreach, a production AI Passport, independent certified runtime, live LLM worker or real HANTER process-level revocation. Do not combine that laboratory with real client data.

**Project isolation:** SHPAIZMAN is a separate project owned by the founder's brother. It has no connection to this workflow, its agents, CRM, server, keys or commercial leads.

## FREE_ONLY guardrails

The current buyer evidence step runs only in existing PR/push/manual GitHub Actions workflows; it creates **no new Supabase Cron or long-running server process**. Existing isolated build/test jobs remain bounded at CPU 1 and 256 MiB per Docker task, and short workflow timeouts. The third job uses only Node stdlib and GitHub artifact transfers. Actual GitHub Actions quota usage depends on the account and must be inspected separately; source-level no-network controls are not a provider spending guarantee.

The Universal NCA commercial lab independently enforces up to **40 intakes, 40 drafts and 40 QA transitions per UTC day**, 100 pending, 500 retained, and a minimum 60-second draft spacing, using local SQLite and zero external API calls. These are **local chosen operating caps**, not the subscription quotas of Supabase, GitHub, or Composio. Do not enable new schedulers or model traffic unless independently verified free usage and Owner authorizations permit it.

## Product honesty and release rules

The evidence packet must always show:

- `SINGLE_USER_OFFLINE_DEMO_ONLY`;
- `AUTOMATED_QA_PASS` reported but `NOT_CRYPTO_ATTESTED`;
- `commercialSaleAuthorized=false`, `productionDeploymentAuthorized=false`;
- `modelGeneratedFullApplication=false`, `runningNanoCoreAgentsVerified=false`;
- `buyerIdentityVerified=false`, `customerAcceptanceVerified=false`;
- `realRevenueUsd=0`, `paymentConfirmed=false`.

Next gates: a genuine full-app VELION generation cycle, isolated execution with independent held-out QA, non-exposed real Owner key enrollment, production AI Passport and HANTER Owner Kill Switch, signed release/QA identity, multi-tenant security assessment, verified competitor benchmark against Cursor and Hermes and finally a genuine customer acceptance or acquisition process.

**Never treat a commercial evidence packet as permission to deploy, spend, contact buyers, issue invoices, or take payments.**

## Portable technical-evaluation package (7 November 2026)

The existing three-stage CI now produces a **complete offline evaluation directory**, not only a standalone JSON receipt. After the isolated CRM is built and separately checked, the buyer evaluation job:

1. Regenerates and independently compares the exact `buyer-evidence.json` against the actual product, build proof, QA report, source SHA and GitHub run identity.
2. Copies only the 12 reviewed product files and three approved evidence files to a new temporary directory, never overwriting a prior package.
3. Includes `BUYER_GUIDE.md` with evaluation steps using Node.js 22+, the single-user demo scope, synthetic-data warning, and absence of any sale/deployment permissions.
4. Creates `buyer-package-manifest.json` containing the SHA-256 and byte count of all 16 files, with explicit `NOT_PRODUCTION_AUTHORIZED` and `NOT_SIGNED` status.
5. Reopens and rehashes the packaged files before upload. Any missing file, extra file, symlink, source mismatch, false QA status or modified byte fails the job.

**Artifact to download:** `constructor-buyer-review-<40-character Git commit>` from the corresponding [offline CRM GitHub Actions workflow](../.github/workflows/offline-client-crm.yml). Its `portable-evaluation/` folder contains the complete portable single-user CRM and verification evidence. The top-level `buyer-evidence.json` is retained for machine consumption. Artifacts have the workflow's 14-day retention policy; no new server-side retention job or database was created.

Offline source: [package assembler/verifier](../engineering/buyer-demo-package.mjs) · [CLI](../tools/buyer-pilot-package.mjs) · [adversarial tests](../test/buyer-demo-package.test.mjs).

**Security boundary:** SHA-256 checks detect mismatches between the evidence and delivered files, but are not a cryptographic proof of an independently trusted publisher. The underlying `qa.json` is a report created by a separate automated CI job, not an independently signed QA certificate. This feature cannot send the package, authenticate a buyer, approve commercial terms, book revenue, authorize production or enable a real NCA. The release remains subject to the Architect's legal, security and commercial decisions.

**Server limits:** Reuses the existing buyer evidence CI runner, no additional continuous workflow, no new Supabase cron, no model tokens, no paid API call and no external outreach. GitHub Actions quota usage and provider limits must still be monitored by the hosting account.

**Project boundary:** SHPAIZMAN remains entirely separate. No shared credentials, repositories, data, agents or customer records are introduced.
