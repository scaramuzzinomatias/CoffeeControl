const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawn } = require('node:child_process');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const { Client } = require('pg');

const backendRoot = path.join(__dirname, '..');
dotenv.config({ path: path.join(backendRoot, '.env') });

const TEST_PORT = 3101;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;
const TEST_PREFIX = `itest_${Date.now()}`;

let serverProcess = null;
let fixture = null;
let adminToken = '';
let managerToken = '';
let technicianToken = '';
let distributorToken = '';
let protectedToken = '';
let notificationSettingsSnapshot = null;

function machineHeaders(mac) {
    return {
        'Content-Type': 'application/json',
        'X-Machine-Mac': mac
    };
}

async function requestJson(method, pathname, { token, body, headers } = {}) {
    const finalHeaders = {
        ...(headers || {})
    };
    if (body !== undefined && !finalHeaders['Content-Type']) {
        finalHeaders['Content-Type'] = 'application/json';
    }
    if (token) {
        finalHeaders.Authorization = `Bearer ${token}`;
    }
    const response = await fetch(`${BASE_URL}${pathname}`, {
        method,
        headers: finalHeaders,
        body: body === undefined ? undefined : JSON.stringify(body)
    });
    const text = await response.text();
    let json = null;
    if (text) {
        try {
            json = JSON.parse(text);
        } catch (_) {
            json = text;
        }
    }
    return { status: response.status, json, headers: response.headers };
}

async function waitForHealth() {
    const deadline = Date.now() + 15000;
    while (Date.now() < deadline) {
        try {
            const response = await fetch(`${BASE_URL}/health`);
            if (response.ok) return;
        } catch (_) {}
        await new Promise(resolve => setTimeout(resolve, 300));
    }
    throw new Error('El backend de test no respondió /health a tiempo');
}

async function withDb(callback) {
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    try {
        return await callback(client);
    } finally {
        await client.end();
    }
}

function tempEmail(label) {
    return `${TEST_PREFIX}.${label}@example.test`;
}

function tempUid(prefixHex) {
    const tail = Math.floor(Math.random() * 0xffffffff).toString(16).toUpperCase().padStart(8, '0');
    return `${prefixHex}${tail}`.slice(0, 20);
}

function tempMac() {
    const base = Math.floor(Math.random() * 0xffffffff).toString(16).toUpperCase().padStart(8, '0');
    return `AA55${base}`.slice(0, 12);
}

function todayIso() {
    return new Date().toISOString().slice(0, 10);
}

async function cleanupFixtures() {
    await withDb(async (client) => {
        await client.query('BEGIN');
        try {
            const machineIdsResult = await client.query(
                `SELECT id FROM machines WHERE name LIKE $1`,
                [`${TEST_PREFIX}%`]
            );
            const employeeIdsResult = await client.query(
                `SELECT id FROM employees WHERE name LIKE $1 OR email LIKE $2`,
                [`${TEST_PREFIX}%`, `${TEST_PREFIX}%@%`]
            );
            const machineIds = machineIdsResult.rows.map(row => row.id);
            const employeeIds = employeeIdsResult.rows.map(row => row.id);

            if (machineIds.length) {
                await client.query('DELETE FROM machine_commands WHERE machine_id = ANY($1::int[])', [machineIds]);
            }
            if (employeeIds.length || machineIds.length) {
                const clauses = [];
                const params = [];
                if (employeeIds.length) {
                    params.push(employeeIds);
                    clauses.push(`employee_id = ANY($${params.length}::int[])`);
                }
                if (machineIds.length) {
                    params.push(machineIds);
                    clauses.push(`machine_id = ANY($${params.length}::int[])`);
                }
                await client.query(`DELETE FROM taps WHERE ${clauses.join(' OR ')}`, params);
                await client.query(`DELETE FROM alert_events WHERE ${clauses.join(' OR ')}`, params);
            }

            await client.query(
                `DELETE FROM audit_logs
                 WHERE actor_username LIKE $1
                    OR entity_label LIKE $1`,
                [`${TEST_PREFIX}%`]
            );
            await client.query(
                `DELETE FROM admin_users
                 WHERE username LIKE $1`,
                [`${TEST_PREFIX}%`]
            );
            await client.query(
                `DELETE FROM employees
                 WHERE name LIKE $1
                    OR email LIKE $2`,
                [`${TEST_PREFIX}%`, `${TEST_PREFIX}%@%`]
            );
            await client.query(
                `DELETE FROM access_levels
                 WHERE name LIKE $1
                    OR code LIKE $2`,
                [`${TEST_PREFIX}%`, `${TEST_PREFIX}%`]
            );
            await client.query(
                `DELETE FROM machines
                 WHERE name LIKE $1`,
                [`${TEST_PREFIX}%`]
            );
            await client.query('COMMIT');
        } catch (err) {
            try { await client.query('ROLLBACK'); } catch (_) {}
            throw err;
        }
    });
}

async function loadNotificationSettingsSnapshot() {
    return withDb(async (client) => {
        const result = await client.query(
            `SELECT enabled,
                    recipient_emails,
                    notify_employee_limit_warning,
                    notify_employee_daily_blocked,
                    notify_machine_offline,
                    notify_stock_low,
                    notify_machine_backend_down,
                    employee_limit_warning_lead
             FROM notification_settings
             WHERE id = 1`
        );
        return result.rows[0] || null;
    });
}

async function restoreNotificationSettingsSnapshot(snapshot) {
    await withDb(async (client) => {
        if (!snapshot) {
            await client.query('DELETE FROM notification_settings WHERE id = 1');
            return;
        }
        await client.query(
            `INSERT INTO notification_settings(
                id,
                enabled,
                recipient_emails,
                notify_employee_limit_warning,
                notify_employee_daily_blocked,
                notify_machine_offline,
                notify_stock_low,
                notify_machine_backend_down,
                employee_limit_warning_lead,
                updated_at
            )
             VALUES (1, $1, $2, $3, $4, $5, $6, $7, $8, NOW())
             ON CONFLICT (id) DO UPDATE SET
                enabled = EXCLUDED.enabled,
                recipient_emails = EXCLUDED.recipient_emails,
                notify_employee_limit_warning = EXCLUDED.notify_employee_limit_warning,
                notify_employee_daily_blocked = EXCLUDED.notify_employee_daily_blocked,
                notify_machine_offline = EXCLUDED.notify_machine_offline,
                notify_stock_low = EXCLUDED.notify_stock_low,
                notify_machine_backend_down = EXCLUDED.notify_machine_backend_down,
                employee_limit_warning_lead = EXCLUDED.employee_limit_warning_lead,
                updated_at = NOW()`,
            [
                snapshot.enabled,
                snapshot.recipient_emails,
                snapshot.notify_employee_limit_warning,
                snapshot.notify_employee_daily_blocked,
                snapshot.notify_machine_offline,
                snapshot.notify_stock_low,
                snapshot.notify_machine_backend_down,
                snapshot.employee_limit_warning_lead
            ]
        );
    });
}

async function seedFixtures() {
    return withDb(async (client) => {
        await client.query('BEGIN');
        try {
            const deptA = `${TEST_PREFIX}_Gerencia`;
            const deptB = `${TEST_PREFIX}_Ventas`;
            const deptOut = `${TEST_PREFIX}_RRHH`;
            const machineMac = tempMac();
            const machineResult = await client.query(
                `INSERT INTO machines(name, location, mac, secret, active, blocked, last_seen)
                 VALUES ($1, $2, $3, $3, true, false, NOW())
                 RETURNING id, name, mac`,
                [`${TEST_PREFIX}_machine`, 'QA lab', machineMac]
            );
            const machine = machineResult.rows[0];

            const employeeA = await client.query(
                `INSERT INTO employees(name, department, email, daily_limit, daily_limit_mode, warning_enabled, active)
                 VALUES ($1, $2, $3, 4, 'enforce', true, true)
                 RETURNING id, name, department`,
                [`${TEST_PREFIX}_emp_a`, deptA, tempEmail('emp_a')]
            );
            const employeeB = await client.query(
                `INSERT INTO employees(name, department, email, daily_limit, daily_limit_mode, warning_enabled, active)
                 VALUES ($1, $2, $3, 4, 'enforce', true, true)
                 RETURNING id, name, department`,
                [`${TEST_PREFIX}_emp_b`, deptB, tempEmail('emp_b')]
            );
            const employeeOut = await client.query(
                `INSERT INTO employees(name, department, email, daily_limit, daily_limit_mode, warning_enabled, active)
                 VALUES ($1, $2, $3, 4, 'enforce', true, true)
                 RETURNING id, name, department`,
                [`${TEST_PREFIX}_emp_out`, deptOut, tempEmail('emp_out')]
            );

            const lostUid = tempUid('L0');
            const inactiveUid = tempUid('D0');
            await client.query(
                `INSERT INTO nfc_cards(uid, employee_id, label, status, active)
                 VALUES
                   ($1, $2, 'TAG perdido', 'lost', false),
                   ($3, $4, 'TAG inactivo', 'inactive', false)`,
                [
                    lostUid,
                    employeeA.rows[0].id,
                    inactiveUid,
                    employeeB.rows[0].id
                ]
            );

            const passwordHash = await bcrypt.hash('coffeecontrol2024', 10);
            const supervisorResult = await client.query(
                `INSERT INTO admin_users(username, password_hash, role, full_name, department, email, active)
                 VALUES ($1, $2, 'supervisor', $3, $4, $5, true)
                 RETURNING id, username`,
                [
                    `${TEST_PREFIX}_sup`,
                    passwordHash,
                    `${TEST_PREFIX}_Supervisor`,
                    deptA,
                    tempEmail('sup')
                ]
            );
            const supervisor = supervisorResult.rows[0];
            await client.query(
                `INSERT INTO admin_user_departments(admin_user_id, department)
                 VALUES ($1, $2), ($1, $3)`,
                [supervisor.id, deptA, deptB]
            );

            const managerResult = await client.query(
                `INSERT INTO admin_users(username, password_hash, role, full_name, email, active)
                 VALUES ($1, $2, 'gerente', $3, $4, true)
                 RETURNING id, username`,
                [
                    `${TEST_PREFIX}_manager`,
                    passwordHash,
                    `${TEST_PREFIX}_Gerente`,
                    tempEmail('manager')
                ]
            );
            const manager = managerResult.rows[0];

            const technicianResult = await client.query(
                `INSERT INTO admin_users(username, password_hash, role, full_name, email, active)
                 VALUES ($1, $2, 'tecnico', $3, $4, true)
                 RETURNING id, username`,
                [
                    `${TEST_PREFIX}_tech`,
                    passwordHash,
                    `${TEST_PREFIX}_Tecnico`,
                    tempEmail('tech')
                ]
            );
            const technician = technicianResult.rows[0];

            const distributorResult = await client.query(
                `INSERT INTO admin_users(username, password_hash, role, full_name, email, active)
                 VALUES ($1, $2, 'distribuidor', $3, $4, true)
                 RETURNING id, username`,
                [
                    `${TEST_PREFIX}_dist`,
                    passwordHash,
                    `${TEST_PREFIX}_Distribuidor`,
                    tempEmail('dist')
                ]
            );
            const distributor = distributorResult.rows[0];

            const protectedResult = await client.query(
                `INSERT INTO admin_users(username, password_hash, role, full_name, email, active, is_protected)
                 VALUES ($1, $2, 'admin', $3, $4, true, true)
                 RETURNING id, username, is_protected`,
                [
                    `${TEST_PREFIX}_protected`,
                    passwordHash,
                    `${TEST_PREFIX}_Protected`,
                    tempEmail('protected')
                ]
            );
            const protectedAdmin = protectedResult.rows[0];

            await client.query('COMMIT');
            return {
                departments: { deptA, deptB, deptOut },
                machine,
                employees: {
                    a: employeeA.rows[0],
                    b: employeeB.rows[0],
                    out: employeeOut.rows[0]
                },
                cards: {
                    lostUid,
                    inactiveUid
                },
                supervisor,
                manager,
                technician,
                distributor,
                protectedAdmin
            };
        } catch (err) {
            try { await client.query('ROLLBACK'); } catch (_) {}
            throw err;
        }
    });
}

before(async () => {
    await cleanupFixtures();
    notificationSettingsSnapshot = await loadNotificationSettingsSnapshot();

    serverProcess = spawn(process.execPath, ['src/server.js'], {
        cwd: backendRoot,
        env: {
            ...process.env,
            PORT: String(TEST_PORT),
            NODE_ENV: 'test',
            DISABLE_ALERT_MONITOR: 'true',
            ALERT_EMAIL_FROM: '',
            ALERT_EMAIL_TO: '',
            SMTP_HOST: '',
            SMTP_PORT: '',
            SMTP_SECURE: '',
            SMTP_USER: '',
            SMTP_PASS: ''
        },
        stdio: ['ignore', 'pipe', 'pipe']
    });

    serverProcess.stdout.on('data', () => {});
    serverProcess.stderr.on('data', () => {});

    await waitForHealth();
    fixture = await seedFixtures();

    const login = await requestJson('POST', '/api/auth/login', {
        body: { username: 'admin', password: 'coffeecontrol' }
    });
    assert.equal(login.status, 200);
    adminToken = login.json.token;

    const managerLogin = await requestJson('POST', '/api/auth/login', {
        body: { username: fixture.manager.username, password: 'coffeecontrol2024' }
    });
    assert.equal(managerLogin.status, 200);
    managerToken = managerLogin.json.token;

    const technicianLogin = await requestJson('POST', '/api/auth/login', {
        body: { username: fixture.technician.username, password: 'coffeecontrol2024' }
    });
    assert.equal(technicianLogin.status, 200);
    technicianToken = technicianLogin.json.token;

    const distributorLogin = await requestJson('POST', '/api/auth/login', {
        body: { username: fixture.distributor.username, password: 'coffeecontrol2024' }
    });
    assert.equal(distributorLogin.status, 200);
    distributorToken = distributorLogin.json.token;

    const protectedLogin = await requestJson('POST', '/api/auth/login', {
        body: { username: fixture.protectedAdmin.username, password: 'coffeecontrol2024' }
    });
    assert.equal(protectedLogin.status, 200);
    protectedToken = protectedLogin.json.token;
});

after(async () => {
    await restoreNotificationSettingsSnapshot(notificationSettingsSnapshot);
    await cleanupFixtures();
    if (serverProcess) {
        serverProcess.kill('SIGTERM');
        await new Promise(resolve => setTimeout(resolve, 500));
        if (!serverProcess.killed) {
            serverProcess.kill('SIGKILL');
        }
    }
});

test('login de supervisor devuelve scopes múltiples', async () => {
    const response = await requestJson('POST', '/api/auth/login', {
        body: {
            username: fixture.supervisor.username,
            password: 'coffeecontrol2024'
        }
    });

    assert.equal(response.status, 200);
    assert.equal(response.json.role, 'supervisor');
    assert.deepEqual(
        [...response.json.department_scopes].sort(),
        [fixture.departments.deptA, fixture.departments.deptB].sort()
    );
});

test('supervisor solo ve empleados de sus áreas en lecturas y reportes', async () => {
    const login = await requestJson('POST', '/api/auth/login', {
        body: {
            username: fixture.supervisor.username,
            password: 'coffeecontrol2024'
        }
    });
    const token = login.json.token;

    const employees = await requestJson('GET', '/api/employees', { token });
    assert.equal(employees.status, 200);
    const departments = [...new Set(employees.json.employees.map(emp => emp.department))].sort();
    assert.deepEqual(departments, [fixture.departments.deptA, fixture.departments.deptB].sort());
    assert.ok(!departments.includes(fixture.departments.deptOut));

    const reports = await requestJson('GET', '/api/reports/departments', { token });
    assert.equal(reports.status, 200);
    const reportDepartments = reports.json.departments.map(row => row.department).sort();
    assert.deepEqual(reportDepartments, [fixture.departments.deptA, fixture.departments.deptB].sort());
});

test('supervisor recibe 403 fuera de alcance y no puede leer máquinas', async () => {
    const login = await requestJson('POST', '/api/auth/login', {
        body: {
            username: fixture.supervisor.username,
            password: 'coffeecontrol2024'
        }
    });
    const token = login.json.token;

    const outOfScope = await requestJson(
        'GET',
        `/api/dashboard/today?department=${encodeURIComponent(fixture.departments.deptOut)}`,
        { token }
    );
    assert.equal(outOfScope.status, 403);

    const machines = await requestJson('GET', '/api/machines', { token });
    assert.equal(machines.status, 403);
});

test('TAG perdido e inactivo responden con razones explícitas en /api/tap', async () => {
    const lost = await requestJson('POST', '/api/tap', {
        headers: machineHeaders(fixture.machine.mac),
        body: { nfc_uid: fixture.cards.lostUid }
    });
    assert.equal(lost.status, 403);
    assert.equal(lost.json.reason, 'card_lost');

    const inactive = await requestJson('POST', '/api/tap', {
        headers: machineHeaders(fixture.machine.mac),
        body: { nfc_uid: fixture.cards.inactiveUid }
    });
    assert.equal(inactive.status, 403);
    assert.equal(inactive.json.reason, 'card_inactive');
});

test('comando remoto reboot se puede encolar, entregar y confirmar', async () => {
    const queued = await requestJson('POST', `/api/machines/${fixture.machine.id}/commands`, {
        token: adminToken,
        body: { type: 'reboot' }
    });
    assert.equal(queued.status, 201);
    assert.equal(queued.json.command.command_type, 'reboot');

    const next = await requestJson('GET', '/api/machine-control/commands/next', {
        headers: {
            'X-Machine-Mac': fixture.machine.mac
        }
    });
    assert.equal(next.status, 200);
    assert.equal(next.json.command.type, 'reboot');

    const ack = await requestJson('POST', `/api/machine-control/commands/${next.json.command.id}/ack`, {
        headers: machineHeaders(fixture.machine.mac),
        body: {
            status: 'completed',
            result: { message: 'ok' }
        }
    });
    assert.equal(ack.status, 200);
    assert.equal(ack.json.ok, true);
});

test('técnico puede solicitar diagnostics_snapshot remoto y consultar el resultado', async () => {
    await withDb(async client => {
        await client.query('DELETE FROM machine_commands WHERE machine_id = $1', [fixture.machine.id]);
        await client.query('UPDATE machines SET last_seen = NOW() WHERE id = $1', [fixture.machine.id]);
    });

    const queued = await requestJson('POST', `/api/machines/${fixture.machine.id}/commands`, {
        token: technicianToken,
        body: {
            type: 'diagnostics_snapshot',
            payload: { limit: 12 }
        }
    });
    assert.equal(queued.status, 201);
    assert.equal(queued.json.command.command_type, 'diagnostics_snapshot');
    assert.equal(queued.json.command.payload.limit, 12);

    const next = await requestJson('GET', '/api/machine-control/commands/next', {
        headers: {
            'X-Machine-Mac': fixture.machine.mac
        }
    });
    assert.equal(next.status, 200);
    assert.equal(next.json.command.type, 'diagnostics_snapshot');
    assert.equal(next.json.command.payload.limit, 12);

    const ack = await requestJson('POST', `/api/machine-control/commands/${next.json.command.id}/ack`, {
        headers: machineHeaders(fixture.machine.mac),
        body: {
            status: 'completed',
            result: {
                message: 'Diagnóstico generado desde la máquina',
                wifi_connected: true,
                backend_ready: true,
                events: {
                    count: 2,
                    capacity: 64,
                    events: [
                        { name: 'BOOT', arg1: 1, arg2: 0, ms: 15 },
                        { name: 'MDB_RESET', arg1: 0, arg2: 0, ms: 320 }
                    ]
                },
                mdb: {
                    seen_config: true,
                    seen_prices: true,
                    vmc_level: 2,
                    max_price: 1500,
                    min_price: 1
                }
            }
        }
    });
    assert.equal(ack.status, 200);
    assert.equal(ack.json.ok, true);

    const result = await requestJson('GET', `/api/machines/${fixture.machine.id}/commands/${next.json.command.id}`, {
        token: technicianToken
    });
    assert.equal(result.status, 200);
    assert.equal(result.json.command.status, 'completed');
    assert.equal(result.json.command.result.events.count, 2);
    assert.equal(result.json.command.result.mdb.vmc_level, 2);
});

test('registro de máquina devuelve la configuración efectiva de precio desde backend', async () => {
    await withDb(client => client.query(
        `UPDATE machines
         SET price_cents = $1,
             pricing_profile = $2,
             mdb_feature_level = $3,
             mdb_country_code = $4,
             mdb_scale_factor = $5,
             mdb_decimal_places = $6,
             mdb_max_response_time = $7,
             mdb_misc_options = $8,
             technical_config_version = $9,
             technical_config_source = 'backend',
             technical_config_updated_at = NOW()
         WHERE id = $10`,
        [1450, 'identity', 2, 0x0032, 100, 2, 6, 1, 4, fixture.machine.id]
    ));

    const registration = await requestJson('POST', '/api/machines/register', {
        headers: {
            'X-Registration-Secret': process.env.REGISTRATION_SECRET
        },
        body: {
            mac: fixture.machine.mac,
            backend_url: BASE_URL,
            wifi_ssid: 'QA_WIFI',
            price_cents: 1200,
            pricing_profile: 'rubino_half_credit',
            config_version: 9,
            config_source: 'portal',
            backend_ok: true
        }
    });

    assert.equal(registration.status, 200);
    assert.equal(registration.json.status, 'approved');
    assert.equal(registration.json.config.price_cents, 1450);
    assert.equal(registration.json.config.pricing_profile, 'identity');
    assert.equal(registration.json.config.mdb_feature_level, 2);
    assert.equal(registration.json.config.mdb_country_code, 0x0032);
    assert.equal(registration.json.config.mdb_scale_factor, 100);
    assert.equal(registration.json.config.mdb_decimal_places, 2);
    assert.equal(registration.json.config.mdb_max_response_time, 6);
    assert.equal(registration.json.config.mdb_misc_options, 1);
    assert.equal(registration.json.config.config_version, 10);
    assert.equal(registration.json.config.config_source, 'backend');

    const support = await requestJson('GET', `/api/machines/${fixture.machine.id}/technical-config`, {
        token: technicianToken
    });
    assert.equal(support.status, 200);
    assert.equal(support.json.support.reported_config.price_cents, 1200);
    assert.equal(support.json.support.reported_config.pricing_profile, 'rubino_half_credit');
    assert.equal(support.json.support.reported_config.config_version, 9);
    assert.equal(support.json.support.reported_config.config_source, 'portal');
    assert.equal(support.json.support.status, 'drift');
    assert.equal(support.json.support.drift.some(item => item.field === 'price_cents'), true);
});

test('actualizar precio de máquina encola config_update cuando la máquina está online', async () => {
    await withDb(async (client) => {
        await client.query('DELETE FROM machine_commands WHERE machine_id = $1', [fixture.machine.id]);
        await client.query(
            `UPDATE machines
             SET last_seen = NOW(),
                 pricing_profile = 'rubino_half_credit',
                 mdb_feature_level = 1,
                 mdb_country_code = 50,
                 mdb_scale_factor = 100,
                 mdb_decimal_places = 2,
                 mdb_max_response_time = 5,
                 mdb_misc_options = 0
             WHERE id = $1`,
            [fixture.machine.id]
        );
    });

    const updated = await requestJson('PATCH', `/api/machines/${fixture.machine.id}`, {
        token: adminToken,
        body: {
            price_cents: 1550
        }
    });
    assert.equal(updated.status, 200);
    assert.equal(updated.json.machine.price_cents, 1550);
    assert.equal(updated.json.config_sync, 'queued');

    const next = await requestJson('GET', '/api/machine-control/commands/next', {
        headers: {
            'X-Machine-Mac': fixture.machine.mac
        }
    });
    assert.equal(next.status, 200);
    assert.equal(next.json.command.type, 'config_update');
    assert.equal(next.json.command.payload.price_cents, 1550);
    assert.equal(next.json.command.payload.pricing_profile, 'rubino_half_credit');
    assert.equal(next.json.command.payload.mdb_feature_level, 1);
    assert.equal(next.json.command.payload.mdb_country_code, 50);
    assert.equal(next.json.command.payload.mdb_scale_factor, 100);
    assert.equal(next.json.command.payload.mdb_decimal_places, 2);
    assert.equal(next.json.command.payload.mdb_max_response_time, 5);
    assert.equal(next.json.command.payload.mdb_misc_options, 0);
    assert.equal(next.json.command.payload.config_version >= 1, true);
    assert.equal(next.json.command.payload.config_source, 'backend');

    const ack = await requestJson('POST', `/api/machine-control/commands/${next.json.command.id}/ack`, {
        headers: machineHeaders(fixture.machine.mac),
        body: {
            status: 'completed',
            result: { message: 'price applied' }
        }
    });
    assert.equal(ack.status, 200);
    assert.equal(ack.json.ok, true);
});

test('configuración técnica remota solo está disponible para admin/técnico/distribuidor', async () => {
    const forbidden = await requestJson('GET', `/api/machines/${fixture.machine.id}/technical-config`, {
        token: managerToken
    });
    assert.equal(forbidden.status, 403);

    const visibleForTechnician = await requestJson('GET', `/api/machines/${fixture.machine.id}/technical-config`, {
        token: technicianToken
    });
    assert.equal(visibleForTechnician.status, 200);
    assert.equal(visibleForTechnician.json.technical_config.price_cents > 0, true);
    assert.equal(visibleForTechnician.json.technical_config.config_version >= 1, true);
    assert.equal(visibleForTechnician.json.technical_config.config_source, 'backend');
    assert.ok(visibleForTechnician.json.support);
    assert.ok(['not_reported', 'in_sync', 'drift'].includes(visibleForTechnician.json.support.status));

    const visibleForDistributor = await requestJson('GET', `/api/machines/${fixture.machine.id}/technical-config`, {
        token: distributorToken
    });
    assert.equal(visibleForDistributor.status, 200);
});

test('técnico puede actualizar configuración técnica completa y encola config_update integral', async () => {
    await withDb(async (client) => {
        await client.query('DELETE FROM machine_commands WHERE machine_id = $1', [fixture.machine.id]);
        await client.query('UPDATE machines SET last_seen = NOW() WHERE id = $1', [fixture.machine.id]);
    });

    const updated = await requestJson('PATCH', `/api/machines/${fixture.machine.id}/technical-config`, {
        token: technicianToken,
        body: {
            price_cents: 1700,
            pricing_profile: 'identity',
            mdb_feature_level: 2,
            mdb_country_code: '0x0032',
            mdb_scale_factor: 100,
            mdb_decimal_places: 2,
            mdb_max_response_time: 7,
            mdb_misc_options: 1
        }
    });
    assert.equal(updated.status, 200);
    assert.equal(updated.json.technical_config.price_cents, 1700);
    assert.equal(updated.json.technical_config.pricing_profile, 'identity');
    assert.equal(updated.json.technical_config.mdb_feature_level, 2);
    assert.equal(updated.json.technical_config.mdb_country_code, 0x0032);
    assert.equal(updated.json.technical_config.mdb_max_response_time, 7);
    assert.equal(updated.json.technical_config.mdb_misc_options, 1);
    assert.equal(updated.json.technical_config.config_version >= 1, true);
    assert.equal(updated.json.technical_config.config_source, 'backend');
    assert.equal(updated.json.config_sync, 'queued');
    assert.equal(updated.json.support.last_backend_change.actor_username, fixture.technician.username);
    assert.equal(updated.json.support.last_backend_change.action, 'machine.update_technical_config');

    const next = await requestJson('GET', '/api/machine-control/commands/next', {
        headers: {
            'X-Machine-Mac': fixture.machine.mac
        }
    });
    assert.equal(next.status, 200);
    assert.equal(next.json.command.type, 'config_update');
    assert.equal(next.json.command.payload.price_cents, 1700);
    assert.equal(next.json.command.payload.pricing_profile, 'identity');
    assert.equal(next.json.command.payload.mdb_feature_level, 2);
    assert.equal(next.json.command.payload.mdb_country_code, 0x0032);
    assert.equal(next.json.command.payload.mdb_scale_factor, 100);
    assert.equal(next.json.command.payload.mdb_decimal_places, 2);
    assert.equal(next.json.command.payload.mdb_max_response_time, 7);
    assert.equal(next.json.command.payload.mdb_misc_options, 1);
    assert.equal(next.json.command.payload.config_version, updated.json.technical_config.config_version);
    assert.equal(next.json.command.payload.config_source, 'backend');

    const ack = await requestJson('POST', `/api/machine-control/commands/${next.json.command.id}/ack`, {
        headers: machineHeaders(fixture.machine.mac),
        body: {
            status: 'completed',
            result: { message: 'full config applied' }
        }
    });
    assert.equal(ack.status, 200);
    assert.equal(ack.json.ok, true);
});

test('supervisor no puede acceder a notificaciones ni auditoría', async () => {
    const login = await requestJson('POST', '/api/auth/login', {
        body: {
            username: fixture.supervisor.username,
            password: 'coffeecontrol2024'
        }
    });
    const token = login.json.token;

    const notificationSettings = await requestJson('GET', '/api/notification-settings', { token });
    assert.equal(notificationSettings.status, 403);

    const auditLogs = await requestJson('GET', '/api/audit-logs', { token });
    assert.equal(auditLogs.status, 403);
});

test('alertas activas respetan el alcance de gerente y supervisor', async () => {
    await withDb(async (client) => {
        await client.query(
            `INSERT INTO alert_events(alert_key, alert_type, status, machine_id, employee_id, payload)
             VALUES
                ($1, 'employee_limit_warning', 'open', $4, $5, $7::jsonb),
                ($2, 'employee_daily_blocked', 'open', $4, $6, $8::jsonb),
                ($3, 'machine_offline', 'open', $4, NULL, $9::jsonb)
             ON CONFLICT (alert_key) DO UPDATE SET
                status = EXCLUDED.status,
                machine_id = EXCLUDED.machine_id,
                employee_id = EXCLUDED.employee_id,
                payload = EXCLUDED.payload,
                last_seen_at = NOW(),
                resolved_at = NULL`,
            [
                `${TEST_PREFIX}_alert_in_scope`,
                `${TEST_PREFIX}_alert_out_scope`,
                `${TEST_PREFIX}_alert_machine`,
                fixture.machine.id,
                fixture.employees.a.id,
                fixture.employees.out.id,
                JSON.stringify({ taps_today: 3, daily_limit: 4, progress_label: '3 / 4' }),
                JSON.stringify({ deny_reason: 'limit_reached' }),
                JSON.stringify({ reason: 'test' })
            ]
        );
    });

    const managerAlerts = await requestJson('GET', '/api/alerts/active?limit=10', {
        token: managerToken
    });
    assert.equal(managerAlerts.status, 200);
    assert.ok(managerAlerts.json.summary.total_open >= 3);
    assert.ok(managerAlerts.json.alerts.some(alert => alert.alert_key === `${TEST_PREFIX}_alert_in_scope`));
    assert.ok(managerAlerts.json.alerts.some(alert => alert.alert_key === `${TEST_PREFIX}_alert_out_scope`));
    assert.ok(managerAlerts.json.alerts.some(alert => alert.alert_key === `${TEST_PREFIX}_alert_machine`));

    const supervisorLogin = await requestJson('POST', '/api/auth/login', {
        body: {
            username: fixture.supervisor.username,
            password: 'coffeecontrol2024'
        }
    });
    const supervisorAlerts = await requestJson('GET', '/api/alerts/active?limit=10', {
        token: supervisorLogin.json.token
    });
    assert.equal(supervisorAlerts.status, 200);
    assert.ok(supervisorAlerts.json.alerts.some(alert => alert.alert_key === `${TEST_PREFIX}_alert_in_scope`));
    assert.ok(!supervisorAlerts.json.alerts.some(alert => alert.alert_key === `${TEST_PREFIX}_alert_out_scope`));
    assert.ok(!supervisorAlerts.json.alerts.some(alert => alert.alert_key === `${TEST_PREFIX}_alert_machine`));
});

test('gerente puede actualizar notificaciones y queda auditado', async () => {
    const current = await requestJson('GET', '/api/notification-settings', { token: managerToken });
    assert.equal(current.status, 200);

    const nextLead = current.json.settings.employee_limit_warning_lead === 1 ? 2 : 1;
    const updated = await requestJson('PUT', '/api/notification-settings', {
        token: managerToken,
        body: {
            enabled: current.json.settings.enabled,
            recipient_emails: current.json.settings.recipient_emails || tempEmail('alerts'),
            notify_employee_limit_warning: current.json.settings.notify_employee_limit_warning,
            notify_employee_daily_blocked: current.json.settings.notify_employee_daily_blocked,
            notify_machine_offline: current.json.settings.notify_machine_offline,
            notify_stock_low: current.json.settings.notify_stock_low,
            employee_limit_warning_lead: nextLead
        }
    });
    assert.equal(updated.status, 200);
    assert.equal(updated.json.settings.employee_limit_warning_lead, nextLead);

    const auditLogs = await requestJson(
        'GET',
        `/api/audit-logs?action=notification_settings.update&q=${encodeURIComponent(fixture.manager.username)}`,
        { token: managerToken }
    );
    assert.equal(auditLogs.status, 200);
    const log = auditLogs.json.logs.find(entry => entry.actor_username === fixture.manager.username);
    assert.ok(log, 'No se encontró el evento de auditoría para notification_settings.update');
    assert.equal(log.action, 'notification_settings.update');
    assert.equal(log.entity_type, 'notification_settings');
});

test('stock bajo abre y resuelve alerta operativa al cruzar el mínimo', async () => {
    const settingsBefore = await requestJson('GET', '/api/notification-settings', { token: managerToken });
    assert.equal(settingsBefore.status, 200);

    const settingsUpdated = await requestJson('PUT', '/api/notification-settings', {
        token: managerToken,
        body: {
            enabled: true,
            recipient_emails: settingsBefore.json.settings.recipient_emails || tempEmail('stock-alerts'),
            notify_employee_limit_warning: settingsBefore.json.settings.notify_employee_limit_warning,
            notify_employee_daily_blocked: settingsBefore.json.settings.notify_employee_daily_blocked,
            notify_machine_offline: settingsBefore.json.settings.notify_machine_offline,
            notify_stock_low: true,
            employee_limit_warning_lead: settingsBefore.json.settings.employee_limit_warning_lead
        }
    });
    assert.equal(settingsUpdated.status, 200);
    assert.equal(settingsUpdated.json.settings.notify_stock_low, true);

    const itemId = Math.floor(Math.random() * 10000) + 30000;
    const created = await requestJson('POST', `/api/machines/${fixture.machine.id}/stock`, {
        token: managerToken,
        body: {
            item_id: itemId,
            product_name: `${TEST_PREFIX}_low_stock`,
            slot_label: 'C3',
            capacity_units: 8,
            current_units: 2,
            min_units: 3,
            active: true
        }
    });
    assert.equal(created.status, 201);

    await withDb(async (client) => {
        const alert = await client.query(
            `SELECT status, payload
             FROM alert_events
             WHERE alert_key = $1`,
            [`stock-low-${fixture.machine.id}-${created.json.stock_item.id}`]
        );
        assert.equal(alert.rowCount, 1);
        assert.equal(alert.rows[0].status, 'open');
        assert.equal(alert.rows[0].payload.status, 'low');
    });

    const restocked = await requestJson('POST', `/api/machines/${fixture.machine.id}/stock/${created.json.stock_item.id}/restock`, {
        token: managerToken,
        body: {
            quantity: 3
        }
    });
    assert.equal(restocked.status, 200);
    assert.equal(restocked.json.stock_item.current_units, 5);

    await withDb(async (client) => {
        const alert = await client.query(
            `SELECT status, resolved_at
             FROM alert_events
             WHERE alert_key = $1`,
            [`stock-low-${fixture.machine.id}-${created.json.stock_item.id}`]
        );
        assert.equal(alert.rowCount, 1);
        assert.equal(alert.rows[0].status, 'resolved');
        assert.ok(alert.rows[0].resolved_at, 'La alerta de stock bajo no quedó resuelta');
    });
});

test('alta de empleado genera auditoría visible para gerente', async () => {
    const created = await requestJson('POST', '/api/employees', {
        token: managerToken,
        body: {
            name: `${TEST_PREFIX}_emp_audit`,
            department: fixture.departments.deptA,
            email: tempEmail('emp_audit'),
            daily_limit: 4,
            daily_limit_mode: 'enforce',
            warning_enabled: true
        }
    });
    assert.equal(created.status, 201);
    assert.equal(created.json.employee.name, `${TEST_PREFIX}_emp_audit`);

    const auditLogs = await requestJson(
        'GET',
        `/api/audit-logs?action=employee.create&q=${encodeURIComponent(TEST_PREFIX)}`,
        { token: managerToken }
    );
    assert.equal(auditLogs.status, 200);
    const log = auditLogs.json.logs.find(entry => entry.entity_label === `${TEST_PREFIX}_emp_audit`);
    assert.ok(log, 'No se encontró el evento de auditoría para employee.create');
    assert.equal(log.actor_username, fixture.manager.username);
    assert.equal(log.action, 'employee.create');
    assert.equal(log.entity_type, 'employee');
});

test('gerente puede crear una jerarquía y asignarla a un empleado con auditoría', async () => {
    const levelName = `${TEST_PREFIX}_nivel_warn`;
    const level = await requestJson('POST', '/api/access-levels', {
        token: managerToken,
        body: {
            name: levelName,
            description: 'Jerarquía de prueba para integración',
            daily_limit: 1,
            daily_limit_mode: 'warn_only',
            warning_enabled: false,
            sort_order: 10,
            active: true
        }
    });
    assert.equal(level.status, 201);
    assert.equal(level.json.access_level.name, levelName);

    const employee = await requestJson('POST', '/api/employees', {
        token: managerToken,
        body: {
            name: `${TEST_PREFIX}_emp_level`,
            department: fixture.departments.deptA,
            email: tempEmail('emp_level'),
            daily_limit: 4,
            daily_limit_mode: 'enforce',
            warning_enabled: true,
            access_level_id: level.json.access_level.id
        }
    });
    assert.equal(employee.status, 201);
    assert.equal(employee.json.employee.access_level_id, level.json.access_level.id);

    const employees = await requestJson('GET', '/api/employees', { token: managerToken });
    assert.equal(employees.status, 200);
    const createdEmployee = employees.json.employees.find(item => item.id === employee.json.employee.id);
    assert.ok(createdEmployee, 'No apareció el empleado con jerarquía en /api/employees');
    assert.equal(createdEmployee.policy_source, 'access_level');
    assert.equal(createdEmployee.access_level_name, levelName);
    assert.equal(Number(createdEmployee.effective_daily_limit), 1);
    assert.equal(createdEmployee.effective_daily_limit_mode, 'warn_only');
    assert.equal(createdEmployee.effective_warning_enabled, false);

    const auditLogs = await requestJson(
        'GET',
        `/api/audit-logs?action=access_level.create&q=${encodeURIComponent(levelName)}`,
        { token: managerToken }
    );
    assert.equal(auditLogs.status, 200);
    const log = auditLogs.json.logs.find(entry => entry.entity_label === levelName);
    assert.ok(log, 'No se encontró la auditoría de access_level.create');
    assert.equal(log.actor_username, fixture.manager.username);
    assert.equal(log.entity_type, 'access_level');
});

test('la jerarquía prevalece sobre la política manual en /api/tap y /api/tap/cards', async () => {
    const levelName = `${TEST_PREFIX}_nivel_override`;
    const level = await requestJson('POST', '/api/access-levels', {
        token: managerToken,
        body: {
            name: levelName,
            daily_limit: 1,
            daily_limit_mode: 'warn_only',
            warning_enabled: false,
            sort_order: 20,
            active: true
        }
    });
    assert.equal(level.status, 201);

    const employee = await requestJson('POST', '/api/employees', {
        token: managerToken,
        body: {
            name: `${TEST_PREFIX}_emp_override`,
            department: fixture.departments.deptA,
            email: tempEmail('emp_override'),
            daily_limit: 1,
            daily_limit_mode: 'enforce',
            warning_enabled: true,
            access_level_id: level.json.access_level.id
        }
    });
    assert.equal(employee.status, 201);

    const uid = tempUid('A0');
    const card = await requestJson('POST', `/api/employees/${employee.json.employee.id}/cards`, {
        token: managerToken,
        body: {
            uid,
            label: 'TAG jerarquía'
        }
    });
    assert.equal(card.status, 201);

    const firstTap = await requestJson('POST', '/api/tap', {
        headers: machineHeaders(fixture.machine.mac),
        body: { nfc_uid: uid }
    });
    assert.equal(firstTap.status, 200);
    assert.equal(firstTap.json.daily_limit_mode, 'warn_only');

    const secondTap = await requestJson('POST', '/api/tap', {
        headers: machineHeaders(fixture.machine.mac),
        body: { nfc_uid: uid }
    });
    assert.equal(secondTap.status, 200);
    assert.equal(secondTap.json.daily_limit_mode, 'warn_only');
    assert.equal(secondTap.json.taps_today, 2);

    const cards = await requestJson('GET', '/api/tap/cards', {
        headers: machineHeaders(fixture.machine.mac)
    });
    assert.equal(cards.status, 200);
    const cachedCard = cards.json.cards.find(item => item.uid === uid);
    assert.ok(cachedCard, 'No apareció la tarjeta en /api/tap/cards');
    assert.equal(Number(cachedCard.daily_limit), 1);
    assert.equal(cachedCard.daily_limit_mode, 'warn_only');
});

test('reportes filtran empleados por jerarquía y por configuración manual', async () => {
    const levelName = `${TEST_PREFIX}_nivel_reportes`;
    const level = await requestJson('POST', '/api/access-levels', {
        token: managerToken,
        body: {
            name: levelName,
            daily_limit: 3,
            daily_limit_mode: 'enforce',
            warning_enabled: true,
            sort_order: 30,
            active: true
        }
    });
    assert.equal(level.status, 201);

    const assigned = await requestJson('POST', '/api/employees', {
        token: managerToken,
        body: {
            name: `${TEST_PREFIX}_emp_report_level`,
            department: fixture.departments.deptA,
            email: tempEmail('emp_report_level'),
            daily_limit: 4,
            daily_limit_mode: 'warn_only',
            warning_enabled: true,
            access_level_id: level.json.access_level.id
        }
    });
    assert.equal(assigned.status, 201);

    const manual = await requestJson('POST', '/api/employees', {
        token: managerToken,
        body: {
            name: `${TEST_PREFIX}_emp_report_manual`,
            department: fixture.departments.deptA,
            email: tempEmail('emp_report_manual'),
            daily_limit: 2,
            daily_limit_mode: 'enforce',
            warning_enabled: true
        }
    });
    assert.equal(manual.status, 201);

    const range = `from=${todayIso()}&to=${todayIso()}`;
    const byLevel = await requestJson(
        'GET',
        `/api/reports/employees?${range}&access_level_id=${level.json.access_level.id}`,
        { token: managerToken }
    );
    assert.equal(byLevel.status, 200);
    const levelEmployee = byLevel.json.employees.find(item => item.id === assigned.json.employee.id);
    assert.ok(levelEmployee, 'No apareció el empleado asignado al nivel en el filtro por jerarquía');
    assert.equal(levelEmployee.access_level_name, levelName);
    assert.equal(levelEmployee.policy_source, 'access_level');
    assert.ok(!byLevel.json.employees.some(item => item.id === manual.json.employee.id));

    const manualOnly = await requestJson(
        'GET',
        `/api/reports/employees?${range}&access_level_id=manual`,
        { token: managerToken }
    );
    assert.equal(manualOnly.status, 200);
    assert.ok(manualOnly.json.employees.some(item => item.id === manual.json.employee.id));
    assert.ok(!manualOnly.json.employees.some(item => item.id === assigned.json.employee.id));
});

test('gerente puede configurar stock por máquina y consultarlo', async () => {
    const itemId = Math.floor(Math.random() * 10000) + 1000;
    const created = await requestJson('POST', `/api/machines/${fixture.machine.id}/stock`, {
        token: managerToken,
        body: {
            item_id: itemId,
            product_name: `${TEST_PREFIX}_cafe_stock`,
            slot_label: 'A1',
            capacity_units: 20,
            current_units: 12,
            min_units: 3,
            active: true
        }
    });
    assert.equal(created.status, 201);
    assert.equal(created.json.stock_item.item_id, itemId);
    assert.equal(created.json.stock_item.current_units, 12);

    const detail = await requestJson('GET', `/api/machines/${fixture.machine.id}/stock`, {
        token: managerToken
    });
    assert.equal(detail.status, 200);
    const stockItem = detail.json.items.find(item => item.item_id === itemId);
    assert.ok(stockItem, 'No se encontró la selección configurada');
    assert.equal(stockItem.product_name, `${TEST_PREFIX}_cafe_stock`);
    assert.equal(detail.json.summary.configured_items >= 1, true);
});

test('vend_confirmed descuenta stock configurado sin romper el tap', async () => {
    const itemId = Math.floor(Math.random() * 10000) + 20000;
    const uid = tempUid('S0');

    await withDb(async (client) => {
        await client.query('BEGIN');
        try {
            await client.query(
                `INSERT INTO nfc_cards(uid, employee_id, label, status, active)
                 VALUES ($1, $2, 'TAG stock test', 'active', true)`,
                [uid, fixture.employees.a.id]
            );
            await client.query(
                `INSERT INTO machine_stock_items(machine_id, item_id, product_name, slot_label, capacity_units, current_units, min_units, active)
                 VALUES ($1, $2, $3, 'B2', 10, 5, 1, true)`,
                [fixture.machine.id, itemId, `${TEST_PREFIX}_sale_stock`]
            );
            await client.query(
                `INSERT INTO taps(employee_id, machine_id, nfc_uid, approved, deny_reason, item_id, amount_cents, over_limit, confirmed, tapped_at)
                 VALUES ($1, $2, $3, true, NULL, NULL, NULL, false, NULL, NOW())`,
                [fixture.employees.a.id, fixture.machine.id, uid]
            );
            await client.query('COMMIT');
        } catch (err) {
            try { await client.query('ROLLBACK'); } catch (_) {}
            throw err;
        }
    });

    const result = await requestJson('POST', '/api/tap/result', {
        headers: machineHeaders(fixture.machine.mac),
        body: {
            nfc_uid: uid,
            vend_success: true,
            item_id: itemId,
            amount: 150
        }
    });
    assert.equal(result.status, 200);
    assert.equal(result.json.ok, true);

    const detail = await requestJson('GET', `/api/machines/${fixture.machine.id}/stock`, {
        token: managerToken
    });
    assert.equal(detail.status, 200);
    const stockItem = detail.json.items.find(item => item.item_id === itemId);
    assert.ok(stockItem, 'No se encontró la selección descontada');
    assert.equal(stockItem.current_units, 4);

    await withDb(async (client) => {
        const movement = await client.query(
            `SELECT movement_type, quantity_delta
             FROM stock_movements
             WHERE machine_id = $1
               AND item_id = $2
             ORDER BY id DESC
             LIMIT 1`,
            [fixture.machine.id, itemId]
        );
        assert.equal(movement.rowCount, 1);
        assert.equal(movement.rows[0].movement_type, 'sale');
        assert.equal(parseInt(movement.rows[0].quantity_delta, 10), -1);
    });
});

test('gerente puede ver reportes de stock con resumen y movimientos', async () => {
    const itemId = Math.floor(Math.random() * 10000) + 40000;
    const created = await requestJson('POST', `/api/machines/${fixture.machine.id}/stock`, {
        token: managerToken,
        body: {
            item_id: itemId,
            product_name: `${TEST_PREFIX}_stock_report`,
            slot_label: 'D4',
            capacity_units: 10,
            current_units: 2,
            min_units: 3,
            active: true
        }
    });
    assert.equal(created.status, 201);

    const restocked = await requestJson('POST', `/api/machines/${fixture.machine.id}/stock/${created.json.stock_item.id}/restock`, {
        token: managerToken,
        body: {
            quantity: 4,
            note: 'Reposición de prueba'
        }
    });
    assert.equal(restocked.status, 200);

    const dashboardToday = await requestJson('GET', '/api/dashboard/today', {
        token: managerToken
    });
    assert.equal(dashboardToday.status, 200);
    const today = dashboardToday.json.business_date;
    const report = await requestJson('GET', `/api/reports/stock?from=${today}&to=${today}`, {
        token: managerToken
    });
    assert.equal(report.status, 200);
    assert.equal(report.json.business_timezone?.length > 0, true);
    assert.equal(report.json.summary.configured_items >= 1, true);
    assert.equal(report.json.summary.restocked_units >= 4, true);

    const stockItem = report.json.items.find(item => Number(item.item_id) === itemId);
    assert.ok(stockItem, 'No se encontró la selección en reportes de stock');
    assert.equal(stockItem.product_name, `${TEST_PREFIX}_stock_report`);
    assert.equal(['ok', 'low', 'empty', 'inactive'].includes(stockItem.status), true);

    const movement = report.json.recent_movements.find(row => Number(row.item_id) === itemId);
    assert.ok(movement, 'No se encontró movimiento reciente de stock');
    assert.equal(movement.movement_type, 'restock');
});

test('supervisor no puede acceder a reportes de stock', async () => {
    const login = await requestJson('POST', '/api/auth/login', {
        body: {
            username: fixture.supervisor.username,
            password: 'coffeecontrol2024'
        }
    });
    const token = login.json.token;

    const report = await requestJson('GET', '/api/reports/stock', { token });
    assert.equal(report.status, 403);
});

test('técnico puede operar máquinas y stock sin permisos gerenciales', async () => {
    const machines = await requestJson('GET', '/api/machines', { token: technicianToken });
    assert.equal(machines.status, 200);
    assert.ok(Array.isArray(machines.json.machines));

    const itemId = Math.floor(Math.random() * 10000) + 50000;
    const created = await requestJson('POST', `/api/machines/${fixture.machine.id}/stock`, {
        token: technicianToken,
        body: {
            item_id: itemId,
            product_name: `${TEST_PREFIX}_tech_stock`,
            slot_label: 'T1',
            capacity_units: 12,
            current_units: 6,
            min_units: 2,
            active: true
        }
    });
    assert.equal(created.status, 201);

    const command = await requestJson('POST', `/api/machines/${fixture.machine.id}/commands`, {
        token: technicianToken,
        body: { type: 'reboot' }
    });
    assert.equal(command.status, 201);
    assert.equal(command.json.command.command_type, 'reboot');
});

test('técnico no puede acceder a empleados, analítica ni configuración global', async () => {
    const employees = await requestJson('GET', '/api/employees', { token: technicianToken });
    assert.equal(employees.status, 403);

    const dashboard = await requestJson('GET', '/api/dashboard/today', { token: technicianToken });
    assert.equal(dashboard.status, 403);

    const reports = await requestJson('GET', '/api/reports/departments', { token: technicianToken });
    assert.equal(reports.status, 403);

    const taps = await requestJson('GET', `/api/machines/${fixture.machine.id}/taps`, { token: technicianToken });
    assert.equal(taps.status, 403);

    const notifications = await requestJson('GET', '/api/notification-settings', { token: technicianToken });
    assert.equal(notifications.status, 403);
});

test('distribuidor puede gestionar onboarding de máquinas y operar comandos técnicos', async () => {
    const pendingMacApprove = tempMac();
    const pendingMacReject = tempMac();
    const [pendingApprove, pendingReject] = await withDb(async client => {
        const approve = await client.query(
            `INSERT INTO pending_machines(mac)
             VALUES ($1)
             RETURNING id, mac`,
            [pendingMacApprove]
        );
        const reject = await client.query(
            `INSERT INTO pending_machines(mac)
             VALUES ($1)
             RETURNING id, mac`,
            [pendingMacReject]
        );
        return [approve.rows[0], reject.rows[0]];
    });

    try {
        const pendingList = await requestJson('GET', '/api/machines/pending', { token: distributorToken });
        assert.equal(pendingList.status, 200);
        assert.ok((pendingList.json.pending || []).some(item => item.id === pendingApprove.id));

        const approved = await requestJson('POST', `/api/machines/pending/${pendingApprove.id}/approve`, {
            token: distributorToken,
            body: {
                name: `${TEST_PREFIX}_machine_setup`,
                location: 'Sala de pruebas'
            }
        });
        assert.equal(approved.status, 201);
        assert.equal(approved.json.machine.name, `${TEST_PREFIX}_machine_setup`);

        const rejected = await requestJson('POST', `/api/machines/pending/${pendingReject.id}/reject`, {
            token: distributorToken
        });
        assert.equal(rejected.status, 200);

        const command = await requestJson('POST', `/api/machines/${fixture.machine.id}/commands`, {
            token: distributorToken,
            body: { type: 'wifi_scan' }
        });
        assert.ok([201, 409].includes(command.status));
    } finally {
        await withDb(client => client.query(
            'DELETE FROM pending_machines WHERE id = ANY($1::int[])',
            [[pendingApprove.id, pendingReject.id]]
        ));
    }
});

test('distribuidor no puede acceder a analítica, empleados ni configuración global', async () => {
    const employees = await requestJson('GET', '/api/employees', { token: distributorToken });
    assert.equal(employees.status, 403);

    const dashboard = await requestJson('GET', '/api/dashboard/today', { token: distributorToken });
    assert.equal(dashboard.status, 403);

    const reports = await requestJson('GET', '/api/reports/departments', { token: distributorToken });
    assert.equal(reports.status, 403);

    const users = await requestJson('GET', '/api/admin-users', { token: distributorToken });
    assert.equal(users.status, 403);

    const block = await requestJson('POST', `/api/machines/${fixture.machine.id}/block`, {
        token: distributorToken,
        body: { reason: 'No debería poder bloquear' }
    });
    assert.equal(block.status, 403);
});

test('mobile-auth permite técnico con refresh/logout y revoca la sesión al cerrar', async () => {
    const login = await requestJson('POST', '/api/mobile-auth/login', {
        body: {
            username: fixture.technician.username,
            password: 'coffeecontrol2024',
            device_name: 'Pixel QA',
            platform: 'android'
        }
    });
    assert.equal(login.status, 200);
    assert.equal(login.json.user.role, 'tecnico');
    assert.ok(login.json.access_token);
    assert.ok(login.json.refresh_token);
    assert.equal(login.json.session.platform, 'android');

    const machines = await requestJson('GET', '/api/machines', {
        token: login.json.access_token
    });
    assert.equal(machines.status, 200);

    const refresh = await requestJson('POST', '/api/mobile-auth/refresh', {
        body: {
            refresh_token: login.json.refresh_token
        }
    });
    assert.equal(refresh.status, 200);
    assert.ok(refresh.json.refresh_token);
    assert.notEqual(refresh.json.refresh_token, login.json.refresh_token);

    const logout = await requestJson('POST', '/api/mobile-auth/logout', {
        body: {
            refresh_token: refresh.json.refresh_token
        }
    });
    assert.equal(logout.status, 200);
    assert.equal(logout.json.ok, true);

    const afterLogout = await requestJson('GET', '/api/machines', {
        token: refresh.json.access_token
    });
    assert.equal(afterLogout.status, 401);
});

test('mobile-auth bloquea supervisor y mobile-tech exige rol operador de tarjetas', async () => {
    const mobileLogin = await requestJson('POST', '/api/mobile-auth/login', {
        body: {
            username: fixture.supervisor.username,
            password: 'coffeecontrol2024',
            device_name: 'Supervisor Phone',
            platform: 'android'
        }
    });
    assert.equal(mobileLogin.status, 403);

    const supervisorLogin = await requestJson('POST', '/api/auth/login', {
        body: {
            username: fixture.supervisor.username,
            password: 'coffeecontrol2024'
        }
    });
    assert.equal(supervisorLogin.status, 200);

    const search = await requestJson('GET', `/api/mobile-tech/employees/search?q=${encodeURIComponent(TEST_PREFIX)}`, {
        token: supervisorLogin.json.token
    });
    assert.equal(search.status, 403);
});

test('mobile-tech permite buscar empleados, consultar un TAG y asignar/reasignar credenciales', async () => {
    const mobileLogin = await requestJson('POST', '/api/mobile-auth/login', {
        body: {
            username: fixture.technician.username,
            password: 'coffeecontrol2024',
            device_name: 'Moto G',
            platform: 'android'
        }
    });
    assert.equal(mobileLogin.status, 200);
    const mobileToken = mobileLogin.json.access_token;

    const search = await requestJson(
        'GET',
        `/api/mobile-tech/employees/search?q=${encodeURIComponent(`${TEST_PREFIX}_emp`)}`,
        { token: mobileToken }
    );
    assert.equal(search.status, 200);
    assert.ok(search.json.employees.some(employee => employee.id === fixture.employees.a.id));

    const lostLookup = await requestJson('GET', `/api/mobile-tech/cards/lookup/${fixture.cards.lostUid}`, {
        token: mobileToken
    });
    assert.equal(lostLookup.status, 200);
    assert.equal(lostLookup.json.found, true);
    assert.equal(lostLookup.json.card.status, 'lost');

    const newUid = tempUid('B0');
    const assigned = await requestJson('POST', `/api/mobile-tech/employees/${fixture.employees.b.id}/cards`, {
        token: mobileToken,
        body: {
            uid: newUid,
            label: 'TAG Android'
        }
    });
    assert.equal(assigned.status, 201);
    assert.equal(assigned.json.card.employee_id, fixture.employees.b.id);

    const lookupAssigned = await requestJson('GET', `/api/mobile-tech/cards/lookup/${newUid}`, {
        token: mobileToken
    });
    assert.equal(lookupAssigned.status, 200);
    assert.equal(lookupAssigned.json.card.employee_id, fixture.employees.b.id);

    const reassigned = await requestJson('PATCH', `/api/mobile-tech/employees/${fixture.employees.a.id}/cards/${assigned.json.card.id}`, {
        token: mobileToken,
        body: {
            employee_id: fixture.employees.a.id,
            status: 'active',
            label: 'TAG reasignado'
        }
    });
    assert.equal(reassigned.status, 200);
    assert.equal(reassigned.json.card.employee_id, fixture.employees.a.id);
    assert.equal(reassigned.json.card.label, 'TAG reasignado');

    const auditLogs = await requestJson(
        'GET',
        `/api/audit-logs?action=nfc_card.update&q=${encodeURIComponent(newUid)}`,
        { token: adminToken }
    );
    assert.equal(auditLogs.status, 200);
    assert.ok(
        auditLogs.json.logs.some(entry =>
            entry.actor_username === fixture.technician.username &&
            entry.entity_label === newUid
        ),
        'No se encontró la auditoría de reasignación desde mobile-tech'
    );
});

test('cuenta protegida no puede editarse ni desactivarse desde el panel', async () => {
    const users = await requestJson('GET', '/api/admin-users', { token: managerToken });
    assert.equal(users.status, 200);
    const protectedUser = users.json.users.find(user => user.id === fixture.protectedAdmin.id);
    assert.ok(protectedUser, 'No apareció la cuenta protegida en /api/admin-users');
    assert.equal(protectedUser.is_protected, true);

    const patchAttempt = await requestJson('PATCH', `/api/admin-users/${fixture.protectedAdmin.id}`, {
        token: adminToken,
        body: { full_name: 'Intento de cambio' }
    });
    assert.equal(patchAttempt.status, 403);
    assert.match(patchAttempt.json.error, /cuenta protegida/i);

    const deleteAttempt = await requestJson('DELETE', `/api/admin-users/${fixture.protectedAdmin.id}`, {
        token: adminToken
    });
    assert.equal(deleteAttempt.status, 403);
    assert.match(deleteAttempt.json.error, /cuenta protegida/i);
});

test('cuenta protegida no puede cambiar su contraseña desde el panel', async () => {
    const response = await requestJson('POST', '/api/auth/change-password', {
        token: protectedToken,
        body: {
            current_password: 'coffeecontrol2024',
            new_password: 'NuevaClave2024'
        }
    });
    assert.equal(response.status, 403);
    assert.match(response.json.error, /soporte local/i);
});
