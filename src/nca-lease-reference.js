// Universal NCA reference: deterministic in-memory lease/fencing prototype.
// Not a durable queue, Owner Authority, or production authorization mechanism.
export function createQueue() { return { tasks: new Map(), epochs: new Map(), stopped: false }; }
export function enqueue(queue, { id, payload }) {
  if (queue.stopped) throw new Error("OWNER_STOP");
  if (typeof id !== "string" || !/^[a-zA-Z0-9_-]{1,64}$/.test(id)) throw new TypeError("Invalid task id");
  if (queue.tasks.has(id)) return false;
  queue.tasks.set(id, { id, payload, state: "QUEUED", lease: null, result: null });
  queue.epochs.set(id, 0);
  return true;
}
export function claim(queue, id, worker, now, ttlMs = 30000) {
  if (queue.stopped) throw new Error("OWNER_STOP");
  if (typeof worker !== "string" || !worker || !Number.isFinite(now) || !Number.isSafeInteger(ttlMs) || ttlMs < 1 || ttlMs > 300000) throw new TypeError("Invalid lease");
  const task = queue.tasks.get(id);
  if (!task || !["QUEUED", "RUNNING"].includes(task.state)) return null;
  if (task.lease && task.lease.expiresAt > now) return null;
  const epoch = queue.epochs.get(id) + 1;
  queue.epochs.set(id, epoch);
  task.lease = { worker, epoch, expiresAt: now + ttlMs };
  task.state = "RUNNING";
  return { id, worker, epoch };
}
export function complete(queue, token, now, result) {
  if (queue.stopped) throw new Error("OWNER_STOP");
  if (!Number.isFinite(now)) throw new TypeError("Invalid timestamp");
  const task = queue.tasks.get(token?.id);
  if (!task || !task.lease || task.lease.worker !== token.worker || task.lease.epoch !== token.epoch || !(task.lease.expiresAt > now)) throw new Error("STALE_LEASE");
  task.result = result;
  task.state = "VERIFYING"; // Independent QA, not worker, may mark COMPLETED.
  task.lease = null;
  return true;
}
export function ownerStop(queue) {
  queue.stopped = true;
  for (const task of queue.tasks.values()) {
    if (task.state !== "COMPLETED") { task.state = "STOPPED"; task.lease = null; }
  }
}
