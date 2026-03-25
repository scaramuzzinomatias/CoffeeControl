const pool = require('../db/pool');
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

let settingsCache = null;
let settingsCacheAt = 0;
let settingsTableMissingLogged = false;

function sanitizeSystemSettings(raw = {}) {
    return {
        business_timezone: normalizeBusinessTimeZone(
            raw.business_timezone,
            FALLBACK_SYSTEM_SETTINGS.business_timezone
        )
    };
}

async function loadSystemSettings(force = false) {
    if (!force && settingsCache && (Date.now() - settingsCacheAt) < SETTINGS_CACHE_TTL_MS) {
        return { ...settingsCache };
    }

    try {
        const result = await pool.query(
            `SELECT business_timezone
             FROM system_settings
             WHERE id = 1`
        );

        const settings = result.rowCount > 0
            ? sanitizeSystemSettings(result.rows[0])
            : sanitizeSystemSettings(FALLBACK_SYSTEM_SETTINGS);

        settingsCache = settings;
        settingsCacheAt = Date.now();
        return { ...settings };
    } catch (err) {
        if (err.code === '42P01') {
            if (!settingsTableMissingLogged) {
                console.warn('[SYSTEM] system_settings todavía no existe; usando fallback de BUSINESS_TIMEZONE/.env');
                settingsTableMissingLogged = true;
            }
            const fallback = sanitizeSystemSettings(FALLBACK_SYSTEM_SETTINGS);
            settingsCache = fallback;
            settingsCacheAt = Date.now();
            return { ...fallback };
        }
        throw err;
    }
}

function invalidateSystemSettingsCache() {
    settingsCache = null;
    settingsCacheAt = 0;
}

async function getSystemSettings() {
    const settings = await loadSystemSettings();
    return {
        ...settings,
        timezone_options: COMMON_TIMEZONE_OPTIONS
    };
}

async function saveSystemSettings(input = {}) {
    const businessTimeZone = assertBusinessTimeZone(input.business_timezone);

    await pool.query(
        `INSERT INTO system_settings(id, business_timezone, updated_at)
         VALUES (1, $1, NOW())
         ON CONFLICT (id) DO UPDATE SET
            business_timezone = EXCLUDED.business_timezone,
            updated_at = NOW()`,
        [businessTimeZone]
    );

    invalidateSystemSettingsCache();
    return getSystemSettings();
}

async function getBusinessTimeZone() {
    const settings = await loadSystemSettings();
    return settings.business_timezone;
}

async function getBusinessTimeContext(referenceDate = new Date()) {
    const timeZone = await getBusinessTimeZone();
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
