
(() => {
  "use strict";

  const $ = id => document.getElementById(id);
  const STORAGE_KEY = "focusflow.tasks.v2";
  const THEME_KEY = "focusflow.theme";

  const form = $("taskForm");
  const modal = $("taskModal");
  const input = $("taskInput");
  const descriptionInput = $("taskDescription");
  const categoryInput = $("taskCategory");
  const priorityInput = $("taskPriority");
  const dueDateInput = $("taskDueDate");
  const searchInput = $("searchInput");
  const taskList = $("taskList");
  const emptyState = $("emptyState");

  let tasks = loadTasks();
  let currentView = "all";
  let currentFilter = "all";
  let editingId = null;
  let toastTimer;

  function loadTasks() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
        || localStorage.getItem("tasks");
      const parsed = saved ? JSON.parse(saved) : [];

      if (!Array.isArray(parsed)) return [];

      return parsed
        .filter(task => task && typeof task.title === "string")
        .map(task => ({
          id: task.id ?? Date.now() + Math.random(),
          title: task.title.trim(),
          description: String(task.description || ""),
          category: ["Personal", "Work", "Study", "Health", "Other"]
            .includes(task.category) ? task.category : "Personal",
          priority: ["Low", "Medium", "High"]
            .includes(task.priority) ? task.priority : "Medium",
          dueDate: /^\d{4}-\d{2}-\d{2}$/.test(task.dueDate || "")
            ? task.dueDate : "",
          completed: Boolean(task.completed),
          createdAt: Number(task.createdAt) || Date.now()
        }))
        .filter(task => task.title);
    } catch (error) {
      console.error("Could not load saved tasks:", error);
      return [];
    }
  }

  function saveTasks() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
      localStorage.setItem("tasks", JSON.stringify(tasks));
    } catch (error) {
      console.error("Could not save tasks:", error);
      showToast("Unable to save tasks in this browser.");
    }
  }

  function todayISO() {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function formatDate(iso) {
    if (!iso) return "";
    const [year, month, day] = iso.split("-").map(Number);
    return new Date(year, month - 1, day).toLocaleDateString(
      undefined,
      { month: "short", day: "numeric" }
    );
  }

  function isOverdue(task) {
    return Boolean(
      !task.completed &&
      task.dueDate &&
      task.dueDate < todayISO()
    );
  }

  function dueLabel(task) {
    if (!task.dueDate) return "No due date";
    if (isOverdue(task)) return "Overdue · " + formatDate(task.dueDate);
    if (task.dueDate === todayISO() && !task.completed) return "Due today";
    if (task.dueDate === todayISO()) return "Due today · completed";
    return "Due " + formatDate(task.dueDate);
  }

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function createTaskCard(task) {
    const card = element(
      "article",
      "task-item" + (task.completed ? " is-complete" : "")
    );

    const check = element(
      "button",
      "task-check" + (task.completed ? " checked" : ""),
      task.completed ? "✓" : ""
    );
    check.type = "button";
    check.setAttribute("aria-label", task.completed
      ? "Mark task incomplete" : "Mark task complete");
    check.addEventListener("click", () => toggleTask(task.id));

    const body = element("div", "task-body");
    const titleRow = element("div", "task-title-row");
    titleRow.appendChild(element("span", "task-title", task.title));
    titleRow.appendChild(element(
      "span",
      "priority-pill priority-" + task.priority.toLowerCase(),
      task.priority
    ));
    body.appendChild(titleRow);

    if (task.description) {
      body.appendChild(element("p", "task-description", task.description));
    }

    const meta = element("div", "task-meta");
    meta.appendChild(element("span", "category-pill", task.category));

    let dueClass = "due-pill";
    if (!task.dueDate) dueClass += " no-date";
    else if (isOverdue(task)) dueClass += " overdue";
    else if (task.dueDate === todayISO() && !task.completed) {
      dueClass += " due-today";
    }

    meta.appendChild(element("span", dueClass, "◷ " + dueLabel(task)));
    body.appendChild(meta);

    const actions = element("div", "task-actions");

    const edit = element("button", "task-action", "✎");
    edit.type = "button";
    edit.title = "Edit task";
    edit.setAttribute("aria-label", "Edit " + task.title);
    edit.addEventListener("click", () => openModal(task));

    const remove = element("button", "task-action delete", "×");
    remove.type = "button";
    remove.title = "Delete task";
    remove.setAttribute("aria-label", "Delete " + task.title);
    remove.addEventListener("click", () => deleteTask(task.id));

    actions.append(edit, remove);
    card.append(check, body, actions);
    return card;
  }

  function matchesView(task) {
    const today = todayISO();

    if (currentView === "today") {
      return task.dueDate === today && !task.completed;
    }
    if (currentView === "upcoming") {
      return task.dueDate > today && !task.completed;
    }
    if (currentView === "completed") return task.completed;
    if (currentView === "overdue") return isOverdue(task);

    return true;
  }

  function getVisibleTasks() {
    const query = searchInput.value.trim().toLowerCase();
    const priority = $("priorityFilter").value;

    return tasks.filter(task => {
      const searchable = [
        task.title,
        task.description,
        task.category,
        task.priority
      ].join(" ").toLowerCase();

      const matchesSearch = searchable.includes(query);
      const matchesPriority =
        priority === "all" || task.priority === priority;

      const matchesFilter =
        currentFilter === "all" ||
        (currentFilter === "pending" && !task.completed) ||
        (currentFilter === "completed" && task.completed);

      return matchesView(task) && matchesSearch &&
        matchesPriority && matchesFilter;
    }).sort((a, b) => {
      const sort = $("sortSelect").value;

      if (sort === "due") {
        return (a.dueDate || "9999-12-31")
          .localeCompare(b.dueDate || "9999-12-31");
      }

      if (sort === "priority") {
        const order = { High: 0, Medium: 1, Low: 2 };
        return order[a.priority] - order[b.priority];
      }

      if (sort === "alphabetical") {
        return a.title.localeCompare(b.title);
      }

      return b.createdAt - a.createdAt;
    });
  }

  function renderTasks() {
    const visible = getVisibleTasks();
    taskList.replaceChildren(...visible.map(createTaskCard));

    taskList.style.display = visible.length ? "grid" : "none";
    emptyState.classList.toggle("visible", visible.length === 0);

    $("resultCount").textContent =
      `${visible.length} ${visible.length === 1 ? "task" : "tasks"}`;

    const total = tasks.filter(matchesView).length;
    $("footerSummary").textContent = tasks.length
      ? `${tasks.filter(t => t.completed).length} of ${tasks.length} tasks completed`
      : "Ready when you are.";

    document.querySelectorAll(".filter").forEach(button => {
      button.classList.toggle(
        "active",
        button.dataset.filter === currentFilter
      );
    });

    $("filterAllCount")?.textContent;
    updateStats();
  }

  function updateStats() {
    const total = tasks.length;
    const completed = tasks.filter(t => t.completed).length;
    const pending = total - completed;
    const overdue = tasks.filter(isOverdue).length;
    const percentage = total
      ? Math.round(completed / total * 100)
      : 0;

    $("totalCount").textContent = total;
    $("completedCount").textContent = completed;
    $("remainingCount").textContent = pending;
    $("overdueCount").textContent = overdue;

    $("progressPercent").textContent = percentage + "%";
    $("ringProgress").style.strokeDashoffset =
      358.14 - 358.14 * percentage / 100;

    $("progressCaption").textContent = total === 0
      ? "Add a task to start your progress."
      : percentage === 100
        ? "Amazing! All tasks are complete."
        : "Every completed task is a win.";

    $("legendCompleted").textContent = completed;
    $("legendRemaining").textContent = pending;
    $("sideProgress").style.width = percentage + "%";
    $("sideProgressText").textContent = percentage + "% complete";

    renderUpcoming();
  }

  function renderUpcoming() {
    const list = $("upcomingList");
    list.replaceChildren();

    const upcoming = tasks
      .filter(t => !t.completed && t.dueDate && t.dueDate >= todayISO())
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      .slice(0, 4);

    if (!upcoming.length) {
      list.appendChild(element(
        "p", "upcoming-empty", "No upcoming deadlines. Add a due date to plan ahead."
      ));
      return;
    }

    upcoming.forEach(task => {
      const [year, month, day] = task.dueDate.split("-").map(Number);
      const date = new Date(year, month - 1, day);

      const row = element("div", "upcoming-item");
      const tile = element("div", "date-tile");
      tile.append(
        element("span", "", date.toLocaleDateString(undefined, { month: "short" })),
        element("strong", "", String(day))
      );

      const info = element("div", "upcoming-info");
      info.append(
        element("strong", "", task.title),
        element("small", "", task.dueDate === todayISO()
          ? "Due today"
          : date.toLocaleDateString(undefined, {
              weekday: "short", month: "short", day: "numeric"
            }))
      );

      row.append(tile, info, element(
        "i", "upcoming-priority " + task.priority
      ));
      list.appendChild(row);
    });
  }

  function openModal(task = null) {
    editingId = task ? task.id : null;
    form.reset();
    $("formError").textContent = "";

    $("modalTitle").textContent = task
      ? "Edit your task" : "Create a new task";

    $("submitTask").textContent = task
      ? "Save changes →" : "Create task →";

    if (task) {
      input.value = task.title;
      descriptionInput.value = task.description;
      categoryInput.value = task.category;
      priorityInput.value = task.priority;
      dueDateInput.value = task.dueDate;
    } else {
      categoryInput.value = "Personal";
      priorityInput.value = "Medium";
    }

    modal.hidden = false;
    document.body.style.overflow = "hidden";
    setTimeout(() => input.focus(), 30);
  }

  function closeModal() {
    modal.hidden = true;
    document.body.style.overflow = "";
    editingId = null;
    form.reset();
    $("formError").textContent = "";
  }

  form.addEventListener("submit", event => {
    event.preventDefault();

    const title = input.value.trim();
    const dueDate = dueDateInput.value;

    if (!title) {
      $("formError").textContent = "Please enter a task title.";
      input.focus();
      return;
    }

    if (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
      $("formError").textContent = "Please select a valid due date.";
      return;
    }

    if (editingId !== null) {
      const task = tasks.find(t => t.id === editingId);
      if (!task) {
        closeModal();
        return;
      }

      Object.assign(task, {
        title,
        description: descriptionInput.value.trim(),
        category: categoryInput.value,
        priority: priorityInput.value,
        dueDate
      });

      saveTasks();
      closeModal();
      renderTasks();
      showToast("Task updated successfully.");
    } else {
      tasks.push({
        id: (crypto.randomUUID
          ? crypto.randomUUID()
          : String(Date.now() + Math.random())),
        title,
        description: descriptionInput.value.trim(),
        category: categoryInput.value,
        priority: priorityInput.value,
        dueDate,
        completed: false,
        createdAt: Date.now()
      });

      saveTasks();
      closeModal();
      renderTasks();
      showToast("Task added successfully!");
    }
  });

  function toggleTask(id) {
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    task.completed = !task.completed;
    saveTasks();
    renderTasks();
    showToast(task.completed ? "Task completed. Great work!" : "Task marked pending.");
  }

  function deleteTask(id) {
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    if (!confirm(`Delete "${task.title}"?`)) return;

    tasks = tasks.filter(t => t.id !== id);
    saveTasks();
    renderTasks();
    showToast("Task deleted.");
  }

  function showToast(message) {
    const toast = $("toast");
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2500);
  }

  function setView(view) {
    currentView = view;
    currentFilter = "all";

    const labels = {
      all: ["All Tasks", "Your tasks"],
      today: ["Today", "Today's tasks"],
      upcoming: ["Upcoming", "Upcoming tasks"],
      completed: ["Completed", "Completed tasks"],
      overdue: ["Overdue", "Overdue tasks"]
    };

    $("breadcrumb").textContent = labels[view][0];
    $("listHeading").textContent = labels[view][1];

    document.querySelectorAll(".nav-link").forEach(button => {
      button.classList.toggle("active", button.dataset.view === view);
    });

    renderTasks();
  }

  document.querySelectorAll(".nav-link").forEach(button => {
    button.addEventListener("click", () => setView(button.dataset.view));
  });

  document.querySelectorAll(".filter").forEach(button => {
    button.addEventListener("click", () => {
      currentFilter = button.dataset.filter;
      renderTasks();
    });
  });

  searchInput.addEventListener("input", renderTasks);
  $("priorityFilter").addEventListener("change", renderTasks);
  $("sortSelect").addEventListener("change", renderTasks);

  $("newTaskButton").addEventListener("click", () => openModal());
  $("emptyAddButton").addEventListener("click", () => openModal());
  $("closeModal").addEventListener("click", closeModal);
  $("cancelEdit").addEventListener("click", closeModal);

  modal.addEventListener("click", event => {
    if (event.target === modal) closeModal();
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !modal.hidden) closeModal();

    if ((event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === "k") {
      event.preventDefault();
      searchInput.focus();
    }
  });

  $("clearCompleted").addEventListener("click", () => {
    const count = tasks.filter(t => t.completed).length;

    if (!count) {
      showToast("No completed tasks to clear.");
      return;
    }

    if (!confirm(`Clear ${count} completed task(s)?`)) return;

    tasks = tasks.filter(t => !t.completed);
    saveTasks();
    renderTasks();
    showToast("Completed tasks cleared.");
  });

  function applyTheme(theme) {
    const dark = theme === "dark";
    document.body.classList.toggle("dark-mode", dark);

    $("themeToggle").innerHTML = dark
      ? "☀ <span>Switch to light</span>"
      : "☾ <span>Switch theme</span>";

    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch (error) {
      console.warn("Theme preference could not be saved.");
    }
  }

  function toggleTheme() {
    applyTheme(document.body.classList.contains("dark-mode")
      ? "light" : "dark");
  }

  $("themeToggle").addEventListener("click", toggleTheme);
  $("viewUpcoming").addEventListener("click", () => setView("upcoming"));

  function setDateLabels() {
    const now = new Date();

    $("headerDate").textContent = now.toLocaleDateString(undefined, {
      weekday: "short", month: "short", day: "numeric"
    });

    $("welcomeDate").textContent = now.toLocaleDateString(undefined, {
      weekday: "long", month: "long", day: "numeric", year: "numeric"
    }).toUpperCase();
  }

  let savedTheme = "light";
  try {
    savedTheme = localStorage.getItem(THEME_KEY) || "light";
  } catch (error) {
    console.warn("Theme preference could not be read.");
  }

  applyTheme(savedTheme);
  setDateLabels();
  saveTasks();
  setView("all");
})();
