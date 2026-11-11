# VELION structured draft: local observation, 2026-11-11

**Status at the original observation: an untrusted two-file domain draft was
quarantined without execution. Its later module-shape preflight failed. A later
isolated QA run also failed; an assistant-revised domain module passed a limited
independent suite. Neither is a finished Task Manager application or release.**
See the [subsequent isolated QA record](REAL_DRAFT_QA_20261111.md).

## What was observed

At 02:52 UTC, one synthetic Task Manager request was sent over loopback to
VELION's opt-in GGUF route. The fixed JSON grammar was enabled on VELION and
required by the Constructor adapter. The local model produced a response which
passed the schema and existing draft-contract checks, and the two proposed files
were saved in quarantine. The request took 51,591 ms in this environment. This
is one observation, not a benchmark or a reliability rate.

- Model: Qwen2.5-1.5B-Instruct GGUF, Q4_K_M; CPU inference with
  `node-llama-cpp` 3.22.3; Node.js 24.22.1.
- Model revision: `91cad51170dc346986eccefdc2dd33a9da36ead9`;
  model file SHA-256:
  `6a1a2eb6d15622bf3c96857206351ba97e1af16c30d7a74ee38970e434e9407e`.
- Fixed format: `constructor_draft_v1`; canonical schema SHA-256:
  `fd4d2ae555076aba433dae990ea9b83fc4405c917af43124deba6ccdf4f3cf4d`.
- VELION implementation: [commit 603cf0998f41aae9f1048a6b543e3178b8c5ced6](https://github.com/oromaskevic23-cmd/VELION-LLM-Public/commit/603cf0998f41aae9f1048a6b543e3178b8c5ced6).
- No model tools, paid model API, generated-code execution, independent QA or
  release approval were used in this observation. The model receipt is local
  and unsigned, not third-party attestation.

The local server and model weights were in a temporary environment. This record
does not establish a persistent server, mobile access, deployment, safety, or
general model quality.

## Retained evidence

The candidate files are stored with `.txt` suffixes as inert, untrusted evidence;
their contents are not to be executed outside an isolated independent
verification process. The observation and original quarantine manifest
were retained unchanged. SHA-256 values below refer to the exact bytes:

| Artifact | SHA-256 |
| --- | --- |
| [Observation](../evidence/structured-gguf-20261111/observation.json) | `33e22bec9c4c1476f08747a820788f4e20665be9c375f0d1c14c4023f76ae436` |
| [Original quarantine manifest](../evidence/structured-gguf-20261111/stage-manifest.json) | `7930f7cf22b18c7f02933c1d69d05a921ffea4c2d0ffc356f0d6112c79ee5477` |
| [Domain draft](../evidence/structured-gguf-20261111/candidate-app.mjs.txt) | `8ebd73546a83ea7488d340e55c1913e197e77666f8899d518f91e0537be205c3` |
| [Draft test](../evidence/structured-gguf-20261111/candidate-test.mjs.txt) | `b53c51de6863ccaff26f17c68bc808f483694114abc65bb2b72f863471e05fba` |
| [Retrospective preflight](../evidence/structured-gguf-20261111/static-preflight.json) | `6233814ed1877462a71ce097bb646ff49d2c7ad263e78964e8d8f680adf5d827` |

The last report was produced **after** the model run from the retained draft;
it was not part of the original manifest. It found that the domain file did not
export the required `createTask`, `completeTask` and `filterOpen` functions.
The test file did not import the domain file at the expected relative path and
did not import `node:test` or `node:assert/strict`. The generated test also
imports `strictAssert` from `node:assert` and calls functions that return no
test result. A schema-compliant answer alone therefore did not produce a
usable implementation.

The new preflight uses Acorn 8.19.0 (MIT) to parse source without executing it.
It checks only syntax and a narrow module shape. A preflight PASS is **not**
a functional test, a security review, a sandbox, or independent QA. Future
quarantine manifests include the preflight result, including FAIL results.

At the time of the original local observation, Docker and Podman were
unavailable and the available `bwrap` isolation attempt was denied by the
environment. Consequently the generated files were not executed and the
independent sandbox suite was not run **during that observation**. The later
[isolated QA record](REAL_DRAFT_QA_20261111.md) reports the separate runs and
their results. The original observation and quarantine manifest remain
unchanged as historical records.
