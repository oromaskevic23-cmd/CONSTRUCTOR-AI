import {createTask, updateTask, toggleTask, deleteTask, filterTasks, taskCounts, loadTasks} from "./tasks.js";

const STORAGE_KEY = "constructor_ai_task_manager_v1";
const form = document.querySelector("#task-form");
const titleField = document.querySelector("#title");
const descriptionField = document.querySelector("#description");
const submitButton = document.querySelector("#submit-task");
const cancelButton = document.querySelector("#cancel-edit");
const taskList = document.querySelector("#task-list");
const message = document.querySelector("#message");
const counts = {
  total: document.querySelector("#count-total"),
  active: document.querySelector("#count-active"),
  completed: document.querySelector("#count-completed")
};
let tasks = [];
let selectedFilter = "all";
let editingId = null;

function notify(text, error = false) {
  message.textContent = text;
  message.dataset.state = error ? "error" : "ok";
}

try {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  tasks = loadTasks(raw);
  if (raw && !tasks.length && raw !== "[]") notify("Stored data could not be validated. Nothing has been executed.", true);
} catch {
  notify("Browser storage is disabled. Changes will remain only until this page closes.", true);
}

function persist(nextTasks) {
  tasks = nextTasks;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  } catch {
    notify("Storage is unavailable. Changes are temporarily in memory.", true);
  }
  render();
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
    } else if (action === "delete") {
      if (!window.confirm("Permanently remove this task from this browser?")) return;
      persist(deleteTask(tasks, id));
      if (editingId === id) resetEditor();
      notify("Task deleted.");
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
