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

The repository automated suite covers record operations, invalid backups, generated tests, ZIP safety, server routes and integrity tampering. **This is not a real-browser E2E suite**; the human browser checklist remains a separate gate.

## Evidence and failure policy

- Bind each result to the exact source commit and acceptance-manifest.json.
- Save the GitHub Actions run URL, logs and failure details. Do not call a skipped, failed or unrun gate PASS.
- Fail closed on invalid backups, incompatible template, oversized file, duplicate identity, corrupted source or missing ZIP.
- Restoration is an explicit replacement, not a merge. Keep independent backups.
- No production release or customer-data import is authorized by passing local checks.
- Exported source may have proprietary rights; inspection/running does not establish permission to redistribute or sell it.

**Author and founding architect:** Alexander Nikolaevich Romaskevich (RomaskevicH), IMPERIAL Core. Third-party rights remain unaffected.
