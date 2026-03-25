// src/routes/nfcCards.js
const express = require('express');
const pool    = require('../db/pool');
const { requireManager } = require('../middleware/roleAccess');

const router = express.Router();

// GET /api/nfc-cards — listar todos los TAGs NFC con datos de empleado
router.get('/', requireManager, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT
                nc.id,
                nc.uid,
                nc.employee_id,
                nc.label,
                nc.active,
                nc.created_at,
                COALESCE(nc.status, CASE WHEN nc.active THEN 'active' ELSE 'inactive' END) AS status,
                e.name AS employee_name
             FROM nfc_cards nc
             LEFT JOIN employees e ON nc.employee_id = e.id
             ORDER BY nc.created_at DESC`
        );
        res.json({ cards: result.rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
