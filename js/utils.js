// js/utils.js

export function parseDateSafe(yyyyMMdd) {
    if (!yyyyMMdd) return null;
    const d = new Date(yyyyMMdd + "T00:00:00");
    return isNaN(d.getTime()) ? null : d;
}

export function formatDateShort(yyyyMMdd) {
    const d = parseDateSafe(yyyyMMdd);
    if (!d) return "No due date";
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function normalizeTaskType(type) {
    const key = (type || "Other").trim();
    return key ? key : "Other";
}

export function countBy(items, keyFn) {
    const counts = {};
    for (const item of items) {
        const k = keyFn(item);
        counts[k] = (counts[k] || 0) + 1;
    }
    return counts;
}

export function filterOrphanTasks(tasks, courses) {
    const validCourseIds = new Set(courses.map((c) => c.id));
    return tasks.filter((t) => validCourseIds.has(t.courseId));
}

export function computeKpis(tasks, today = new Date()) {
    const day = new Date(today);
    day.setHours(0, 0, 0, 0);

    const in7 = new Date(day);
    in7.setDate(in7.getDate() + 7);

    let overdue = 0;
    let next7 = 0;

    for (const t of tasks) {
        const d = parseDateSafe(t.dueDate);
        if (!d) continue;

        if (d < day) overdue++;
        if (d >= day && d <= in7) next7++;
    }

    return { overdue, next7 };
}

export function upcomingTasks(tasks, today = new Date(), limit = 10) {
    const day = new Date(today);
    day.setHours(0, 0, 0, 0);

    const withDue = [];
    for (const t of tasks) {
        const d = parseDateSafe(t.dueDate);
        if (!d) continue;
        if (d < day) continue;
        withDue.push({ ...t, _due: d });
    }

    withDue.sort((a, b) => a._due - b._due);
    return withDue.slice(0, limit).map(({ _due, ...rest }) => rest);
}

export function tasksPerCourse(tasks) {
    const counts = {};
    for (const t of tasks) {
        const cid = t.courseId;
        counts[cid] = (counts[cid] || 0) + 1;
    }
    return counts;
}

export function taskTypeCounts(tasks) {
    const counts = {};
    for (const t of tasks) {
        const key = normalizeTaskType(t.type);
        counts[key] = (counts[key] || 0) + 1;
    }
    return counts;
}
