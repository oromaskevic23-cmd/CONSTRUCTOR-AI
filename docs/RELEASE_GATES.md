# CONSTRUCTOR AI — Release Gates and Incident Rollback

**Current target:** Browser Task Manager reference `0.1.0`. Platform v1.0 and verified autonomous generation are **not released**.

## Required acceptance ladder

- **Gate 0 — Review:** source control provenance, scope, IP/license and owner approval for publication.
- **Gate 1 — Syntax / Unit:** `npm run check` and `npm test` must pass on the exact commit.
- **Gate 2 — Reference HTTP:** built-in smoke test checks allowlisted asset responses and denied methods/paths.
- **Gate 3 — Source inventory:** `node tools/verify.mjs` lists SHA-256 inputs, but the inventory is not a signed attestation.
- **Gate 4 — Browser acceptance:** manual or automated browser verification (data persistence, keyboard access, 250-task limit and no HTML execution). **NOT YET VERIFIED**.
- **Gate 5 — AI Pipeline:** verified model response → scoped mission → isolated build → tests → independent QA → authorization. **BLOCKED / NOT YET VERIFIED**.
- **Gate 6 — Production:** operational infrastructure, credential isolation, audit, monitoring, approved rollback, release signature. **NOT YET VERIFIED**.

**Fail closed:** never publish a “verified autonomous app” when Gate 5 has not passed.

## Rollback

Revert or deploy a previously verified commit SHA, and re-execute the full check suite. Browser-only localStorage data may be incompatible between future releases; preserve data migration design before changing storage schema. Production rollback is not implemented by this reference repo.

## Ownership

Product author attribution: Alexander Romaskevich (RomaskevicH); one-human founder-led project with LLM assistance. This document does not constitute a legal company incorporation, signed auditor report or patent.
