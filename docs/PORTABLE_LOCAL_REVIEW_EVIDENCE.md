# CONSTRUCTOR AI — Portable signed local-review evidence

Scope: **local review only**. This is NOT production release, sandbox attestation, trusted key enrollment or an authenticated Audit Ledger.

The local exporter now copies these exact inputs along with the generated source: `stage-manifest.json`, `qa.log`, `qa-attestation.json`, `owner-approval.json`. The `review-proof.json` v2 inventory binds each exported source file to its SHA-256.

Offline inspection, using **independently trusted** Owner and QA public keys and an independently reviewed QA suite:

```sh
node tools/verify-local-review.mjs REVIEW_DIRECTORY OWNER_PUBLIC_PEM QA_PUBLIC_PEM QA_SUITE_FILE
```

The read-only verifier rejects modified source, missing or extra files, unexpected symlinks, mismatched QA log/manifest, false proof fields, invalid QA or Owner signatures and wrong suite hash. It checks signatures at the **signed** approval issuedAt for historical inspection; this does **not** establish a trusted timestamp, independent key enrollment, real QA isolation, current Owner authorization, or replay protection. The exporter retains live expiry checks and its persistent replay claim. Never treat read-only verification as authorization to execute or publish.

Review packages may contain sensitive model-generated code, task metadata and QA logs. Share only through explicitly approved channels. Tests use synthetic keys and QA claims. No live VELION model or production workflow is claimed.
