#!/usr/bin/env bash
set -euo pipefail
# REAL Linux guest, QEMU software-emulated CPU. Synthetic input only!
# Not a hardware-attested or production-hardened hostile-code sandbox.
[ "$CONSTRUCTOR_VM_EXPERIMENT_APPROVED" = "YES_SYNTHETIC_ONLY" ] || exit 2
for command in qemu-system-x86_64 busybox cpio gzip timeout ldd node curl python3; do
  command -v "$command" >/dev/null || { echo "MISSING_GUEST_BUILD_TOOL:$command"; exit 2; }
done
WORKDIR="$(mktemp -d /tmp/constructor-tcg-guest-XXXXXX)"
trap 'rm -rf -- "$WORKDIR"' EXIT
ROOT="$WORKDIR/root"
mkdir -p "$ROOT/bin" "$ROOT/dev" "$ROOT/proc" "$ROOT/sys" "$ROOT/work" "$ROOT/tmp" "$ROOT/lib"
cp -L "$(command -v busybox)" "$ROOT/bin/busybox"
ln -s busybox "$ROOT/bin/sh"
cp -L "$(command -v node)" "$ROOT/bin/node"
while IFS= read -r library; do
  [ -f "$library" ] || { echo "MISSING_SHARED_LIBRARY";exit 1; }
  cp -L --parents "$library" "$ROOT"
done < <(ldd "$(command -v node)" | awk '{for(i=1;i<=NF;i++) if($i ~ /^\//) print $i}' | sort -u)
cat > "$ROOT/work/guest.test.mjs" <<'NODETEST'
import test from "node:test";
import assert from "node:assert/strict";
import {existsSync,readFileSync,readdirSync} from "node:fs";
test("guest booted its own Linux kernel",()=>{
 assert.match(readFileSync("/proc/version","utf8"),/Linux version/);
});
test("no virtual network adapters attached",()=>{
 assert.deepEqual(readdirSync("/sys/class/net"),["lo"]);
});
test("host workspace and Docker socket are unavailable",()=>{
 assert.equal(existsSync("/home/runner/work"),false);
 assert.equal(existsSync("/var/run/docker.sock"),false);
});
test("guest actually executes Node acceptance logic",()=>{
 assert.equal(2+3,5);
});
NODETEST
cat > "$ROOT/init" <<'GUESTINIT'
#!/bin/busybox sh
export PATH=/bin:/usr/bin
/bin/busybox mount -t devtmpfs devtmpfs /dev
/bin/busybox mount -t proc proc /proc
/bin/busybox mount -t sysfs sysfs /sys
echo "CONSTRUCTOR_VM_GUEST_START"
echo "CONSTRUCTOR_VM_GUEST_KERNEL=$(/bin/busybox uname -r)"
/bin/node --test --test-reporter=tap /work/guest.test.mjs
EXIT=$?
echo "CONSTRUCTOR_VM_NODE_EXIT=$EXIT"
echo "CONSTRUCTOR_VM_GUEST_END"
/bin/busybox poweroff -f
GUESTINIT
chmod 755 "$ROOT/init"
KERNEL="$WORKDIR/vmlinuz-virt"
curl --fail --silent --show-error --location --retry 2 --max-time 120 \
  "https://dl-cdn.alpinelinux.org/alpine/v3.22/releases/x86_64/netboot/vmlinuz-virt" \
  -o "$KERNEL"
[ "$(stat -c%s "$KERNEL")" -gt 5000000 ] || { echo "BAD_KERNEL_SIZE";exit 1; }
KERNEL_SHA="$(sha256sum "$KERNEL" | awk '{print $1}')"
(cd "$ROOT" && find . -print0 | cpio --quiet --null -o --format=newc | gzip -9 > "$WORKDIR/rootfs.cpio.gz")
set +e
timeout -k 5s 120s qemu-system-x86_64 \
  -machine q35,accel=tcg -cpu qemu64 -smp 1 -m 768 \
  -kernel "$KERNEL" -initrd "$WORKDIR/rootfs.cpio.gz" \
  -append "console=ttyS0 rdinit=/init panic=1" \
  -display none -serial stdio -monitor none -nic none -no-reboot \
  > "$WORKDIR/guest.log" 2>&1
EXIT=$?
set -e
python3 - "$WORKDIR/guest.log" "$KERNEL_SHA" "$EXIT" <<'CHECK'
import hashlib,json,pathlib,re,sys
raw=pathlib.Path(sys.argv[1]).read_bytes()
text=raw.decode("utf8",errors="replace")
mandatory=("CONSTRUCTOR_VM_GUEST_START","CONSTRUCTOR_VM_GUEST_END",
           "CONSTRUCTOR_VM_NODE_EXIT=0","# tests 4","# pass 4","# fail 0",
           "CONSTRUCTOR_VM_GUEST_KERNEL=")
if len(raw)>65536 or any(token not in text for token in mandatory) or "not ok " in text:
    print("FAIL_CLOSED_VM_GUEST_OR_TEST_NOT_VERIFIED")
    print("GUEST_SERIAL_LOG_LAST_LINES",text[-2500:])
    sys.exit(1)
receipt={"schema":"constructor_tcg_vm_receipt_v1",
 "environment":"QEMU_TCG_REAL_LINUX_GUEST_UNATTESTED",
 "input":"STATIC_SYNTHETIC_TEST_ONLY",
 "guest_kernel_sha256":sys.argv[2],"guest_log_sha256":hashlib.sha256(raw).hexdigest(),
 "guest_node_tests":4,"guest_node_failures":0,
 "guest_network_device":"NONE","host_filesystem_mount":"NONE",
 "guest_attestation":"NOT_VERIFIED","kernel_publisher_signature":"NOT_VERIFIED",
 "model_generated_source_executed":False,
 "qemu_process_exit":int(sys.argv[3]),"release":"DENIED"}
with open("experimental-vm-receipt.json","x",encoding="utf8") as f:
    json.dump(receipt,f,indent=2);f.write("\n")
print(json.dumps(receipt,indent=2))
CHECK
