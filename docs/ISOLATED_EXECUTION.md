# CONSTRUCTOR AI — Isolated Execution Receipt v0.1

**Mission:** create real test process evidence for ProofGraph while preserving fail-closed release.  
**State:** Linux Docker reference, **NOT** an independently certified VM sandbox or production-safe multi-tenant hostile-code executor.

## Trust boundary

The executor in [isolated-executor.mjs](../engineering/isolated-executor.mjs) accepts **only** a bounded JavaScript test source (up to 32 KiB), mission and requirement identifiers, a fixed acceptance clause and an **immutable local Docker image ID** (`sha256:<64 hex>`). The host command is constructed from immutable argument tokens and calls `docker` directly; **no shell command from a model is accepted**.

The test source is copied into a freshly created temporary directory, byte-hashed, exposed **read-only** only to the container and erased on completion. Launch controls include:

- `--network none`; no external network by design;
- non-root `65534:65534`, root filesystem read-only, no added Linux capabilities, `no-new-privileges`;
- 48 PIDs maximum, 256 MiB RAM, 0.5 CPU, separate IPC namespace;
- fixed `node --test --test-reporter=tap /work/test.mjs` entrypoint, no arbitrary shell, 20-second max wall time, 16 KiB output per channel;
- Docker socket, host home directory and host secrets are **not mounted inside** the container.

These are *configuration controls*, **not proof of sandbox escape resistance**. Docker containers share the host kernel. For unknown adversarial workloads, replace this reference with a hardened VM/microVM, external sandbox runner or independently reviewed isolation boundary before production.

## Reproduce a genuine container execution

Requires Docker Engine and Node.js 22+. In a test-only machine:

```bash
docker pull node:22-alpine
export CONSTRUCTOR_DOCKER_IMAGE_ID="$(docker image inspect --format '{{.Id}}' node:22-alpine)"
npm run isolated:demo
```

The reference image comes from a **floating registry tag at pull time**, but execution pins its *resolved immutable local image ID*. That prevents tag drift between pull and execution; it does **not** independently verify publisher signatures or supply a globally reproducible image provenance chain. A production rollout must use a reviewed digest-pinned and signed image supply chain. No Docker daemon must be connected to an untrusted tenant. The smoke test is also run by a dedicated GitHub Actions job on PRs.

## What the execution really proves

- Actual Node test source bytes are hashed into the `SOURCE` evidence record.
- Docker process exit status plus bounded *actual* stdout/stderr bytes form an execution receipt. The SHA-256 of that receipt is the `TEST` evidence record.
- The recorded `TEST` status is based on exit code, **not a model's self-reported PASS**. Nonzero exit generates FAIL.
- Missing external `INDEPENDENT_QA` is explicitly shown by the ProofGraph.
- `release: DENIED` for every result. No signatures, user identity, or owner authorization are invented.
- Infrastructure errors, timeouts and output overruns fail closed without a completed-success receipt.

Docker output comes from the executed code and remains untrusted. The receipt is hash-bound but **not independently attested**; a privileged host process or compromised Docker daemon can forge results. Replay, durable identity, honest QA execution and production release are still future gates.

## Negative-path validation

`node --test test/isolated-executor.test.js` uses explicit mock Docker adapters for unit testing. Mocked unit tests **do not prove container isolation**. The CI `docker-isolation` job performs a separate **real Docker runtime** smoke test, stores `isolated-execution-evidence.json`, and links it to an exact GitHub Actions run.

Next milestones: signed CI runner receipts, durable nonce registry, Linux/Windows executor parity, VM boundary, separate trusted QA execution and artifact-to-requirement acceptance tests.
