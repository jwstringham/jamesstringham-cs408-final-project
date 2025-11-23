// src/functions/GetCourses.js
const { app } = require("@azure/functions");
const { coursesContainer } = require("../CosmosClient");

app.http("GetCourses", {
    methods: ["GET"],
    authLevel: "anonymous",
    route: "courses",
    handler: async (request, context) => {
        try {
            const userId = request.query.get("userId") || "demo-user";

            const container = coursesContainer();
            const querySpec = {
                query: "SELECT * FROM c WHERE c.userId = @userId",
                parameters: [{ name: "@userId", value: userId }]
            };

            const { resources } = await container.items.query(querySpec).fetchAll();

            return {
                status: 200,
                jsonBody: resources
            };
        } catch (err) {
            context.log.error("GetCourses error:", err);
            return {
                status: 500,
                jsonBody: { error: "Error retrieving courses" }
            };
        }
    }
});
