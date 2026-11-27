/**
 * IMPERIAL Core — project authorship and architectural provenance.
 * Project author / Founding Architect: Ромаскевич Александр Николаевич
 * International name: Alexander Nikolaevich Romaskevich (RomaskevicH)
 * GitHub: https://github.com/oromaskevic23-cmd
 * Individual source contributions and third-party rights: see AUTHORS.md and Git history.
 */
import {createTask, updateTask, toggleTask, deleteTask, filterTasks, taskCounts, parseStoredTasks} from "./tasks.js";

const STORAGE_KEY = "constructor_ai_task_manager_v1";
const form = document.querySelector("#task-form");
const titleField = document.querySelector("#title");
const descriptionField = document.querySelector("#description");
const submitButton = document.querySelector("#submit-task");
const cancelButton = document.querySelector("#cancel-edit");
const taskList = document.querySelector("#task-list");
const message = document.querySelector("#message");
const storageWarning = document.querySelector("#storage-warning");
const counts = {
  total: document.querySelector("#count-total"),
  active: document.querySelector("#count-active"),
  completed: document.querySelector("#count-completed")
};
let tasks = [];
let selectedFilter = "all";
let editingId = null;
let storageReadBlocked = false;
let storage;
let lastStoredRaw = null;
let storageChanged = false;

function notify(text, error = false) {
  message.textContent = text;
  message.dataset.state = error ? "error" : "ok";
}

function warnStorage(text) {
  storageWarning.textContent = text;
  storageWarning.hidden = !text;
}

function markStorageChanged() {
  storageChanged = true;
  warnStorage("Stored tasks changed outside this tab. New edits here stay in memory only. Copy anything you need before reloading.");
}

try {
  storage = window.localStorage;
  lastStoredRaw = storage.getItem(STORAGE_KEY);
  tasks = lastStoredRaw === null ? [] : parseStoredTasks(lastStoredRaw);
} catch {
  storageReadBlocked = true;
  submitButton.disabled = true;
  warnStorage("Stored tasks could not be read or validated. Saving is disabled to preserve existing data. Restore access or recover the stored data before continuing.");
}

window.addEventListener("storage", event => {
  if (storageReadBlocked || event.storageArea !== storage) return;
  if (event.key === STORAGE_KEY || event.key === null) markStorageChanged();
});

function persist(nextTasks) {
  if (storageReadBlocked) throw new Error("Saving is disabled because stored tasks could not be read or validated.");
  tasks = nextTasks;
  let saved = false;
  if (!storageChanged) {
    try {
      if (storage.getItem(STORAGE_KEY) !== lastStoredRaw) {
        markStorageChanged();
      } else {
        const raw = JSON.stringify(tasks);
        storage.setItem(STORAGE_KEY, raw);
        lastStoredRaw = raw;
        saved = true;
        warnStorage("");
      }
    } catch {
      warnStorage("Browser storage is unavailable. Changes are only in memory and will be lost when this page closes.");
    }
  }
  render();
  return saved;
}

function actionButton(label, action, id, extraClass = "") {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "task-action " + extraClass;
  button.textContent = label;
  button.dataset.action = action;
  button.dataset.id = id;
  return button;
}

function render() {
  if (storageReadBlocked) {
    Object.keys(counts).forEach(k => { counts[k].textContent = "—"; });
    taskList.replaceChildren();
    const unavailable = document.createElement("li");
    unavailable.className = "empty-state";
    unavailable.textContent = "Stored tasks are unavailable.";
    taskList.append(unavailable);
    return;
  }
  const totals = taskCounts(tasks);
  Object.keys(counts).forEach(k => { counts[k].textContent = String(totals[k]); });
  taskList.replaceChildren();
  const visible = filterTasks(tasks, selectedFilter);
  if (!visible.length) {
    const empty = document.createElement("li");
    empty.className = "empty-state";
    empty.textContent = tasks.length ? "No tasks match this filter." : "No tasks yet. Create your first one above.";
    taskList.append(empty);
    return;
  }
  for (const task of visible) {
    const item = document.createElement("li");
    item.className = "task" + (task.completed ? " is-done" : "");

    const details = document.createElement("div");
    details.className = "task-details";
    const heading = document.createElement("h3");
    heading.textContent = task.title;
    details.append(heading);
    if (task.description) {
      const description = document.createElement("p");
      description.textContent = task.description;
      details.append(description);
    }

    const controls = document.createElement("div");
    controls.className = "task-controls";
    controls.append(
      actionButton(task.completed ? "Reopen" : "Complete", "toggle", task.id),
      actionButton("Edit", "edit", task.id),
      actionButton("Delete", "delete", task.id, "danger")
    );
    item.append(details, controls);
    taskList.append(item);
  }
}

form.addEventListener("submit", event => {
  event.preventDefault();
  try {
    const input = {title: titleField.value, description: descriptionField.value};
    const now = new Date().toISOString();
    const next = editingId
      ? updateTask(tasks, editingId, input, now)
      : createTask(tasks, input, {id: crypto.randomUUID(), now});
    const saved = persist(next);
    const action = editingId ? "Task updated" : "Task created";
    notify(saved ? action + "." : action + " in memory only.", !saved);
    resetEditor();
  } catch (error) {
    notify(error.message || "Unable to save task.", true);
  }
});

function resetEditor() {
  editingId = null;
  form.reset();
  submitButton.textContent = "Create task";
  cancelButton.hidden = true;
}

cancelButton.addEventListener("click", () => { resetEditor(); notify("Editing cancelled."); });

taskList.addEventListener("click", event => {
  const button = event.target.closest("button[data-action]");
  if (!button || !taskList.contains(button)) return;
  const {action, id} = button.dataset;
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  try {
    if (action === "toggle") {
      const saved = persist(toggleTask(tasks, id, new Date().toISOString()));
      notify(saved ? "Task status updated." : "Task status updated in memory only.", !saved);
    } else if (action === "delete") {
      if (!window.confirm("Permanently remove this task from this browser?")) return;
      const saved = persist(deleteTask(tasks, id));
      if (editingId === id) resetEditor();
      notify(saved ? "Task deleted." : "Task deleted in memory only.", !saved);
    } else if (action === "edit") {
      editingId = id;
      titleField.value = task.title;
      descriptionField.value = task.description;
      submitButton.textContent = "Save changes";
      cancelButton.hidden = false;
      titleField.focus();
      notify("Editing selected task.");
    }
  } catch (error) {
    notify(error.message || "Action failed.", true);
  }
});

document.querySelector("#filters").addEventListener("click", event => {
  const button = event.target.closest("button[data-filter]");
  if (!button) return;
  selectedFilter = button.dataset.filter;
  document.querySelectorAll("[data-filter]").forEach(b => {
    b.setAttribute("aria-pressed", String(b === button));
  });
  render();
});

render();
