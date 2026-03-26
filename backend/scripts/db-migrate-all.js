const fs = require('fs');
const path = require('path');
const { withPool, sqlDir } = require('./_lib');

const BASELINE_CHECKS = [
    { version: 4, sql: `SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'daily_consumption'
          AND column_name = 'taps_over_limit'
    ) AS ok` },
    { version: 6, sql: `SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'machines'
          AND column_name = 'wifi_ssid'
    ) AS ok` },
    { version: 7, sql: `SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'machines'
          AND column_name = 'backend_ok'
    ) AS ok` },
    { version: 8, sql: `SELECT to_regclass('public.alert_events') IS NOT NULL AS ok` },
    { version: 9, sql: `SELECT to_regclass('public.notification_settings') IS NOT NULL AS ok` },
    { version: 10, sql: `SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'employees'
          AND column_name = 'daily_limit_mode'
    ) AS ok` },
    { version: 11, sql: `SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'notification_settings'
          AND column_name = 'employee_limit_warning_lead'
    ) AS ok` },
    { version: 14, sql: `SELECT to_regclass('public.system_settings') IS NOT NULL AS ok` },
    { version: 15, sql: `SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'nfc_cards'
          AND column_name = 'status'
    ) AS ok` },
    { version: 16, sql: `SELECT to_regclass('public.audit_logs') IS NOT NULL AS ok` },
    { version: 17, sql: `SELECT to_regclass('public.admin_user_departments') IS NOT NULL AS ok` },
    { version: 18, sql: `SELECT to_regclass('public.machine_stock_items') IS NOT NULL
                              AND to_regclass('public.stock_movements') IS NOT NULL AS ok` },
    { version: 19, sql: `SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'notification_settings'
          AND column_name = 'notify_stock_low'
    ) AS ok` },
    { version: 21, sql: `SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'employees'
          AND column_name = 'access_level_id'
    ) AS ok` },
];

async function ensureSchemaMigrationsTable(pool) {
    await pool.query(
        `CREATE TABLE IF NOT EXISTS schema_migrations (
            version     INT PRIMARY KEY,
            filename    VARCHAR(120) NOT NULL,
            applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`
    );
}

async function detectSatisfiedBaselineVersions(pool) {
    const versions = [];
    for (const check of BASELINE_CHECKS) {
        const result = await pool.query(check.sql);
        if (result.rows[0]?.ok) versions.push(check.version);
    }
    return versions;
}

async function main() {
    const { listMigrationFiles } = require('./_lib');
    const files = listMigrationFiles();

    if (!files.length) {
        console.log('No se encontraron migraciones.');
        return;
    }

    await withPool(async (pool) => {
        await ensureSchemaMigrationsTable(pool);

        const appliedResult = await pool.query('SELECT version FROM schema_migrations ORDER BY version');
        const appliedVersions = new Set(appliedResult.rows.map(row => parseInt(row.version, 10)));

        if (!appliedVersions.size) {
            const baselineVersions = await detectSatisfiedBaselineVersions(pool);
            if (baselineVersions.length > 0) {
                const baselineFiles = files.filter(file => baselineVersions.includes(file.version));
                for (const file of baselineFiles) {
                    await pool.query(
                        `INSERT INTO schema_migrations (version, filename)
                         VALUES ($1, $2)
                         ON CONFLICT (version) DO NOTHING`,
                        [file.version, file.name]
                    );
                    appliedVersions.add(file.version);
                }
                console.log(`Baseline detectado: ${baselineFiles.map(file => `v${file.version}`).join(', ')}. Se marcan migraciones ya incorporadas por schema actual.`);
            }
        }

        let appliedCount = 0;
        for (const file of files) {
            if (appliedVersions.has(file.version)) {
                console.log(`SKIP ${file.name}`);
                continue;
            }
            const fullPath = path.join(sqlDir, file.name);
            const sql = fs.readFileSync(fullPath, 'utf8');
            console.log(`RUN  ${file.name}`);
            try {
                await pool.query(sql);
                await pool.query(
                    `INSERT INTO schema_migrations (version, filename)
                     VALUES ($1, $2)
                     ON CONFLICT (version) DO NOTHING`,
                    [file.version, file.name]
                );
                appliedCount += 1;
                console.log(`OK   ${file.name}`);
            } catch (err) {
                throw new Error(`${file.name}: ${err.message}`);
            }
        }

        console.log(`Migraciones nuevas aplicadas: ${appliedCount}`);
    });
}

main().catch((err) => {
    console.error('[db:migrate:all] Error:', err.message);
    process.exit(1);
});
