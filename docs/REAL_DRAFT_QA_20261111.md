# Real VELION draft and assistant-revised module: isolated QA

**Result:** the original Qwen-produced domain draft failed isolated QA. A
separately identified assistant-revised version passed the three-case
independent domain suite and its own three tests in separate isolated
containers. The repaired module is an assistant-revised derivative, not
a successful autonomous model-generated application. Neither result grants
release approval, proves general security, or supplies a complete user-facing
Task Manager.

## Original model draft: failed

The [original local observation](STRUCTURED_GGUF_EVIDENCE_20261111.md) produced
a structured two-file draft and placed it in quarantine without execution.
On 2026-11-11 a later [GitHub Actions run](https://github.com/oromaskevic23-cmd/CONSTRUCTOR-AI/actions/runs/42951781270)
checked the original retained file hashes, then ran the draft's tests and the
independent suite in separate Docker containers. Both failed:

- The draft test imported `./app.mjs` from the `test` directory, where that
  module did not exist.
- The independent suite could not import the required `completeTask` export.

The exact workflow source is pinned to
[commit 78d2aea1b5dfd12579defaa580fca01eecced087](https://github.com/oromaskevic23-cmd/CONSTRUCTOR-AI/commit/78d2aea1b5dfd12579defaa580fca01eecced087).
These are execution observations, not just a static finding. The recorded
result is **FAIL**; no owner approval or release occurred.

## Assistant-revised module: limited PASS

After inspecting the failed draft, the assistant revised the domain module and
its tests. The files remain clearly labelled, inert `.txt` evidence in the
repository; they are not represented as unmodified model output:

| Retained file | SHA-256 |
| --- | --- |
| [Assistant-revised module](../evidence/structured-repaired-20261111/repaired-app.mjs.txt) | `022f8954aa80572201cd39941636d084e756a57bf8c2bcfbeccbe325afd98305` |
| [Assistant-revised tests](../evidence/structured-repaired-20261111/repaired-test.mjs.txt) | `8a8859e9c942beb81ce8a2083cfedc13ed8d9f500d476655ac1195612626187c` |

The follow-up [GitHub Actions run](https://github.com/oromaskevic23-cmd/CONSTRUCTOR-AI/actions/runs/42952177322),
on [commit 73ca544c8826351513edfddd45de60964f73ae4e](https://github.com/oromaskevic23-cmd/CONSTRUCTOR-AI/commit/73ca544c8826351513edfddd45de60964f73ae4e),
first verified both file hashes, then reported **3/3 PASS** in the revised
candidate tests and **3/3 PASS** in the existing independently authored suite.
The independent suite's SHA-256 is
`295b1b9c6fe9ba3aded8e63ec1324ff8392453514a019d1784cd74bac370cd89`.

The workflow used the existing pinned Node container image, no container
network, a read-only filesystem, non-root UID, dropped capabilities, and
bounded CPU, memory, process count and time. It used a standard GitHub-hosted
runner for the public repository and did not upload an artifact. The job log is
evidence of these checks; it is not a separately signed QA attestation and does
not authorize an export or deployment.

## One subsequent model attempt: no draft

After the original trial, the generator prompt was clarified to spell out the
required exports, imports, test registration and valid task fields. One local
Qwen 1.5B request with that revised prompt was made. It returned HTTP 502 with
`LOCAL_MODEL_UNAVAILABLE` after 72,918 ms, without a candidate or model receipt.
The former bridge collapsed several upstream errors into that code, so the
precise cause of this historical attempt cannot be recovered from the record.
No retry or successful model result is claimed. The
[retained observation](../evidence/structured-revised-20261111/observation.json)
has SHA-256
`590fff9780c94b681bfbdc1bddc56745b4b01b5f720680e754342d261ae41568`.

The bridge now relays a small allowlist of bounded diagnostic categories for
future requests without forwarding arbitrary upstream error text. This change
cannot establish the cause of the earlier error. The revised prompt and narrow
domain tests do not establish general intelligence, autonomous development,
mobile availability, or application readiness.
