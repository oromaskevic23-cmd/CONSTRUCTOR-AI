# Verified Engineering Fabric — Beyond Enterprise Standard v1.0

**Status:** Proposed corporate engineering quality system with initial repo-local tests; not a third-party certification or verified production maturity.

## Five independently checkable pillars

1. **Deterministic behavior.** Given inputs and an explicit clock/ID, reference operations are repeatable, testable and free from implicit network/provider effects.
2. **Trustworthy provenance.** Source/version hashes, author and dependency attribution, no history rewriting, signed/approved scope where applicable.
3. **Security by negative tests.** Deny untrusted paths, reject malformed records, enforce quotas, constrain tool privileges and preserve human control.
4. **Independent evidence.** Tests and smoke checks are actually executed; a CI workflow creates an inspectable source inventory after successful checks. Never fake an attestation.
5. **Reversible releases.** Audit the exact SHA, environment and artifacts; record migration/rollback plans and known blockers, release only with owner approval.

## Definition of proof

| Level | Acceptance evidence |
|---|---|
| E0 | Design and architecture document |
| E1 | Explicit API and security acceptance criteria |
| E2 | Code implementing the documented behavior |
| E3 | Unit, syntax and static checks with actual output |
| E4 | Integration with external components in target environment |
| E5 | Real end-to-end runtime, including authorized model → sandbox → QA |
| E6 | Production deployment with audit, monitoring and operator approval |

The reference Task Manager does **not** satisfy E4–E6 for the autonomous platform. Its local server HTTP smoke test demonstrates only the HTTP serving boundary, not real platform integration.

## Pull-request change contract

- Scope and reason described; Conventional Commit headline.
- Changes minimize attack surface and preserve identity/approval limits.
- Tests match touched behavior; negative tests for auth, quotas and invalid input.
- Actual commands and outcomes attached; CI status verified on the exact commit.
- Dependencies/licenses/LLM assistance identified; original authorship respected.
- Release evidence includes risks, rollbacks, signatures if implemented and owner authorization.
- Public documentation excludes keys, private algorithms and non-public customer data.

## Proof passport proposal

```json
{
  "schema": "constructor_proof_passport_v1",
  "mission_id": "EXAMPLE-NOT-ISSUED",
  "source_commit_sha": "EXAMPLE",
  "policy_version": "PROPOSED",
  "independent_qa": "NOT_VERIFIED",
  "verification_level": "E0",
  "tests": [],
  "authorization_evidence": null,
  "release_decision": "DENIED"
}
```

Example above is a **proposal**, not a signed passport; the CI SHA-256 inventory is not a passport or a verified independent attestation.

## Free-only policy

No paid API calls, subscriptions, bank or token transactions without owner authorization. Test and reference build run with Node's standard library and no runtime npm dependencies. A billion-agent future horizon cannot be assumed to run for free.
