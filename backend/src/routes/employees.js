// src/routes/employees.js
const express = require('express');
const pool    = require('../db/pool');

const router = express.Router();

// GET /api/employees — listar todos con tarjetas NFC
router.get('/', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT e.*,
                COALESCE(
                    json_agg(json_build_object(
                        'id', nc.id, 'uid', nc.uid, 'label', nc.label, 'active', nc.active
                    )) FILTER (WHERE nc.id IS NOT NULL), '[]'
                ) AS nfc_cards
             FROM employees e
             LEFT JOIN nfc_cards nc ON nc.employee_id = e.id
             WHERE e.active = true
             GROUP BY e.id
             ORDER BY e.name`
        );
        res.json({ employees: result.rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/employees/:id — detalle de un empleado
router.get('/:id', async (req, res) => {
    try {
        const emp = await pool.query(
            `SELECT e.*,
                COALESCE(
                    json_agg(json_build_object(
                        'id', nc.id, 'uid', nc.uid, 'label', nc.label, 'active', nc.active
                    )) FILTER (WHERE nc.id IS NOT NULL), '[]'
                ) AS nfc_cards
             FROM employees e
             LEFT JOIN nfc_cards nc ON nc.employee_id = e.id
             WHERE e.id = $1
             GROUP BY e.id`,
            [req.params.id]
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
            recent_taps: taps.rows
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/employees — crear empleado
router.post('/', async (req, res) => {
    const { name, department, email, dni, legajo, phone, daily_limit } = req.body;
    if (!name) return res.status(400).json({ error: 'name requerido' });

    try {
        const result = await pool.query(
            `INSERT INTO employees (name, department, email, dni, legajo, phone, daily_limit)
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [name.trim(), department||null, email||null, dni||null, legajo||null, phone||null, daily_limit||4]
        );
        res.status(201).json({ employee: result.rows[0] });
    } catch (err) {
        if (err.code === '23505')
            return res.status(409).json({ error: 'Email o DNI ya registrado' });
        res.status(500).json({ error: err.message });
    }
});

// PATCH /api/employees/:id — editar empleado
router.patch('/:id', async (req, res) => {
    const { name, department, email, dni, legajo, phone, daily_limit, active } = req.body;
    try {
        const result = await pool.query(
            `UPDATE employees SET
                name        = COALESCE($1, name),
                department  = COALESCE($2, department),
                email       = COALESCE($3, email),
                dni         = COALESCE($4, dni),
                legajo      = COALESCE($5, legajo),
                phone       = COALESCE($6, phone),
                daily_limit = COALESCE($7, daily_limit),
                active      = COALESCE($8, active)
             WHERE id = $9 RETURNING *`,
            [name, department, email, dni, legajo, phone, daily_limit, active, req.params.id]
        );
        if (result.rowCount === 0) return res.status(404).json({ error: 'No encontrado' });
        res.json({ employee: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PATCH /api/employees/:id/limit
router.patch('/:id/limit', async (req, res) => {
    const { daily_limit } = req.body;
    if (!daily_limit || daily_limit < 1 || daily_limit > 50)
        return res.status(400).json({ error: 'Límite debe ser entre 1 y 50' });
    try {
        const result = await pool.query(
            'UPDATE employees SET daily_limit=$1 WHERE id=$2 RETURNING id,name,daily_limit',
            [daily_limit, req.params.id]
        );
        if (result.rowCount === 0) return res.status(404).json({ error: 'No encontrado' });
        res.json({ employee: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/employees/:id/cards — registrar tarjeta NFC
router.post('/:id/cards', async (req, res) => {
    const { uid, label } = req.body;
    if (!uid) return res.status(400).json({ error: 'uid requerido' });
    try {
        const result = await pool.query(
            `INSERT INTO nfc_cards (uid, employee_id, label)
             VALUES ($1, $2, $3)
             ON CONFLICT (uid) DO UPDATE SET employee_id=$2, label=$3, active=true
             RETURNING *`,
            [uid.toUpperCase().trim(), req.params.id, label||'Tarjeta']
        );
        res.status(201).json({ card: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/employees/:id — eliminar empleado (soft delete)
router.delete('/:id', async (req, res) => {
    try {
        const result = await pool.query(
            'UPDATE employees SET active=false WHERE id=$1 RETURNING id,name',
            [req.params.id]
        );
        if (result.rowCount === 0) return res.status(404).json({ error: 'No encontrado' });
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PATCH /api/employees/:id/cards/:cardId — toggle activo / renombrar / reasignar
router.patch('/:id/cards/:cardId', async (req, res) => {
    const { active, label, employee_id } = req.body;
    try {
        const result = await pool.query(
            `UPDATE nfc_cards SET
                active      = CASE WHEN $1::text IS NOT NULL THEN $1::boolean ELSE active END,
                label       = COALESCE($2, label),
                employee_id = COALESCE($3::int, employee_id)
             WHERE id = $4 RETURNING *`,
            [
                active !== undefined ? String(active) : null,
                label ?? null,
                employee_id ?? null,
                req.params.cardId
            ]
        );
        if (result.rowCount === 0) return res.status(404).json({ error: 'No encontrado' });
        res.json({ card: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/employees/:id/cards/:cardId — desactivar tarjeta
router.delete('/:id/cards/:cardId', async (req, res) => {
    try {
        await pool.query(
            'UPDATE nfc_cards SET active=false WHERE id=$1 AND employee_id=$2',
            [req.params.cardId, req.params.id]
        );
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
