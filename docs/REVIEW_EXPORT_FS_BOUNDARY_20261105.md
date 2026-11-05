# CONSTRUCTOR AI — Local Review Export Filesystem Boundary

**Project author and founding architect:** Alexander Nikolaevich Romaskevich (RomaskevicH)  
**Date:** 2026-11-05 · **Status:** source hardening on an isolated review branch. CI and production deployment are separate evidence gates.

## Security finding

The local-review exporter previously used a file metadata check followed by a path-based read. A final-component symlink could be switched between these operations. The exporter also enumerated `stage/test` without first rejecting a symlinked intermediate directory. Permitting stage, replay-claim, and output directories to overlap could lead to unexpected source inventory changes or conflicting evidence storage.

These are **local input and artifact integrity risks**, not evidence that an actual intrusion occurred.

## Implemented scope

- Read input files through a single `open(O_NOFOLLOW)` file descriptor, check the descriptor metadata, and reject a final symlink; keep the input size cap.
- Reject a symlinked `stage/test` directory before enumerating or reading generated test source.
- Reject identical, nested, or parent-child relationships among the canonical source stage, persistent replay-claim directory and local review-copy directory.
- Preserve one-time Owner approval consumption, independent signed QA requirements, export-only scope, and `productionRelease: DENIED`.
- Add adversarial offline tests for directory symlinks, source-file symlinks, nested export/replay paths and identical trust directories.

## Explicit limitations

This revision does **not** prove safe operation while an untrusted concurrent process can rename an intermediate directory between validation and file opening. Production use requires an exclusive, permission-restricted host workspace or a directory-descriptor/openat-style containment design, plus secure storage, revocation, enrolled Owner and QA trust roots and independent sandbox attestation.

These are local source and negative tests only: they do not establish a live LLM worker, a secure VM, production AI Passport, deployment approval or buyer acceptance.

## Acceptance

On the proposed branch, run:

```bash
node --test test/review-export-filesystem.test.mjs test/task-review-export.test.mjs
npm run verify
```

Do not merge or call this production-ready unless independent CI verifies the exact branch head and the Owner approves promotion under the existing Approval Gateway policy.
