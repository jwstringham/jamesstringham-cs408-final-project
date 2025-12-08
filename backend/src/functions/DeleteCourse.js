// src/functions/DeleteCourse.js
const { app } = require("@azure/functions");
const { coursesContainer } = require("../CosmosClient");

app.http("DeleteCourse", {
    methods: ["DELETE"],
    authLevel: "anonymous",
    route: "courses/{id}",
    handler: async (request, context) => {
        try {
            const id = request.params.id;
            const userId =
                request.query.get("userId") || "demo-user"; // partition key

            if (!id) {
                return {
                    status: 400,
                    jsonBody: { error: "Course id is required in the route" }
                };
            }

            const container = coursesContainer();
            await container.item(id, userId).delete();

            return {
                status: 200,
                jsonBody: { message: "Course deleted" }
            };
        } catch (err) {
            context.log("DeleteCourse error:", err);
            return {
                status: 500,
                jsonBody: { error: "Error deleting course" }
            };
        }
    }
});

