const { withPool } = require('./_lib');

function ok(label, detail) {
    console.log(`OK   ${label}${detail ? ` — ${detail}` : ''}`);
}

function warn(label, detail) {
    console.log(`WARN ${label}${detail ? ` — ${detail}` : ''}`);
}

function fail(label, detail) {
    console.log(`FAIL ${label}${detail ? ` — ${detail}` : ''}`);
}

function envValue(name) {
    return String(process.env[name] || '').trim();
}

async function httpHealth() {
    const port = envValue('PORT') || '3000';
    const url = `http://127.0.0.1:${port}/health`;
    try {
        const response = await fetch(url, { method: 'GET' });
        if (!response.ok) {
            warn('HTTP /health', `${url} respondió ${response.status}`);
            return;
        }
        const data = await response.json();
        ok('HTTP /health', `${url} respondió ok=${data.ok}`);
    } catch (_) {
        warn('HTTP /health', `${url} no está disponible`);
    }
}

async function main() {
    const databaseUrl = envValue('DATABASE_URL');
    const jwtSecret = envValue('JWT_SECRET');
    const registrationSecret = envValue('REGISTRATION_SECRET');
    const smtpHost = envValue('SMTP_HOST');
    const smtpUser = envValue('SMTP_USER');
    const smtpPass = envValue('SMTP_PASS');
    const alertFrom = envValue('ALERT_EMAIL_FROM');
    const alertTo = envValue('ALERT_EMAIL_TO');

    databaseUrl ? ok('DATABASE_URL') : fail('DATABASE_URL', 'faltante');
    jwtSecret ? ok('JWT_SECRET') : fail('JWT_SECRET', 'faltante');
    registrationSecret ? ok('REGISTRATION_SECRET') : fail('REGISTRATION_SECRET', 'faltante');

    if (smtpHost && smtpUser && smtpPass && alertFrom && alertTo) {
        ok('SMTP', `${smtpHost} configurado para ${alertFrom}`);
    } else {
        warn('SMTP', 'configuración incompleta o pendiente');
    }

    await withPool(async (pool) => {
        const dbNow = await pool.query('SELECT NOW() AS now');
        ok('PostgreSQL', `conectado (${dbNow.rows[0].now.toISOString()})`);

        const tableCheck = await pool.query(
            `SELECT name, to_regclass(name) IS NOT NULL AS present
             FROM (VALUES
                ('public.employees'),
                ('public.nfc_cards'),
                ('public.machines'),
                ('public.admin_users'),
                ('public.admin_user_departments'),
                ('public.alert_events'),
                ('public.notification_settings'),
                ('public.system_settings'),
                ('public.audit_logs')
             ) AS t(name)`
        );

        for (const row of tableCheck.rows) {
            if (row.present) ok(`Tabla ${row.name}`);
            else fail(`Tabla ${row.name}`, 'no existe');
        }

        const counts = await pool.query(
            `SELECT
                (SELECT COUNT(*)::int FROM employees) AS employees,
                (SELECT COUNT(*)::int FROM nfc_cards) AS nfc_cards,
                (SELECT COUNT(*)::int FROM machines) AS machines,
                (SELECT COUNT(*)::int FROM admin_users) AS admin_users,
                (SELECT COUNT(*)::int FROM admin_user_departments) AS admin_user_departments`
        );
        const snapshot = counts.rows[0];
        ok('Conteos', `employees=${snapshot.employees}, nfc_cards=${snapshot.nfc_cards}, machines=${snapshot.machines}, admin_users=${snapshot.admin_users}, admin_user_departments=${snapshot.admin_user_departments}`);
    });

    await httpHealth();
}

main().catch((err) => {
    console.error('[support:doctor] Error:', err.message);
    process.exit(1);
});
