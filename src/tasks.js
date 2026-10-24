// CONSTRUCTOR AI reference: pure, deterministic task-domain operations. No model/network execution.
export const MAX_TASKS = 250;
export const MAX_TITLE_LENGTH = 120;
export const MAX_DESCRIPTION_LENGTH = 500;
const ID_FORMAT = /^[A-Za-z0-9_-]{1,64}$/;

export function normalizeTitle(value) {
  if (typeof value !== "string") throw new TypeError("Task title must be text");
  const result = value.trim().replace(/\s+/g, " ");
  if (!result || result.length > MAX_TITLE_LENGTH || /[\u0000-\u001f\u007f]/.test(result)) {
    throw new RangeError("Task title must contain 1–120 printable characters");
  }
  return result;
}

export function normalizeDescription(value = "") {
  if (typeof value !== "string") throw new TypeError("Description must be text");
  const result = value.trim();
  if (result.length > MAX_DESCRIPTION_LENGTH || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(result)) {
    throw new RangeError("Description must contain at most 500 characters");
  }
  return result;
}

function validDate(value) {
  return typeof value === "string" && /^\d{4}-\d\d-\d\dT/.test(value) && !Number.isNaN(Date.parse(value));
}

export function isTask(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  try {
    return typeof value.id === "string" && ID_FORMAT.test(value.id) &&
      normalizeTitle(value.title) === value.title &&
      normalizeDescription(value.description) === value.description &&
      typeof value.completed === "boolean" &&
      validDate(value.createdAt) && validDate(value.updatedAt);
  } catch {
    return false;
  }
}

function assertState(tasks) {
  if (!Array.isArray(tasks) || tasks.length > MAX_TASKS || tasks.some(task => !isTask(task))) {
    throw new TypeError("Invalid task state");
  }
  const ids = tasks.map(task => task.id);
  if (new Set(ids).size !== ids.length) throw new TypeError("Duplicate task identifiers");
}

function timestamp(value) {
  if (!validDate(value)) throw new TypeError("Invalid ISO timestamp");
  return value;
}

export function createTask(tasks, input, meta) {
  assertState(tasks);
  if (tasks.length >= MAX_TASKS) throw new RangeError("Maximum number of tasks reached");
  if (!input || typeof input !== "object") throw new TypeError("Invalid task input");
  if (!meta || typeof meta.id !== "string" || !ID_FORMAT.test(meta.id) || tasks.some(t => t.id === meta.id)) {
    throw new TypeError("A unique valid task ID is required");
  }
  const time = timestamp(meta.now);
  const task = {
    id: meta.id, title: normalizeTitle(input.title),
    description: normalizeDescription(input.description ?? ""),
    completed: false, createdAt: time, updatedAt: time
  };
  return [task, ...tasks];
}

export function updateTask(tasks, id, input, now) {
  assertState(tasks);
  if (!tasks.some(task => task.id === id)) throw new RangeError("Task not found");
  if (!input || typeof input !== "object") throw new TypeError("Invalid update");
  const time = timestamp(now);
  return tasks.map(task => task.id === id ? {
    ...task,
    title: normalizeTitle(input.title),
    description: normalizeDescription(input.description ?? ""),
    updatedAt: time
  } : task);
}

export function toggleTask(tasks, id, now) {
  assertState(tasks);
  if (!tasks.some(task => task.id === id)) throw new RangeError("Task not found");
  const time = timestamp(now);
  return tasks.map(task => task.id === id ? {...task, completed: !task.completed, updatedAt: time} : task);
}

export function deleteTask(tasks, id) {
  assertState(tasks);
  if (!tasks.some(task => task.id === id)) throw new RangeError("Task not found");
  return tasks.filter(task => task.id !== id);
}

export function filterTasks(tasks, status = "all") {
  assertState(tasks);
  if (!["all", "active", "completed"].includes(status)) throw new RangeError("Invalid filter");
  return status === "all" ? [...tasks] : tasks.filter(task => task.completed === (status === "completed"));
}

export function taskCounts(tasks) {
  assertState(tasks);
  const completed = tasks.filter(t => t.completed).length;
  return {total: tasks.length, active: tasks.length - completed, completed};
}

export function loadTasks(raw) {
  if (typeof raw !== "string") return [];
  try {
    const parsed = JSON.parse(raw);
    assertState(parsed);
    return parsed.map(task => ({...task}));
  } catch {
    return [];
  }
}
