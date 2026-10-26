# CONSTRUCTOR AI — FreeLLMAPI Free-only Adapter (Pilot E2)

**Mission:** IC-CONSTRUCTOR-AI-FREELLMAPI-20261026  
**Date:** 2026-10-26  
**Status:** feature-branch source and mocked integration tests; **NOT DEPLOYED, NOT LIVE INFERENCE**.  
**Founder:** Alexander Romaskevich — RomaskevicH  
**Intelligence identity:** **VELEON** is the LLM initiative; MAX, if separately implemented, is a mode, not a rename.

## Upstream identification and license

The screenshot describes [FreeLLMAPI](https://github.com/tashfeenahmed/freellmapi) by Tashfeen Ahmed; original MIT notice: [LICENSE](https://github.com/tashfeenahmed/freellmapi/blob/main/LICENSE). This adapter uses the **documented OpenAI-compatible HTTP API**; no upstream source is copied or claimed as original IMPERIAL Core code. Any future vendoring, modification or redistribution must preserve all legally required upstream notices and review component licenses.

The upstream README explicitly describes its free provider pool as personal experimentation, **not commercial production**. Providers set their own terms. A claimed large aggregate free allowance is not a verified budget, entitlement, SLA or permission to resell providers' capacity. The upstream project's feature set and model catalog have changed since the screenshot; do not hardcode the screenshot's number of providers.

## Engineering integration implemented

The existing CONSTRUCTOR AI plan-only chain is preserved:

Human explicit request -> validateMission -> scoped short-lived single-use local HMAC permit -> **provider selector** (Groq or FreeLLMAPI) -> strict constructor_draft_v1 schema -> SHA-256 receipt -> optional quarantine of inert draft files -> RELEASE DENIED.

Files:
- engineering/freellmapi-gateway.mjs: OpenAI-compatible POST adapter, bounded JSON response, fixed loopback or pinned HTTPS endpoint, fail-closed codes.
- engineering/plan-only.mjs: explicit opt-in provider branch; defaults to existing Groq path.
- tools/generate-plan.mjs: manual --provider freellmapi and --confirm-free-only.
- engineering/proof-bundle.mjs: validates the new provider receipt with the unchanged local HMAC permit and quarantine status.
- test/freellmapi-gateway.test.js: positive/negative mock contract tests and proof-quarantine integration.
- test/cli.test.js: missing credential / missing approval fail-closed tests.

**Crucial:** This is an HTTP client integration, not deployment of the upstream FreeLLMAPI server. A separate running owner-controlled router and upstream provider accounts/keys are required. It cannot guarantee zero billing merely by setting environment booleans.

## Mandatory pilot prerequisites

1. Owner-approved, **private, single-user** FreeLLMAPI server, ideally running on the same trusted host as CONSTRUCTOR AI. Default endpoint: http://127.0.0.1:3001/v1. The endpoint must have a working GET /v1/models and POST /v1/chat/completions, valid unified proxy token and *documented* provider restrictions. No publicly exposed admin panel.
2. Review each enabled provider's current free tier, acceptable use, paid billing controls and whether third-party application access is permitted. Configure the router's fallback chain **exclusively** to verified zero-billable accounts/models; turn off all paid fallback, paid credits, auto-upgrade, unknown providers and trial/evaluation-only routes. A router may retry internally; this client issues one request but cannot certify router attempt count.
3. Keep proxy API key and PLAN_AUTH_KEY **only** in a protected server environment. Never publish secrets to GitHub, frontend JavaScript, screenshots, logs, or chat.
4. Keep the new connector restricted to **INTERNAL_PROTOTYPE**. Do not route commercial customers, private business documents or wallets through personal free tiers without explicit legal, privacy and provider-permission review.
5. If the router is remote, set FREELLMAPI_BASE_URL to its owner-controlled HTTPS origin plus /v1 and set FREELLMAPI_ALLOWED_REMOTE_ORIGIN to that **exact** origin. Arbitrary network URLs, redirects, userinfo, fragments and non-HTTPS remote addresses are denied. DNS-rebinding, credentials, network ACLs, rate quota and tenant isolation need further independent deployment review.

## Server-side variables and activation

Define securely:

- PLAN_AUTH_KEY: generated secret of at least 32 bytes.
- FREELLMAPI_API_KEY: the proxy's owner-specific unified token (32–512 visible ASCII characters), never copied from upstream examples.
- FREELLMAPI_BASE_URL: defaults to http://127.0.0.1:3001/v1.
- FREELLMAPI_ALLOWED_REMOTE_ORIGIN: only for a separately audited HTTPS endpoint.
- FREELLMAPI_MODEL: model identifier or proxy routing profile, default auto; **auto is safe only if upstream chain is free-only and verified**.
- FREELLMAPI_FREE_CHAIN_VERIFIED=true only after current owner account verification.
- FREELLMAPI_PAID_BILLING_DISABLED=true only when paid billing cannot happen.
- FREELLMAPI_INTERNAL_ONLY=true only for owner-only test traffic.
- FREELLMAPI_TERMS_REVIEWED=true only after applicable provider terms are reviewed.

All four booleans are independent **operator declarations**, not cryptographic billing attestations or actual quota checks.

After setup and separate owner authorization, internal plan-only invocation is:

~~~bash
npm run plan -- --provider freellmapi --goal "Build a local task tracker" --confirm-inference --confirm-free-only
~~~

To store an inert, locally verified SHA-256 quarantine package, optionally add BOTH --quarantine-root and --confirm-quarantine. The destination directory must already be trusted and writable. No generated code is executed.

For existing original Groq path, omit --provider and --confirm-free-only; it remains unchanged.

## Evidence ladder

- E2 source/contract: feature branch code exists. Unit and fake-transport tests must run green.
- E3 CI: check GitHub Actions on exact feature commit, including negative-path tests. Not proof of live inference.
- E4 live: configure owner-controlled runtime and credentials, perform one manual real-model request with no payment, verify reported provider/model and response SHA-256. Server-side audit must independently record provider usage; current adapter only reports the router's untrusted model text.
- E5 application: permissioned durable server-side queue, independent QA, isolated sandbox, invoice-cost control and paid-provider prohibitions.
- E6 production: only when licensed to support intended commercial usage, fully secured, independently audited, legally reviewed and explicitly approved by owner.

**No automatic provider setup. No background work. No paid calls. No production rollout.** External research and written descriptions are not equivalent to measured provider capacity.
