const nodemailer = require('nodemailer');
const { withTenantContext } = require('../db/tenantContext');
const pool = require('../db/pool');
const bootstrapPool = require('../db/bootstrapPool');
const notificationTemplates = require('../config/notificationTemplates');
const systemSettings = require('./systemSettings');
const { classifyStockStatus } = require('./stock');
const {
    formatBusinessDate,
    formatDateTimeInZone
} = require('../lib/businessTime');

const ALERT_CHECK_INTERVAL_MS = Math.max(parseInt(process.env.ALERT_CHECK_INTERVAL_MS || '60000', 10), 15000);
const MACHINE_OFFLINE_WINDOW_MS = 180000;
const SETTINGS_CACHE_TTL_MS = 10000;
const FALLBACK_NOTIFICATION_SETTINGS = Object.freeze({
    enabled: true,
    recipient_emails: String(process.env.ALERT_EMAIL_TO || '').trim(),
    notify_employee_limit_warning: false,
    notify_employee_daily_blocked: true,
    notify_machine_offline: true,
    notify_stock_low: false,
    notify_machine_backend_down: false,
    employee_limit_warning_lead: 1
});

let monitorHandle = null;
let transport = null;
let emailReadyLogged = false;
const settingsCache = {};
let settingsCacheAt = 0;
let settingsTableMissingLogged = false;

function parseRecipients(rawValue) {
    return String(rawValue || '')
        .split(/[\n,;]+/)
        .map(value => value.trim())
        .filter(Boolean);
}

function uniqueRecipients(values) {
    const seen = new Set();
    const recipients = [];
    for (const email of parseRecipients(values)) {
        const key = email.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        recipients.push(email);
    }
    return recipients;
}

function emailConfig() {
    return {
        from: String(process.env.ALERT_EMAIL_FROM || '').trim(),
        host: String(process.env.SMTP_HOST || '').trim(),
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        secure: String(process.env.SMTP_SECURE || 'false').trim().toLowerCase() === 'true',
        user: String(process.env.SMTP_USER || '').trim(),
        pass: String(process.env.SMTP_PASS || '').trim()
    };
}

function smtpReady() {
    const cfg = emailConfig();
    return Boolean(cfg.from && cfg.host && cfg.port);
}

function normalizeBoolean(value, fallback = false) {
    if (typeof value === 'boolean') return value;
    if (value === 'true') return true;
    if (value === 'false') return false;
    return fallback;
}

function normalizeInteger(value, fallback, { min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER } = {}) {
    const parsed = parseInt(value, 10);
    if (!Number.isInteger(parsed)) return fallback;
    return Math.min(Math.max(parsed, min), max);
}

function sanitizeNotificationSettings(raw = {}) {
    const recipientList = uniqueRecipients(raw.recipient_emails);
    return {
        enabled: normalizeBoolean(raw.enabled, FALLBACK_NOTIFICATION_SETTINGS.enabled),
        recipient_emails: recipientList.join(', '),
        notify_employee_limit_warning: normalizeBoolean(
            raw.notify_employee_limit_warning,
            FALLBACK_NOTIFICATION_SETTINGS.notify_employee_limit_warning
        ),
        notify_employee_daily_blocked: normalizeBoolean(
            raw.notify_employee_daily_blocked,
            FALLBACK_NOTIFICATION_SETTINGS.notify_employee_daily_blocked
        ),
        notify_machine_offline: normalizeBoolean(
            raw.notify_machine_offline,
            FALLBACK_NOTIFICATION_SETTINGS.notify_machine_offline
        ),
        notify_stock_low: normalizeBoolean(
            raw.notify_stock_low,
            FALLBACK_NOTIFICATION_SETTINGS.notify_stock_low
        ),
        notify_machine_backend_down: false,
        employee_limit_warning_lead: normalizeInteger(
            raw.employee_limit_warning_lead,
            FALLBACK_NOTIFICATION_SETTINGS.employee_limit_warning_lead,
            { min: 1, max: 10 }
        )
    };
}

function buildSettingsApiModel(settings) {
    const cfg = emailConfig();
    return {
        ...settings,
        recipients: parseRecipients(settings.recipient_emails),
        smtp_ready: smtpReady(),
        email_from: cfg.from || '',
        smtp_host: cfg.host || ''
    };
}

async function loadNotificationSettings(tenantId, force = false) {
    if (!force && settingsCache[tenantId] && (Date.now() - settingsCacheAt) < SETTINGS_CACHE_TTL_MS) {
        return { ...settingsCache[tenantId] };
    }

    try {
        const result = await withTenantContext(tenantId, client => client.query(
            `SELECT enabled,
                    recipient_emails,
                    notify_employee_limit_warning,
                    notify_employee_daily_blocked,
                    notify_machine_offline,
                    notify_stock_low,
                    notify_machine_backend_down,
                    employee_limit_warning_lead
             FROM notification_settings
             WHERE id = 1 AND tenant_id = $1`,
            [tenantId]
        ));

        const settings = result.rowCount > 0
            ? sanitizeNotificationSettings(result.rows[0])
            : sanitizeNotificationSettings(FALLBACK_NOTIFICATION_SETTINGS);

        settingsCache[tenantId] = settings;
        settingsCacheAt = Date.now();
        return { ...settings };
    } catch (err) {
        if (err.code === '42P01') {
            if (!settingsTableMissingLogged) {
                console.warn('[ALERT] notification_settings todavía no existe; usando fallback de .env');
                settingsTableMissingLogged = true;
            }
            const fallback = sanitizeNotificationSettings(FALLBACK_NOTIFICATION_SETTINGS);
            settingsCache[tenantId] = fallback;
            settingsCacheAt = Date.now();
            return { ...fallback };
        }
        throw err;
    }
}

function invalidateSettingsCache(tenantId) {
    delete settingsCache[tenantId];
    settingsCacheAt = 0;
}

async function getNotificationSettings(tenantId) {
    const settings = await loadNotificationSettings(tenantId);
    return buildSettingsApiModel(settings);
}

async function getEmployeeLimitWarningLead(tenantId) {
    const settings = await loadNotificationSettings(tenantId);
    return settings.employee_limit_warning_lead;
}

function assertSettingsValid(settings, { requireRecipients = true } = {}) {
    const recipients = parseRecipients(settings.recipient_emails);
    if (requireRecipients && !recipients.length) {
        throw new Error('Indicá al menos un destinatario para las notificaciones.');
    }
    return recipients;
}

async function saveNotificationSettings(input, tenantId) {
    const settings = sanitizeNotificationSettings(input);
    if (settings.enabled && (
        settings.notify_employee_daily_blocked
        || settings.notify_machine_offline
        || settings.notify_stock_low
        || settings.notify_machine_backend_down
    )) {
        assertSettingsValid(settings, { requireRecipients: true });
    }

    await withTenantContext(tenantId, client => client.query(
        `INSERT INTO notification_settings(
            id,
            tenant_id,
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
         VALUES (1, $1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
         ON CONFLICT (tenant_id, id) DO UPDATE SET
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
            tenantId,
            settings.enabled,
            settings.recipient_emails,
            settings.notify_employee_limit_warning,
            settings.notify_employee_daily_blocked,
            settings.notify_machine_offline,
            settings.notify_stock_low,
            settings.notify_machine_backend_down,
            settings.employee_limit_warning_lead
        ]
    ));

    invalidateSettingsCache(tenantId);
    return getNotificationSettings(tenantId);
}

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[ch]));
}

function renderTemplate(template, values) {
    return String(template || '').replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (_match, key) => {
        const normalizedKey = String(key || '').trim().toLowerCase();
        if (!Object.prototype.hasOwnProperty.call(values, normalizedKey)) return '';
        return String(values[normalizedKey] ?? '');
    });
}

function textToHtml(text) {
    return String(text || '')
        .split(/\r?\n/)
        .map(line => line ? `<div>${escapeHtml(line)}</div>` : '<div style="height:10px"></div>')
        .join('');
}

function getTransport() {
    if (transport) return transport;
    const cfg = emailConfig();
    const auth = cfg.user ? { user: cfg.user, pass: cfg.pass } : undefined;
    transport = nodemailer.createTransport({
        host: cfg.host,
        port: cfg.port,
        secure: cfg.secure,
        auth
    });
    return transport;
}

async function openAlert({ alertKey, alertType, machineId = null, employeeId = null, payload = null, tenantId }) {
    const existing = await withTenantContext(tenantId, client => client.query(
        `SELECT alert_key, status, last_notified_at
         FROM alert_events
         WHERE alert_key = $1 AND tenant_id = $2`,
        [alertKey, tenantId]
    ));

    if (existing.rowCount === 0) {
        await withTenantContext(tenantId, client => client.query(
            `INSERT INTO alert_events(alert_key, alert_type, status, machine_id, employee_id, payload, tenant_id)
             VALUES ($1, $2, 'open', $3, $4, $5::jsonb, $6)`,
            [alertKey, alertType, machineId, employeeId, payload ? JSON.stringify(payload) : null, tenantId]
        ));
        return { shouldNotify: true };
    }

    const row = existing.rows[0];
    await withTenantContext(tenantId, client => client.query(
        `UPDATE alert_events
         SET status = 'open',
             machine_id = COALESCE($2, machine_id),
             employee_id = COALESCE($3, employee_id),
             last_seen_at = NOW(),
             resolved_at = NULL,
             payload = $4::jsonb
         WHERE alert_key = $1 AND tenant_id = $5`,
        [alertKey, machineId, employeeId, payload ? JSON.stringify(payload) : null, tenantId]
    ));

    return {
        shouldNotify: row.status === 'resolved' || !row.last_notified_at
    };
}

async function resolveAlert(alertKey, tenantId) {
    await withTenantContext(tenantId, client => client.query(
        `UPDATE alert_events
         SET status = 'resolved',
             resolved_at = NOW(),
             last_seen_at = NOW()
         WHERE alert_key = $1
           AND tenant_id = $2
           AND status <> 'resolved'`,
        [alertKey, tenantId]
    ));
}

async function markAlertNotified(alertKey, tenantId) {
    await withTenantContext(tenantId, client => client.query(
        `UPDATE alert_events
         SET last_notified_at = NOW()
         WHERE alert_key = $1 AND tenant_id = $2`,
        [alertKey, tenantId]
    ));
}

function alertTypeEnabled(settings, alertType) {
    if (!settings.enabled) return false;
    if (alertType === 'employee_limit_warning') return settings.notify_employee_limit_warning;
    if (alertType === 'employee_daily_blocked') return settings.notify_employee_daily_blocked;
    if (alertType === 'machine_offline') return settings.notify_machine_offline;
    if (alertType === 'stock_low') return settings.notify_stock_low;
    if (alertType === 'machine_backend_down') return false;
    return true;
}

async function sendEmail({ subject, text, html, recipients, bccOnly = false }) {
    if (!smtpReady() || !Array.isArray(recipients) || !recipients.length) {
        if (!emailReadyLogged) {
            console.log('[ALERT] Email deshabilitado: faltan destinatarios o SMTP_* en backend/.env');
            emailReadyLogged = true;
        }
        return false;
    }

    const cfg = emailConfig();
    const payload = {
        from: cfg.from,
        subject,
        text,
        html
    };
    if (bccOnly) {
        payload.to = cfg.from;
        payload.bcc = recipients.join(', ');
    } else {
        payload.to = recipients.join(', ');
    }

    await getTransport().sendMail(payload);
    return true;
}

async function notifyIfNeeded({
    alertKey,
    alertType,
    machineId = null,
    employeeId = null,
    payload = null,
    subject,
    text,
    html,
    recipients = null,
    bccOnly = false,
    tenantId
}) {
    try {
        const state = await openAlert({ alertKey, alertType, machineId, employeeId, payload, tenantId });
        const settings = await loadNotificationSettings(tenantId);
        if (!alertTypeEnabled(settings, alertType)) return false;
        if (!state.shouldNotify) return false;
        const deliveryRecipients = Array.isArray(recipients)
            ? uniqueRecipients(recipients)
            : parseRecipients(settings.recipient_emails);
        const sent = await sendEmail({ subject, text, html, recipients: deliveryRecipients, bccOnly });
        if (sent) {
            await markAlertNotified(alertKey, tenantId);
            console.log(`[ALERT] Email enviado: ${alertKey}`);
        }
        return sent;
    } catch (err) {
        console.error(`[ALERT] Error notificando ${alertKey}:`, err.message);
        return false;
    }
}

async function sendTestNotification(input = {}, tenantId) {
    const baseSettings = sanitizeNotificationSettings({
        ...FALLBACK_NOTIFICATION_SETTINGS,
        ...(await loadNotificationSettings(tenantId)),
        ...(input || {})
    });
    const recipients = assertSettingsValid(baseSettings, { requireRecipients: true });
    if (!smtpReady()) {
        throw new Error('SMTP no configurado en backend. Revisá SMTP_* y ALERT_EMAIL_FROM.');
    }

    const timeZone = await systemSettings.getBusinessTimeZone(tenantId);
    const subject = '[CoffeeControl] Prueba de notificaciones';
    const now = formatDateTimeInZone(new Date(), timeZone);
    const text = [
        'Esta es una prueba manual del sistema de notificaciones de CoffeeControl.',
        `Fecha y hora: ${now}.`,
        `Destinatarios: ${recipients.join(', ')}.`
    ].join('\n');
    const html = `
        <h2>Prueba de notificaciones</h2>
        <p>Este correo confirma que el canal SMTP de <strong>CoffeeControl</strong> está operativo.</p>
        <ul>
          <li>Fecha y hora: <strong>${escapeHtml(now)}</strong></li>
          <li>Destinatarios: <strong>${escapeHtml(recipients.join(', '))}</strong></li>
        </ul>
    `;

    await sendEmail({ subject, text, html, recipients });
    return {
        recipients,
        email_from: emailConfig().from || '',
        sent_at: new Date().toISOString()
    };
}

async function notifyEmployeeDailyBlocked({ employeeId, employeeName, dailyLimit, tapsToday, machineName, uid, tenantId }) {
    const { timeZone, businessDate: dayKey } = await systemSettings.getBusinessTimeContext(tenantId);
    const alertKey = `employee-daily-block-${employeeId}-${dayKey}`;
    const payload = {
        employee_name: employeeName,
        daily_limit: dailyLimit,
        taps_today: tapsToday,
        machine_name: machineName,
        uid,
        business_date: dayKey
    };
    const templateValues = {
        employee_name: employeeName,
        daily_limit: dailyLimit,
        taps_today: tapsToday,
        machine_name: machineName || '—',
        uid: uid || '—',
        business_date: dayKey,
        business_timezone: timeZone
    };
    const subject = renderTemplate(notificationTemplates.employeeDailyBlocked.subject, templateValues);
    const text = renderTemplate(notificationTemplates.employeeDailyBlocked.body, templateValues);
    const html = `
        <h2>Empleado bloqueado por límite diario</h2>
        <div>${textToHtml(text)}</div>
    `;
    return notifyIfNeeded({ alertKey, alertType: 'employee_daily_blocked', employeeId, payload, subject, text, html, tenantId });
}

async function loadEmployeeWarningRecipients(employeeId, tenantId) {
    const employeeResult = await pool.query(
        `SELECT id, name, email, department, warning_enabled
         FROM employees
         WHERE id = $1 AND active = true AND tenant_id = $2`,
        [employeeId, tenantId]
    );

    if (employeeResult.rowCount === 0) return null;

    const employee = employeeResult.rows[0];
    if (!employee.warning_enabled) {
        return { employee, recipients: [] };
    }

    const recipients = [];
    if (employee.email) recipients.push(employee.email);

    if (employee.department) {
        const supervisorResult = await pool.query(
            `SELECT email
             FROM admin_users
             WHERE active = true
               AND role = 'supervisor'
               AND email IS NOT NULL
               AND tenant_id = $2
               AND TRIM(LOWER(department)) = TRIM(LOWER($1))
             UNION
             SELECT au.email
             FROM admin_users au
             JOIN admin_user_departments aud
               ON aud.admin_user_id = au.id
             WHERE au.active = true
               AND au.role = 'supervisor'
               AND au.email IS NOT NULL
               AND au.tenant_id = $2
               AND aud.tenant_id = $2
               AND TRIM(LOWER(aud.department)) = TRIM(LOWER($1))`,
            [employee.department, tenantId]
        );
        recipients.push(...supervisorResult.rows.map(row => row.email));
    }

    return {
        employee,
        recipients: uniqueRecipients(recipients)
    };
}

async function notifyEmployeeLimitWarning({ employeeId, dailyLimit, tapsToday, machineName, uid, tenantId }) {
    const target = await loadEmployeeWarningRecipients(employeeId, tenantId);
    if (!target) return false;
    const settings = await loadNotificationSettings(tenantId);

    const { timeZone, businessDate: dayKey } = await systemSettings.getBusinessTimeContext(tenantId);
    const relationText = tapsToday > dailyLimit
        ? 'superó'
        : tapsToday === dailyLimit
            ? 'alcanzó'
            : 'está por alcanzar';
    const warningLead = settings.employee_limit_warning_lead;
    const remainingCups = Math.max(parseInt(dailyLimit, 10) - parseInt(tapsToday, 10), 0);
    const warningTrigger = Math.max(parseInt(dailyLimit, 10) - warningLead, 1);
    const alertKey = `employee-limit-warning-${employeeId}-${dayKey}`;
    const payload = {
        employee_name: target.employee.name,
        department: target.employee.department,
        daily_limit: dailyLimit,
        taps_today: tapsToday,
        machine_name: machineName,
        uid,
        business_date: dayKey,
        warning_lead: warningLead,
        remaining_cups: remainingCups,
        warning_trigger: `${warningTrigger}/${dailyLimit}`
    };
    const templateValues = {
        employee_name: target.employee.name,
        relation_text: relationText,
        daily_limit: dailyLimit,
        taps_today: tapsToday,
        machine_name: machineName || '—',
        department: target.employee.department || '—',
        uid: uid || '—',
        business_date: dayKey,
        business_timezone: timeZone,
        warning_lead: warningLead,
        remaining_cups: remainingCups,
        warning_trigger: `${warningTrigger}/${dailyLimit}`
    };
    const subject = renderTemplate(notificationTemplates.employeeLimitWarning.subject, templateValues);
    const text = renderTemplate(notificationTemplates.employeeLimitWarning.body, templateValues);
    const html = `
        <h2>Advertencia de límite diario</h2>
        <div>${textToHtml(text)}</div>
    `;

    return notifyIfNeeded({
        alertKey,
        alertType: 'employee_limit_warning',
        employeeId,
        payload,
        subject,
        text,
        html,
        recipients: target.recipients,
        bccOnly: true,
        tenantId
    });
}

async function notifyMachineBackendDown(machine) {
    const timeZone = await systemSettings.getBusinessTimeZone(machine.tenant_id);
    const lastSeen = formatDateTimeInZone(machine.last_seen, timeZone);
    const alertKey = `machine-backend-down-${machine.id}`;
    const payload = {
        machine_name: machine.name,
        location: machine.location,
        wifi_ssid: machine.wifi_ssid,
        wifi_ip: machine.wifi_ip,
        backend_url: machine.backend_url,
        backend_error: machine.backend_error,
        last_seen: machine.last_seen
    };
    const subject = `[CoffeeControl] Backend sin respuesta para ${machine.name}`;
    const text = [
        `La máquina ${machine.name} reportó backend sin respuesta.`,
        `Ubicación: ${machine.location || '—'}.`,
        `SSID: ${machine.wifi_ssid || '—'}.`,
        `IP: ${machine.wifi_ip || '—'}.`,
        `Backend: ${machine.backend_url || '—'}.`,
        `Error: ${machine.backend_error || 'Sin detalle'}.`,
        `Último contacto: ${lastSeen}.`
    ].join('\n');
    const html = `
        <h2>Backend sin respuesta</h2>
        <p>La máquina <strong>${escapeHtml(machine.name)}</strong> reportó problemas para llegar al backend.</p>
        <ul>
          <li>Ubicación: <strong>${escapeHtml(machine.location || '—')}</strong></li>
          <li>SSID: <strong>${escapeHtml(machine.wifi_ssid || '—')}</strong></li>
          <li>IP: <strong>${escapeHtml(machine.wifi_ip || '—')}</strong></li>
          <li>Backend: <strong>${escapeHtml(machine.backend_url || '—')}</strong></li>
          <li>Error: <strong>${escapeHtml(machine.backend_error || 'Sin detalle')}</strong></li>
          <li>Último contacto: <strong>${escapeHtml(lastSeen)}</strong></li>
        </ul>
    `;
    return notifyIfNeeded({ alertKey, alertType: 'machine_backend_down', machineId: machine.id, payload, subject, text, html, tenantId: machine.tenant_id });
}

async function resolveMachineBackendDown(machineId, tenantId) {
    return resolveAlert(`machine-backend-down-${machineId}`, tenantId);
}

async function notifyMachineOffline(machine) {
    const timeZone = await systemSettings.getBusinessTimeZone(machine.tenant_id);
    const lastSeen = formatDateTimeInZone(machine.last_seen, timeZone);
    const alertKey = `machine-offline-${machine.id}`;
    const payload = {
        machine_name: machine.name,
        location: machine.location,
        last_seen: machine.last_seen,
        wifi_ssid: machine.wifi_ssid,
        wifi_ip: machine.wifi_ip,
        backend_url: machine.backend_url
    };
    const templateValues = {
        machine_name: machine.name,
        location: machine.location || '—',
        last_seen: lastSeen,
        wifi_ssid: machine.wifi_ssid || '—',
        wifi_ip: machine.wifi_ip || '—',
        backend_url: machine.backend_url || '—'
    };
    const subject = renderTemplate(notificationTemplates.machineOffline.subject, templateValues);
    const text = renderTemplate(notificationTemplates.machineOffline.body, templateValues);
    const html = `
        <h2>Máquina offline</h2>
        <div>${textToHtml(text)}</div>
    `;
    return notifyIfNeeded({ alertKey, alertType: 'machine_offline', machineId: machine.id, payload, subject, text, html, tenantId: machine.tenant_id });
}

async function resolveMachineOffline(machineId, tenantId) {
    return resolveAlert(`machine-offline-${machineId}`, tenantId);
}

function stockAlertStatus(stockItem) {
    if (!stockItem) return { key: 'inactive', label: 'Inactivo' };
    if (stockItem.status && stockItem.status_label) {
        return {
            key: String(stockItem.status),
            label: String(stockItem.status_label)
        };
    }
    const status = classifyStockStatus(stockItem);
    return {
        key: status.key,
        label: status.label
    };
}

async function notifyStockLow({ machine, stockItem }) {
    if (!machine || !stockItem?.id) return false;
    const status = stockAlertStatus(stockItem);
    if (status.key !== 'low' && status.key !== 'empty') return false;

    const alertKey = `stock-low-${machine.id}-${stockItem.id}`;
    const payload = {
        machine_name: machine.name,
        location: machine.location || null,
        stock_item_id: stockItem.id,
        item_id: stockItem.item_id,
        product_name: stockItem.product_name || null,
        slot_label: stockItem.slot_label || null,
        current_units: stockItem.current_units,
        min_units: stockItem.min_units,
        capacity_units: stockItem.capacity_units,
        status: status.key,
        status_label: status.label
    };
    const templateValues = {
        machine_name: machine.name,
        location: machine.location || '—',
        item_id: stockItem.item_id,
        product_name: stockItem.product_name || '—',
        slot_label: stockItem.slot_label || '—',
        current_units: stockItem.current_units,
        min_units: stockItem.min_units,
        capacity_units: stockItem.capacity_units,
        status: status.key,
        status_label: status.label
    };
    const subject = renderTemplate(notificationTemplates.stockLow.subject, templateValues);
    const text = renderTemplate(notificationTemplates.stockLow.body, templateValues);
    const html = `
        <h2>Stock bajo</h2>
        <div>${textToHtml(text)}</div>
    `;
    return notifyIfNeeded({
        alertKey,
        alertType: 'stock_low',
        machineId: machine.id,
        payload,
        subject,
        text,
        html,
        tenantId: machine.tenant_id
    });
}

async function resolveStockLow(machineId, stockItemId, tenantId) {
    if (!machineId || !stockItemId) return false;
    await resolveAlert(`stock-low-${machineId}-${stockItemId}`, tenantId);
    return true;
}

async function syncStockLowAlert({ machine, stockItem }) {
    if (!machine || !stockItem?.id) return false;
    const status = stockAlertStatus(stockItem);
    if (status.key === 'low' || status.key === 'empty') {
        return notifyStockLow({ machine, stockItem: { ...stockItem, status: status.key, status_label: status.label } });
    }
    return resolveStockLow(machine.id, stockItem.id, machine.tenant_id);
}

async function checkMachineOfflineAlerts() {
    try {
        const result = await bootstrapPool.query(
            `SELECT id, name, location, last_seen, wifi_ssid, wifi_ip, backend_url, tenant_id
             FROM machines
             WHERE active = true`
        );

        const now = Date.now();
        for (const machine of result.rows) {
            const isOffline = machine.last_seen
                ? (now - new Date(machine.last_seen).getTime()) >= MACHINE_OFFLINE_WINDOW_MS
                : false;

            if (isOffline) {
                await notifyMachineOffline(machine);
            } else {
                await resolveMachineOffline(machine.id, machine.tenant_id);
            }
        }
    } catch (err) {
        console.error('[ALERT] Error revisando máquinas offline:', err.message);
    }
}

function startAlertMonitor() {
    if (monitorHandle) return;
    setTimeout(() => { checkMachineOfflineAlerts(); }, 8000);
    monitorHandle = setInterval(checkMachineOfflineAlerts, ALERT_CHECK_INTERVAL_MS);
    if (typeof monitorHandle.unref === 'function') monitorHandle.unref();
    console.log('[ALERT] Monitor de alertas iniciado');
}

module.exports = {
    startAlertMonitor,
    getNotificationSettings,
    getEmployeeLimitWarningLead,
    saveNotificationSettings,
    sendTestNotification,
    invalidateSettingsCache,
    notifyEmployeeLimitWarning,
    notifyEmployeeDailyBlocked,
    notifyMachineBackendDown,
    resolveMachineBackendDown,
    resolveMachineOffline,
    checkMachineOfflineAlerts,
    notifyStockLow,
    resolveStockLow,
    syncStockLowAlert
};
