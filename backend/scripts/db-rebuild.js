const path = require('path');
const { spawnSync } = require('child_process');
const { Client, Pool } = require('pg');
const {
    parseArgs,
    parseDatabaseUrl,
    quoteIdent,
    readSqlFile,
    listMigrationFiles
} = require('./_lib');

function usage() {
    console.log(`Uso:
  node scripts/db-rebuild.js --confirm nombre_bd [--dry-run]

Qué hace:
  1. DROP DATABASE
  2. CREATE DATABASE
  3. aplica backend/sql/schema.sql
  4. aplica todas las migraciones en orden
  5. registra schema_migrations

Importante:
  - usa el schema actual del repo
  - hoy schema.sql incluye datos demo/seed`);
}

async function recreateDatabase(db) {
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

async function main() {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
        usage();
        return;
    }

    const db = parseDatabaseUrl();
    if (!args['dry-run']) {
        if (!args.confirm) {
            throw new Error(`Falta --confirm ${db.database}`);
        }
        if (String(args.confirm).trim() !== db.database) {
            throw new Error(`Confirmación inválida. Debe ser exactamente --confirm ${db.database}`);
        }
    }

    const migrations = listMigrationFiles();
    console.log(`[db:rebuild] Destino: ${db.database} @ ${db.host}:${db.port}`);
    console.log(`[db:rebuild] Schema: backend/sql/schema.sql`);
    console.log(`[db:rebuild] Migraciones: ${migrations.map(item => item.name).join(', ')}`);

    if (args['dry-run']) {
        console.log(`[db:rebuild] DRY RUN`);
        console.log(`DROP DATABASE IF EXISTS ${quoteIdent(db.database)};`);
        console.log(`CREATE DATABASE ${quoteIdent(db.database)};`);
        console.log(`-- aplicar schema.sql y ${migrations.length} migraciones`);
        return;
    }

    await recreateDatabase(db);

    const pool = new Pool({ connectionString: db.connectionString });
    try {
        console.log('[db:rebuild] Aplicando schema.sql...');
        await pool.query(readSqlFile('schema.sql'));
    } finally {
        await pool.end();
    }

    console.log('[db:rebuild] Aplicando migraciones faltantes...');
    const migrateScript = path.join(__dirname, 'db-migrate-all.js');
    const result = spawnSync(process.execPath, [migrateScript], {
        stdio: 'inherit',
        env: process.env
    });
    if (result.status !== 0) {
        throw new Error(`db-migrate-all terminó con código ${result.status}`);
    }

    console.log('[db:rebuild] OK — base reconstruida');
}

main().catch((err) => {
    console.error('[db:rebuild] Error:', err.message);
    process.exit(1);
});
