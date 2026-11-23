# IMPERIAL Core — Universal Nano Core Agent Architecture v2.0

**Status:** PROPOSED / ARCHITECTURE ONLY. **Owner:** Alexander Nikolaevich Romaskevich, Founder, Owner, CEO, Chief Systems Architect and Final Architectural Decision Authority. **Date:** 2026-11-23. **Scope:** existing IMPERIAL Core ecosystem; CONSTRUCTOR AI is the first bounded reference domain. **Runtime status:** not deployed, not independently accepted.

This specification extends [ALWAYS_ON_NCA_CONTROL_PLANE.md](./ALWAYS_ON_NCA_CONTROL_PLANE.md) and does not supersede its security gates. It defines a universal reusable agent kernel, not one omnipotent agent. Architecture Before Implementation. FREE_ONLY.

## 1. Constitutional invariants

1. Architect retains final architectural authority and independent Owner STOP.
2. HANTER is the AI Command Center, responsible for command routing, prioritization and escalation, **not** a universal privileged executor.
3. Federated Multi-Orchestrator Architecture: each organization, tenant and business domain has its own orchestrator(s), scoped capabilities, queues and budgets. No single global orchestrator.
4. VELION is a separate Intelligence Core. Its model outputs are untrusted suggestions, not permission grants.
5. Nano Core Agents (NCA) have immutable AI Passport identity, short-lived scoped execution permits, signed Enterprise Skills manifests and bounded resource budgets.
6. Guardian Core is the policy decision point; Approval Gateway is an independent authorization boundary; Audit Ledger stores append-only tamper-evident records. Identity is not authority.
7. Zero Trust, Public/Private Boundary and CRYPTO IMPERIAL Ecosystem Boundary apply at every hop. Never leak private evidence or permit real payments without a separately approved financial authority.
8. No self-certification: independent QA verifies execution artifacts before a release-eligible completion status.

## 2. Universal agent kernel (UAK)

The **Universal Agent Kernel** is a small deterministic state machine plus adapters. It MUST NOT embed unrestricted shell, credentials, payment permissions, model calls, or cross-tenant database access.

Modules and contracts:
- `passport.validate(passport, tenant, revocation_epoch)` -> identity / expiry / allowed domain; fail closed.
- `permit.verify(signed_permit, task_id, policy_version, owner_epoch)` -> scoped authority; no agent-issued permits.
- `skills.resolve(skill_id, digest, version, task_scope)` -> signed manifest, deterministic dependency lock and explicit tool permissions.
- `planner.propose(task, context, model_adapter)` -> untrusted plan with typed steps, estimated costs and required permissions.
- `executor.run(step, permit, fencing_token, sandbox)` -> bounded result; external effects only through protected sink.
- `checkpoint.commit(task_id, state_digest, fencing_token)` -> durable, compare-and-swap protected.
- `evidence.record(input_digest, output_digest, command, logs, artifact_sha)` -> provenance without secrets.
- `qa.request(task_id, evidence_refs)` -> separate reviewer identity, independent workspace.
- `recovery.reconcile(task_id, observed_effects)` -> safe resumption; no blind replay of external effects.

All adapters are replaceable by capability, not by agent identity. A new business type is supported by a new domain policy, orchestrator, skill set and sandbox, without modifying kernel authority logic.

## 3. Organization / team / agent topology

`Organization -> Tenant -> Business Domain -> Federated Orchestrator -> Professional Team -> NCA instances`.

An organization may have multiple business domains and multiple teams. A team has a role catalog and a capacity policy, not a fixed agent count. NCA instances scale from zero to N under explicit tenant quotas. Each task has exactly one accountable owner NCA; supporting agents receive separate subtasks and cannot claim the parent's authority.

Example role catalog (illustrative, not deployed):
- Engineering: architect, coder, test author, build operator, security reviewer, independent QA.
- Business: CRM data steward, workflow designer, dashboard analyst, quality reviewer.
- Security: read-only scanner, evidence triager, remediation proposer, independent verifier.
- Research: source retriever, analyst, fact verifier, citation auditor.

No automatic delegation to other domains. Cross-domain request = new command with its own authorization and audit chain.

## 4. Durable execution semantics

Task states: `RECEIVED -> POLICY_CHECK -> [WAITING_APPROVAL] -> QUEUED -> LEASED -> RUNNING -> VERIFYING -> COMPLETED`; exception paths `RETRY_WAIT`, `BLOCKED`, `STOPPED`, `CANCELLED`.

Required persistent entities:
- `commands(command_id, tenant_id, request_digest, idempotency_key, requested_by, owner_epoch)`
- `tasks(task_id, parent_task_id, tenant_id, domain_id, orchestrator_id, owner_passport_id, state, policy_version, required_evidence, budget, created_at)`
- `leases(task_id, worker_id, fencing_token, expires_at, heartbeat_at)`
- `checkpoints(task_id, seq, state_digest, encrypted_ref, fencing_token)`
- `permits(permit_id, task_id, skill_digest, scope, expires_at, owner_epoch, issuer_signature)`
- `audit_events(event_id, task_id, event_type, actor, prev_hash, payload_digest, event_hash)`
- `qa_verdicts(task_id, reviewer_passport_id, source_commit, test_log_digest, verdict)`

Enforce unique `(tenant_id, idempotency_key)`, monotonic fencing token per task, append-only audit records, transactional claim and task state updates. DB row-level isolation is defense in depth, not a substitute for independent authority checks. Store secrets in a protected secret provider only; never in task payloads or logs.

Guarantee **at-least-once scheduling** and idempotent effects, not fictional exactly-once execution. Lease expiry does not prove worker death; stale workers must be rejected at every protected write.

## 5. Always-on scheduler and bounded resources

Use a durable timer/scheduler that wakes workers only for eligible tasks; no always-running LLM loop. A heartbeat is emitted only while a task is leased. Fair queue scheduling uses tenant and domain budgets, priority aging and bounded concurrency. Per-task limits: wall time, steps, model tokens, memory, outbound calls and retry count. Exponential backoff with cap; poison tasks go to dead-letter queue. All free-tier quotas are hard ceilings; on exhaustion, enter `BLOCKED_RESOURCE` without spending money.

A background scheduler may be implemented only on an explicitly approved existing server. Do not assume that free-tier platforms provide uninterrupted 24/7 execution; report actual uptime and limitations.

## 6. Security and independent Owner STOP

The Owner Authority registry is logically and credential-isolated from HANTER, VELION, NCA runtimes and protected execution sink. Every protected action verifies:
`valid_passport && valid_scoped_permit && matching_tenant && current_owner_epoch && current_fencing_token && policy_allow && approval_if_required && within_budget`.

If any check or dependency fails: deny. Owner STOP increments monotonic `owner_epoch`, revokes permits and prevents new claims, checkpoints with protected effects, and result publication. STOP takes precedence over retries, scheduler triggers and orchestration messages. Recovery requires a new owner-authorized epoch and reconciliation. A model must never sign or issue owner recovery authority.

## 7. Enterprise Skills supply-chain

Every skill has `skill_id`, semantic version, source commit SHA, content digest, signer identity, declared input/output JSON Schema, required tools, egress domains, data classification, maximum budget and rollback strategy. Resolve only allowlisted signed skills. Validate output schemas; reject prompt injection as an instruction source. Use an ephemeral sandbox with no default network, least-privilege filesystem and restricted process access. Skills cannot alter AI Passport, policy, Owner Authority or Audit Ledger.

## 8. Evidence and independent verification

Evidence package per task:
- input requirements digest and policy/permit reference
- exact source commit SHA and skill digests
- reproducible build/test commands, exit codes, timestamps and logs
- generated artifacts with SHA-256 hashes
- independent reviewer identity, isolated verification environment and verdict
- explicit NOT RUN / BLOCKED entries for unexecuted checks

Release gate requires a full reproducible acceptance matrix and explicit Owner approval. CI green alone does not authorize release. Do not equate model-written code, local smoke tests and production readiness.

## 9. Recovery and fault-injection acceptance matrix

| Test | Expected outcome |
|---|---|
| Scheduler restarts mid-queue | No lost tasks; durable recovery |
| Two workers claim same task | Exactly one valid lease/fencing token |
| Old worker publishes after lease takeover | Rejected |
| Duplicate command delivered | One logical task |
| STOP during protected write | Denied at protected sink |
| Owner Authority unavailable | Fail closed |
| Tenant mismatch or revoked passport | Denied and audited |
| Expired approval / permit | Denied |
| Malformed model output / prompt injection | No unauthorized side effects |
| Crash between external effect and acknowledgment | Reconcile; do not blindly replay |
| QA fails or evidence absent | BLOCKED, never COMPLETED |
| Quota exhausted | Stop or queue; zero paid charges |
| Audit Ledger unavailable | Protected release denied |
| Restore from checkpoint | Deterministic state and evidence continuity |

## 10. Implementation phases and measurable exit gates

**P0:** Inventory current HANTER/CONSTRUCTOR AI infrastructure, open PRs and verified runtime. No duplicate services or repos. Select one existing free resource only after owner approval.

**P1:** One Engineering orchestrator + durable queue + one NCA worker + one independent QA worker. Demonstrate create/edit/test/package Smart Task Manager with exact SHA and full evidence. No external payments or public release.

**P2:** Implement independent Owner STOP, fencing tokens, permit verification, crash recovery and the negative fault-injection matrix. Require separate security review.

**P3:** Generalize the kernel with signed Enterprise Skills and AI Passport, add Business CRM and Business Dashboard domain orchestrators, enforce tenant isolation.

**P4:** Expand teams dynamically only after measured success rate, recovery time, cost ceilings and security test results. Target autonomy percentages are goals, not measured current performance.

## 11. Canonical product boundaries

HANTER = AI Command Center; VELION = separate Intelligence Core; CONSTRUCTOR AI = AI-native IDE and autonomous software engineering product; Universal NCA = reusable bounded worker architecture. IMPERIUM is a **long-term architectural digital currency for AI agents worldwide**, not an assertion of current worldwide adoption, market value or circulation. The CRYPTO IMPERIAL Ecosystem Boundary prevents ordinary NCA tasks from crossing into financial execution.

## 12. Current evidence

Architecture document only. No claim of deployed Universal NCA, 24/7 uptime, passed failure tests, production authorization or completed enterprise rollout. Preserve `main`; use independent review and Owner decision before merge.
