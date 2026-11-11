# CONSTRUCTOR AI — Local Studio VELION candidate

## What this increment provides

An optional form in the local Template Studio submits a Task Manager request to
the existing fixed-loopback VELION/Ollama adapter. Accepted model output passes
the existing strict two-file contract and heuristic review, then is written to
a new local quarantine directory. The response includes a mission ID, stage ID
and hashes. The same authenticated response contains a read-only text preview of
the two untrusted generated files, displayed with `textContent` and never run.
These are local observations, not signed provenance or proof that a model's
weights are owned by IMPERIAL Core.

No model output is run or shown as a finished application by this endpoint.
Docker QA, independent human review, Owner enrollment and the existing
review-only export gateway are separate actions. Production release remains
denied. HANTER, federated orchestrators, AI Passport, Guardian Core and a
production Audit Ledger are not connected by this increment.

## Local setup

Use Node.js 22+, an authorized locally installed Ollama model, and an existing
private directory. This example creates separate random local secrets. Run it
only in your own terminal; never post the token or permit secret in a chat or
commit either value.

```sh
npm ci --ignore-scripts --no-audit --no-fund
export IMPERIAL_TASK_LOCAL_ONLY=YES
export VELION_LOCAL_MODEL=YOUR_INSTALLED_LOCAL_MODEL
export VELION_LOCAL_PERMIT_SECRET="$(node -e 'console.log(require("node:crypto").randomBytes(32).toString("base64url"))')"
export CONSTRUCTOR_LOCAL_AI_TOKEN="$(node -e 'console.log(require("node:crypto").randomBytes(32).toString("base64url"))')"
export CONSTRUCTOR_LOCAL_QUARANTINE="$(mktemp -d)"
printf 'Local Studio token: %s\n' "$CONSTRUCTOR_LOCAL_AI_TOKEN"
npm start
```

Open `http://127.0.0.1:4173/studio`, enter a Task Manager request and the
local session token, then select **Generate candidate**. The token field is
cleared on submission and is not stored by the interface. The quarantine
directory is the one selected in `CONSTRUCTOR_LOCAL_QUARANTINE`; protect it
and retain it deliberately if its contents are needed after the session.

The **Stop generation** button requests cancellation of an in-progress local
request. The model server must honor the abort to actually stop computation;
if staging has already started, a quarantined candidate can still remain.
Closing the page also requests cancellation and clears the token field.

The local controller issues a one-time mission-scoped v2 HMAC permit bound to the exact mission goal, model identity and `velion-local-task` route before the inference request. It does not grant autonomous execution or prove human identity. Changes to any scoped field are denied before inference.

If the client disconnects while a request is running, the server sends an abort signal to the local model request and releases its one-request slot after the provider returns. Actual cancellation depends on the local model server honoring the disconnected request. A disconnect that occurs during filesystem staging can still leave a quarantined draft; no execution or release is authorized.

The default Ollama route requires a model already reachable at `http://127.0.0.1:11434/api/generate`.
No remote provider, paid fallback, model download or model installation is
performed by this feature. Model availability and its terms remain operator
responsibilities. The local form supports only the existing Task Manager domain
module contract; arbitrary application generation is not provided.

## Optional VELION GGUF chat route

On the same trusted computer, a separately started VELION chat with the GGUF
backend can be used instead of Ollama. This route is disabled by default, uses
only `127.0.0.1`, and requires its own VELION session token and expected model
SHA-256. In the Constructor server environment, in addition to the settings
above, set `CONSTRUCTOR_LOCAL_MODEL_ROUTE=velion-gguf`, `VELION_CHAT_PORT` to
the VELION server's port, `VELION_CHAT_TOKEN` to that server's token, and
`VELION_GGUF_SHA256` to the verified model-file hash. Set `VELION_LOCAL_MODEL`
to `gguf-` followed by the first 12 lowercase hex digits of that hash.
The VELION token must differ from both Constructor secrets. Keep all secrets
local and use the separate VELION chat setup for launching that service.

For the fixed-schema experiment, also set `VELION_GGUF_STRUCTURED_DRAFT=YES`
on the VELION server and `CONSTRUCTOR_LOCAL_GGUF_STRUCTURED=YES` on the
Constructor server. Both are explicit opt-ins. The Constructor adapter then
requests the fixed `constructor_draft_v1` schema and rejects a response that
does not carry the expected schema fingerprint; it never falls back to plain
chat. Run `node tools/observe-structured-local.mjs` with the same local
configuration for one synthetic request. It stages only an accepted draft and
does not execute source, run QA, or grant a release.

The adapter checks the local GGUF receipt's model identity, file hash, timing,
and input/output hashes before passing the untrusted answer through the existing
strict draft contract and quarantine. The receipt is local and unsigned: it is
not independent attestation. It makes no fallback calls. VELION's chat output
limits apply, so models may fail to produce a complete valid Task Manager draft.
A syntactically valid response is not evidence that the code is correct or safe.
A successful quarantine does not mean execution, independent QA or production
approval. Later drafts also receive a non-executing syntax and module-shape
preflight; PASS only covers those limited checks, not correctness or security.
The [recorded structured trial](STRUCTURED_GGUF_EVIDENCE_20261111.md) produced
a quarantined draft whose retrospective preflight failed. The
[earlier real-model trials](VELION_GGUF_BRIDGE_EVIDENCE_20261110.md) did not
produce an accepted candidate.

## Boundaries

- Disabled unless `IMPERIAL_TASK_LOCAL_ONLY=YES` and every configuration value
  is present. The session token must be different from the permit secret.
- The endpoint requires a loopback connection, an exact local Host and Origin,
  a bearer token, JSON, a bounded body and one active generation at a time.
- The adapter stops reading a model response after 100,000 bytes; response
  bounds are not a guarantee against every local resource exhaustion attack.
- The public/static Studio disables this form and never sends the local token.
- The local session token and HMAC permit are local access controls, not a
  verified human identity, distributed AI Passport or Owner approval.
- Static review is heuristic, not a sanitizer or sandbox. The local host,
  model server and selected quarantine root must be trusted by the operator.
- No automatic retry, paid service, network publication, external customer
  access, source execution or release is provided by the endpoint.

Tests use a synthetic model transport and do not prove a real Ollama request.
Browser acceptance must be evaluated from its actual run, separately from
the ordinary unit tests.
