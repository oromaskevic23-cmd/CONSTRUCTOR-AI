# NCA Lease Reference — Isolated Test Evidence (2026-11-23)

Status: **PASS for isolated six-test reference suite only**. NOT full CONSTRUCTOR AI acceptance. Not a deployed always-on agent. This evidence was generated using local Node.js from the exact GitHub file blobs below; repository-wide checkout and full build were not performed.

- Repository: `oromaskevic23-cmd/CONSTRUCTOR-AI`
- Branch: `architecture/always-on-nca-control-plane-20261123`
- Source file: `src/nca-lease-reference.js`
- Source Git blob SHA: `7a732d6c5ada85ab116b65d0f8c45e3ccce86a41`
- Test file: `test/nca-lease-reference.test.js`
- Test Git blob SHA: `be6f104867a309b32f443f8ddbe4b1043485ebd2`
- Files retrieved using connected GitHub read tool; exact bytes independently confirmed with `git hash-object` in local isolated directory.
- Command: `node --experimental-default-type=module --test test/nca-lease-reference.test.js`
- Actual TAP result: `tests 6; pass 6; fail 0; cancelled 0; skipped 0; duration_ms 75.310781`
- Cases: duplicate task idempotency; one active lease; stale fencing rejection; no worker self-certification; owner STOP rejects claim/publication; invalid IDs/lease TTL denied.

**Limitations:** This is an in-memory reference module; ownerStop is a local boolean, NOT an independently authenticated Owner Authority. No durable queue, process restart, network sink, tenant boundary, browser, production server or full repository tests executed. No production security claims. No paid resources, Val Town, external effects or release. The full Smart Task Manager regression suite is not included in this test run. Independent code review and Owner approval remain required before merge.

**Decision:** isolated reference tests passed; enterprise readiness remains NOT VERIFIED.
