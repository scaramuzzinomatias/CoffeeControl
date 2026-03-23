// src/routes/dashboard.js
// Endpoints para el panel del gerente

const express = require('express');
const pool    = require('../db/pool');

const router = express.Router();

// ── GET /api/dashboard/today ──────────────────────────
// Resumen del día: métricas + ranking + alertas
router.get('/today', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT
                employee_id,
                employee_name,
                department,
                daily_limit,
                taps_today,
                spent_today_cents,
                CASE
                    WHEN taps_today >= daily_limit THEN 'blocked'
                    WHEN taps_today >= daily_limit * 0.75 THEN 'warning'
                    ELSE 'ok'
                END AS status
             FROM daily_consumption
             ORDER BY taps_today DESC`
        );

        const employees = result.rows;

        const totalTaps  = employees.reduce((s, e) => s + parseInt(e.taps_today), 0);
        const totalCents = employees.reduce((s, e) => s + parseInt(e.spent_today_cents), 0);
        const blocked    = employees.filter(e => e.status === 'blocked').length;
        const warnings   = employees.filter(e => e.status === 'warning').length;

        res.json({
            summary: {
                total_taps_today:   totalTaps,
                total_spent_cents:  totalCents,
                blocked_employees:  blocked,
                warning_employees:  warnings,
            },
            employees
        });

    } catch (err) {
        console.error('[DASHBOARD] Error:', err.message);
        res.status(500).json({ error: 'Error interno' });
    }
});

// ── GET /api/dashboard/monthly ────────────────────────
// Resumen del mes actual
router.get('/monthly', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT
                employee_id,
                employee_name,
                department,
                taps_total,
                spent_cents
             FROM monthly_summary
             WHERE month = DATE_TRUNC('month', NOW())
             ORDER BY taps_total DESC`
        );

        const totalCents = result.rows.reduce((s, e) => s + parseInt(e.spent_cents), 0);

        res.json({
            month:         new Date().toISOString().slice(0, 7),
            total_spent_cents: totalCents,
            employees:     result.rows
        });

    } catch (err) {
        console.error('[MONTHLY] Error:', err.message);
        res.status(500).json({ error: 'Error interno' });
    }
});

// ── GET /api/dashboard/feed ───────────────────────────
// Últimos 50 taps del día (para el log en tiempo real)
router.get('/feed', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT
                t.id,
                t.nfc_uid,
                e.name          AS employee_name,
                m.name          AS machine_name,
                t.approved,
                t.deny_reason,
                t.amount_cents,
                t.confirmed,
                t.tapped_at
             FROM taps t
             LEFT JOIN employees e ON e.id = t.employee_id
             JOIN machines  m ON m.id = t.machine_id
             WHERE t.tapped_at >= CURRENT_DATE
             ORDER BY t.tapped_at DESC
             LIMIT 50`
        );

        res.json({ taps: result.rows });

    } catch (err) {
        console.error('[FEED] Error:', err.message);
        res.status(500).json({ error: 'Error interno' });
    }
});

// ── GET /api/dashboard/uid-history/:uid ─────────────
// Historial de intentos de acceso de un UID específico
router.get('/uid-history/:uid', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT t.tapped_at, m.name AS machine, t.approved, t.deny_reason
             FROM taps t
             JOIN machines m ON m.id = t.machine_id
             WHERE t.nfc_uid = $1
             ORDER BY t.tapped_at DESC
             LIMIT 50`,
            [req.params.uid.toUpperCase()]
        );
        res.json({ taps: result.rows, total: result.rowCount });
    } catch (err) {
        console.error('[UID-HISTORY] Error:', err.message);
        res.status(500).json({ error: 'Error interno' });
    }
});

// ── GET /api/dashboard/unknown-uids ──────────────────
// UIDs que tapearon como desconocidos y aún no tienen tarjeta registrada
router.get('/unknown-uids', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT DISTINCT ON (t.nfc_uid)
                t.nfc_uid         AS uid,
                m.name            AS machine,
                m.id              AS machine_id,
                t.tapped_at       AS ts
             FROM taps t
             JOIN machines m ON m.id = t.machine_id
             WHERE t.deny_reason = 'card_unknown'
               AND NOT EXISTS (
                   SELECT 1 FROM nfc_cards nc
                   WHERE nc.uid = t.nfc_uid AND nc.active = true
               )
             ORDER BY t.nfc_uid, t.tapped_at DESC`
        );
        res.json({ uids: result.rows });
    } catch (err) {
        console.error('[UNKNOWN-UIDS] Error:', err.message);
        res.status(500).json({ error: 'Error interno' });
    }
});

module.exports = router;
