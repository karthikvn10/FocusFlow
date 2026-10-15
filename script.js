
"use strict";

document.addEventListener("DOMContentLoaded", function () {
  const get = id => document.getElementById(id);

  const taskForm = get("taskForm");
  const taskInput = get("taskInput");
  const dueDateInput = get("dueDate");
  const priorityInput = get("priority");
  const taskList = get("taskList");
  const emptyMessage = get("emptyMessage");
  const filterTasks = get("filterTasks");
  const formMessage = get("formMessage");

  const totalCount = get("totalCount");
  const completedCount = get("completedCount");
  const remainingCount = get("remainingCount");
  const clearCompleted = get("clearCompleted");
  const themeButton = get("themeButton");

  if (!taskForm || !taskInput || !taskList) {
    console.error(
      "FocusFlow: Missing taskForm, taskInput, or taskList in index.html."
    );
    alert("FocusFlow setup error: Check that index.html contains taskForm, taskInput and taskList.");
    return;
  }

  const STORAGE_KEY = "focusflow.tasks.v1";
  let tasks = [];

  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) : [];
    tasks = Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("Could not load tasks:", error);
  }

  function saveTasks() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    } catch (error) {
      console.error("Could not save tasks:", error);
      showMessage("Unable to save tasks in this browser.");
    }
  }

  function showMessage(message) {
    if (formMessage) {
      formMessage.textContent = message;
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

    const filter = filterTasks ? filterTasks.value : "all";

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
      details.appendChild(makeElement("div", "task-title", task.title));

      const meta = makeElement("div", "task-meta");

      if (task.dueDate) {
        meta.appendChild(makeElement("span", "", "Due: " + task.dueDate));
      }

      if (task.priority) {
        meta.appendChild(
          makeElement(
            "span",
            "priority " + task.priority,
            task.priority + " priority"
          )
        );
      }

      details.appendChild(meta);

      const actions = makeElement("div", "task-actions");
      const deleteButton = makeElement("button", "", "Delete");
      deleteButton.type = "button";

      deleteButton.addEventListener("click", () => {
        tasks = tasks.filter(savedTask => savedTask.id !== task.id);
        saveTasks();
        renderTasks();
      });

      actions.appendChild(deleteButton);
      item.append(checkbox, details, actions);
      taskList.appendChild(item);
    });

    if (emptyMessage) {
      emptyMessage.hidden = visibleTasks.length !== 0;
    }

    if (totalCount) totalCount.textContent = tasks.length;
    if (completedCount) {
      completedCount.textContent =
        tasks.filter(task => task.completed).length;
    }
    if (remainingCount) {
      remainingCount.textContent =
        tasks.filter(task => !task.completed).length;
    }
  }

  taskForm.addEventListener("submit", function (event) {
    event.preventDefault();

    const title = taskInput.value.trim();

    if (!title) {
      showMessage("Please enter a task name.");
      taskInput.focus();
      return;
    }

    tasks.unshift({
      id: Date.now().toString() + Math.random().toString(16).slice(2),
      title: title,
      dueDate: dueDateInput ? dueDateInput.value : "",
      priority: priorityInput ? priorityInput.value : "Medium",
      completed: false
    });

    saveTasks();
    taskForm.reset();

    if (priorityInput) priorityInput.value = "Medium";

    showMessage("Task added successfully!");
    renderTasks();
    taskInput.focus();
  });

  if (filterTasks) {
    filterTasks.addEventListener("change", renderTasks);
  }

  if (clearCompleted) {
    clearCompleted.addEventListener("click", () => {
      tasks = tasks.filter(task => !task.completed);
      saveTasks();
      renderTasks();
    });
  }

  if (themeButton) {
    themeButton.addEventListener("click", () => {
      document.body.classList.toggle("dark");

      const isDark = document.body.classList.contains("dark");
      themeButton.textContent = isDark ? "☀️ Theme" : "🌙 Theme";

      try {
        localStorage.setItem("focusflow.dark", String(isDark));
      } catch (error) {
        console.warn("Could not save theme preference.");
      }
    });
  }

  try {
    if (localStorage.getItem("focusflow.dark") === "true") {
      document.body.classList.add("dark");
      if (themeButton) themeButton.textContent = "☀️ Theme";
    }
  } catch (error) {
    console.warn("Could not load theme preference.");
  }

  renderTasks();
});
