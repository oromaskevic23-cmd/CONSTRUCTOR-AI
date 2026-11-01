# CONSTRUCTOR AI — VELION Prompt → Quarantine → Docker → Independent QA → Approval Gateway

Milestone 2026-11-01. Scope: bounded executable code-generation pilot for task-manager domain logic, NOT a general autonomous software factory or production deployment.

## Current implementation and limits

The local VELION adapter targets the fixed loopback Ollama endpoint (127.0.0.1:11434). It requires a scoped local HMAC permit and explicit developer opt-in. Generated text is parsed with the existing constructor_draft_v1 contract. Exactly two files are accepted: app.mjs and test/app.test.mjs. The untrusted content is staged with SHA-256 hashes, then executed only inside a separate Docker container with no network, read-only mounts, a nonroot user, dropped Linux capabilities and resource limits.

The trusted, independently authored QA suite is mounted separately; generated tests do not constitute independent QA. The CI fixture simulates a model response to verify these boundaries; fixture execution DOES NOT establish live VELION inference. A real local model request is supported but has not been proven to complete this cycle on an operational host.

The Ed25519 Approval Gateway verifies separately issued Owner authorization bound to QA evidence and a mission. The gated local-review-export command re-hashes the staged source and QA log, validates their binding, checks an external Owner public key, atomically claims the approval nonce in a trusted persistent directory and writes a local review copy only after successful verification. The code DOES NOT issue Owner approvals or enroll an Owner public key; CI test keys are synthetic. Without a genuine trusted Owner public key and externally signed approval, all exports are denied. An Owner approval signature must come from an external, authorized signing process; this repository intentionally contains no private signing key or enrollment mechanism. Even a valid approval permits a LOCAL REVIEW COPY ONLY, never production deployment, financial operations or autonomous execution.

## Supported software request

Only a Task Manager domain API is supported for the first experimental cycle. The model must generate a JavaScript module exporting createTask(id,title), completeTask(task), and filterOpen(tasks), plus model-authored tests. Independent hidden tests enforce task validation, immutability and filtering. Other program classes and arbitrary commands are rejected. This creates genuinely new model-supplied source code rather than copying reviewed Template Studio source, but it is not a general graphical application generator.

## Reproducing the safe synthetic gate

Node.js 22+ and Docker are needed. From repository root:

~~~sh
npm ci --ignore-scripts --no-audit --no-fund
npm run verify
mkdir -p /tmp/constructor-safe-output
node tools/prepare-synthetic-task-build.mjs /tmp/constructor-safe-output
~~~

The command only stages synthetic source, never executes it on the host. The GitHub Actions prompt-sandbox-qa workflow performs Docker execution and independent QA, and emits a scoped task-qa-proof.json with release DENIED. Trusted operators can use the exact same guarded Docker entrypoint: bash tools/run-isolated-task-qa.sh STAGED_DIR EXISTING_EVIDENCE_DIR. Preload the pinned Node Docker image first; the script fails closed if it is missing. Do not execute app.mjs directly on the host.

## Optional local model inference — no automated execution

On a trusted host with an authorized installed Ollama model running on loopback, and a separately managed 32+ byte local secret:

~~~sh
export IMPERIAL_TASK_LOCAL_ONLY=YES
export VELION_LOCAL_MODEL=YOUR_INSTALLED_LOCAL_MODEL
export VELION_LOCAL_PERMIT_SECRET=YOUR_LOCALLY_STORED_SECRET
mkdir -p /tmp/constructor-safe-output
node tools/local-velion-task-build.mjs 'Build a task manager with editable tasks' /tmp/constructor-safe-output
~~~

Never commit or paste real secrets. This command does not execute generated code or provide an Owner signature. Third-party model weights remain third-party; VELION is the routing/control layer here, not proprietary trained model weights.

## Governance and admission criteria

Architecture: Architect → HANTER → domain orchestrator → CONSTRUCTOR AI with VELION → quarantine → sandbox worker → independent QA → Approval Gateway. HANTER runtime dispatch and the federated orchestration interface are future integrations, not existing parts of this pilot. AI Passport, Enterprise Skills, Guardian Core, ProofGraph, Audit Ledger, Zero Trust, Public/Private Boundary, Owner Kill Switch and CRYPTO IMPERIAL Ecosystem Boundary remain mandatory.

Fail closed: no local permit means no inference; no valid typed output means no staging; no isolated Docker means no execution; no independent QA means no approval; no genuine Owner enrollment means no export. There is NO production release path in this pilot.

Rollback: revert the merged Git commit. No customer-data migration, production deployment, payments or external paid service is involved. Reproduce CI, read exact run logs and distinguish synthetic execution evidence from future real-model E2E evidence.

Owner and founding architect: Alexander Nikolaevich Romaskevich (RomaskevicH). Third-party rights unchanged.
