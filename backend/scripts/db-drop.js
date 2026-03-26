const { Client } = require('pg');
const { parseArgs, parseDatabaseUrl, quoteIdent } = require('./_lib');

function usage() {
    console.log(`Uso:
  node scripts/db-drop.js --confirm nombre_bd [--dry-run]

Ejemplos:
  node scripts/db-drop.js --dry-run
  node scripts/db-drop.js --confirm coffeecontrol`);
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

    const adminUrl = new URL(db.connectionString);
    adminUrl.pathname = '/postgres';

    const terminateSql = `
        SELECT pg_terminate_backend(pid)
        FROM pg_stat_activity
        WHERE datname = $1
          AND pid <> pg_backend_pid()
    `;
    const dropSql = `DROP DATABASE IF EXISTS ${quoteIdent(db.database)}`;

    if (args['dry-run']) {
        console.log('[db:drop] DRY RUN');
        console.log(`[db:drop] Conectaría a postgres en ${db.host}:${db.port}`);
        console.log(terminateSql.trim() + ';');
        console.log(dropSql + ';');
        return;
    }

    const client = new Client({ connectionString: adminUrl.toString() });
    await client.connect();
    try {
        console.log(`[db:drop] Terminando conexiones sobre ${db.database}...`);
        await client.query(terminateSql, [db.database]);
        console.log(`[db:drop] Borrando base ${db.database}...`);
        await client.query(dropSql);
        console.log('[db:drop] OK — base borrada');
    } finally {
        await client.end();
    }
}

main().catch((err) => {
    console.error('[db:drop] Error:', err.message);
    process.exit(1);
});
