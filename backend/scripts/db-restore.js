const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const { spawnSync } = require('child_process');
const {
    parseArgs,
    parseDatabaseUrl,
    quoteIdent,
    findPostgresExecutable
} = require('./_lib');

function usage() {
    console.log(`Uso:
  node scripts/db-restore.js --input archivo [--format sql|custom] [--recreate --confirm nombre_bd] [--yes] [--dry-run]

Ejemplos:
  npm run db:restore -- --input ..\\backups\\db\\coffeecontrol-20260326-150817.sql --yes
  node scripts/db-restore.js --input C:\\Backups\\coffeecontrol.dump --format custom --recreate --confirm coffeecontrol --yes
  node scripts/db-restore.js --input C:\\Backups\\coffeecontrol.sql --dry-run`);
}

function detectFormat(inputPath, explicitFormat) {
    if (explicitFormat) {
        const normalized = String(explicitFormat).trim().toLowerCase();
        if (!['sql', 'custom'].includes(normalized)) {
            throw new Error('Formato inválido. Usá --format sql o --format custom');
        }
        return normalized;
    }
    const ext = path.extname(inputPath).toLowerCase();
    if (['.dump', '.backup', '.bin', '.custom'].includes(ext)) return 'custom';
    return 'sql';
}

async function recreateDatabaseIfNeeded(db, args) {
    if (!args.recreate) return;

    if (!args.confirm) {
        throw new Error(`Falta --confirm ${db.database}`);
    }
    if (String(args.confirm).trim() !== db.database) {
        throw new Error(`Confirmación inválida. Debe ser exactamente --confirm ${db.database}`);
    }

    const adminUrl = new URL(db.connectionString);
    adminUrl.pathname = '/postgres';
    const client = new Client({ connectionString: adminUrl.toString() });
    await client.connect();
    try {
        await client.query(
            `SELECT pg_terminate_backend(pid)
             FROM pg_stat_activity
             WHERE datname = $1
               AND pid <> pg_backend_pid()`,
            [db.database]
        );
        await client.query(`DROP DATABASE IF EXISTS ${quoteIdent(db.database)}`);
        await client.query(`CREATE DATABASE ${quoteIdent(db.database)}`);
    } finally {
        await client.end();
    }
}

function buildRestoreCommand({ format, db, inputPath }) {
    if (format === 'custom') {
        const pgRestore = findPostgresExecutable('pg_restore');
        if (!pgRestore) {
            throw new Error('No se encontró pg_restore. Instalá PostgreSQL o definí PG_BIN');
        }
        return {
            executable: pgRestore,
            args: [
                `--dbname=${db.connectionString}`,
                '--clean',
                '--if-exists',
                '--no-owner',
                '--no-privileges',
                inputPath
            ]
        };
    }

    const psql = findPostgresExecutable('psql');
    if (!psql) {
        throw new Error('No se encontró psql. Instalá PostgreSQL o definí PG_BIN');
    }
    return {
        executable: psql,
        args: [
            `--dbname=${db.connectionString}`,
            '--file',
            inputPath
        ]
    };
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
        usage();
        return;
    }

    const inputPath = path.resolve(String(args.input || '').trim());
    if (!String(args.input || '').trim()) {
        throw new Error('Falta --input archivo');
    }
    if (!fs.existsSync(inputPath)) {
        throw new Error(`No existe el archivo: ${inputPath}`);
    }
    if (!args['dry-run'] && !args.yes) {
        throw new Error('Este comando modifica la base. Confirmá con --yes o usá --dry-run');
    }

    const db = parseDatabaseUrl();
    const format = detectFormat(inputPath, args.format);
    const command = buildRestoreCommand({ format, db, inputPath });

    console.log(`[db:restore] Archivo: ${inputPath}`);
    console.log(`[db:restore] Formato: ${format}`);
    console.log(`[db:restore] Destino: ${db.database} @ ${db.host}:${db.port}`);
    console.log(`[db:restore] Herramienta: ${command.executable}`);

    if (args['dry-run']) {
        if (args.recreate) console.log(`[db:restore] Recreate: DROP/CREATE ${db.database}`);
        console.log(`${command.executable} ${command.args.join(' ')}`);
        return;
    }

    await recreateDatabaseIfNeeded(db, args);

    const result = spawnSync(command.executable, command.args, {
        stdio: 'inherit',
        env: process.env
    });
    if (result.status !== 0) {
        throw new Error(`${path.basename(command.executable)} terminó con código ${result.status}`);
    }
    console.log('[db:restore] OK — backup restaurado');
}

main().catch((err) => {
    console.error('[db:restore] Error:', err.message);
    process.exit(1);
});
