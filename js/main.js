// js/main.js
const API_BASE = "https://func-syllabi-hsb5bfc0cudbarcj.westus3-01.azurewebsites.net/api";

// ---------- helpers ----------

async function apiFetch(path, options = {}) {
    const res = await fetch(`${API_BASE}${path}`, {
        headers: {
            "Content-Type": "application/json",
            ...(options.headers || {})
        },
        ...options
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


// index.html – upload + create course
async function initIndexPage() {
    const form = document.getElementById("upload-form");
    if (!form) return;

    const statusEl = document.getElementById("upload-status");

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        statusEl.textContent = "Uploading...";

        try {
            const courseName = form.courseName.value.trim();
            const instructor = form.instructor.value.trim();
            const semester = form.semester.value.trim();
            const fileInput = form.syllabusFile;
            const file = fileInput.files[0];

            if (!courseName || !instructor || !semester || !file) {
                statusEl.textContent = "Please complete all fields and choose a PDF.";
                return;
            }

            // 1) upload PDF
            const fileBase64 = await readFileAsBase64(file);
            const uploadRes = await apiFetch("/upload-syllabus", {
                method: "POST",
                body: JSON.stringify({ fileBase64 })
            });

            // 2) create course (dummy – not yet linked to blobName)
            const courseRes = await apiFetch("/courses", {
                method: "POST",
                body: JSON.stringify({
                    userId: "demo-user",
                    courseName,
                    instructor,
                    semester
                })
            });

            statusEl.textContent = `Created course "${courseRes.courseName}" and stored syllabus.`;
            form.reset();
        } catch (err) {
            console.error(err);
            statusEl.textContent = "Error: " + err.message;
        }
    });
}

// courses.html – list & delete courses
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
        } catch (err) {
            alert("Error deleting: " + err.message);
        }
    });

    loadCourses();
}

// tasks.html – pick course, list & add/delete tasks
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
            const tasks = await apiFetch(`/tasks?courseId=${encodeURIComponent(courseId)}`);
            statusEl.textContent = tasks.length ? "" : "No tasks yet.";
            tasks.forEach((t) => {
                const li = document.createElement("li");
                li.className = "task-item";
                li.innerHTML = `
                    <div>
                        <strong>${t.title}</strong><br>
                        <small>${t.dueDate || "No due date"} • ${t.type || ""} • weight: ${t.weight ?? "-"}</small>
                    </div>
                    <button class="btn-delete-task" data-id="${t.id}" data-course-id="${t.courseId}">Delete</button>
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
                body: JSON.stringify({ courseId: currentCourseId, title, dueDate, type, weight })
            });
            form.reset();
            await loadTasks(currentCourseId);
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
                method: "DELETE"
            });
            await loadTasks(currentCourseId);
        } catch (err) {
            alert("Error deleting task: " + err.message);
        }
    });

    await loadCoursesIntoSelect();
}

// insights.html – simple stats
async function initInsightsPage() {
    const summaryEl = document.getElementById("insights-summary");
    if (!summaryEl) return;

    try {
        const tasks = await apiFetch("/tasks");
        if (!tasks.length) {
            summaryEl.textContent = "No tasks yet. Add some tasks first.";
            return;
        }

        // simple stats
        const totalTasks = tasks.length;
        const byCourse = {};
        tasks.forEach((t) => {
            byCourse[t.courseId] = (byCourse[t.courseId] || 0) + 1;
        });

        const lines = [];
        lines.push(`Total tasks: ${totalTasks}`);
        lines.push("Tasks per course:");
        Object.entries(byCourse).forEach(([courseId, count]) => {
            lines.push(`- ${courseId}: ${count} tasks`);
        });

        summaryEl.innerHTML = lines.join("<br>");
    } catch (err) {
        summaryEl.textContent = "Error loading insights: " + err.message;
    }
}

document.addEventListener("DOMContentLoaded", () => {
    const page = document.body.dataset.page;
    if (page === "index") initIndexPage();
    if (page === "courses") initCoursesPage();
    if (page === "tasks") initTasksPage();
    if (page === "insights") initInsightsPage();
});
