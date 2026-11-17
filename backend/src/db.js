const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'cafeteria',
    port: Number(process.env.DB_PORT) || 5432,
    max: 10, // Limite de conexões simultâneas
    idleTimeoutMillis: 30000
});

module.exports = pool;
