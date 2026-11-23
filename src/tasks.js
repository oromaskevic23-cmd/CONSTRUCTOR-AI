// CONSTRUCTOR AI reference: pure, deterministic task-domain operations. No model/network execution.
export const MAX_TASKS = 250;
export const MAX_TITLE_LENGTH = 120;
export const MAX_DESCRIPTION_LENGTH = 500;
const ID_FORMAT = /^[A-Za-z0-9_-]{1,64}$/;
// Prevent bidirectional display overrides in task text while retaining ordinary Unicode.
const BIDI_FORMAT_CONTROLS = /[\u202a-\u202e\u2066-\u2069]/;

export function normalizeTitle(value) {
  if (typeof value !== "string") throw new TypeError("Task title must be text");
  const result = value.trim().replace(/\s+/g, " ");
  if (!result || result.length > MAX_TITLE_LENGTH || /[\u0000-\u001f\u007f]/.test(result) || BIDI_FORMAT_CONTROLS.test(result)) {
    throw new RangeError("Task title must contain 1–120 printable characters");
  }
  return result;
}

export function normalizeDescription(value = "") {
  if (typeof value !== "string") throw new TypeError("Description must be text");
  const result = value.trim();
  if (result.length > MAX_DESCRIPTION_LENGTH || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(result) || BIDI_FORMAT_CONTROLS.test(result)) {
    throw new RangeError("Description must contain at most 500 characters");
  }
  return result;
}

function validDate(value) {
  if (typeof value !== "string") return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!match || Number.isNaN(Date.parse(value))) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  if (hour > 23 || minute > 59 || second > 59) return false;
  if (month < 1 || month > 12) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day >= 1 && day <= daysInMonth[month - 1];
}

export function isTask(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  try {
    return typeof value.id === "string" && ID_FORMAT.test(value.id) &&
      normalizeTitle(value.title) === value.title &&
      normalizeDescription(value.description) === value.description &&
      typeof value.completed === "boolean" &&
      validDate(value.createdAt) && validDate(value.updatedAt) &&
      Date.parse(value.updatedAt) >= Date.parse(value.createdAt);
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
  if (Date.parse(time) < Date.parse(tasks.find(task => task.id === id).updatedAt))
    throw new RangeError("Task update cannot precede previous update");
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
  if (Date.parse(time) < Date.parse(tasks.find(task => task.id === id).updatedAt))
    throw new RangeError("Task completion cannot precede previous update");
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
