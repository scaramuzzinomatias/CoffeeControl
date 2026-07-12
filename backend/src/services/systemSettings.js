const { withTenantContext } = require('../db/tenantContext');
const {
    DEFAULT_BUSINESS_TIMEZONE,
    COMMON_TIMEZONE_OPTIONS,
    normalizeBusinessTimeZone,
    assertBusinessTimeZone,
    formatBusinessDate,
    monthStartFromBusinessDate
} = require('../lib/businessTime');

const SETTINGS_CACHE_TTL_MS = 10000;
const FALLBACK_SYSTEM_SETTINGS = Object.freeze({
    business_timezone: normalizeBusinessTimeZone(DEFAULT_BUSINESS_TIMEZONE)
});

const settingsCache = new Map();
const missingLogged = new Set();

function sanitizeSystemSettings(raw = {}) {
    return {
        business_timezone: normalizeBusinessTimeZone(
            raw.business_timezone,
            FALLBACK_SYSTEM_SETTINGS.business_timezone
        )
    };
}

async function loadSystemSettings(tenantId, force = false) {
    const cached = settingsCache.get(tenantId);
    if (!force && cached && (Date.now() - cached.at) < SETTINGS_CACHE_TTL_MS) {
        return { ...cached.settings };
    }

    try {
        const result = await withTenantContext(tenantId, client => client.query(
            `SELECT business_timezone
             FROM system_settings
             WHERE id = 1 AND tenant_id = $1`,
            [tenantId]
        ));

        const settings = result.rowCount > 0
            ? sanitizeSystemSettings(result.rows[0])
            : sanitizeSystemSettings(FALLBACK_SYSTEM_SETTINGS);

        settingsCache.set(tenantId, { settings, at: Date.now() });
        return { ...settings };
    } catch (err) {
        if (err.code === '42P01') {
            if (!missingLogged.has(tenantId)) {
                console.warn(`[SYSTEM] system_settings todavía no existe para tenant ${tenantId}; usando fallback de BUSINESS_TIMEZONE/.env`);
                missingLogged.add(tenantId);
            }
            const fallback = sanitizeSystemSettings(FALLBACK_SYSTEM_SETTINGS);
            settingsCache.set(tenantId, { settings: fallback, at: Date.now() });
            return { ...fallback };
        }
        throw err;
    }
}

function invalidateSystemSettingsCache(tenantId) {
    settingsCache.delete(tenantId);
}

async function getSystemSettings(tenantId) {
    const settings = await loadSystemSettings(tenantId);
    return {
        ...settings,
        timezone_options: COMMON_TIMEZONE_OPTIONS
    };
}

async function saveSystemSettings(tenantId, input = {}) {
    const businessTimeZone = assertBusinessTimeZone(input.business_timezone);

    await withTenantContext(tenantId, client => client.query(
        `INSERT INTO system_settings(id, tenant_id, business_timezone, updated_at)
         VALUES (1, $1, $2, NOW())
         ON CONFLICT (tenant_id, id) DO UPDATE SET
            business_timezone = EXCLUDED.business_timezone,
            updated_at = NOW()`,
        [tenantId, businessTimeZone]
    ));

    invalidateSystemSettingsCache(tenantId);
    return getSystemSettings(tenantId);
}

async function getBusinessTimeZone(tenantId) {
    const settings = await loadSystemSettings(tenantId);
    return settings.business_timezone;
}

async function getBusinessTimeContext(tenantId, referenceDate = new Date()) {
    const timeZone = await getBusinessTimeZone(tenantId);
    const businessDate = formatBusinessDate(referenceDate, timeZone);
    return {
        timeZone,
        businessDate,
        monthStart: monthStartFromBusinessDate(businessDate)
    };
}

module.exports = {
    getSystemSettings,
    saveSystemSettings,
    invalidateSystemSettingsCache,
    getBusinessTimeZone,
    getBusinessTimeContext
};
