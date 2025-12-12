import {
  parseDateSafe,
  formatDateShort,
  normalizeTaskType,
  countBy,
  filterOrphanTasks,
  computeKpis,
  upcomingTasks,
  tasksPerCourse,
  taskTypeCounts,
} from "../js/utils.js";

QUnit.module("utils.js", function () {
    QUnit.module("dates", function () {
        QUnit.test("parseDateSafe returns Date for valid YYYY-MM-DD", function (assert) {
        const d = parseDateSafe("2025-12-12");
        assert.ok(d instanceof Date);
        assert.equal(d.getFullYear(), 2025);
        assert.equal(d.getMonth(), 11); // Dec = 11
        assert.equal(d.getDate(), 12);
        });

        QUnit.test("parseDateSafe returns null for invalid input", function (assert) {
        assert.equal(parseDateSafe(null), null);
        assert.equal(parseDateSafe(""), null);
        assert.equal(parseDateSafe("not-a-date"), null);
        assert.equal(parseDateSafe("2025-99-99"), null);
        });

        QUnit.test("formatDateShort returns 'No due date' for null/invalid", function (assert) {
        assert.equal(formatDateShort(null), "No due date");
        assert.equal(formatDateShort("bad"), "No due date");
        });

        QUnit.test("formatDateShort returns a short date for valid input", function (assert) {
        const s = formatDateShort("2025-12-12");
        assert.ok(typeof s === "string");
        assert.ok(s.length > 0);
        assert.notEqual(s, "No due date");
        });
    });

    QUnit.module("normalization / counting", function () {
        QUnit.test("normalizeTaskType trims and defaults to Other", function (assert) {
        assert.equal(normalizeTaskType(" Homework "), "Homework");
        assert.equal(normalizeTaskType(""), "Other");
        assert.equal(normalizeTaskType("   "), "Other");
        assert.equal(normalizeTaskType(null), "Other");
        assert.equal(normalizeTaskType(undefined), "Other");
        });

        QUnit.test("countBy counts items using keyFn", function (assert) {
        const items = [{ a: "x" }, { a: "x" }, { a: "y" }];
        const counts = countBy(items, (i) => i.a);
        assert.equal(counts.x, 2);
        assert.equal(counts.y, 1);
        });

        QUnit.test("tasksPerCourse counts by courseId", function (assert) {
        const tasks = [
            { courseId: "c1" },
            { courseId: "c1" },
            { courseId: "c2" },
        ];
        const counts = tasksPerCourse(tasks);
        assert.equal(counts.c1, 2);
        assert.equal(counts.c2, 1);
        });

        QUnit.test("taskTypeCounts counts normalized types", function (assert) {
        const tasks = [
            { type: "Homework" },
            { type: " Homework " },
            { type: "" },
            { type: null },
            { type: "Exam" },
        ];
        const counts = taskTypeCounts(tasks);
        assert.equal(counts.Homework, 2);
        assert.equal(counts.Other, 2);
        assert.equal(counts.Exam, 1);
        });
    });

    QUnit.module("insights-like logic", function () {
        QUnit.test("filterOrphanTasks removes tasks whose course no longer exists", function (assert) {
        const courses = [{ id: "c1" }, { id: "c2" }];
        const tasks = [
            { id: "t1", courseId: "c1" },
            { id: "t2", courseId: "c2" },
            { id: "t3", courseId: "ghost" },
        ];
        const filtered = filterOrphanTasks(tasks, courses);
        assert.equal(filtered.length, 2);
        assert.deepEqual(
            filtered.map((t) => t.id).sort(),
            ["t1", "t2"]
        );
        });

        QUnit.test("computeKpis counts overdue and next-7-days correctly", function (assert) {
        // fixed 'today' so test is deterministic
        const today = new Date("2025-12-12T00:00:00");

        const tasks = [
            { dueDate: "2025-12-11" }, // overdue
            { dueDate: "2025-12-12" }, // today => next7
            { dueDate: "2025-12-19" }, // within 7 days => next7
            { dueDate: "2025-12-20" }, // day 8 => not next7
            { dueDate: null },         // ignored
            { dueDate: "bad" },        // ignored
        ];

        const { overdue, next7 } = computeKpis(tasks, today);
        assert.equal(overdue, 1);
        assert.equal(next7, 2);
        });

        QUnit.test("upcomingTasks returns sorted upcoming tasks with due dates only", function (assert) {
        const today = new Date("2025-12-12T00:00:00");

        const tasks = [
            { id: "a", dueDate: "2025-12-13" },
            { id: "b", dueDate: "2025-12-12" },
            { id: "c", dueDate: "2025-12-20" },
            { id: "d", dueDate: "2025-12-11" }, // overdue
            { id: "e", dueDate: null },         // excluded
        ];

        const upcoming = upcomingTasks(tasks, today, 3);
        assert.equal(upcoming.length, 3);
        assert.deepEqual(upcoming.map((t) => t.id), ["b", "a", "c"]);
        });

        QUnit.test("upcomingTasks respects limit", function (assert) {
        const today = new Date("2025-12-12T00:00:00");
        const tasks = [
            { id: "1", dueDate: "2025-12-12" },
            { id: "2", dueDate: "2025-12-13" },
            { id: "3", dueDate: "2025-12-14" },
            { id: "4", dueDate: "2025-12-15" },
        ];

        const upcoming2 = upcomingTasks(tasks, today, 2);
        assert.equal(upcoming2.length, 2);
        assert.deepEqual(upcoming2.map((t) => t.id), ["1", "2"]);
        });
    });
});
