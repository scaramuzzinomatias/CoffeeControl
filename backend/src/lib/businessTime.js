const DEFAULT_BUSINESS_TIMEZONE = String(
    process.env.BUSINESS_TIMEZONE || 'America/Argentina/Buenos_Aires'
).trim() || 'America/Argentina/Buenos_Aires';

const COMMON_TIMEZONE_OPTIONS = Object.freeze([
    { value: 'America/Argentina/Buenos_Aires', label: 'Argentina (Buenos Aires)' },
    { value: 'America/Santiago', label: 'Chile (Santiago)' },
    { value: 'America/Sao_Paulo', label: 'Brasil (São Paulo)' },
    { value: 'America/Montevideo', label: 'Uruguay (Montevideo)' },
    { value: 'America/Asuncion', label: 'Paraguay (Asunción)' },
    { value: 'America/Bogota', label: 'Colombia (Bogotá)' },
    { value: 'America/Lima', label: 'Perú (Lima)' },
    { value: 'America/Panama', label: 'Panamá' },
    { value: 'America/Caracas', label: 'Venezuela (Caracas)' },
    { value: 'America/Mexico_City', label: 'México (CDMX)' },
    { value: 'America/Guatemala', label: 'Centroamérica (Guatemala)' },
    { value: 'America/Chicago', label: 'USA Central (Chicago)' },
    { value: 'America/New_York', label: 'USA Este (New York)' },
    { value: 'America/Los_Angeles', label: 'USA Oeste (Los Angeles)' },
    { value: 'UTC', label: 'UTC' }
]);

function isValidTimeZone(value) {
    const timeZone = String(value || '').trim();
    if (!timeZone) return false;
    try {
        new Intl.DateTimeFormat('en-US', { timeZone }).format(new Date());
        return true;
    } catch (_err) {
        return false;
    }
}

function normalizeBusinessTimeZone(value, fallback = DEFAULT_BUSINESS_TIMEZONE) {
    const normalizedFallback = isValidTimeZone(fallback)
        ? String(fallback).trim()
        : 'America/Argentina/Buenos_Aires';
    return isValidTimeZone(value) ? String(value).trim() : normalizedFallback;
}

function assertBusinessTimeZone(value) {
    const timeZone = String(value || '').trim();
    if (!isValidTimeZone(timeZone)) {
        throw new Error('Zona horaria inválida. Usá un identificador IANA, por ejemplo America/Argentina/Buenos_Aires.');
    }
    return timeZone;
}

function formatBusinessDate(value, timeZone = DEFAULT_BUSINESS_TIMEZONE) {
    const date = value ? new Date(value) : new Date();
    return new Intl.DateTimeFormat('sv-SE', {
        timeZone: normalizeBusinessTimeZone(timeZone),
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(date);
}

function formatDateTimeInZone(value, timeZone = DEFAULT_BUSINESS_TIMEZONE, locale = 'es-AR') {
    if (!value) return '—';
    return new Date(value).toLocaleString(locale, {
        timeZone: normalizeBusinessTimeZone(timeZone)
    });
}

function monthStartFromBusinessDate(businessDate) {
    const dateKey = String(businessDate || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
        return `${formatBusinessDate(new Date(), DEFAULT_BUSINESS_TIMEZONE).slice(0, 7)}-01`;
    }
    return `${dateKey.slice(0, 7)}-01`;
}

function buildBusinessDayRangeSql(column, tzParamIndex, dateParamIndex) {
    return `${column} >= (($${dateParamIndex}::date)::timestamp AT TIME ZONE $${tzParamIndex})
            AND ${column} < ((($${dateParamIndex}::date + INTERVAL '1 day')::timestamp) AT TIME ZONE $${tzParamIndex})`;
}

function buildBusinessMonthRangeSql(column, tzParamIndex, monthStartParamIndex) {
    return `${column} >= (($${monthStartParamIndex}::date)::timestamp AT TIME ZONE $${tzParamIndex})
            AND ${column} < ((($${monthStartParamIndex}::date + INTERVAL '1 month')::timestamp) AT TIME ZONE $${tzParamIndex})`;
}

module.exports = {
    DEFAULT_BUSINESS_TIMEZONE,
    COMMON_TIMEZONE_OPTIONS,
    isValidTimeZone,
    normalizeBusinessTimeZone,
    assertBusinessTimeZone,
    formatBusinessDate,
    formatDateTimeInZone,
    monthStartFromBusinessDate,
    buildBusinessDayRangeSql,
    buildBusinessMonthRangeSql
};
