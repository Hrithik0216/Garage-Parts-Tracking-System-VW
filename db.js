const { Pool } = require('pg');
require("dotenv").config
const db = new Pool({
    user: "postgres",
    host: "127.0.0.1",
    database: "GarageParts",
    password: "Hrithik0216",
    port: 1602,
});

module.exports = db;