/**
 * IMPERIAL Core — project authorship and architectural provenance.
 * Project author / Founding Architect: Ромаскевич Александр Николаевич
 * International name: Alexander Nikolaevich Romaskevich (RomaskevicH)
 * GitHub: https://github.com/oromaskevic23-cmd
 * Individual source contributions and third-party rights: see AUTHORS.md and Git history.
 */
import {createTask, updateTask, toggleTask, deleteTask, filterTasks, taskCounts, parseTaskStorage} from "./tasks.js";

const STORAGE_KEY = "constructor_ai_task_manager_v1";
const form = document.querySelector("#task-form");
const titleField = document.querySelector("#title");
const descriptionField = document.querySelector("#description");
const submitButton = document.querySelector("#submit-task");
const cancelButton = document.querySelector("#cancel-edit");
const taskList = document.querySelector("#task-list");
const message = document.querySelector("#message");
const searchField = document.querySelector("#search-tasks");
const storageWarning = document.querySelector("#storage-warning");
const counts = {
  total: document.querySelector("#count-total"),
  active: document.querySelector("#count-active"),
  completed: document.querySelector("#count-completed")
};
let tasks = [];
let selectedFilter = "all";
let editingId = null;
let storageAvailable = true;

function notify(text, error = false) {
  message.textContent = text;
  message.dataset.state = error ? "error" : "ok";
}

function warnStorage(text) {
  storageAvailable = false;
  storageWarning.textContent = text;
  storageWarning.hidden = false;
}

try {
  tasks = parseTaskStorage(window.localStorage.getItem(STORAGE_KEY));
} catch {
  warnStorage("Saved tasks could not be loaded and have not been replaced. Changes will remain only in this session.");
}

function persist(nextTasks) {
  tasks = nextTasks;
  if (storageAvailable) {
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks)); }
    catch { warnStorage("Browser storage is unavailable. Changes will remain only in this session."); }
  }
  render();
}

function actionButton(label, action, id, title, extraClass = "") {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "task-action " + extraClass;
  button.textContent = label;
  button.setAttribute("aria-label", label + ": " + title);
  button.dataset.action = action;
  button.dataset.id = id;
  return button;
}

function render() {
  const totals = taskCounts(tasks);
  Object.keys(counts).forEach(k => { counts[k].textContent = String(totals[k]); });
  taskList.replaceChildren();
  const visible = filterTasks(tasks, selectedFilter, searchField.value);
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
      actionButton(task.completed ? "Reopen" : "Complete", "toggle", task.id, task.title),
      actionButton("Edit", "edit", task.id, task.title),
      actionButton("Delete", "delete", task.id, task.title, "danger")
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
    persist(next);
    notify(editingId ? "Task updated." : "Task created.");
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
      persist(toggleTask(tasks, id, new Date().toISOString()));
      notify("Task status updated.");
      const updated = [...taskList.querySelectorAll("button[data-action]")].find(b => b.dataset.id === id && b.dataset.action === "toggle");
      (updated || searchField).focus();
    } else if (action === "delete") {
      if (!window.confirm("Permanently remove this task from this browser?")) return;
      persist(deleteTask(tasks, id));
      if (editingId === id) resetEditor();
      notify("Task deleted.");
      searchField.focus();
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

searchField.addEventListener("input", render);
render();
