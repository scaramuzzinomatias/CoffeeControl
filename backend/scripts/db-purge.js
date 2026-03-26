const { withPool, parseArgs } = require('./_lib');

const PURGE_TABLES = [
    'stock_movements',
    'taps',
    'machine_commands',
    'pending_machines',
    'alert_events',
    'audit_logs'
];

function usage() {
    console.log(`Uso:
  node scripts/db-purge.js --yes [--dry-run]

Qué hace:
  - limpia datos operativos/transaccionales
  - preserva usuarios, empleados, TAGs, máquinas, jerarquías, configuración y stock configurado
  - resetea telemetría dinámica de máquinas (last_seen, RSSI, IP, backend_ok, backend_error)`);
}

async function existingTables(pool, tableNames) {
    const result = await pool.query(
        `SELECT tablename
         FROM pg_tables
         WHERE schemaname = 'public'
           AND tablename = ANY($1::text[])`,
        [tableNames]
    );
    return result.rows.map(row => row.tablename);
}

async function snapshot(pool) {
    const result = await pool.query(
        `SELECT
            (SELECT COUNT(*)::int FROM taps) AS taps,
            (SELECT COUNT(*)::int FROM stock_movements) AS stock_movements,
            (SELECT COUNT(*)::int FROM machine_commands) AS machine_commands,
            (SELECT COUNT(*)::int FROM pending_machines) AS pending_machines,
            (SELECT COUNT(*)::int FROM alert_events) AS alert_events,
            (SELECT COUNT(*)::int FROM audit_logs) AS audit_logs`
    );
    return result.rows[0];
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
        usage();
        return;
    }
    if (!args.yes && !args['dry-run']) {
        throw new Error('Este comando es destructivo. Confirmá con --yes o usá --dry-run');
    }

    await withPool(async (pool) => {
        const before = await snapshot(pool);
        console.log('[db:purge] Estado actual:', before);

        const tables = await existingTables(pool, PURGE_TABLES);
        const truncateSql = tables.length
            ? `TRUNCATE TABLE ${tables.map(name => `public.${name}`).join(', ')} RESTART IDENTITY CASCADE`
            : null;
        const machineResetSql = `
            UPDATE machines
            SET last_seen = NULL,
                wifi_rssi = NULL,
                wifi_ip = NULL,
                backend_ok = NULL,
                backend_error = NULL
        `;

        if (args['dry-run']) {
            console.log('[db:purge] DRY RUN');
            if (truncateSql) console.log(truncateSql + ';');
            console.log(machineResetSql.trim() + ';');
            return;
        }

        await pool.query('BEGIN');
        try {
            if (truncateSql) await pool.query(truncateSql);
            await pool.query(machineResetSql);
            await pool.query('COMMIT');
        } catch (err) {
            await pool.query('ROLLBACK');
            throw err;
        }

        const after = await snapshot(pool);
        console.log('[db:purge] OK — datos operativos purgados');
        console.log('[db:purge] Estado final:', after);
    });
}

main().catch((err) => {
    console.error('[db:purge] Error:', err.message);
    process.exit(1);
});
