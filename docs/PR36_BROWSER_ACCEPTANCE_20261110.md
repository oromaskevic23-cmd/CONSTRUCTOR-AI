# PR 36 local browser acceptance checkpoint

This is a self-recorded local engineering check on 10 November 2026, not an
independent audit, a production release or proof of model-generated software.
The starting repository content was reconstructed from PR 36 head
`dac6154ed9a2fac1350562206b56c2e2840dbd17`; all 136 tracked file blobs were
checked against that Git tree before the browser-test fixes below.

## Dependency and repository checks

- Node.js 24.22.1; locked dependencies installed with
  `npm ci --ignore-scripts --no-audit --no-fund`. The installed
  `@supabase/supabase-js` version was 2.118.0.
- `npm run verify` completed: syntax checks, **196/196 Node tests**, IP
  metadata checks and source inventory. The metadata gate is not legal review.

## Real browser checks

Two defects in the existing acceptance script were reproduced and fixed:
the status filter locator also matched a status-change button, and a
`browser.newPage()`-owned context could not create the second tab needed for
the stale-storage test. A phone-sized Chromium touch context was also added.

On Chromium 153.0.8010.0 with Playwright 1.62.1, the updated browser suite
passed its five grouped scenarios:

1. Task Manager template: ZIP download and clean extraction, integrity and
   packaged tests, CRUD, search/status, backup/restore, reload, keyboard flow,
   safe text rendering, corrupt storage and cooperative stale-tab handling.
2. Business CRM template: ZIP, packaged tests, CRUD, storage error and recovery.
3. Business Dashboard template: ZIP, packaged tests, CRUD and backup/restore.
4. Local AI request with a synthetic fixture; no model-generated code executed.
5. Hosted-origin boundary: local AI token and request controls stayed disabled.

The Task Manager was additionally tested in a 375-by-812 mobile Chromium
viewport with touch input: create a task, change status, reload and check for
horizontal overflow. This is browser emulation, **not an iPhone, Safari,
native app, assistive-technology or physical-device test**.

The application bytes came from the verified PR tree; only the acceptance
script was changed. The checked-in script's SHA-256 was
`7d186d4113832998eeb4eb13973736be6e204be6a3d857d1a67b75ecbbe4f284`.
The local runner changed only the Chromium launch executable and arguments;
its SHA-256 was
`e2d0090d77105b85f82d010dad73f08cc6c4e514ba850afd1d7bac2535247b90`.
Chromium ran with `--no-sandbox` inside this temporary development environment;
this is not evidence of browser or application containment.

No real model request, full model-generated application, Docker isolation,
independent security review, remote hosting or release was performed. The
previous failed Docker run remains historical evidence. Any future CI result
must be checked against the exact later commit; this record is unsigned.
