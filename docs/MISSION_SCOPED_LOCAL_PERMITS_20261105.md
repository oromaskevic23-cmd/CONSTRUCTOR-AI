# CONSTRUCTOR AI — Scoped Local Draft Permits

**Project author and founding architect:** Alexander Nikolaevich Romaskevich (RomaskevicH)  
**Date:** 2026-11-05 · **Status:** source implementation and automated tests; not production authorization.

## The boundary strengthened

The previous local HMAC permit authorized an action by mission ID alone. The
same ID could be paired with a different goal, model or model route by a caller
holding a valid permit. Version 2 binds the validated mission ID and goal,
explicit model authorization, the selected route and model identifier to one
SHA-256 scope digest covered by the HMAC. The gated plan runner, local task
generator and reviewed VELION bridge verify their own exact scope before making
the provider request. Substitution fails closed.

The permit has a maximum lifetime of five minutes. Replay is rejected when a
caller reuses the **same process-local Set**; a fresh process or a new Set is
not a durable replay store. Successful verification permits only a draft-model
request. Generated code remains untrusted and release remains denied.

The goal itself is not included in the token, but its unsalted digest is not
confidentiality: predictable goals may be guessed. Keep permits and shared
secrets private.

## Migration and operation

The local issue and verify functions now require a complete validated mission,
an explicit route and model. Callers in this repository were updated together.
Version-1 tokens are rejected even if their HMAC is valid; issue a new
short-lived version-2 token rather than attempting to upgrade or reuse an old
token. Existing command-line entry points retain their documented arguments.

The local permit is issued and verified using a shared process secret. It does
not authenticate a person, replace an Ed25519 AI Passport, implement Guardian
Core or Approval Gateway, enforce spend quotas, provide durable revocation, or
protect against a hostile process that already controls the secret or calls
lower-level provider adapters directly. Such callers must remain outside the
trusted control plane. No key enrollment or production deployment is supplied.

The Ollama request now uses the provider's documented `num_predict` option to
request a maximum of 4096 generated tokens, instead of the unrecognized
`max_predict` option. A reported non-stop completion, including a length
cutoff, is rejected. The request parameter and mocked tests do not prove that a
particular running provider honored the limit; live usage and cost remain
unverified. [Ollama API reference](https://github.com/ollama/ollama/blob/main/docs/openapi.yaml).

The local regression tests cover altered goals, IDs, routes, models, expiration,
replay, forged and legacy tokens, and ensure the model transport is never
called after scope substitution. See
[local permit tests](../test/local-permit.test.js),
[Groq gateway tests](../test/groq-gateway.test.js) and
[VELION task tests](../test/velion-task-build.test.mjs).

## Next trust milestone

Replace the process-local secret and replay Set with independently verifiable
scoped identities, an authorized persistent replay/revocation store, explicit
budgets and a trusted policy decision. Bind acceptance and sandbox evidence to
a trusted producer before considering an owner-signed review or production
release. A checksum or a model-generated test log is not an attestation.
