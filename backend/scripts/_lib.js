const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { Pool } = require('pg');

const backendRoot = path.join(__dirname, '..');
const projectRoot = path.join(backendRoot, '..');
const sqlDir = path.join(backendRoot, 'sql');

dotenv.config({ path: path.join(backendRoot, '.env') });

function requireEnv(name) {
    const value = String(process.env[name] || '').trim();
    if (!value) {
        throw new Error(`Falta la variable de entorno ${name}`);
    }
    return value;
}

function createPool() {
    return new Pool({
        connectionString: requireEnv('DATABASE_URL')
    });
}

function readSqlFile(filename) {
    return fs.readFileSync(path.join(sqlDir, filename), 'utf8');
}

function parseArgs(argv) {
    const args = {};
    for (let i = 0; i < argv.length; i += 1) {
        const token = String(argv[i] || '');
        if (!token.startsWith('--')) continue;

        const stripped = token.slice(2);
        const eqIndex = stripped.indexOf('=');
        if (eqIndex >= 0) {
            const key = stripped.slice(0, eqIndex);
            const value = stripped.slice(eqIndex + 1);
            args[key] = value;
            continue;
        }

        const next = argv[i + 1];
        if (next && !String(next).startsWith('--')) {
            args[stripped] = String(next);
            i += 1;
        } else {
            args[stripped] = true;
        }
    }
    return args;
}

function normalizeDepartmentList(value) {
    const rawValues = Array.isArray(value)
        ? value
        : String(value || '').split(/[\n,;]+/);
    const seen = new Set();
    const items = [];
    for (const raw of rawValues) {
        const normalized = String(raw || '').trim().slice(0, 60);
        if (!normalized) continue;
        const key = normalized.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        items.push(normalized);
    }
    return items;
}

function formatTimestamp(date = new Date()) {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const hh = String(date.getHours()).padStart(2, '0');
    const mi = String(date.getMinutes()).padStart(2, '0');
    const ss = String(date.getSeconds()).padStart(2, '0');
    return `${yyyy}${mm}${dd}-${hh}${mi}${ss}`;
}

async function withPool(callback) {
    const pool = createPool();
    try {
        return await callback(pool);
    } finally {
        await pool.end();
    }
}

module.exports = {
    backendRoot,
    projectRoot,
    sqlDir,
    createPool,
    readSqlFile,
    requireEnv,
    parseArgs,
    normalizeDepartmentList,
    formatTimestamp,
    withPool
};
