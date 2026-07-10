const express = require('express');
const pool = require('../db/pool');
const audit = require('../services/audit');
const {
    isManagerRole,
    requireManager,
    requireAnalyticsViewer
} = require('../middleware/roleAccess');
const { normalizeLimitMode } = require('../lib/dailyLimit');
const {
    normalizeAccessLevelName,
    normalizeAccessLevelCode,
    normalizeAccessLevelDescription,
    normalizeAccessLevelSortOrder
} = require('../lib/accessLevels');

const router = express.Router();

function normalizeOptionalBoolean(value) {
    if (typeof value === 'boolean') return value;
    if (value === 'true') return true;
    if (value === 'false') return false;
    return null;
}

// NOTA: el filtro al.tenant_id será redundante cuando RLS de access_levels esté activo
async function fetchAccessLevelById(db, id, tenantId) {
    return db.query(
        `SELECT
            al.*,
            COUNT(e.id)::int AS employees_count
         FROM access_levels al
         LEFT JOIN employees e ON e.access_level_id = al.id AND e.active = true
         WHERE al.id = $1 AND al.tenant_id = $2
         GROUP BY al.id`,
        [id, tenantId]
    );
}

router.get('/', requireAnalyticsViewer, async (req, res) => {
    try {
        const includeInactive = isManagerRole(req.user?.role)
            && String(req.query.include_inactive || '').trim().toLowerCase() === 'true';
        const result = await req.db.query(
            `SELECT
                al.*,
                COUNT(e.id)::int AS employees_count
             FROM access_levels al
             LEFT JOIN employees e ON e.access_level_id = al.id AND e.active = true
             WHERE al.tenant_id = $1${includeInactive ? '' : ' AND al.active = true'}
             GROUP BY al.id
             ORDER BY al.active DESC, al.sort_order ASC, LOWER(al.name) ASC, al.id ASC`,
            [req.user.tenant_id]
        );
        res.json({ access_levels: result.rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/', requireManager, async (req, res) => {
    try {
        const name = normalizeAccessLevelName(req.body.name);
        const code = normalizeAccessLevelCode(req.body.code, name);
        const description = normalizeAccessLevelDescription(req.body.description);
        const dailyLimit = parseInt(req.body.daily_limit, 10);
        if (!Number.isInteger(dailyLimit) || dailyLimit < 1 || dailyLimit > 50) {
            return res.status(400).json({ error: 'El límite diario debe ser un número entre 1 y 50' });
        }
        const dailyLimitMode = normalizeLimitMode(req.body.daily_limit_mode);
        const warningEnabled = normalizeOptionalBoolean(req.body.warning_enabled);
        const sortOrder = normalizeAccessLevelSortOrder(req.body.sort_order, 100);
        const active = normalizeOptionalBoolean(req.body.active);

        const result = await req.db.query(
            `INSERT INTO access_levels(
                code,
                name,
                description,
                daily_limit,
                daily_limit_mode,
                warning_enabled,
                sort_order,
                active,
                tenant_id,
                updated_at
            )
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
             RETURNING *`,
            [
                code,
                name,
                description,
                dailyLimit,
                dailyLimitMode,
                warningEnabled === null ? true : warningEnabled,
                sortOrder,
                active === null ? true : active,
                req.user.tenant_id
            ]
        );

        const created = (await fetchAccessLevelById(req.db, result.rows[0].id, req.user.tenant_id)).rows[0];
        await audit.logAuditEvent({
            req,
            action: 'access_level.create',
            entityType: 'access_level',
            entityId: created.id,
            entityLabel: created.name,
            summary: `Creó el nivel de acceso ${created.name}`,
            details: created
        });
        res.status(201).json({ access_level: created });
    } catch (err) {
        if (
            err.message === 'El nombre del nivel es requerido'
            || err.message === 'El código interno del nivel es requerido'
            || err.message === 'El orden del nivel debe ser un número entre 0 y 9999'
        ) {
            return res.status(400).json({ error: err.message });
        }
        if (err.code === '23505') {
            return res.status(409).json({ error: 'Ya existe un nivel con ese nombre o código' });
        }
        res.status(500).json({ error: err.message });
    }
});

router.patch('/:id', requireManager, async (req, res) => {
    try {
        const beforeResult = await fetchAccessLevelById(req.db, req.params.id, req.user.tenant_id);
        if (beforeResult.rowCount === 0) return res.status(404).json({ error: 'No encontrado' });
        const before = beforeResult.rows[0];

        const updates = [];
        const values = [];

        if (Object.prototype.hasOwnProperty.call(req.body, 'name')) {
            values.push(normalizeAccessLevelName(req.body.name));
            updates.push(`name = $${values.length}`);
        }
        if (Object.prototype.hasOwnProperty.call(req.body, 'code')) {
            const fallbackName = Object.prototype.hasOwnProperty.call(req.body, 'name')
                ? req.body.name
                : before.name;
            values.push(normalizeAccessLevelCode(req.body.code, fallbackName));
            updates.push(`code = $${values.length}`);
        }
        if (Object.prototype.hasOwnProperty.call(req.body, 'description')) {
            values.push(normalizeAccessLevelDescription(req.body.description));
            updates.push(`description = $${values.length}`);
        }
        if (Object.prototype.hasOwnProperty.call(req.body, 'daily_limit')) {
            const dailyLimit = parseInt(req.body.daily_limit, 10);
            if (!Number.isInteger(dailyLimit) || dailyLimit < 1 || dailyLimit > 50) {
                return res.status(400).json({ error: 'El límite diario debe ser un número entre 1 y 50' });
            }
            values.push(dailyLimit);
            updates.push(`daily_limit = $${values.length}`);
        }
        if (Object.prototype.hasOwnProperty.call(req.body, 'daily_limit_mode')) {
            values.push(normalizeLimitMode(req.body.daily_limit_mode));
            updates.push(`daily_limit_mode = $${values.length}`);
        }
        if (Object.prototype.hasOwnProperty.call(req.body, 'warning_enabled')) {
            const warningEnabled = normalizeOptionalBoolean(req.body.warning_enabled);
            if (warningEnabled === null) {
                return res.status(400).json({ error: 'warning_enabled inválido' });
            }
            values.push(warningEnabled);
            updates.push(`warning_enabled = $${values.length}`);
        }
        if (Object.prototype.hasOwnProperty.call(req.body, 'sort_order')) {
            values.push(normalizeAccessLevelSortOrder(req.body.sort_order, before.sort_order));
            updates.push(`sort_order = $${values.length}`);
        }
        if (Object.prototype.hasOwnProperty.call(req.body, 'active')) {
            const active = normalizeOptionalBoolean(req.body.active);
            if (active === null) {
                return res.status(400).json({ error: 'active inválido' });
            }
            values.push(active);
            updates.push(`active = $${values.length}`);
        }

        if (!updates.length) {
            return res.json({ access_level: before });
        }

        values.push(req.params.id, req.user.tenant_id);
        await req.db.query(
            `UPDATE access_levels
             SET ${updates.join(', ')}, updated_at = NOW()
             WHERE id = $${values.length - 1} AND tenant_id = $${values.length}`,
            values
        );

        const after = (await fetchAccessLevelById(req.db, req.params.id, req.user.tenant_id)).rows[0];
        await audit.logAuditEvent({
            req,
            action: after.active === false && before.active !== false
                ? 'access_level.deactivate'
                : 'access_level.update',
            entityType: 'access_level',
            entityId: after.id,
            entityLabel: after.name,
            summary: after.active === false && before.active !== false
                ? `Desactivó el nivel de acceso ${after.name}`
                : `Actualizó el nivel de acceso ${after.name}`,
            details: {
                before,
                after
            }
        });
        res.json({ access_level: after });
    } catch (err) {
        if (
            err.message === 'El nombre del nivel es requerido'
            || err.message === 'El código interno del nivel es requerido'
            || err.message === 'El orden del nivel debe ser un número entre 0 y 9999'
        ) {
            return res.status(400).json({ error: err.message });
        }
        if (err.code === '23505') {
            return res.status(409).json({ error: 'Ya existe un nivel con ese nombre o código' });
        }
        res.status(500).json({ error: err.message });
    }
});

router.delete('/:id', requireManager, async (req, res) => {
    try {
        const beforeResult = await fetchAccessLevelById(req.db, req.params.id, req.user.tenant_id);
        if (beforeResult.rowCount === 0) return res.status(404).json({ error: 'No encontrado' });
        const before = beforeResult.rows[0];

        await req.db.query(
            `UPDATE access_levels
             SET active = false, updated_at = NOW()
             WHERE id = $1 AND tenant_id = $2`,
            [req.params.id, req.user.tenant_id]
        );

        const after = (await fetchAccessLevelById(req.db, req.params.id, req.user.tenant_id)).rows[0];
        await audit.logAuditEvent({
            req,
            action: 'access_level.deactivate',
            entityType: 'access_level',
            entityId: after.id,
            entityLabel: after.name,
            summary: `Desactivó el nivel de acceso ${after.name}`,
            details: {
                before,
                after
            }
        });
        res.json({ ok: true, access_level: after });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
