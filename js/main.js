// js/main.js
const API_BASE = "https://func-syllabi-hsb5bfc0cudbarcj.westus3-01.azurewebsites.net/api";

// ---------- helpers ----------

async function apiFetch(path, options = {}) {
    const res = await fetch(`${API_BASE}${path}`, {
        headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
        },
        ...options,
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`API ${res.status}: ${text}`);
    }
    // try JSON, fall back to text
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("application/json")) return res.json();
    return res.text();
}

function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(reader.error);
        reader.onload = () => {
        const result = reader.result;
        const base64 = result.split(",")[1];
        resolve(base64);
        };
        reader.readAsDataURL(file);
    });
}

function notifyDataChanged() {
    window.dispatchEvent(new Event("datachanged"));
}

function parseDateSafe(yyyyMMdd) {
    if (!yyyyMMdd) return null;
    const d = new Date(yyyyMMdd + "T00:00:00");
    return isNaN(d.getTime()) ? null : d;
}

function formatDateShort(yyyyMMdd) {
    const d = parseDateSafe(yyyyMMdd);
    if (!d) return "No due date";
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}


// Fade-in on load
document.documentElement.classList.remove("is-transitioning");

// Fade-out on navigation clicks (same-site only)
function enablePageTransitions() {
    document.addEventListener("click", (e) => {
        const a = e.target.closest("a");
        if (!a) return;

        const href = a.getAttribute("href");
        if (!href) return;

        // only intercept local html navigation (no external links)
        const isExternal = /^https?:\/\//i.test(href);
        const isHash = href.startsWith("#");
        if (isExternal || isHash) return;

        // allow ctrl/cmd click open in new tab
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

        e.preventDefault();
        document.documentElement.classList.add("is-transitioning");

        // small delay to let fade happen
        setTimeout(() => {
        window.location.href = href;
        }, 180);
    });
}

// Animate cards in sequence on each page
function animateCardsInSequence() {
    const cards = Array.from(document.querySelectorAll(".card"));
    cards.forEach((card, i) => {
        card.style.setProperty("--delay", `${i * 90}ms`);
    });
}

// Shimmer helper (used on upload)
function setShimmer(el, on) {
    if (!el) return;
    el.classList.toggle("shimmer", !!on);
}


// ---------- index.html – upload syllabus ----------

async function initIndexPage() {
    const form = document.getElementById("upload-form");
    if (!form) return;

    const statusEl = document.getElementById("upload-status");
    const card = statusEl?.closest(".card");

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        statusEl.textContent = "Uploading syllabus and starting parsing...";
        setShimmer(card, true);

        try {
        const fileInput = form.syllabusFile;
        const file = fileInput.files[0];

        if (!file) {
            statusEl.textContent = "Please select a PDF first.";
            return;
        }

        const fileBase64 = await readFileAsBase64(file);

        // Just upload; backend will create course + tasks later
        await apiFetch("/upload-syllabus", {
            method: "POST",
            body: JSON.stringify({
            fileBase64,
            userId: "demo-user", // optional, can be used later
            }),
        });

        statusEl.textContent =
            "Syllabus uploaded successfully. Parsing will run in the background. Check the Courses and Tasks pages in a few seconds.";
        setShimmer(card, false);
        form.reset();

        // Tell other pages (like insights) that data changed
        notifyDataChanged();
        } catch (err) {
        console.error(err);
        statusEl.textContent = "Error: " + err.message;
        setShimmer(card, false);
        }
    });
}

// ---------- courses.html – list & delete courses ----------

async function initCoursesPage() {
    const list = document.getElementById("courses-list");
    if (!list) return;

    const statusEl = document.getElementById("courses-status");

    async function loadCourses() {
        list.innerHTML = "";
        statusEl.textContent = "Loading...";
        try {
        const courses = await apiFetch("/courses?userId=demo-user");
        statusEl.textContent = courses.length ? "" : "No courses yet.";
        courses.forEach((c) => {
            const li = document.createElement("li");
            li.className = "course-item";
            li.innerHTML = `
            <div>
                <strong>${c.courseName}</strong><br>
                <small>${c.instructor || ""} • ${c.semester || ""}</small>
            </div>
            <button class="btn-delete" data-id="${c.id}">Delete</button>
            `;
            list.appendChild(li);
        });
        } catch (err) {
        console.error(err);
        statusEl.textContent = "Error: " + err.message;
        }
    }

    list.addEventListener("click", async (e) => {
        const btn = e.target.closest(".btn-delete");
        if (!btn) return;
        const id = btn.dataset.id;
        if (!confirm("Delete this course?")) return;

        try {
        await apiFetch(`/courses/${id}?userId=demo-user`, { method: "DELETE" });
        await loadCourses();
        notifyDataChanged();
        } catch (err) {
        alert("Error deleting: " + err.message);
        }
    });

    loadCourses();
}

// ---------- tasks.html – pick course, list & add/delete tasks ----------

async function initTasksPage() {
    const courseSelect = document.getElementById("task-course-select");
    if (!courseSelect) return;

    const tasksList = document.getElementById("tasks-list");
    const statusEl = document.getElementById("tasks-status");
    const form = document.getElementById("task-form");

    let currentCourseId = null;

    async function loadCoursesIntoSelect() {
        const courses = await apiFetch("/courses?userId=demo-user");
        courseSelect.innerHTML = `<option value="">Select a course...</option>`;
        courses.forEach((c) => {
        const opt = document.createElement("option");
        opt.value = c.id;
        opt.textContent = c.courseName;
        courseSelect.appendChild(opt);
        });
    }

    async function loadTasks(courseId) {
        tasksList.innerHTML = "";
        if (!courseId) {
        statusEl.textContent = "Choose a course to see its tasks.";
        return;
        }
        statusEl.textContent = "Loading tasks...";
        try {
        const tasks = await apiFetch(
            `/tasks?courseId=${encodeURIComponent(courseId)}`
        );
        statusEl.textContent = tasks.length ? "" : "No tasks yet.";
        tasks.forEach((t) => {
            const li = document.createElement("li");
            li.className = "task-item";
            li.innerHTML = `
            <div>
                <strong>${t.title}</strong><br>
                <small>${t.dueDate || "No due date"} • ${t.type || ""} • weight: ${
            t.weight ?? "-"
            }</small>
            </div>
            <button class="btn-delete-task" data-id="${t.id}" data-course-id="${
            t.courseId
            }">Delete</button>
            `;
            tasksList.appendChild(li);
        });
        } catch (err) {
        statusEl.textContent = "Error: " + err.message;
        }
    }

    courseSelect.addEventListener("change", async () => {
        currentCourseId = courseSelect.value || null;
        await loadTasks(currentCourseId);
    });

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (!currentCourseId) {
        alert("Choose a course first.");
        return;
        }
        const title = form.title.value.trim();
        const dueDate = form.dueDate.value || null;
        const type = form.type.value.trim();
        const weight = form.weight.value ? Number(form.weight.value) : null;

        if (!title) {
        alert("Task title required.");
        return;
        }

        try {
        await apiFetch("/tasks", {
            method: "POST",
            body: JSON.stringify({
            courseId: currentCourseId,
            title,
            dueDate,
            type,
            weight,
            }),
        });
        form.reset();
        await loadTasks(currentCourseId);
        notifyDataChanged();
        } catch (err) {
        alert("Error creating task: " + err.message);
        }
    });

    tasksList.addEventListener("click", async (e) => {
        const btn = e.target.closest(".btn-delete-task");
        if (!btn) return;
        if (!confirm("Delete this task?")) return;

        const id = btn.dataset.id;
        const courseId = btn.dataset["courseId"];
        try {
        await apiFetch(`/tasks/${id}?courseId=${encodeURIComponent(courseId)}`, {
            method: "DELETE",
        });
        await loadTasks(currentCourseId);
        notifyDataChanged();
        } catch (err) {
        alert("Error deleting task: " + err.message);
        }
    });

    await loadCoursesIntoSelect();
}

// ---------- insights.html – dashboard stats + charts (Chart.js) ----------

let typesChart = null;
let byCourseChart = null;

async function initInsightsPage() {
    const summaryEl = document.getElementById("insights-summary");
    if (!summaryEl) return;

    const kpiCourses = document.getElementById("kpi-courses");
    const kpiTasks = document.getElementById("kpi-tasks");
    const kpiNext7 = document.getElementById("kpi-next7");
    const kpiOverdue = document.getElementById("kpi-overdue");
    const upcomingEl = document.getElementById("upcoming-list");

    const typesCanvas = document.getElementById("chart-types");
    const byCourseCanvas = document.getElementById("chart-by-course");

    async function refreshInsights() {
        summaryEl.textContent = "Loading insights...";
        if (upcomingEl) upcomingEl.innerHTML = "";

        try {
        // Fetch both so we can show real course names
        const [courses, tasks] = await Promise.all([
            apiFetch("/courses?userId=demo-user"),
            apiFetch("/tasks"),
        ]);

        // Build set of valid course IDs
        const validCourseIds = new Set(courses.map(c => c.id));

        // Filter out orphaned tasks (tasks whose course was deleted)
        const filteredTasks = tasks.filter(t => validCourseIds.has(t.courseId));

        const courseNameById = new Map(courses.map((c) => [c.id, c.courseName]));

        // KPIs
        const totalCourses = courses.length;
        const totalTasks = filteredTasks.length;

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const in7 = new Date(today);
        in7.setDate(in7.getDate() + 7);

        let overdue = 0;
        let next7 = 0;

        const tasksWithDue = [];
        for (const t of filteredTasks) {
            const d = parseDateSafe(t.dueDate);
            if (!d) continue;

            if (d < today) overdue++;
            if (d >= today && d <= in7) next7++;

            tasksWithDue.push({ ...t, _due: d });
        }

        if (kpiCourses) kpiCourses.textContent = String(totalCourses);
        if (kpiTasks) kpiTasks.textContent = String(totalTasks);
        if (kpiNext7) kpiNext7.textContent = String(next7);
        if (kpiOverdue) kpiOverdue.textContent = String(overdue);

        // Chart 1: task types (donut)
        const typeCounts = {};
        for (const t of filteredTasks) {
            const key = (t.type || "Other").trim() || "Other";
            typeCounts[key] = (typeCounts[key] || 0) + 1;
        }
        const typeLabels = Object.keys(typeCounts);
        const typeData = typeLabels.map((k) => typeCounts[k]);

        if (typesCanvas && window.Chart) {
            if (typesChart) typesChart.destroy();
            typesChart = new Chart(typesCanvas, {
            type: "doughnut",
            data: {
                labels: typeLabels,
                datasets: [{ data: typeData }],
            },
            options: {
                responsive: true,
                plugins: {
                legend: { position: "bottom" },
                },
            },
            });
        }

        // Chart 2: tasks per course (bar)
        const byCourseCounts = {};
        for (const t of filteredTasks) {
            const cid = t.courseId;
            byCourseCounts[cid] = (byCourseCounts[cid] || 0) + 1;
        }

        const sortedCourseEntries = Object.entries(byCourseCounts)
            .map(([cid, count]) => ({
            cid,
            count,
            name: courseNameById.get(cid) || cid,
            }))
            .sort((a, b) => b.count - a.count);

        const courseLabels = sortedCourseEntries.map((x) => x.name);
        const courseData = sortedCourseEntries.map((x) => x.count);

        if (byCourseCanvas && window.Chart) {
            if (byCourseChart) byCourseChart.destroy();
            byCourseChart = new Chart(byCourseCanvas, {
            type: "bar",
            data: {
                labels: courseLabels,
                datasets: [{ label: "Tasks", data: courseData }],
            },
            options: {
                responsive: true,
                plugins: {
                legend: { display: false },
                },
                scales: {
                x: {
                    ticks: { autoSkip: false, maxRotation: 45, minRotation: 0 },
                },
                },
            },
            });
        }

        // Upcoming deadlines list (next 10)
        const upcoming = tasksWithDue
            .filter((t) => t._due >= today)
            .sort((a, b) => a._due - b._due)
            .slice(0, 10);

        if (upcomingEl) {
            if (!upcoming.length) {
            upcomingEl.innerHTML = `<div class="status-msg">No upcoming due dates found.</div>`;
            } else {
            upcomingEl.innerHTML = upcoming
                .map((t) => {
                const courseName = courseNameById.get(t.courseId) || t.courseId;
                return `
                <div class="upcoming-item">
                    <div class="upcoming-left">
                    <strong>${t.title}</strong>
                    <small>${courseName} • ${t.type || "Other"}</small>
                    </div>
                    <div class="upcoming-right">
                    <strong>${formatDateShort(t.dueDate)}</strong>
                    </div>
                </div>
                `;
                })
                .join("");
            }
        }

        // Summary message
        if (!filteredTasks.length) {
            summaryEl.textContent = "No tasks yet. Upload a syllabus or add tasks first.";
        } else {
            summaryEl.textContent = "";
        }
        } catch (err) {
        console.error(err);
        summaryEl.textContent = "Error loading insights: " + err.message;
        }
    }

    // Initial load
    await refreshInsights();

    // Refresh when other pages change data
    window.addEventListener("datachanged", refreshInsights);

    // Refresh when user returns to this tab
    window.addEventListener("focus", refreshInsights);
}

// ---------- router ----------
document.addEventListener("DOMContentLoaded", () => {
    // Start in a visible state, then enable transitions
    document.documentElement.classList.remove("is-transitioning");
    enablePageTransitions();
    animateCardsInSequence();

    const page = document.body.dataset.page;
    if (page === "index") initIndexPage();
    if (page === "courses") initCoursesPage();
    if (page === "tasks") initTasksPage();
    if (page === "insights") initInsightsPage();
});

