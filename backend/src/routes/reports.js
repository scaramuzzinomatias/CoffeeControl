// src/routes/reports.js
const express = require('express');
const pool    = require('../db/pool');

const router = express.Router();

// GET /api/reports/machines — ranking de máquinas por consumo
router.get('/machines', async (req, res) => {
    try {
        const result = await pool.query(`SELECT * FROM machine_status ORDER BY taps_month DESC`);
        res.json({ machines: result.rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/reports/machines/:id/employees — top empleados de una máquina (mes)
router.get('/machines/:id/employees', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT e.name AS employee_name, e.legajo, e.department,
                    COUNT(t.id) AS taps_count,
                    COALESCE(SUM(t.amount_cents),0) AS spent_cents
             FROM taps t
             JOIN employees e ON e.id = t.employee_id
             WHERE t.machine_id = $1
               AND t.approved = true
               AND t.tapped_at >= DATE_TRUNC('month', NOW())
             GROUP BY e.id, e.name, e.legajo, e.department
             ORDER BY taps_count DESC`,
            [req.params.id]
        );
        res.json({ employees: result.rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/reports/employees/:id/machines — en qué máquinas consumió un empleado
router.get('/employees/:id/machines', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT * FROM employee_machine_consumption
             WHERE employee_id = $1
             ORDER BY taps_count DESC`,
            [req.params.id]
        );
        res.json({ machines: result.rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
