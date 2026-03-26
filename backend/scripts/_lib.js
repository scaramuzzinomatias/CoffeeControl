const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');
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

function migrationVersion(filename) {
    const match = /^migration_v(\d+)\.sql$/i.exec(String(filename || ''));
    return match ? parseInt(match[1], 10) : null;
}

function listMigrationFiles() {
    return fs.readdirSync(sqlDir)
        .map(name => ({ name, version: migrationVersion(name) }))
        .filter(item => Number.isInteger(item.version))
        .sort((a, b) => a.version - b.version);
}

function ensureDir(dirPath) {
    fs.mkdirSync(dirPath, { recursive: true });
    return dirPath;
}

function parseDatabaseUrl(connectionString = requireEnv('DATABASE_URL')) {
    const url = new URL(connectionString);
    const database = decodeURIComponent(String(url.pathname || '').replace(/^\/+/, ''));
    if (!database) {
        throw new Error('DATABASE_URL no incluye nombre de base de datos');
    }
    return {
        connectionString,
        url,
        database,
        host: url.hostname,
        port: url.port || '5432',
        username: decodeURIComponent(url.username || ''),
        password: decodeURIComponent(url.password || '')
    };
}

function quoteIdent(value) {
    return `"${String(value || '').replace(/"/g, '""')}"`;
}

function resolveExecutableFromPath(executableName) {
    const locator = process.platform === 'win32' ? 'where.exe' : 'which';
    const result = spawnSync(locator, [executableName], { encoding: 'utf8' });
    if (result.status !== 0) return null;
    const lines = String(result.stdout || '')
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean);
    return lines[0] || null;
}

function postgresBinCandidates() {
    const candidates = [];
    const customBin = String(process.env.PG_BIN || '').trim();
    if (customBin) candidates.push(customBin);

    if (process.platform === 'win32') {
        const roots = [
            path.join(process.env['ProgramFiles'] || 'C:\\Program Files', 'PostgreSQL'),
            path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'PostgreSQL')
        ];
        for (const root of roots) {
            if (!fs.existsSync(root)) continue;
            const versions = fs.readdirSync(root, { withFileTypes: true })
                .filter(entry => entry.isDirectory())
                .map(entry => entry.name)
                .sort((a, b) => parseInt(b, 10) - parseInt(a, 10));
            for (const version of versions) {
                candidates.push(path.join(root, version, 'bin'));
            }
        }
    }

    return candidates;
}

function findPostgresExecutable(baseName) {
    const executableName = process.platform === 'win32' ? `${baseName}.exe` : baseName;

    const fromPath = resolveExecutableFromPath(executableName);
    if (fromPath && fs.existsSync(fromPath)) return fromPath;

    for (const binDir of postgresBinCandidates()) {
        const fullPath = path.join(binDir, executableName);
        if (fs.existsSync(fullPath)) return fullPath;
    }

    return null;
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
    listMigrationFiles,
    ensureDir,
    requireEnv,
    parseDatabaseUrl,
    quoteIdent,
    findPostgresExecutable,
    parseArgs,
    normalizeDepartmentList,
    formatTimestamp,
    withPool
};
