const { normalizeLimitMode } = require('./dailyLimit');

function normalizeOptionalString(value, maxLength = 255) {
    if (value === null || value === undefined) return null;
    const trimmed = String(value).trim();
    if (!trimmed) return null;
    return trimmed.slice(0, maxLength);
}

function slugify(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 40);
}

function normalizeAccessLevelName(value) {
    const normalized = normalizeOptionalString(value, 80);
    if (!normalized) throw new Error('El nombre del nivel es requerido');
    return normalized;
}

function normalizeAccessLevelCode(value, fallbackName = '') {
    const raw = normalizeOptionalString(value, 80) || fallbackName;
    const code = slugify(raw);
    if (!code) throw new Error('El código interno del nivel es requerido');
    return code;
}

function normalizeAccessLevelDescription(value) {
    return normalizeOptionalString(value, 255);
}

function normalizeAccessLevelSortOrder(value, fallback = 100) {
    if (value === null || value === undefined || value === '') return fallback;
    const parsed = parseInt(value, 10);
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > 9999) {
        throw new Error('El orden del nivel debe ser un número entre 0 y 9999');
    }
    return parsed;
}

function normalizeAccessLevelId(value, { allowNull = false } = {}) {
    if (value === null || value === undefined || value === '') {
        if (allowNull) return null;
        throw new Error('Nivel de acceso inválido');
    }
    const parsed = parseInt(value, 10);
    if (!Number.isInteger(parsed) || parsed < 1) {
        throw new Error('Nivel de acceso inválido');
    }
    return parsed;
}

function normalizeAccessLevelFilter(value) {
    if (value === null || value === undefined || value === '') return null;
    const raw = String(value).trim().toLowerCase();
    if (!raw) return null;
    if (raw === 'manual') return 'manual';
    return normalizeAccessLevelId(raw);
}

function buildAccessLevelClause({ filter, params, column }) {
    if (!filter) {
        return {
            sql: '',
            value: null
        };
    }
    if (filter === 'manual') {
        return {
            sql: ` AND ${column} IS NULL`,
            value: 'manual'
        };
    }
    params.push(filter);
    return {
        sql: ` AND ${column} = $${params.length}`,
        value: filter
    };
}

function effectivePolicyExpressions(employeeAlias = 'e', accessLevelAlias = 'al') {
    return {
        dailyLimit: `COALESCE(${accessLevelAlias}.daily_limit, ${employeeAlias}.daily_limit)`,
        dailyLimitMode: `COALESCE(${accessLevelAlias}.daily_limit_mode, ${employeeAlias}.daily_limit_mode)`,
        warningEnabled: `COALESCE(${accessLevelAlias}.warning_enabled, ${employeeAlias}.warning_enabled)`,
        source: `CASE WHEN ${accessLevelAlias}.id IS NULL THEN 'manual' ELSE 'access_level' END`
    };
}

function applyEffectivePolicy(row = {}) {
    return {
        effective_daily_limit: parseInt(row.effective_daily_limit ?? row.daily_limit ?? 0, 10) || 0,
        effective_daily_limit_mode: normalizeLimitMode(row.effective_daily_limit_mode ?? row.daily_limit_mode),
        effective_warning_enabled: row.effective_warning_enabled === false ? false : Boolean(row.effective_warning_enabled ?? row.warning_enabled ?? true),
        policy_source: row.policy_source || (row.access_level_id ? 'access_level' : 'manual')
    };
}

module.exports = {
    normalizeAccessLevelName,
    normalizeAccessLevelCode,
    normalizeAccessLevelDescription,
    normalizeAccessLevelSortOrder,
    normalizeAccessLevelId,
    normalizeAccessLevelFilter,
    buildAccessLevelClause,
    effectivePolicyExpressions,
    applyEffectivePolicy
};
