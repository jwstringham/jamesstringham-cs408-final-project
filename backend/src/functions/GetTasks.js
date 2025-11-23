// src/functions/GetTasks.js
const { app } = require("@azure/functions");
const { tasksContainer } = require("../CosmosClient");

app.http("GetTasks", {
    methods: ["GET"],
    authLevel: "anonymous",
    route: "tasks",
    handler: async (request, context) => {
        try {
            const courseId = request.query.get("courseId");

            const container = tasksContainer();
            let querySpec;

            if (courseId) {
                querySpec = {
                    query: "SELECT * FROM c WHERE c.courseId = @courseId",
                    parameters: [{ name: "@courseId", value: courseId }]
                };
            } else {
                querySpec = { query: "SELECT * FROM c" };
            }

            const { resources } = await container.items.query(querySpec).fetchAll();

            return {
                status: 200,
                jsonBody: resources
            };
        } catch (err) {
            context.log.error("GetTasks error:", err);
            return {
                status: 500,
                jsonBody: { error: "Error retrieving tasks" }
            };
        }
    }
});

