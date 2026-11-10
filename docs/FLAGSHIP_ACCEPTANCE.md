# CONSTRUCTOR AI — Independent Flagship Acceptance

## Product and honest scope

**Scope:** Template Studio for three reviewed, local single-user applications: Task Manager, Business CRM and Business Dashboard. All are exportable as ZIPs with editable JavaScript, source-hash integrity checks, local HTTP server, record CRUD tests and validated JSON backup/restore.

**Not claimed:** arbitrary prompt-to-production AI generation, agent autonomy, deployed NCA fleet, customer identity, cloud storage, tenant isolation, independent security certification, or commercial production readiness. SHA-256 hashes establish integrity against the shipped manifest, not authorship or trusted signing.

## Reviewer checklist (Node.js 22+, npm, unzip)

Clone the repository at an immutable commit SHA and record that SHA. No AI token or paid account is necessary for reviewed templates.

~~~sh
npm ci --ignore-scripts --no-audit --no-fund
npm run verify
node tools/build-acceptance.mjs acceptance-output
node tools/verify-acceptance.mjs acceptance-output
cat acceptance-output/acceptance-manifest.json
~~~

The build writes **three ZIPs** to a new, non-existing directory: tasks-local-app.zip, crm-local-app.zip, dashboard-local-app.zip. The manifest records each ZIP's SHA-256, size, and — only when provided by the CI environment — the source commit. It does not imply independent certification.

For **each** ZIP, create a separate clean directory, extract, then run:

~~~sh
npm run verify
npm test
npm start
~~~

Open http://127.0.0.1:4174 in a browser. Use only **one local app server at a time**, as exported apps use the same port. Generated applications have no install-time dependencies.

### Human browser acceptance (repeat for all three app types)

1. Create a record and confirm the summary increases.
2. Edit the title, change the status, search by the edited title and confirm the result.
3. Download **Export data**, then delete the record.
4. Select the saved file with **Restore JSON backup**. Confirm replacement and verify the original record and totals return.
5. Repeat restore but cancel confirmation; verify the current workspace is unchanged.
6. Try invalid JSON, a mismatched template and a backup with a duplicate record ID; each must be rejected without modifying records.
7. Reload and confirm persistence in the same browser's localStorage (unless storage is disabled); preview mode intentionally uses temporary memory.
8. Modify a source file inside an extracted application and run npm run verify: integrity checking must fail. Re-extract the original ZIP before continuing.

The repository automated suite covers record operations, invalid backups, generated tests, ZIP safety, server routes and integrity tampering. CI separately extracts all three ZIPs into clean directories and executes each application's own integrity check and tests.

### Automated real-browser gate

The independent Chromium workflow at .github/workflows/flagship-browser.yml launches the actual Studio in a real Chromium browser, downloads one ZIP for each template, verifies extracted integrity and automated tests, and drives create/edit/status/search/delete, backup export, malformed/cross-template rejection, cancel/restore and reload persistence in each exported application. It uses a pinned ephemeral Playwright 1.64.1 installation (not a runtime product dependency), real browser binaries and synthetic local data only.

**Boundary:** Automated Chromium E2E evidence is not a human audit, penetration test, production deployment or multi-browser compatibility proof. Retain a separate human acceptance step for visual, accessibility, and mobile behavior. A newly added workflow is not labeled PASS until its actual GitHub Actions run succeeds for a specified source commit.

To retain a genuine task-application screenshot from a successful local run,
use an already installed compatible Playwright/Chromium, a clean Git checkout
and an existing empty directory outside that checkout:

~~~sh
export CONSTRUCTOR_TESTED_COMMIT="$(git rev-parse HEAD)"
export CONSTRUCTOR_BROWSER_EVIDENCE_DIR="/absolute/path/to/existing/evidence-directory"
node e2e/browser-acceptance.mjs
~~~

The optional evidence output records the checkout SHA, browser/Node versions,
test outcomes and screenshot hash. It is unsigned local evidence, not an
independent security attestation. No screenshot is copied until the browser
acceptance run succeeds. Browser installation and any cloud execution remain
subject to the operator's verified budget and authorization.

## Public GitHub Pages delivery gate

The separate public-delivery workflow checks the actual public GitHub Pages URL over HTTPS, verifies all nine published assets against the source-bound SHA-256 deployment manifest, rejects stale links or missing backup support, and retains a downloadable JSON evidence artifact. The pinned source revision must be disclosed: the public deployment is not automatically identical to every later main-branch commit. A successful source CI alone never establishes successful public delivery. This gate is read-only and runs only when explicitly triggered by GitHub workflows, not as autonomous monitoring.

## Evidence and failure policy

- Bind each result to the exact source commit and acceptance-manifest.json.
- Save the GitHub Actions run URL, logs and failure details. Do not call a skipped, failed or unrun gate PASS.
- Fail closed on invalid backups, incompatible template, oversized file, duplicate identity, corrupted source or missing ZIP.
- Restoration is an explicit replacement, not a merge. Keep independent backups.
- No production release or customer-data import is authorized by passing local checks.
- Exported source may have proprietary rights; inspection/running does not establish permission to redistribute or sell it.

**Author and founding architect:** Alexander Nikolaevich Romaskevich (RomaskevicH), IMPERIAL Core. Third-party rights remain unaffected.
