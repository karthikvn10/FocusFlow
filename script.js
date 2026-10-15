
"use strict";

const taskForm = document.getElementById("taskForm");
const taskInput = document.getElementById("taskInput");
const dueDateInput = document.getElementById("dueDate");
const priorityInput = document.getElementById("priority");
const taskList = document.getElementById("taskList");
const emptyMessage = document.getElementById("emptyMessage");
const filterTasks = document.getElementById("filterTasks");
const formMessage = document.getElementById("formMessage");

const totalCount = document.getElementById("totalCount");
const completedCount = document.getElementById("completedCount");
const remainingCount = document.getElementById("remainingCount");

const STORAGE_KEY = "focusflow.tasks.v1";

let tasks = [];

try {
  const saved = localStorage.getItem(STORAGE_KEY);
  const parsed = saved ? JSON.parse(saved) : [];
  tasks = Array.isArray(parsed) ? parsed : [];
} catch (error) {
  console.error("Could not load saved tasks:", error);
  tasks = [];
}

function saveTasks() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  } catch (error) {
    console.error("Could not save tasks:", error);
    formMessage.textContent =
      "Task added, but your browser could not save it.";
  }
}

function makeElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function renderTasks() {
  taskList.replaceChildren();

  const filter = filterTasks.value;

  const visibleTasks = tasks.filter(task => {
    if (filter === "active") return !task.completed;
    if (filter === "completed") return task.completed;
    return true;
  });

  visibleTasks.forEach(task => {
    const item = makeElement(
      "li",
      "task-item" + (task.completed ? " done" : "")
    );

    const checkbox = makeElement("input", "task-check");
    checkbox.type = "checkbox";
    checkbox.checked = Boolean(task.completed);
    checkbox.setAttribute("aria-label", "Mark task as completed");

    checkbox.addEventListener("change", () => {
      task.completed = checkbox.checked;
      saveTasks();
      renderTasks();
    });

    const details = makeElement("div", "task-details");
    const title = makeElement("div", "task-title", task.title);
    details.appendChild(title);

    const meta = makeElement("div", "task-meta");

    if (task.dueDate) {
      const date = makeElement("span", "", "Due: " + task.dueDate);
      meta.appendChild(date);
    }

    const priority = makeElement(
      "span",
      "priority " + task.priority,
      task.priority + " priority"
    );
    meta.appendChild(priority);
    details.appendChild(meta);

    const actions = makeElement("div", "task-actions");
    const deleteButton = makeElement("button", "", "Delete");
    deleteButton.type = "button";
    deleteButton.setAttribute("aria-label", "Delete " + task.title);

    deleteButton.addEventListener("click", () => {
      tasks = tasks.filter(item => item.id !== task.id);
      saveTasks();
      renderTasks();
    });

    actions.appendChild(deleteButton);

    item.append(checkbox, details, actions);
    taskList.appendChild(item);
  });

  emptyMessage.hidden = visibleTasks.length !== 0;

  totalCount.textContent = tasks.length;
  completedCount.textContent =
    tasks.filter(task => task.completed).length;
  remainingCount.textContent =
    tasks.filter(task => !task.completed).length;
}

taskForm.addEventListener("submit", function (event) {
  event.preventDefault();

  const title = taskInput.value.trim();

  if (!title) {
    formMessage.textContent = "Please enter a task name.";
    taskInput.focus();
    return;
  }

  const task = {
    id: Date.now().toString() + Math.random().toString(16).slice(2),
    title: title,
    dueDate: dueDateInput.value,
    priority: priorityInput.value,
    completed: false
  };

  tasks.unshift(task);
  saveTasks();

  taskForm.reset();
  priorityInput.value = "Medium";
  formMessage.textContent = "Task added successfully!";
  renderTasks();
  taskInput.focus();
});

filterTasks.addEventListener("change", renderTasks);

document.getElementById("clearCompleted").addEventListener("click", () => {
  tasks = tasks.filter(task => !task.completed);
  saveTasks();
  renderTasks();
});

document.getElementById("themeButton").addEventListener("click", () => {
  document.body.classList.toggle("dark");

  const isDark = document.body.classList.contains("dark");
  document.getElementById("themeButton").textContent =
    isDark ? "☀️ Theme" : "🌙 Theme";

  try {
    localStorage.setItem("focusflow.dark", String(isDark));
  } catch (error) {
    console.warn("Theme preference could not be saved.");
  }
});

try {
  if (localStorage.getItem("focusflow.dark") === "true") {
    document.body.classList.add("dark");
    document.getElementById("themeButton").textContent = "☀️ Theme";
  }
} catch (error) {
  console.warn("Theme preference could not be loaded.");
}

renderTasks();
