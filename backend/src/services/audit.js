const pool = require('../db/pool');

const SENSITIVE_KEYS = new Set([
    'password',
    'password_hash',
    'new_password',
    'current_password',
    'pass',
    'token',
    'authorization',
    'smtp_pass',
    'secret'
]);

function clientIpFromReq(req) {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.trim()) {
        return forwarded.split(',')[0].trim();
    }
    return req.ip || req.socket?.remoteAddress || null;
}

function sanitizeValue(value, keyHint = '') {
    if (value === null || value === undefined) return value;
    if (Array.isArray(value)) {
        return value.map(item => sanitizeValue(item));
    }
    if (value instanceof Date) {
        return value.toISOString();
    }
    if (typeof value === 'object') {
        const out = {};
        for (const [key, innerValue] of Object.entries(value)) {
            if (SENSITIVE_KEYS.has(String(key).toLowerCase())) {
                out[key] = '[REDACTED]';
            } else {
                out[key] = sanitizeValue(innerValue, key);
            }
        }
        return out;
    }
    if (typeof value === 'string' && SENSITIVE_KEYS.has(String(keyHint).toLowerCase())) {
        return '[REDACTED]';
    }
    return value;
}

async function logAuditEvent({
    req,
    action,
    entityType,
    entityId = null,
    entityLabel = null,
    summary,
    details = null
}) {
    if (!req?.user?.id || !action || !entityType || !summary) return;

    const actor = req.user;
    const cleanDetails = sanitizeValue(details);

    try {
        await pool.query(
            `INSERT INTO audit_logs(
                actor_user_id,
                actor_username,
                actor_role,
                actor_ip,
                actor_user_agent,
                action,
                entity_type,
                entity_id,
                entity_label,
                summary,
                details
            )
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb)`,
            [
                actor.id,
                actor.username || null,
                actor.role || null,
                clientIpFromReq(req),
                req.headers['user-agent'] || null,
                action,
                entityType,
                entityId === null || entityId === undefined ? null : String(entityId),
                entityLabel || null,
                summary,
                cleanDetails ? JSON.stringify(cleanDetails) : null
            ]
        );
    } catch (err) {
        console.error('[AUDIT] Error registrando evento:', err.message);
    }
}

async function getAuditLogs({ entityType, action, q, limit = 200 } = {}) {
    const clauses = [];
    const params = [];

    if (entityType) {
        params.push(String(entityType).trim());
        clauses.push(`entity_type = $${params.length}`);
    }
    if (action) {
        params.push(String(action).trim());
        clauses.push(`action = $${params.length}`);
    }
    if (q) {
        params.push(`%${String(q).trim()}%`);
        clauses.push(`(
            summary ILIKE $${params.length}
            OR actor_username ILIKE $${params.length}
            OR COALESCE(entity_label, '') ILIKE $${params.length}
            OR COALESCE(entity_id, '') ILIKE $${params.length}
        )`);
    }

    params.push(Math.min(Math.max(parseInt(limit, 10) || 100, 1), 500));
    const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

    const result = await pool.query(
        `SELECT
            id,
            actor_user_id,
            actor_username,
            actor_role,
            actor_ip,
            actor_user_agent,
            action,
            entity_type,
            entity_id,
            entity_label,
            summary,
            details,
            created_at
         FROM audit_logs
         ${whereSql}
         ORDER BY created_at DESC, id DESC
         LIMIT $${params.length}`,
        params
    );

    return result.rows;
}

module.exports = {
    logAuditEvent,
    getAuditLogs
};
