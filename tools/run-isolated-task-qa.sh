#!/usr/bin/env bash
# Project author and founding architect: Alexander Nikolaevich Romaskevich (RomaskevicH).
# Run UNTRUSTED Task Manager source only inside a locked-down Docker container.
# Usage: bash tools/run-isolated-task-qa.sh STAGE EXISTING_EVIDENCE_DIR
set -euo pipefail
if [[ $# -ne 2 ]]; then echo "Expected STAGE and EXISTING_EVIDENCE_DIR" >&2; exit 2; fi
ROOT="$(cd -- "$(dirname -- "$0")/.." && pwd -P)"
STAGE="$(realpath -e -- "$1")"
EVIDENCE="$(realpath -e -- "$2")"
[[ -d "$STAGE" && -d "$EVIDENCE" ]] || { echo "SAFE_DIRECTORIES_REQUIRED" >&2; exit 2; }
[[ "$STAGE" != "$EVIDENCE" ]] || { echo "EVIDENCE_AND_STAGE_MUST_BE_SEPARATE" >&2; exit 2; }
[[ ! -e "$EVIDENCE/candidate-tests.log" && ! -e "$EVIDENCE/independent-qa.log" && ! -e "$EVIDENCE/task-qa-observation.json" ]] || { echo "REFUSE_TO_OVERWRITE_EVIDENCE" >&2; exit 2; }
IMAGE="node@sha256:fe4f6d74e20370acb04ad889077d14d0f64a9c8ea6a42bc60cddf1e844699914"
docker image inspect "$IMAGE" >/dev/null 2>&1 || { echo "PINNED_SANDBOX_IMAGE_NOT_PRELOADED" >&2; exit 2; }
docker run --rm --pull=never --network=none --read-only \
 --user "$(id -u):$(id -g)" --cap-drop=ALL --security-opt=no-new-privileges \
 --pids-limit=64 --memory=256m --cpus=1 --tmpfs /tmp:rw,noexec,nosuid,size=33554432 \
 --mount "type=bind,src=$STAGE,dst=/work,readonly" \
 "$IMAGE" node --check /work/app.mjs
docker run --rm --pull=never --network=none --read-only \
 --user "$(id -u):$(id -g)" --cap-drop=ALL --security-opt=no-new-privileges \
 --pids-limit=64 --memory=256m --cpus=1 --tmpfs /tmp:rw,noexec,nosuid,size=33554432 \
 --mount "type=bind,src=$STAGE,dst=/work,readonly" \
 "$IMAGE" node --test --test-reporter=tap /work/test/app.test.mjs \
 | tee "$EVIDENCE/candidate-tests.log"
# Run trusted acceptance in a fresh container; do not load candidate-authored tests.
docker run --rm --pull=never --network=none --read-only \
 --user "$(id -u):$(id -g)" --cap-drop=ALL --security-opt=no-new-privileges \
 --pids-limit=64 --memory=256m --cpus=1 --tmpfs /tmp:rw,noexec,nosuid,size=33554432 \
 --mount "type=bind,src=$STAGE,dst=/work,readonly" \
 --mount "type=bind,src=$ROOT/qa,dst=/qa,readonly" \
 "$IMAGE" node --test --test-reporter=tap /qa/independent-task-suite.mjs \
 | tee "$EVIDENCE/independent-qa.log"
node "$ROOT/tools/verify-task-sandbox-qa.mjs" "$STAGE" \
 "$EVIDENCE/independent-qa.log" "$EVIDENCE/task-qa-observation.json"
echo "UNSIGNED_QA_LOG_RECORDED; RELEASE_DENIED"
