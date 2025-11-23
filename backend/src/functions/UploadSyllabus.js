const { app } = require("@azure/functions");
const { BlobServiceClient } = require("@azure/storage-blob");
const { v4: uuidv4 } = require("uuid");

app.http("UploadSyllabus", {
    methods: ["POST"],
    authLevel: "anonymous",
    route: "upload-syllabus",
    handler: async (request, context) => {
        try {
            // Expect JSON: { fileBase64: "...." }
            const body = await request.json();
            const fileBase64 = body.fileBase64;

            if (!fileBase64) {
                return {
                    status: 400,
                    jsonBody: { error: "fileBase64 is required in the request body" }
                };
            }

            const buffer = Buffer.from(fileBase64, "base64");
            const blobName = uuidv4() + ".pdf";

            const blobServiceClient = BlobServiceClient.fromConnectionString(
                process.env.BLOB_CONNECTION_STRING
            );
            const containerClient = blobServiceClient.getContainerClient(
                process.env.BLOB_CONTAINER
            );

            await containerClient.createIfNotExists();
            const blockBlobClient = containerClient.getBlockBlobClient(blobName);
            await blockBlobClient.uploadData(buffer);

            return {
                status: 200,
                jsonBody: {
                    message: "Syllabus uploaded to Blob Storage",
                    blobName
                }
            };
        } catch (err) {
            context.log.error("Upload error:", err);
            return {
                status: 500,
                jsonBody: { error: "Error uploading syllabus" }
            };
        }
    }
});
