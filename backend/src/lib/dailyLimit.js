const VALID_LIMIT_MODES = new Set(['enforce', 'warn_only', 'off']);

function normalizeLimitMode(value, fallback = 'enforce') {
    const mode = String(value || '').trim().toLowerCase();
    return VALID_LIMIT_MODES.has(mode) ? mode : fallback;
}

function parseLimitValue(value, fallback = 0) {
    const parsed = parseInt(value, 10);
    return Number.isInteger(parsed) ? parsed : fallback;
}

function normalizeWarningLead(value, fallback = 1) {
    const parsed = parseInt(value, 10);
    if (!Number.isInteger(parsed)) return fallback;
    return Math.min(Math.max(parsed, 1), 10);
}

function getWarningThreshold(dailyLimit, warningLead = 1) {
    const limit = parseLimitValue(dailyLimit, 0);
    if (limit <= 0) return null;
    return Math.max(limit - normalizeWarningLead(warningLead), 1);
}

function isLimitReached({ dailyLimit, mode, tapsToday }) {
    const normalizedMode = normalizeLimitMode(mode);
    const limit = parseLimitValue(dailyLimit, 0);
    const taps = parseLimitValue(tapsToday, 0);
    return normalizedMode === 'enforce' && limit > 0 && taps >= limit;
}

function shouldWarnForUsage({ dailyLimit, mode, tapsToday, warningLead = 1 }) {
    const normalizedMode = normalizeLimitMode(mode);
    if (normalizedMode === 'off') return false;
    const taps = parseLimitValue(tapsToday, 0);
    const threshold = getWarningThreshold(dailyLimit, warningLead);
    return threshold !== null && taps >= threshold;
}

function shouldWarnAfterApproval({ dailyLimit, mode, tapsBefore, warningLead = 1 }) {
    const normalizedMode = normalizeLimitMode(mode);
    if (normalizedMode === 'off') return false;
    const threshold = getWarningThreshold(dailyLimit, warningLead);
    if (threshold === null) return false;
    const nextCount = parseLimitValue(tapsBefore, 0) + 1;
    return nextCount >= threshold;
}

function statusFromUsage({ dailyLimit, mode, tapsToday, warningLead = 1 }) {
    if (isLimitReached({ dailyLimit, mode, tapsToday })) return 'blocked';
    if (shouldWarnForUsage({ dailyLimit, mode, tapsToday, warningLead })) return 'warning';
    return 'ok';
}

module.exports = {
    VALID_LIMIT_MODES,
    normalizeLimitMode,
    normalizeWarningLead,
    getWarningThreshold,
    isLimitReached,
    shouldWarnForUsage,
    shouldWarnAfterApproval,
    statusFromUsage
};
