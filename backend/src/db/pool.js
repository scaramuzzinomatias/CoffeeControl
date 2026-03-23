// src/db/pool.js — Conexión a PostgreSQL
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,               // máximo de conexiones simultáneas
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
    client_encoding: 'UTF8',
});

pool.on('error', (err) => {
    console.error('[DB] Error inesperado en cliente idle:', err.message);
});

module.exports = pool;
