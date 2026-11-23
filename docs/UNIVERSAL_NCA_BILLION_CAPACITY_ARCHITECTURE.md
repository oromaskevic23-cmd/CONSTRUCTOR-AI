# IMPERIAL Core — Universal NCA Billion+ Capacity Architecture
Status: PROPOSED / ARCHITECTURE ONLY / NOT IMPLEMENTED / NOT TESTED
Owner and final architectural authority: Alexander Nikolaevich Romaskevich
Parent design: [Always-On NCA Control Plane](ALWAYS_ON_NCA_CONTROL_PLANE.md)
Scope: CONSTRUCTOR AI engineering domain first. No main modification, release, payments, Val Town, or paid infrastructure.

## Scale contract: distinguish identities from concurrency
Billion+ means a design target of >=1,000,000,000 durable *logical* NCA identities over partitioned storage. It is NOT a claim of one billion concurrent processes, active tasks, enrolled passports, or measured throughput. Physical worker concurrency is constrained by measured FREE_ONLY capacity. Agents are activated on demand; the control plane stays available through a bounded scheduler and durable backlog. If no reliable always-on free runtime exists, report BLOCKED rather than claim 24/7 availability.

## Federated topology and trust boundaries
Architect/Owner -> HANTER AI Command Center -> domain-specific federated orchestrators -> bounded NCA execution pools -> independent QA -> evidence-backed result.
VELION is a separate Intelligence Core for reasoning; never an authorization authority. Each NCA carries an AI Passport (identity and capability claims, revocation/expiry), but identity never implies permission. Guardian Core enforces tenant, domain, task and resource policy; independent Approval Gateway verifies scoped Owner authorization for protected actions. Audit Ledger records tamper-evident event chains with externally verifiable anchors when available. Zero Trust, Public/Private Boundary and CRYPTO IMPERIAL Ecosystem Boundary are deny-by-default. No cross-domain, payment or external publication authority is inferred from engineering tasks.

## Hierarchical sharding
- Region -> tenant -> domain -> partition -> task; logical agent IDs are immutable and routable through an indirection directory, not fixed to workers.
- Partition key = hash(tenant_id, domain_id, task_id); tenant-aware quotas prevent one tenant monopolizing workers. Never use a single global queue, coordinator, or hot counter.
- Domain orchestrators own their partitions and budgets. HANTER coordinates commands and observes results but does not bypass domain authority.
- Versioned partition maps and migration epochs prevent split-brain during rebalancing; only one current lease/fencing epoch can commit a protected mutation.
- Durable task records and append-only state transitions are authoritative; cache and model memory are disposable. Store minimal sensitive data, with retention/deletion policy and tenant isolation.

## Universal NCA lifecycle
REGISTERED -> ELIGIBLE -> ASSIGNED -> LEASED -> RUNNING -> CHECKPOINTED -> VERIFYING -> COMPLETED.
Alternative outcomes: WAITING_APPROVAL, RETRY_WAIT, BLOCKED, STOPPED, DEAD_LETTER. A task is not completed until independent verification succeeds. Agents are ephemeral workers bound to a task-scoped permit, policy version, passport, owner epoch, resource budget, and fencing epoch. No agent may enlarge its own scope.

## Always-on operation without always-running billion workers
1. Persist incoming command and deduplicate on (tenant_id, command_id, idempotency_key).
2. Guardian Core checks admission policy and tenant quotas; Approval Gateway handles required signatures.
3. Domain orchestrator builds a bounded dependency DAG, reserves budget, and enqueues eligible work.
4. Scheduler wakes only on eligible backlog or a bounded polling interval; workers are leased just in time.
5. A worker checkpoints progress and emits heartbeat while its lease remains valid. Reclaims always issue a newer fencing token.
6. Independent QA verifies exact source SHA, executed commands, test logs, artifact digests and reviewer provenance. Failed QA cannot produce COMPLETED.
7. On quota exhaustion, pause admission and preserve backlog. No automatic paid-tier fallback.
8. Backpressure is explicit: bounded queues, per-tenant fair scheduling, concurrency caps, dead-letter retention and alert thresholds.

## Owner STOP, security, recovery
Owner STOP is checked through an independent authority registry with monotonic owner_epoch. STOP denies new leases and all protected writes. A stale worker or stale authority epoch cannot commit. Registry unavailability fails closed for protected actions. Recovery requires new Owner-signed authorization, a newer epoch and reconciliation of in-flight tasks; retries cannot automatically resume a stopped domain. All external side effects pass through a protected sink with scoped authorization and idempotency/reconciliation, never an exactly-once claim.

## Capacity math and SLOs (targets, not measurements)
Let N = logical identities, A = concurrently active workers, r = average completed tasks/worker/second, U = measured utilization. Throughput ceiling estimate = A * r * U; actual throughput must be load-tested. Storage estimate = N * bytes_per_identity plus indexes, replicas and audit retention; do not budget based on identity count alone. Example ONLY: 1e9 identities * 512 bytes = 512 GB raw before indexes, replication and events, far beyond many free quotas. Therefore no claim that billion-scale production fits FREE_ONLY. No SLO is accepted without a measured baseline, failure budget and cost evidence.

## Progressive implementation gates
G0: inventory actual repository source, existing PRs, evidence and free runtime limits.
G1: one domain, one durable queue, one NCA worker, one independent QA worker, task permits, Owner STOP; synthetic tests.
G2: two workers competing for same lease, crash/restart, stale fencing, task idempotency, expired passport, cross-tenant denial, failed authority registry, malformed LLM output.
G3: 100/1,000/10,000 logical identities in bounded synthetic load; measure queue latency, lease churn, storage bytes, CPU and cost. Scale only after results.
G4: partition migration, tenant isolation, quota exhaustion, disaster recovery, audit replay and independent red-team review.
G5: extend verified contracts to Business CRM and Business Dashboard. No production release or merge without independent review and Owner decision.

## Evidence requirements
For every gate: repository commit SHA, environment/runtime versions, exact executed commands, exit codes, raw test logs, artifact SHA-256, measured resource usage, reviewer identity, known limitations. Mark NOT RUN explicitly. Do not treat this architecture document as proof of deployed agents or tested billion-scale capacity.

## Acceptance decision
PROPOSED only. No billion-agent runtime, 24/7 availability, operational Owner STOP, scaling benchmark or live LLM proof is asserted by this document.
