// src/functions/DeleteTask.js
const { app } = require("@azure/functions");
const { tasksContainer } = require("../CosmosClient");

app.http("DeleteTask", {
    methods: ["DELETE"],
    authLevel: "anonymous",
    route: "tasks/{id}",
    handler: async (request, context) => {
        try {
            const userId = request.query.get("userId") || "demo-user"; 
            const courseId =
                request.query.get("courseId") ||
                (await (async () => {
                    try {
                        const body = await request.json();
                        return body.courseId;
                    } catch {
                        return null;
                    }
                })());

            if (!id || !courseId) {
                return {
                    status: 400,
                    jsonBody: {
                        error: "id (route) and courseId (query or body) are required"
                    }
                };
            }

            const container = tasksContainer();
            await container.item(id, courseId).delete();

            return {
                status: 200,
                jsonBody: { message: "Task deleted" }
            };
        } catch (err) {
            context.log("DeleteTask error:", err);
            return {
                status: 500,
                jsonBody: { error: "Error deleting task" }
            };
        }
    }
});

