# Task UI: browser and isolated-candidate evidence

**Scope:** a review-only Task UI shell for the restricted task-domain contract.
This is not an autonomously generated complete application, production
deployment, installed mobile app, or signed Owner-approved review export.

The UI supports adding, completing, reopening, deleting and filtering tasks,
with browser-local storage and text-only rendering. It checks domain return
values before incorporating them. Invalid storage is left intact; detected
cross-tab changes are kept in memory rather than overwriting stored data. The
cross-tab check is best effort and is not an atomic concurrency guarantee.

## Verified tests

On 2026-11-11, [GitHub Actions run 42955632434](https://github.com/oromaskevic23-cmd/CONSTRUCTOR-AI/actions/runs/42955632434)
completed successfully on
[commit 6754ffd73db443833fd08bb2b68812d83f98d211](https://github.com/oromaskevic23-cmd/CONSTRUCTOR-AI/commit/6754ffd73db443833fd08bb2b68812d83f98d211).
Its checks have different scopes:

1. Four DOM-emulation tests exercised the UI with a separately authored
   synthetic domain fixture, including text rendering, damaged storage,
   stale-tab detection, and invalid domain responses.
2. Chromium 156.0.8078.79 exercised the UI with that **synthetic fixture** at
   320×568, 375×812, and 1280×900. The checks covered creation, completion,
   reopening, filters, reload persistence, delete confirmation, text rendering,
   horizontal overflow, and a stale-tab case. This did **not** run the real
   model draft in Chromium.
3. In a separate read-only, non-root, network-disabled Docker container, two
   DOM-emulation tests exercised the UI with the **assistant-revised** domain
   module. The module's SHA-256 was verified before use. This was not a real
   browser, an unmodified autonomous model output, or a signed QA attestation.

The UI source is in [qa/task-ui](../qa/task-ui/README.md). Its entry point
deliberately references an absent `app.mjs`: a candidate is supplied only in
the isolated test environment. It does not export the candidate, deploy a site,
or change the existing Owner Approval Gateway. Prior to the successful run,
an earlier isolated UI test failed because its test dependencies were mounted
at the wrong path; that error was corrected and the successful run above
retested the updated files.

Local Chromium could not start in the development environment because a system
socket operation was denied. The recorded browser result is the separate GitHub
runner, not a local or physical-device test. No iPhone, Safari, Android device,
App Store installation, user data, autonomous workflow, live model call, or
production security certification was tested.
