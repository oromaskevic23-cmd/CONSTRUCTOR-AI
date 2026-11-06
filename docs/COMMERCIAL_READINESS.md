# Commercial release readiness

The founder's current direction is to develop CONSTRUCTOR AI, use it to build required applications, and consider selling or licensing the product when evidence supports a release. No buyer, valuation, revenue or transaction is established by this document.

| Gate | Current state | Evidence required before a commercial claim |
|---|---|---|
| Local template builder | Implemented in 0.4 | Repeatable export, data operations and integrity tests |
| Arbitrary AI application generation | Not verified. A bounded new local VELION/Ollama Task Manager code-generation pilot and synthetic Docker execution/QA path are introduced; no general-purpose, independently verified real-model full cycle. | Real authorized model response through an end-to-end application workflow, isolated QA, genuine Owner approval and explicit release scope |
| Isolated execution | A separate disposable offline Docker CI sandbox is added for synthetic generated Task Manager code; not a production host or general-purpose isolation guarantee | Host isolation, resource limits, secrets protection, adversarial tests and target-production attestation |
| Customer accounts and tenant separation | Not delivered by the template studio | Authentication, authorization and cross-tenant negative tests |
| Data recovery | Local JSON export and validated replace-import with explicit confirmation (flagship engineering increment); no cloud copies | Independent recovery, corruption and browser acceptance tests; production backup/recovery strategy |
| Build reproducibility | Exact dependency and lockfile pins | Clean CI installation and recorded commit-specific results |
| IP and licenses | Review required | Contributor and dependency inventory; actual rights to commercialize each component |
| Independent security assessment | Not completed | Findings, fixes and independent verification |
| Buyer delivery and support | Not agreed | Accepted scope, release package, transfer terms, support and maintenance obligations |

## Release evidence

Each proposed release should identify its exact source commit, dependency lockfile, artifact hashes, test results, known limitations and rollback path. CI success is one gate; it is not an Enterprise certification or proof that software is ready for sale.

Sale or license terms require the actual owner's authorization and review of applicable rights. Product development creates no authority to move funds, operate liquidity pools or make financial commitments.

## Technical buyer review gate

An additional [technical buyer evidence gate](BUYER_TECHNICAL_REVIEW.md) verifies all 12 offline CRM product-file hashes and binds the deterministic build proof to the separately produced automated QA report and exact source revision. A successful gate produces an **unsigned demo-only technical evidence packet**. It does not prove a signed Owner approval, external customer, sale, revenue, live model-generated full app, independent human security certification or commercial readiness. It adds no Supabase Cron or external provider calls.
