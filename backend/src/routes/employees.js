// src/routes/employees.js
const express = require('express');
const pool    = require('../db/pool');
const { requireManager } = require('../middleware/roleAccess');
const { normalizeLimitMode } = require('../lib/dailyLimit');
const { buildDepartmentScopeClause } = require('../lib/accessScope');
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

function normalizeCardStatus(value, { allowNull = false } = {}) {
    if (value === null || value === undefined || value === '') {
        return allowNull ? null : 'active';
    }
    const normalized = String(value).trim().toLowerCase();
    if (['active', 'inactive', 'lost'].includes(normalized)) return normalized;
    throw new Error('Estado de TAG NFC inválido');
}

function cardStatusFromLegacy(active, status = null) {
    if (status && ['active', 'inactive', 'lost'].includes(String(status).trim().toLowerCase())) {
        return String(status).trim().toLowerCase();
    }
    return active ? 'active' : 'inactive';
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
        const result = await pool.query(
            `SELECT e.*,
                COALESCE(
                    json_agg(json_build_object(
                        'id', nc.id, 'uid', nc.uid, 'label', nc.label, 'active', nc.active, 'status', COALESCE(nc.status, CASE WHEN nc.active THEN 'active' ELSE 'inactive' END)
                    )) FILTER (WHERE nc.id IS NOT NULL), '[]'
                ) AS nfc_cards
             FROM employees e
             LEFT JOIN nfc_cards nc ON nc.employee_id = e.id
             WHERE e.active = true
               ${scope.sql}
             GROUP BY e.id
             ORDER BY e.name`
            ,
            params
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
        const emp = await pool.query(
            `SELECT e.*,
                COALESCE(
                    json_agg(json_build_object(
                        'id', nc.id, 'uid', nc.uid, 'label', nc.label, 'active', nc.active, 'status', COALESCE(nc.status, CASE WHEN nc.active THEN 'active' ELSE 'inactive' END)
                    )) FILTER (WHERE nc.id IS NOT NULL), '[]'
                ) AS nfc_cards
             FROM employees e
             LEFT JOIN nfc_cards nc ON nc.employee_id = e.id
             WHERE e.id = $1
               ${scope.sql}
             GROUP BY e.id`,
            params
        );
        if (emp.rowCount === 0) return res.status(404).json({ error: 'No encontrado' });

        // Consumo por máquina (mes actual)
        const machines = await pool.query(
            `SELECT machine_name, location, taps_count, spent_cents
             FROM employee_machine_consumption
             WHERE employee_id = $1
             ORDER BY taps_count DESC`,
            [req.params.id]
        );

        // Historial últimos 30 taps
        const taps = await pool.query(
            `SELECT t.id, m.name AS machine_name, t.approved, t.deny_reason,
                    t.amount_cents, t.tapped_at
             FROM taps t
             JOIN machines m ON m.id = t.machine_id
             WHERE t.employee_id = $1
             ORDER BY t.tapped_at DESC LIMIT 30`,
            [req.params.id]
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
    const { name, department, email, dni, legajo, phone, daily_limit, daily_limit_mode, warning_enabled } = req.body;
    if (!name) return res.status(400).json({ error: 'name requerido' });

    try {
        const limitValue = normalizeDailyLimit(daily_limit);
        const limitMode = normalizeLimitMode(daily_limit_mode);
        const warningEnabledValue = normalizeOptionalBoolean(warning_enabled);
        const warningEnabled = warningEnabledValue === null ? true : warningEnabledValue;
        const result = await pool.query(
            `INSERT INTO employees
                (name, department, email, dni, legajo, phone, daily_limit, daily_limit_mode, warning_enabled)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             RETURNING *`,
            [
                name.trim(),
                normalizeOptionalString(department),
                normalizeOptionalString(email),
                normalizeOptionalString(dni),
                normalizeOptionalString(legajo),
                normalizeOptionalString(phone),
                limitValue,
                limitMode,
                warningEnabled
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
                email: result.rows[0].email
            }
        });
        res.status(201).json({ employee: result.rows[0] });
    } catch (err) {
        if (err.message === 'El límite diario debe ser un número entre 1 y 50') {
            return res.status(400).json({ error: err.message });
        }
        if (err.code === '23505')
            return res.status(409).json({ error: 'Email o DNI ya registrado' });
        res.status(500).json({ error: err.message });
    }
});

// PATCH /api/employees/:id — editar empleado
router.patch('/:id', requireManager, async (req, res) => {
    const { name, department, email, dni, legajo, phone, daily_limit, daily_limit_mode, warning_enabled, active } = req.body;
    try {
        const before = await pool.query(
            `SELECT id, name, department, email, dni, legajo, phone, daily_limit, daily_limit_mode, warning_enabled, active
             FROM employees WHERE id = $1`,
            [req.params.id]
        );
        if (before.rowCount === 0) return res.status(404).json({ error: 'No encontrado' });
        const limitValue = normalizeDailyLimit(daily_limit, { allowNull: true });
        const limitMode = daily_limit_mode === undefined ? null : normalizeLimitMode(daily_limit_mode);
        const warningEnabled = normalizeOptionalBoolean(warning_enabled);
        const activeValue = normalizeOptionalBoolean(active);
        const result = await pool.query(
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
                active      = COALESCE($10, active)
             WHERE id = $11 RETURNING *`,
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
                activeValue,
                req.params.id
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
                    active: result.rows[0].active
                }
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

// PATCH /api/employees/:id/limit
router.patch('/:id/limit', requireManager, async (req, res) => {
    const { daily_limit } = req.body;
    try {
        const before = await pool.query(
            'SELECT id, name, daily_limit FROM employees WHERE id = $1',
            [req.params.id]
        );
        if (before.rowCount === 0) return res.status(404).json({ error: 'No encontrado' });
        const limitValue = normalizeDailyLimit(daily_limit);
        const result = await pool.query(
            'UPDATE employees SET daily_limit=$1 WHERE id=$2 RETURNING id,name,daily_limit',
            [limitValue, req.params.id]
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
        const employee = await pool.query(
            'SELECT id, name FROM employees WHERE id = $1',
            [req.params.id]
        );
        if (employee.rowCount === 0) return res.status(404).json({ error: 'No encontrado' });
        const result = await pool.query(
            `INSERT INTO nfc_cards (uid, employee_id, label)
             VALUES ($1, $2, $3)
             ON CONFLICT (uid) DO UPDATE SET employee_id=$2, label=$3, active=true, status='active'
             RETURNING *`,
            [uid.toUpperCase().trim(), req.params.id, label||'Tarjeta']
        );
        await audit.logAuditEvent({
            req,
            action: 'nfc_card.create',
            entityType: 'nfc_card',
            entityId: result.rows[0].id,
            entityLabel: result.rows[0].uid,
            summary: `Asoció el TAG ${result.rows[0].uid} a ${employee.rows[0].name}`,
            details: {
                employee_id: employee.rows[0].id,
                employee_name: employee.rows[0].name,
                label: result.rows[0].label,
                status: result.rows[0].status
            }
        });
        res.status(201).json({ card: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/employees/:id — eliminar empleado (soft delete) + desactivar tarjetas
router.delete('/:id', requireManager, async (req, res) => {
    const client = await pool.connect();
    let employee = null;
    try {
        await client.query('BEGIN');
        const result = await client.query(
            'UPDATE employees SET active=false WHERE id=$1 RETURNING id,name',
            [req.params.id]
        );
        if (result.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'No encontrado' });
        }
        employee = result.rows[0];
        // Desactivar todas las tarjetas del empleado
        await client.query(
            `UPDATE nfc_cards
             SET active=false, status='inactive'
             WHERE employee_id=$1`,
            [req.params.id]
        );
        await client.query('COMMIT');
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
        await client.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// PATCH /api/employees/:id/cards/:cardId — toggle activo / renombrar / reasignar
router.patch('/:id/cards/:cardId', requireManager, async (req, res) => {
    const { active, label, employee_id, status } = req.body;
    try {
        const before = await pool.query(
            `SELECT nc.id, nc.uid, nc.label, nc.employee_id, nc.active,
                    COALESCE(nc.status, CASE WHEN nc.active THEN 'active' ELSE 'inactive' END) AS status,
                    e.name AS employee_name
             FROM nfc_cards nc
             LEFT JOIN employees e ON e.id = nc.employee_id
             WHERE nc.id = $1`,
            [req.params.cardId]
        );
        if (before.rowCount === 0) return res.status(404).json({ error: 'No encontrado' });
        const normalizedActive = normalizeOptionalBoolean(active);
        const reassignedEmployeeId = employee_id ?? null;
        const normalizedStatus = status === undefined
            ? null
            : normalizeCardStatus(status, { allowNull: true });
        const finalStatus = normalizedStatus !== null
            ? normalizedStatus
            : reassignedEmployeeId !== null
                ? 'active'
                : normalizedActive === null
                    ? null
                    : normalizedActive
                        ? 'active'
                        : 'inactive';

        const result = await pool.query(
            `UPDATE nfc_cards SET
                status      = COALESCE($1, status, CASE WHEN active THEN 'active' ELSE 'inactive' END),
                active      = CASE
                                WHEN COALESCE($1, status, CASE WHEN active THEN 'active' ELSE 'inactive' END) = 'active' THEN true
                                ELSE false
                              END,
                label       = COALESCE($2, label),
                employee_id = COALESCE($3::int, employee_id)
             WHERE id = $4 RETURNING *`,
            [
                finalStatus,
                label ?? null,
                reassignedEmployeeId,
                req.params.cardId
            ]
        );
        const employeeResult = await pool.query(
            'SELECT id, name FROM employees WHERE id = $1',
            [result.rows[0].employee_id]
        );
        const card = {
            ...result.rows[0],
            status: cardStatusFromLegacy(result.rows[0].active, result.rows[0].status)
        };
        const targetEmployee = employeeResult.rows[0] || null;
        const action = reassignedEmployeeId !== null
            ? 'nfc_card.update'
            : card.status === 'lost'
                ? 'nfc_card.update'
                : card.status === 'inactive'
                    ? 'nfc_card.deactivate'
                    : 'nfc_card.update';
        await audit.logAuditEvent({
            req,
            action,
            entityType: 'nfc_card',
            entityId: card.id,
            entityLabel: card.uid,
            summary: reassignedEmployeeId !== null
                ? `Reasignó el TAG ${card.uid} a ${targetEmployee?.name || `empleado ${card.employee_id}`}`
                : card.status === 'lost'
                    ? `Marcó el TAG ${card.uid} como perdido`
                    : card.status === 'inactive'
                        ? `Dio de baja el TAG ${card.uid}`
                        : `Actualizó el TAG ${card.uid}`,
            details: {
                before: before.rows[0],
                after: {
                    id: card.id,
                    uid: card.uid,
                    label: card.label,
                    employee_id: card.employee_id,
                    employee_name: targetEmployee?.name || null,
                    status: card.status,
                    active: card.active
                }
            }
        });
        res.json({ card });
    } catch (err) {
        if (err.message === 'Estado de TAG NFC inválido') {
            return res.status(400).json({ error: err.message });
        }
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/employees/:id/cards/:cardId — desactivar tarjeta
router.delete('/:id/cards/:cardId', requireManager, async (req, res) => {
    try {
        const result = await pool.query(
            `UPDATE nfc_cards
             SET active=false, status='inactive'
             WHERE id=$1 AND employee_id=$2
             RETURNING id, uid, label, employee_id`,
            [req.params.cardId, req.params.id]
        );
        if (result.rowCount === 0) return res.status(404).json({ error: 'No encontrado' });
        await audit.logAuditEvent({
            req,
            action: 'nfc_card.deactivate',
            entityType: 'nfc_card',
            entityId: result.rows[0].id,
            entityLabel: result.rows[0].uid,
            summary: `Dio de baja el TAG ${result.rows[0].uid}`,
            details: {
                employee_id: result.rows[0].employee_id,
                label: result.rows[0].label
            }
        });
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
