// src/functions/DeleteCourse.js
const { app } = require("@azure/functions");
const { coursesContainer, tasksContainer } = require("../CosmosClient");

app.http("DeleteCourse", {
    methods: ["DELETE"],
    authLevel: "anonymous",
    route: "courses/{id}",
    handler: async (request, context) => {
        try {
        const courseId = request.params.id;
        const userId = request.query.get("userId") || "demo-user"; // courses partition key

        if (!courseId) {
            return {
            status: 400,
            jsonBody: { error: "Course id is required in the route" },
            };
        }

        const tContainer = tasksContainer();

        const { resources: taskDocs } = await tContainer.items
            .query({
            query: "SELECT c.id FROM c WHERE c.courseId = @courseId",
            parameters: [{ name: "@courseId", value: courseId }],
            })
            .fetchAll();

        if (taskDocs.length > 0) {
            try {
            await tContainer.items.bulk(
                taskDocs.map((t) => ({
                operationType: "Delete",
                id: t.id,
                partitionKey: courseId,
                }))
            );
            } catch (bulkErr) {
            context.log("Bulk delete failed, falling back to per-item deletes:", bulkErr);
            for (const t of taskDocs) {
                await tContainer.item(t.id, courseId).delete();
            }
            }
        }

        const cContainer = coursesContainer();
        await cContainer.item(courseId, userId).delete();

        return {
            status: 200,
            jsonBody: { message: "Course and associated tasks deleted", deletedTasks: taskDocs.length },
        };
        } catch (err) {
        context.log("DeleteCourse error:", err);
        return {
            status: 500,
            jsonBody: { error: "Error deleting course" },
        };
        }
    },
});
