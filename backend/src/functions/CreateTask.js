// src/functions/CreateTask.js
const { app } = require("@azure/functions");
const { v4: uuidv4 } = require("uuid");
const { tasksContainer } = require("../CosmosClient");

app.http("CreateTask", {
    methods: ["POST"],
    authLevel: "anonymous",
    route: "tasks",
    handler: async (request, context) => {
        try {
            const body = await request.json();
            const {
                courseId,
                title,
                dueDate = null,
                type = "",
                weight = null
            } = body || {};

            if (!courseId || !title) {
                return {
                    status: 400,
                    jsonBody: { error: "courseId and title are required" }
                };
            }

            const task = {
                id: "task-" + uuidv4(),
                courseId,   // partition key
                title,
                dueDate,
                type,
                weight
            };

            const container = tasksContainer();
            const { resource } = await container.items.create(task);

            return {
                status: 201,
                jsonBody: resource
            };
        } catch (err) {
            context.log.error("CreateTask error:", err);
            return {
                status: 500,
                jsonBody: { error: "Error creating task" }
            };
        }
    }
});

