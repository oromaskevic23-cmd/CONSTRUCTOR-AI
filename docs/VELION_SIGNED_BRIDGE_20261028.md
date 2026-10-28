# CONSTRUCTOR AI → VELION: Signed Local Model Proposal Bridge

**Date:** 2026-10-28  
**Mode:** FREE_ONLY / Zero Trust / reviewed synthetic fixture only  
**Status:** source-level integration; production service/dispatch NOT enabled.

## Implementation

- [Client](../engineering/velion-proposal-client.mjs) reuses the existing, one-time [local HMAC permit](../engineering/local-permit.mjs). The reviewed mission is `IC-CONSTRUCTOR-ORDER-001`, with a fixed, non-sensitive goal. **Unreviewed prompts, customer requests and arbitrary mission IDs are denied before network access.**
- The client signs every call with a separate, strong ephemeral HMAC secret and a fresh nonce; timestamp, path, HTTP method and exact body hash are bound into the signature. The endpoint is hard-coded to `http://127.0.0.1:8765/v1/model/proposals`. No arbitrary remote URL is accepted.
- VELION authenticates and rejects replay, checks the reviewed source catalog and model identity, runs the genuine local Nemotron 3 model only when installed, and returns a non-executable proposal receipt.
- The client independently validates model identity, mission and response schema, decision, SHA-256 output, token count, `execute_allowed=false`, `payment_confirmed=false`, `human_approval=NOT_GRANTED_BY_ROUTER`. Return object sets `release: DENIED` and `sandbox_execution: NOT_RUN`.
- Offline independent [tests](../tests/velion-proposal-client.test.mjs) must PASS before release. The [real integration smoke](../tools/velion-bridge-smoke.mjs) is run only on the isolated GitHub Actions runner that has both an ephemeral local VELION API and a genuine Ollama model. It requires two independently generated runtime secrets, never saved in Git.

## Boundaries and blockers

1. **No permanent inference server:** GitHub Actions virtual machines are temporary; no public endpoint or 24/7 model availability is claimed.
2. **No customer or agent dispatch:** This is a fixed public synthetic task only, not production CONSTRUCTOR AI user input; no data is stored, no background job is created, and no NCA is deployed.
3. **Not a substitute for full AI Passport/Approval Gateway:** Existing HMAC permit is a narrow local draft permit, not user identity or an enterprise approval.
4. **No credentials committed** and no paid providers, Val Town or new cloud hosting. Render workspace was not selected; Supabase Auth identity for this service is not provisioned.
5. **Independent QA and release remain separate:** Nothing here authorizes executing model output or accepting client delivery.

For the cross-repository verification, see [VELION Model Router](https://github.com/oromaskevic23-cmd/VELION-LLM-Public) and its signed localhost bridge workflow.
