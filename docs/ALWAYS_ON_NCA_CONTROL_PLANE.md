# IMPERIAL Core — Always-On NCA Control Plane (Architecture Proposal)

Status: PROPOSED; NOT IMPLEMENTED. Owner/final architectural authority: Alexander Nikolaevich Romaskevich. Scope: existing CONSTRUCTOR AI engineering domain, without modifying runtime, main, deployments or financial systems.

## Authority and domain boundaries

Architect / Owner -> HANTER (AI Command Center) -> Engineering Federated Orchestrator -> Nano Core Agents -> independently verified artifacts. This is a federated multi-orchestrator design, not a global orchestrator. VELION is a separate Intelligence Core, providing model reasoning but never authorization. AI Passport identifies an agent and its capabilities; identity is not authority. Guardian Core evaluates policy; Approval Gateway validates independent owner authorization; Audit Ledger stores tamper-evident event evidence. Public/Private Boundary and CRYPTO IMPERIAL Ecosystem Boundary remain closed by default. Zero Trust between all runtime components.

## Persistent task record (proposed schema)

- task_id: immutable UUID; tenant_id; domain_id; command_id; idempotency_key (unique per tenant and operation)
- requested_by; approved_capabilities; policy_version; approval_reference (nullable); required_evidence
- assigned_agent_passport_id; orchestrator_id; state; attempt; max_attempts
- lease_owner; lease_expires_at; fencing_epoch (monotonically increasing integer)
- created_at; updated_at; next_run_at; last_heartbeat_at; checkpoint_ref; result_ref; error_code
- budget: max_steps, max_runtime_seconds, max_tokens, max_external_calls; all bounded and FREE_ONLY

Store command records, tasks, leases, checkpoints, approvals and audit events durably. Never store API secrets or raw sensitive task inputs in public evidence.

## State machine

RECEIVED -> POLICY_CHECK -> QUEUED -> LEASED -> RUNNING -> VERIFYING -> COMPLETED.
POLICY_CHECK -> WAITING_APPROVAL -> QUEUED only on valid scoped authorization.
RUNNING -> RETRY_WAIT -> QUEUED for bounded recoverable failures.
Any nonterminal state -> BLOCKED for policy or dependency failure.
Any nonterminal state -> STOPPED on Owner STOP.
VERIFYING -> BLOCKED if independent QA fails. No self-certification.

## Concurrency and execution protocol

1. HANTER records command with idempotency key; deny duplicate submissions.
2. Guardian Core checks scope and tenant; Approval Gateway verifies signed approval where required.
3. Domain orchestrator creates tasks and dependency DAG; no cross-domain execution without explicit scoped delegation.
4. Worker atomically claims eligible task using compare-and-swap; increments fencing_epoch and sets bounded lease.
5. Each write/checkpoint/result requires matching current fencing_epoch, valid lease, policy_version and non-stopped owner epoch.
6. Heartbeats renew lease only for current holder; expired lease can be reclaimed with a new fencing epoch.
7. Execution is sandboxed and bounded. Model output is untrusted; external side effects require separate protected execution sink and policy recheck.
8. Independent QA verifies source SHA, reproducible commands, actual logs and evidence hash before COMPLETED.
9. Audit Ledger records state transitions with event ID, previous hash, payload hash, actor passport, timestamp and authorization decision.
10. Retry uses capped exponential backoff with jitter; terminal failures go to dead-letter queue. External side effects must use idempotency keys or reconciliation; never claim exactly-once execution.

## Owner STOP and recovery

Owner STOP is validated by independent Owner Authority, not by HANTER or VELION. A monotonic owner_epoch is stored in an isolated authority registry. A STOP increments epoch and marks domain STOPPED; workers must check epoch before claiming, before every protected side effect and before publishing evidence. A stale worker with an old epoch or fencing token is rejected. If authority registry is unreachable, deny new claims and protected writes (fail closed). Recovery requires fresh owner-signed authorization, new epoch and independent reconciliation of in-flight work; STOP must not be undone by automated retries.

## Minimum executable acceptance gates

- Restart scheduler and worker mid-task: no task loss; recover with checkpoint and new fencing token.
- Two simultaneous workers: at most one valid lease; stale worker cannot publish.
- Repeated command with same idempotency key: one logical task.
- Inject clock rollback, expired passport, invalid approval, tenant mismatch: deny.
- Owner STOP while worker running: no further protected writes; stale epoch rejected.
- Authority database unavailable: no new protected actions.
- Model returns prompt injection or malformed output: no privileged execution.
- Fail QA: never mark COMPLETED.
- Every successful result references immutable commit SHA, executed commands, test logs, artifact hashes and independent reviewer identity.
- Verify resource ceilings and zero paid resource usage.

## Delivery plan

Phase 1: one Engineering domain orchestrator, one persistent queue, one sandboxed NCA worker, one independent QA worker. Use existing infrastructure only after inventory and explicit owner approval for any migration. Phase 2: six-role engineering team with bounded delegation. Phase 3: Business CRM and Business Dashboard domains. Scale worker count only after measured throughput, isolation and recovery tests.

## Evidence status

This file is an architecture-only proposal. No queue, scheduler, always-on runtime, STOP isolation, migration, integration or end-to-end acceptance is claimed as implemented or tested. Do not merge into main or announce release without independent review and owner decision.
