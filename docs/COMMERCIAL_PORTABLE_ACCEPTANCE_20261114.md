# Commercial pilot — portable export acceptance, 2026-11-14

Tested source revision: `fa6e2674de1464ebe25cd93fa55383e46c860436`. Scope: built-in local templates, not real-model-generated software.

## Local reproducibility and verification

Node.js v22.16.0. Network DNS prevented a direct clone; exact files were reconstructed from GitHub connector responses and validated with git hash-object before use. All eight relevant source/test blobs matched:
- project-domain.mjs: 6b4d0b7b1ba2729e81569f41f55b5bf9bdffca0b
- project-runtime.mjs: c551676bafefba9f20431d8207b1e0004f4a1f57
- project-backup.mjs: cddee99d1427f5d60bec9402360476e8332ba590
- project.css: 5b915ef4f1d17ba61396cf220ed1dc9c16e375ae
- project-export.mjs: 06ffc285594c83071a3272dfc38d6e26f9e72bc4
- zip.mjs: 38f6232ee26f49c3ec8df3eb912c2851f26c7832
- tools/build-acceptance.mjs: f2eda59f679bef8ac536e04029f934b938dacf81
- test/commercial-csv.test.mjs: 8c0c2f99c6720e6dc0b2601fb492f10a73183525

Built with GITHUB_SHA set to the tested revision: `node tools/build-acceptance.mjs NEW_DIR`. Repeated build produced byte-identical archives and manifest. Extracted each ZIP into a separate directory, ran `node verify.mjs` and `node --test test/app.test.mjs test/backup.test.mjs`. All 36 listed file hashes matched (12 per app), all 6 exported tests passed, and all 8 CSV source tests passed (14 tests total; 0 failures).

| Template | ZIP bytes | SHA-256 |
|---|---:|---|
| Task Manager | 28356 | ef6c17bc7242b6b41048b0abf637c5ae40e6044089bf2dc5c32d0aaad7313275 |
| Business CRM | 28342 | 18b8dde41b5a8d4ff1161445564fafa6459cb9309dce805c7ea022ef531303fd |
| Business Dashboard | 28385 | 08ba4e49c612a5f3a162d9c3595183affd583fae2f3d9e2c2e6467edb903b3b6 |

## Blocking gates

Actual Chromium 144.0.7559.96 browser navigation was attempted against the exported Task Manager server. The HTTP server responded to a local HTTP probe, but Chromium returned ERR_BLOCKED_BY_ADMINISTRATOR on localhost. Browser CSV download and interactive acceptance were NOT RUN TO COMPLETION. Do not bypass environment policy. Full repository verification, independent QA, real model-generated app acceptance, rights review and commercial release remain pending. No CI or cloud resources were used. No claim of paying customers, production readiness or external certification.

The three archives are reproducible local template exports, not a customer deployment. Re-run browser acceptance on an authorized environment before merging the CSV candidate.
