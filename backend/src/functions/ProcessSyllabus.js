// src/functions/ProcessSyllabus.js
const { app } = require("@azure/functions");
const { coursesContainer, tasksContainer } = require("../CosmosClient");
const { v4: uuidv4 } = require("uuid");
const pdf = require("pdf-parse");


app.storageBlob("ProcessSyllabus", {
    path: "syllabi/{blobName}",
    connection: "BLOB_CONNECTION_STRING",
    handler: async (blob, context) => {
        try {
            const blobName = context.triggerMetadata.blobName || context.triggerMetadata.name;
            context.log(`ProcessSyllabus triggered for blob: ${blobName}`);

            const buffer = Buffer.isBuffer(blob) ? blob : Buffer.from(blob);
            const pdfResult = await pdf(buffer);

            const text = pdfResult.text || "";
            context.log("Extracted text length:", text.length);

            if (!text || !text.trim()) {
                context.log("No text extracted from syllabus; skipping.");
                return;
            }

            const parsed = await extractCourseAndTasks(text);

            if (!parsed || !parsed.courseName) {
                context.log("AI could not confidently extract course info; skipping.");
                return;
            }

            const courseId = "course-" + uuidv4();

            const courses = coursesContainer();
            const courseDoc = {
                id: courseId,
                userId: "demo-user",
                courseName: parsed.courseName,
                instructor: parsed.instructor || "",
                semester: parsed.semester || "",
                numAssignments: parsed.tasks ? parsed.tasks.length : 0,
                sourceBlob: blobName
            };
            await courses.items.create(courseDoc);

            const tasksContainerClient = tasksContainer();
            for (const t of parsed.tasks || []) {
                await tasksContainerClient.items.create({
                    id: "task-" + uuidv4(),
                    courseId,
                    title: t.title,
                    dueDate: t.dueDate,
                    type: t.type,
                    weight: t.weight
                });
            }

            context.log(
                `Created course "${courseDoc.courseName}" with ${
                    courseDoc.numAssignments
                } tasks.`
            );
        } catch (err) {
            context.log("ProcessSyllabus error:", err);
        }
    }
});

function safeJsonParse(maybeJson) {
    if (!maybeJson) return null;

    let s = maybeJson.trim();

    s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");

    const firstBrace = s.indexOf("{");
    const lastBrace = s.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        s = s.slice(firstBrace, lastBrace + 1);
    }

    try {
        return JSON.parse(s);
    } catch (e) {
        return null;
    }
}

async function extractCourseAndTasks(text) {
    const prompt = `
You are parsing a university course syllabus.

From the syllabus text below, extract:
- The course name
- The instructor name, if present
- The semester or term
- A list of graded tasks (homework, exams, projects, quizzes, labs, etc.)

Return ONLY valid JSON (no markdown, no code fences, no backticks) in this exact shape:

{
  "courseName": string,
  "instructor": string | null,
  "semester": string | null,
  "tasks": [
    {
      "title": string,
      "dueDate": "YYYY-MM-DD" | null,
      "type": "Homework" | "Quiz" | "Exam" | "Project" | "Paper" | "Lab" | "Other",
      "weight": number | null
    }
  ]
}

If unsure about any field, set it to null.

Syllabus text:
"""${text.substring(0, 12000)}"""
`;
    const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
    const apiKey = process.env.AZURE_OPENAI_KEY;
    const deployment = process.env.AZURE_OPENAI_DEPLOYMENT_NAME;
    const apiVersion = process.env.AZURE_OPENAI_API_VERSION;

    try {
        const { AzureOpenAI } = await import("openai"); 
        const options = { endpoint, apiKey, deployment, apiVersion }
        const client = new AzureOpenAI(options);
        const completion = await client.chat.completions.create({
            model: deployment,   // use your deployment name here
            temperature: 0,
            response_format: { type: "json_object" },
            messages: [
                {
                    role: "system",
                    content: "You extract structured data from course syllabi."
                },
                {
                    role: "user",
                    content: prompt
                }
            ]
        });

        const content = completion.choices?.[0]?.message?.content?.trim();
        if (!content) return null;

        return safeJsonParse(content);

    } catch (err) {
        console.error("Azure OpenAI error:", err);
        return null;
    }
}
