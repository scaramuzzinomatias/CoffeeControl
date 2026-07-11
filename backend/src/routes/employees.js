// src/routes/employees.js
const express = require('express');

const { requireManager } = require('../middleware/roleAccess');
const { normalizeLimitMode } = require('../lib/dailyLimit');
const { buildDepartmentScopeClause } = require('../lib/accessScope');
const { normalizeAccessLevelId } = require('../lib/accessLevels');
const {
    registerOrAssignCard,
    updateCardAssignment,
    deactivateCard
} = require('../lib/nfcCards');
const audit = require('../services/audit');

const router = express.Router();

function normalizeOptionalString(value) {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed || null;
}

function normalizeOptionalBoolean(value) {
    if (typeof value === 'boolean') return value;
    if (value === 'true') return true;
    if (value === 'false') return false;
    return null;
}

function normalizeDailyLimit(value, { allowNull = false } = {}) {
    if (value === null || value === undefined || value === '') {
        return allowNull ? null : 4;
    }
    const parsed = parseInt(value, 10);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 50) {
        throw new Error('El límite diario debe ser un número entre 1 y 50');
    }
    return parsed;
}

function departmentExpr(column) {
    return `COALESCE(NULLIF(TRIM(${column}), ''), 'Sin área')`;
}

// NOTA: filtro tenant_id redundante cuando RLS de access_levels esté activo
async function getAccessLevelById(db, id, tenantId) {
    return db.query(
        `SELECT id, code, name, active
         FROM access_levels
         WHERE id = $1 AND tenant_id = $2`,
        [id, tenantId]
    );
}

// GET /api/employees — listar todos con tarjetas NFC
router.get('/', async (req, res) => {
    try {
        const params = [];
        const scope = buildDepartmentScopeClause({
            user: req.user,
            requestedDepartment: req.query.department,
            params,
            column: departmentExpr('e.department')
        });
        // NOTA: al.tenant_id en el ON del LEFT JOIN preserva el LEFT JOIN
        // (NULL si no hay match de tenant) y será redundante con RLS activo
        const params2 = params.concat([req.user.tenant_id]);
        const result = await req.db.query(
            `SELECT e.*,
                al.code AS access_level_code,
                al.name AS access_level_name,
                al.description AS access_level_description,
                al.active AS access_level_active,
                COALESCE(al.daily_limit, e.daily_limit) AS effective_daily_limit,
                COALESCE(al.daily_limit_mode, e.daily_limit_mode) AS effective_daily_limit_mode,
                COALESCE(al.warning_enabled, e.warning_enabled) AS effective_warning_enabled,
                CASE WHEN al.id IS NULL THEN 'manual' ELSE 'access_level' END AS policy_source,
                COALESCE(
                    json_agg(json_build_object(
                        'id', nc.id, 'uid', nc.uid, 'label', nc.label, 'active', nc.active, 'status', COALESCE(nc.status, CASE WHEN nc.active THEN 'active' ELSE 'inactive' END)
                    )) FILTER (WHERE nc.id IS NOT NULL), '[]'
                ) AS nfc_cards
             FROM employees e
             LEFT JOIN access_levels al ON al.id = e.access_level_id AND al.tenant_id = $${params.length + 1}
             LEFT JOIN nfc_cards nc ON nc.employee_id = e.id
             WHERE e.active = true
               AND e.tenant_id = $${params.length + 1}
                ${scope.sql}
             GROUP BY e.id, al.id
             ORDER BY e.name`
            ,
            params2
        );
        res.json({
            employees: result.rows,
            department: req.query.department ? String(req.query.department).trim() : null,
            department_scopes: scope.appliedScopes
        });
    } catch (err) {
        res.status(err.status || 500).json({ error: err.message });
    }
});

// GET /api/employees/:id — detalle de un empleado
router.get('/:id', async (req, res) => {
    try {
        const params = [req.params.id];
        const scope = buildDepartmentScopeClause({
            user: req.user,
            requestedDepartment: req.query.department,
            params,
            column: departmentExpr('e.department')
        });
        const emp = await req.db.query(
            `SELECT e.*,
                al.code AS access_level_code,
                al.name AS access_level_name,
                al.description AS access_level_description,
                al.active AS access_level_active,
                COALESCE(al.daily_limit, e.daily_limit) AS effective_daily_limit,
                COALESCE(al.daily_limit_mode, e.daily_limit_mode) AS effective_daily_limit_mode,
                COALESCE(al.warning_enabled, e.warning_enabled) AS effective_warning_enabled,
                CASE WHEN al.id IS NULL THEN 'manual' ELSE 'access_level' END AS policy_source,
                COALESCE(
                    json_agg(json_build_object(
                        'id', nc.id, 'uid', nc.uid, 'label', nc.label, 'active', nc.active, 'status', COALESCE(nc.status, CASE WHEN nc.active THEN 'active' ELSE 'inactive' END)
                    )) FILTER (WHERE nc.id IS NOT NULL), '[]'
                ) AS nfc_cards
             FROM employees e
             LEFT JOIN access_levels al ON al.id = e.access_level_id AND al.tenant_id = $${params.length + 1}
             LEFT JOIN nfc_cards nc ON nc.employee_id = e.id
             WHERE e.id = $1
               AND e.tenant_id = $${params.length + 1}
                ${scope.sql}
             GROUP BY e.id, al.id`,
            params.concat([req.user.tenant_id])
        );
        if (emp.rowCount === 0) return res.status(404).json({ error: 'No encontrado' });

        // Consumo por máquina (mes actual)
        const machines = await req.db.query(
            `SELECT machine_name, location, taps_count, spent_cents
             FROM employee_machine_consumption
             WHERE employee_id = $1
               AND tenant_id = $2
             ORDER BY taps_count DESC`,
            [req.params.id, req.user.tenant_id]
        );

        // Historial últimos 30 taps
        const taps = await req.db.query(
            `SELECT t.id, m.name AS machine_name, t.approved, t.deny_reason,
                    t.amount_cents, t.tapped_at
             FROM taps t
             JOIN machines m ON m.id = t.machine_id AND m.tenant_id = $2
             WHERE t.employee_id = $1
               AND t.tenant_id = $2
             ORDER BY t.tapped_at DESC LIMIT 30`,
            [req.params.id, req.user.tenant_id]
        );

        res.json({
            employee: emp.rows[0],
            machines_this_month: machines.rows,
            recent_taps: taps.rows,
            department: req.query.department ? String(req.query.department).trim() : null,
            department_scopes: scope.appliedScopes
        });
    } catch (err) {
        res.status(err.status || 500).json({ error: err.message });
    }
});

// POST /api/employees — crear empleado
router.post('/', requireManager, async (req, res) => {
    const { name, department, email, dni, legajo, phone, daily_limit, daily_limit_mode, warning_enabled, access_level_id } = req.body;
    if (!name) return res.status(400).json({ error: 'name requerido' });

    try {
        const limitValue = normalizeDailyLimit(daily_limit);
        const limitMode = normalizeLimitMode(daily_limit_mode);
        const warningEnabledValue = normalizeOptionalBoolean(warning_enabled);
        const warningEnabled = warningEnabledValue === null ? true : warningEnabledValue;
        const accessLevelId = normalizeAccessLevelId(access_level_id, { allowNull: true });
        let accessLevel = null;
        if (accessLevelId !== null) {
            const accessLevelResult = await getAccessLevelById(req.db, accessLevelId, req.user.tenant_id);
            if (accessLevelResult.rowCount === 0) {
                return res.status(400).json({ error: 'Nivel de acceso inválido' });
            }
            accessLevel = accessLevelResult.rows[0];
        }
        const result = await req.db.query(
            `INSERT INTO employees
                (tenant_id, name, department, email, dni, legajo, phone, daily_limit, daily_limit_mode, warning_enabled, access_level_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
             RETURNING *`,
            [
                req.user.tenant_id,
                name.trim(),
                normalizeOptionalString(department),
                normalizeOptionalString(email),
                normalizeOptionalString(dni),
                normalizeOptionalString(legajo),
                normalizeOptionalString(phone),
                limitValue,
                limitMode,
                warningEnabled,
                accessLevelId
            ]
        );
        await audit.logAuditEvent({
            req,
            action: 'employee.create',
            entityType: 'employee',
            entityId: result.rows[0].id,
            entityLabel: result.rows[0].name,
            summary: `Creó el empleado ${result.rows[0].name}`,
            details: {
                department: result.rows[0].department,
                daily_limit: result.rows[0].daily_limit,
                daily_limit_mode: result.rows[0].daily_limit_mode,
                warning_enabled: result.rows[0].warning_enabled,
                access_level_id: result.rows[0].access_level_id,
                access_level_name: accessLevel?.name || null,
                email: result.rows[0].email
            }
        });
        res.status(201).json({ employee: result.rows[0] });
    } catch (err) {
        if (err.message === 'El límite diario debe ser un número entre 1 y 50') {
            return res.status(400).json({ error: err.message });
        }
        if (err.message === 'Nivel de acceso inválido') {
            return res.status(400).json({ error: err.message });
        }
        if (err.code === '23505')
            return res.status(409).json({ error: 'Email o DNI ya registrado' });
        res.status(500).json({ error: err.message });
    }
});

// PATCH /api/employees/:id — editar empleado
router.patch('/:id', requireManager, async (req, res) => {
    const { name, department, email, dni, legajo, phone, daily_limit, daily_limit_mode, warning_enabled, access_level_id, active } = req.body;
    try {
        const before = await req.db.query(
            `SELECT id, name, department, email, dni, legajo, phone, daily_limit, daily_limit_mode, warning_enabled, access_level_id, active
             FROM employees WHERE id = $1 AND tenant_id = $2`,
            [req.params.id, req.user.tenant_id]
        );
        if (before.rowCount === 0) return res.status(404).json({ error: 'No encontrado' });
        const limitValue = normalizeDailyLimit(daily_limit, { allowNull: true });
        const limitMode = daily_limit_mode === undefined ? null : normalizeLimitMode(daily_limit_mode);
        const warningEnabled = normalizeOptionalBoolean(warning_enabled);
        const activeValue = normalizeOptionalBoolean(active);
        const hasAccessLevelField = Object.prototype.hasOwnProperty.call(req.body, 'access_level_id');
        const accessLevelId = hasAccessLevelField
            ? normalizeAccessLevelId(access_level_id, { allowNull: true })
            : null;
        let accessLevel = null;
        if (hasAccessLevelField && accessLevelId !== null) {
            const accessLevelResult = await getAccessLevelById(req.db, accessLevelId, req.user.tenant_id);
            if (accessLevelResult.rowCount === 0) {
                return res.status(400).json({ error: 'Nivel de acceso inválido' });
            }
            accessLevel = accessLevelResult.rows[0];
        }
        const result = await req.db.query(
            `UPDATE employees SET
                name        = COALESCE($1, name),
                department  = COALESCE($2, department),
                email       = COALESCE($3, email),
                dni         = COALESCE($4, dni),
                legajo      = COALESCE($5, legajo),
                phone       = COALESCE($6, phone),
                daily_limit = COALESCE($7, daily_limit),
                daily_limit_mode = COALESCE($8, daily_limit_mode),
                warning_enabled  = COALESCE($9, warning_enabled),
                access_level_id = CASE WHEN $10 THEN $11::int ELSE access_level_id END,
                active      = COALESCE($12, active)
             WHERE id = $13
               AND tenant_id = $14
             RETURNING *`,
            [
                normalizeOptionalString(name),
                normalizeOptionalString(department),
                normalizeOptionalString(email),
                normalizeOptionalString(dni),
                normalizeOptionalString(legajo),
                normalizeOptionalString(phone),
                limitValue,
                limitMode,
                warningEnabled,
                hasAccessLevelField,
                accessLevelId,
                activeValue,
                req.params.id,
                req.user.tenant_id
            ]
        );
        const action = before.rows[0].active && result.rows[0].active === false
            ? 'employee.deactivate'
            : 'employee.update';
        await audit.logAuditEvent({
            req,
            action,
            entityType: 'employee',
            entityId: result.rows[0].id,
            entityLabel: result.rows[0].name,
            summary: action === 'employee.deactivate'
                ? `Desactivó el empleado ${result.rows[0].name}`
                : `Actualizó el empleado ${result.rows[0].name}`,
            details: {
                before: before.rows[0],
                after: {
                    id: result.rows[0].id,
                    name: result.rows[0].name,
                    department: result.rows[0].department,
                    email: result.rows[0].email,
                    dni: result.rows[0].dni,
                    legajo: result.rows[0].legajo,
                    phone: result.rows[0].phone,
                    daily_limit: result.rows[0].daily_limit,
                    daily_limit_mode: result.rows[0].daily_limit_mode,
                    warning_enabled: result.rows[0].warning_enabled,
                    access_level_id: result.rows[0].access_level_id,
                    access_level_name: accessLevel?.name || null,
                    active: result.rows[0].active
                }
            }
        });
        res.json({ employee: result.rows[0] });
    } catch (err) {
        if (err.message === 'El límite diario debe ser un número entre 1 y 50') {
            return res.status(400).json({ error: err.message });
        }
        if (err.message === 'Nivel de acceso inválido') {
            return res.status(400).json({ error: err.message });
        }
        res.status(500).json({ error: err.message });
    }
});

// PATCH /api/employees/:id/limit
router.patch('/:id/limit', requireManager, async (req, res) => {
    const { daily_limit } = req.body;
    try {
        const before = await req.db.query(
            'SELECT id, name, daily_limit FROM employees WHERE id = $1 AND tenant_id = $2',
            [req.params.id, req.user.tenant_id]
        );
        if (before.rowCount === 0) return res.status(404).json({ error: 'No encontrado' });
        const limitValue = normalizeDailyLimit(daily_limit);
        const result = await req.db.query(
            'UPDATE employees SET daily_limit=$1 WHERE id=$2 AND tenant_id=$3 RETURNING id,name,daily_limit',
            [limitValue, req.params.id, req.user.tenant_id]
        );
        await audit.logAuditEvent({
            req,
            action: 'employee.update',
            entityType: 'employee',
            entityId: result.rows[0].id,
            entityLabel: result.rows[0].name,
            summary: `Actualizó el límite diario de ${result.rows[0].name}`,
            details: {
                before: before.rows[0],
                after: result.rows[0]
            }
        });
        res.json({ employee: result.rows[0] });
    } catch (err) {
        if (err.message === 'El límite diario debe ser un número entre 1 y 50') {
            return res.status(400).json({ error: err.message });
        }
        res.status(500).json({ error: err.message });
    }
});

// POST /api/employees/:id/cards — registrar tarjeta NFC
router.post('/:id/cards', requireManager, async (req, res) => {
    const { uid, label } = req.body;
    if (!uid) return res.status(400).json({ error: 'uid requerido' });
    try {
        const result = await registerOrAssignCard({
            db: req.db,
            tenantId: req.user.tenant_id,
            req,
            employeeId: Number.parseInt(req.params.id, 10),
            uid,
            label,
            source: 'panel'
        });
        res.status(201).json(result);
    } catch (err) {
        res.status(err.status || 500).json({ error: err.message });
    }
});

// DELETE /api/employees/:id — eliminar empleado (soft delete) + desactivar tarjetas
// Usa req.db porque authJwt ya abrió la transacción con app.tenant_id seteado.
router.delete('/:id', requireManager, async (req, res) => {
    let employee = null;
    try {
        const result = await req.db.query(
            'UPDATE employees SET active=false WHERE id=$1 AND tenant_id=$2 RETURNING id,name',
            [req.params.id, req.user.tenant_id]
        );
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'No encontrado' });
        }
        employee = result.rows[0];
        // Desactivar todas las tarjetas del empleado
        await req.db.query(
            `UPDATE nfc_cards
             SET active=false, status='inactive'
             WHERE employee_id=$1
               AND tenant_id=$2`,
            [req.params.id, req.user.tenant_id]
        );
        await audit.logAuditEvent({
            req,
            action: 'employee.deactivate',
            entityType: 'employee',
            entityId: employee.id,
            entityLabel: employee.name,
            summary: `Dio de baja el empleado ${employee.name}`
        });
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PATCH /api/employees/:id/cards/:cardId — toggle activo / renombrar / reasignar
router.patch('/:id/cards/:cardId', requireManager, async (req, res) => {
    const { active, label, employee_id, status } = req.body;
    try {
        const result = await updateCardAssignment({
            db: req.db,
            tenantId: req.user.tenant_id,
            req,
            cardId: Number.parseInt(req.params.cardId, 10),
            label,
            employeeId: employee_id ?? null,
            status,
            active,
            source: 'panel'
        });
        res.json(result);
    } catch (err) {
        res.status(err.status || 500).json({ error: err.message });
    }
});

// DELETE /api/employees/:id/cards/:cardId — desactivar tarjeta
router.delete('/:id/cards/:cardId', requireManager, async (req, res) => {
    try {
        await deactivateCard({
            db: req.db,
            tenantId: req.user.tenant_id,
            req,
            cardId: Number.parseInt(req.params.cardId, 10),
            employeeId: Number.parseInt(req.params.id, 10),
            source: 'panel'
        });
        res.json({ ok: true });
    } catch (err) {
        res.status(err.status || 500).json({ error: err.message });
    }
});

module.exports = router;
