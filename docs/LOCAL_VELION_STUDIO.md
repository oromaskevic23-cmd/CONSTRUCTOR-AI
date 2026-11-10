# CONSTRUCTOR AI — Local Studio VELION candidate

## What this increment provides

An optional form in the local Template Studio submits a Task Manager request to
the existing fixed-loopback VELION/Ollama adapter. The operator can choose a
two-file task module or a nine-file full-application draft. The module passes
its strict contract and heuristic review; the full-application draft passes a
separate structural contract but has no static review at this stage. Accepted
source is written to a new local quarantine directory. The response includes a mission ID, stage ID
and hashes. These are local observations, not signed provenance or proof that a
model's weights are owned by IMPERIAL Core.

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

Open `http://127.0.0.1:4173/studio`, choose the candidate scope, enter a Task Manager request and the
local session token, then select **Generate candidate**. The token field is
cleared on submission and is not stored by the interface. The quarantine
directory is the one selected in `CONSTRUCTOR_LOCAL_QUARANTINE`; protect it
and retain it deliberately if its contents are needed after the session.

The local controller issues a one-time mission-scoped v2 HMAC permit bound to the exact mission goal, model identity and the selected route (`velion-local-task` or `velion-local-application-v1`) before the inference request. It does not grant autonomous execution or prove human identity. Changes to any scoped field are denied before inference.

The model must already be reachable at `http://127.0.0.1:11434/api/generate`.
No remote provider, paid fallback, model download or model installation is
performed by this feature. Model availability and its terms remain operator
responsibilities. Both modes support Task Manager requests only; arbitrary
application generation is not provided.

## Boundaries

- Disabled unless `IMPERIAL_TASK_LOCAL_ONLY=YES` and every configuration value
  is present. The session token must be different from the permit secret.
- The endpoint requires a loopback connection, an exact local Host and Origin,
  a bearer token, JSON, a bounded body and one active generation at a time.
- The adapter bounds the model response to 100,000 bytes for the module or
  250,000 bytes for the full application. Full-application inference has a
  maximum five-minute timeout and an 8,192 output-token request. These bounds
  do not prevent every local resource exhaustion attack.
- The Stop button and a disconnected browser request cancellation from the
  local model transport. An external local model server may not stop inference
  immediately; cancellation is not an independently verified kill switch.
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

## Full application contract (laboratory only)

The Studio form and the local CLI have a separately scoped full-application route. With
an authorized local model and private output directory already configured,
an operator can request one bounded draft:

```sh
node tools/local-velion-task-build.mjs --full-app "Build a task manager with search and persistent local storage" "$CONSTRUCTOR_LOCAL_QUARANTINE"
```

This route requires `IMPERIAL_TASK_LOCAL_ONLY=YES`, `VELION_LOCAL_MODEL` and
`VELION_LOCAL_PERMIT_SECRET`. The local HMAC permit is bound to the distinct
`velion-local-application-v1` route. It is not an Owner Ed25519 authorization
or production AI Passport. The adapter makes at most one local model request,
with a bounded response and output-token ceiling. It neither installs a model
nor accesses a remote inference provider.

The versioned contract accepts exactly nine model-authored files, including
HTML, CSS, application/storage/validation modules, server, manifest, README and
tests. The package manifest permits no dependencies or lifecycle scripts.
Passing its structural checks does not establish that the source is safe or
functional. Source is quarantined as untrusted data; static security review,
isolated build, independent browser QA, Owner approval and release are **not
performed by this command**. Never execute the candidate on the host.

The model's token counters and source hashes are provider-reported evidence,
not an independently authenticated model identity or proof of execution.
The same limits and quarantine boundary apply to the Studio selection. A
successful synthetic test or structural validation does not prove that the
generated application runs or satisfies its requirements.
