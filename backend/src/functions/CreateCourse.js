// src/functions/CreateCourse.js
const { app } = require("@azure/functions");
const { v4: uuidv4 } = require("uuid");
const { coursesContainer } = require("../CosmosClient");

app.http("CreateCourse", {
    methods: ["POST"],
    authLevel: "anonymous",
    route: "courses",
    handler: async (request, context) => {
        try {
            const body = await request.json();
            const {
                userId = "demo-user",
                courseName,
                instructor = "",
                semester = ""
            } = body || {};

            if (!courseName) {
                return {
                    status: 400,
                    jsonBody: { error: "courseName is required" }
                };
            }

            const course = {
                id: "course-" + uuidv4(),
                userId,              // partition key
                courseName,
                instructor,
                semester,
                numAssignments: 0   
            };

            const container = coursesContainer();
            const { resource } = await container.items.create(course);

            return {
                status: 201,
                jsonBody: resource
            };
        } catch (err) {
            context.log.error("CreateCourse error:", err);
            return {
                status: 500,
                jsonBody: { error: "Error creating course" }
            };
        }
    }
});

