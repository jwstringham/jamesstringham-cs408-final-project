// src/cosmosClient.js
const { CosmosClient } = require("@azure/cosmos");

const client = new CosmosClient(process.env.COSMOS_DB_CONN_STRING);
const database = client.database(process.env.COSMOS_DB_NAME);

function coursesContainer() {
    return database.container(process.env.COURSES_CONTAINER_NAME);
}

function tasksContainer() {
    return database.container(process.env.TASKS_CONTAINER_NAME);
}

module.exports = {
    coursesContainer,
    tasksContainer
};