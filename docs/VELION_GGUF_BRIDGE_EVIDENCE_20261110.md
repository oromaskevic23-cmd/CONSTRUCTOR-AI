# Local VELION GGUF → CONSTRUCTOR AI: development evidence

Recorded 10 November 2026 on a temporary CPU-only development environment.
These are self-recorded observations, not signed or independently attested
evidence. Both models are external Qwen weights, not IMPERIAL-owned weights.
No private user data, paid model service, production deployment or generated
code execution was used.

## Scope

Each trial sent a synthetic Task Manager goal through a local CONSTRUCTOR AI
HTTP server, its HMAC-scoped task service, the new loopback transport and a
local VELION GGUF chat HTTP server. Both servers ran in the same temporary
development process and listened on `127.0.0.1`. The VELION runtime checked
the model file hash; the bridge checked the returned local receipt and input/
output hashes. Model text was untrusted. The task contract and heuristic
review remained active; no Docker sandbox or independent QA ran.

## Observed trials

| Trial | Result |
| --- | --- |
| [Qwen2.5-Coder 7B, initial prompt, 512-token limit](../evidence/velion-gguf-bridge-20261110/coder7b-initial.json) | HTTP 502, `LOCAL_MODEL_UNAVAILABLE`; no model answer was captured and no candidate was staged. The underlying cause was not recorded. |
| [Qwen2.5 1.5B, initial prompt, first attempt](../evidence/velion-gguf-bridge-20261110/instruct1p5b-first.json) | HTTP 502, `LOCAL_MODEL_UNAVAILABLE`; no model answer was captured and no candidate was staged. The underlying cause was not recorded. |
| [Qwen2.5 1.5B, initial prompt, diagnostic repeat](../evidence/velion-gguf-bridge-20261110/instruct1p5b-initial.json) | The model answered; CONSTRUCTOR rejected the answer with HTTP 422 because it did not satisfy the strict draft contract. No candidate was staged. |
| [Qwen2.5 1.5B, clarified prompt, 512-token limit](../evidence/velion-gguf-bridge-20261110/instruct1p5b-revised-512.json) | VELION rejected an incomplete answer after the local runtime reported `maxTokens`; CONSTRUCTOR returned HTTP 502. No candidate was staged. |

An additional trial with the clarified prompt, a 1024-token limit and the
revised VELION credential instruction returned HTTP 422 after the model's
JSON-like answer failed the strict contract; no candidate was staged. Its
full raw JSON record was lost when the temporary environment reset, so this
last observation cannot be independently checked from a retained log here.

The four linked records above were recovered from previously captured tool
output after the reset and verified byte-for-byte against their recorded
SHA-256 values. They contain only synthetic prompts, model output and local
unsigned receipts; treat all model text as untrusted. Hashes do not prove
who ran the trial or establish sandbox execution. A prompt or token-limit
change is not proof of model quality. No complete Smart Task Manager was
generated, and production release remains denied.
