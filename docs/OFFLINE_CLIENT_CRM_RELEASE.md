# CONSTRUCTOR AI × NCA Engineering Teams — Offline Client Pipeline CRM

**Sprint:** IC-CONSTRUCTOR-NCA-ISOLATED-PRODUCT-20261030  
**Status:** GitHub Actions product-build and independent automated QA gate; production release NOT AUTHORIZED.

## Deliverable

**Offline Client Pipeline** is a complete, portable local single-user Business CRM assembled from the already-reviewed CONSTRUCTOR AI Template Studio. A finished artifact contains HTML/CSS/JavaScript sources, a local HTTP server, a package manifest, SHA-256 file inventory, an automated functional test and README. It has no runtime dependencies or paid API requirements.

Supported business workflow: create and edit an opportunity, store a contact description and deal value, cycle through New / Qualified / Won, search/filter opportunities, view pipeline and Won value summaries, delete entries and export a JSON backup. Data resides in local browser storage only.

**Restrictions:** no authenticated users, shared multiuser database, actual client outreach, payment verification, cloud backup, email sync or real AI-generated product logic. Do not sell or describe it as an enterprise CRM without acceptance testing, legal rights review and Owner approval.

## Architecture / Five-role separation

Architect (final decision authority) → HANTER Command Center → federated orchestrators → professional NCA engineering teams → scoped execution.

| Role | Responsibility | Evidence in this sprint |
| --- | --- | --- |
| NCA-ARCHITECT | Lock product type, scope, and release gates | This document and fixed CRM template specification |
| NCA-BUILDER | Create standalone reviewed application | tools/build-offline-client-crm.mjs |
| NCA-TESTER | Run generated app's own hash checks & tests | Product-build-and-sandbox-test job |
| NCA-REVIEWER | Independently re-open artifact and test behavior, server and security | tools/qa-offline-client-crm.mjs in separate CI job |
| NCA-RELEASE_CURATOR | Preserve signed/reproducible test evidence | Two CI artifacts: product/build-proof and QA JSON |

**Important:** these are responsibility mappings, not proof that autonomous LLM NCA workers executed. The software workflow uses the deterministic existing generator and independent automated QA code. No VELION/Groq/other model inference occurs, and the previous HANTER dispatcher is not connected to this workflow. No signed AI Passport or real Approval Gateway is claimed.

## Actual build and independent execution

GitHub Actions [workflow](../.github/workflows/offline-client-crm.yml) uses two separate jobs:

1. Checkout only the triggering commit with credentials not persisted.
2. Pull the official Node 22 Linux container at the exact SHA-256 index digest specified in the workflow. This pin is required.
3. Run the reviewed generator **inside** a Docker container with \`--network=none\`, \`--read-only\`, a read-only source mount, a designated temporary output mount, \`--cap-drop=ALL\`, \`no-new-privileges\`, a non-root user and resource limits.
4. In another container with no network and a read-only product mount, run the generated application's built-in \`node verify.mjs\` and \`node --test test/app.test.mjs\`.
5. Upload the actual packaged application and its build proof as a downloadable GitHub Actions artifact.
6. A **different CI job** downloads the artifact and independently checks each SHA-256 source-file digest, the CRM operations and negative conditions, static browser CSP and DOM text safety, and the real localhost HTTP server's GET / HEAD / POST / 404 handling.
7. Only a passing QA job uploads \`qa.json\` that records actual checks. GitHub Action green is evidence of test success on that commit, not independent human certification.

No privileged Docker socket or host filesystem is mounted into the container; the container runs on an ephemeral GitHub runner. The network is denied **during app generation, product tests and independent QA**, but the runner retrieves the pinned image and GitHub Actions before the sandbox starts.

### Reproducing

Push or open a pull request containing the changed files and inspect the \`CONSTRUCTOR AI — isolated offline CRM product build and independent QA\` GitHub Actions workflow. In successful runs, download **both** artifacts:

- \`constructor-offline-client-crm-<commit>\`: \`offline-client-crm/\` with 11 product files and \`build-proof.json\`.
- \`constructor-offline-client-crm-qa-<commit>\`: separate \`qa.json\` detailing test outcomes.

On a trusted local machine with Node.js 22+, unpack the product and run:

\`\`\`sh
node verify.mjs
node --test test/app.test.mjs
node serve.mjs
\`\`\`

Open \`http://127.0.0.1:4174\` in a browser. Real interactive browser E2E is **not** covered; no customer data should be used for initial acceptance.

## Security, audit and promotion

- FREE_ONLY / no paid model calls / no external customer actions.
- No source-code execution of untrusted model output; only reviewed built-in template logic is assembled and tested.
- Fail-closed on build, manifest, app test, HTTP probe or QA failures.
- Build artifact and QA JSON have SHA-256 content digests, **not signatures**. Evidence is retained in GitHub Actions for 14 days; it is not a durable Audit Ledger/ProofGraph service.
- AI Passport, Enterprise Skills, Guardian Core, Approval Gateway, Audit Ledger, Owner Kill Switch, Zero Trust, Public/Private Boundary and CRYPTO IMPERIAL Ecosystem Boundary are unchanged.
- Signed identities, independent human QA, real agent inference, persistent NCA sessions, live application deployment and commercial release are not part of this milestone.

**Next hard gate:** real NCA-driven code changes using an authenticated, tightly scoped HANTER dispatch envelope, separate code execution sandbox, independently authored acceptance tests and Architect-approved release. This must not grant a model the ability to access private data or deploy.
