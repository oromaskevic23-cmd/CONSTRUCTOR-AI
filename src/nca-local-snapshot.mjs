// Local-only persistence prototype for Universal NCA. NOT a distributed queue.
// Single writer only; no multi-process locks, DB transactions or production durability.
import { readFile, writeFile, rename, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

const VALID_STATES = new Set(["QUEUED", "RUNNING", "VERIFYING", "STOPPED"]);
export function snapshotQueue(queue) {
  if (!(queue.tasks instanceof Map) || !(queue.epochs instanceof Map) || typeof queue.stopped !== "boolean") throw new TypeError("Invalid queue");
  const tasks = [...queue.tasks.values()].map(t => {
    if (!t || typeof t.id !== "string" || !/^[A-Za-z0-9_-]{1,64}$/.test(t.id) || !VALID_STATES.has(t.state)) throw new TypeError("Invalid task");
    const epoch = queue.epochs.get(t.id);
    if (!Number.isSafeInteger(epoch) || epoch < 0) throw new TypeError("Invalid epoch");
    if (t.state === "RUNNING" && (!t.lease || t.lease.epoch !== epoch)) throw new TypeError("Invalid running lease");
    if (t.state !== "RUNNING" && t.lease !== null) throw new TypeError("Invalid inactive lease");
    return {id:t.id, payload:t.payload, state:t.state, lease:t.lease, result:t.result, epoch};
  });
  return JSON.stringify({schema:1, stopped:queue.stopped, tasks});
}
export function restoreQueue(raw) {
  const obj = JSON.parse(raw);
  if (!obj || obj.schema !== 1 || typeof obj.stopped !== "boolean" || !Array.isArray(obj.tasks) || obj.tasks.length > 10000) throw new TypeError("Invalid snapshot");
  const queue = {tasks:new Map(),epochs:new Map(),stopped:obj.stopped};
  for (const t of obj.tasks) {
    if (!t || typeof t.id !== "string" || !/^[A-Za-z0-9_-]{1,64}$/.test(t.id) || queue.tasks.has(t.id) || !VALID_STATES.has(t.state) || !Number.isSafeInteger(t.epoch) || t.epoch < 0) throw new TypeError("Invalid snapshot task");
    if (t.state === "RUNNING" && (!t.lease || t.lease.epoch !== t.epoch || typeof t.lease.worker !== "string" || !Number.isSafeInteger(t.lease.issuedAt) || !Number.isSafeInteger(t.lease.expiresAt) || t.lease.expiresAt <= t.lease.issuedAt)) throw new TypeError("Invalid lease");
    if (t.state !== "RUNNING" && t.lease !== null) throw new TypeError("Invalid inactive lease");
    if (obj.stopped && t.state !== "STOPPED") throw new TypeError("Inconsistent STOP snapshot");
    queue.tasks.set(t.id,{id:t.id,payload:t.payload,state:t.state,lease:t.lease,result:t.result});
    queue.epochs.set(t.id,t.epoch);
  }
  return queue;
}
export async function saveSnapshot(file, queue) {
  const snapshot = snapshotQueue(queue);
  await mkdir(dirname(file),{recursive:true});
  const temp = file + "." + process.pid + ".tmp";
  await writeFile(temp,snapshot,{flag:"wx",mode:0o600});
  await rename(temp,file);
}
export async function loadSnapshot(file) { return restoreQueue(await readFile(file,"utf8")); }
