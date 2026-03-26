// src/routes/dashboard.js
// Endpoints para el panel del gerente

const express = require('express');
const pool    = require('../db/pool');
const alerts  = require('../services/alerts');
const systemSettings = require('../services/systemSettings');
const { requireManager, requireAnalyticsViewer } = require('../middleware/roleAccess');
const { statusFromUsage } = require('../lib/dailyLimit');
const { buildDepartmentScopeClause } = require('../lib/accessScope');
const { effectivePolicyExpressions } = require('../lib/accessLevels');
const {
    buildBusinessDayRangeSql,
    buildBusinessMonthRangeSql
} = require('../lib/businessTime');

const router = express.Router();
router.use(requireAnalyticsViewer);

function departmentExpr(column) {
    return `COALESCE(NULLIF(TRIM(${column}), ''), 'Sin área')`;
}

const effectivePolicy = effectivePolicyExpressions('e', 'al');

// ── GET /api/dashboard/today ──────────────────────────
// Resumen del día: métricas + ranking + alertas
router.get('/today', async (req, res) => {
    try {
        const { timeZone, businessDate } = await systemSettings.getBusinessTimeContext();
        const warningLead = await alerts.getEmployeeLimitWarningLead();
        const params = [timeZone, businessDate];
        const scope = buildDepartmentScopeClause({
            user: req.user,
            requestedDepartment: req.query.department,
            params,
            column: departmentExpr('e.department')
        });
        const result = await pool.query(
            `SELECT
                e.id AS employee_id,
                e.name AS employee_name,
                e.department,
                e.access_level_id,
                al.name AS access_level_name,
                ${effectivePolicy.dailyLimit} AS daily_limit,
                ${effectivePolicy.dailyLimitMode} AS daily_limit_mode,
                ${effectivePolicy.warningEnabled} AS warning_enabled,
                ${effectivePolicy.source} AS policy_source,
                COUNT(t.id) FILTER (WHERE t.approved = true) AS taps_today,
                COUNT(t.id) FILTER (WHERE t.approved = true AND t.over_limit = true) AS taps_over_limit,
                COALESCE(SUM(t.amount_cents) FILTER (WHERE t.approved = true), 0) AS spent_today_cents
             FROM employees e
             LEFT JOIN access_levels al ON al.id = e.access_level_id
             LEFT JOIN taps t
                ON t.employee_id = e.id
               AND ${buildBusinessDayRangeSql('t.tapped_at', 1, 2)}
             WHERE e.active = true
               ${scope.sql}
             GROUP BY e.id, al.id
             ORDER BY taps_today DESC`
            ,
            params
        );

        const employees = result.rows.map(row => ({
            ...row,
            status: statusFromUsage({
                dailyLimit: row.daily_limit,
                mode: row.daily_limit_mode,
                tapsToday: row.taps_today,
                warningLead
            })
        }));

        const totalTaps  = employees.reduce((s, e) => s + parseInt(e.taps_today), 0);
        const totalCents = employees.reduce((s, e) => s + parseInt(e.spent_today_cents), 0);
        const blocked    = employees.filter(e => e.status === 'blocked').length;
        const warnings   = employees.filter(e => e.status === 'warning').length;

        res.json({
            business_date: businessDate,
            business_timezone: timeZone,
            department_scopes: scope.appliedScopes,
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
        res.status(err.status || 500).json({ error: err.status ? err.message : 'Error interno' });
    }
});

// ── GET /api/dashboard/monthly ────────────────────────
// Resumen del mes actual
router.get('/monthly', async (req, res) => {
    try {
        const { timeZone, monthStart } = await systemSettings.getBusinessTimeContext();
        const params = [timeZone, monthStart];
        const scope = buildDepartmentScopeClause({
            user: req.user,
            requestedDepartment: req.query.department,
            params,
            column: departmentExpr('e.department')
        });
        const result = await pool.query(
            `SELECT
                e.id AS employee_id,
                e.name AS employee_name,
                e.department,
                COUNT(t.id) FILTER (WHERE t.approved = true) AS taps_total,
                COALESCE(SUM(t.amount_cents) FILTER (WHERE t.approved = true), 0) AS spent_cents
             FROM employees e
             LEFT JOIN taps t
                ON t.employee_id = e.id
               AND t.approved = true
               AND ${buildBusinessMonthRangeSql('t.tapped_at', 1, 2)}
             WHERE e.active = true
               ${scope.sql}
             GROUP BY e.id, e.name, e.department
             ORDER BY taps_total DESC`
            ,
            params
        );

        const totalCents = result.rows.reduce((s, e) => s + parseInt(e.spent_cents), 0);

        res.json({
            month: monthStart.slice(0, 7),
            business_timezone: timeZone,
            department_scopes: scope.appliedScopes,
            total_spent_cents: totalCents,
            employees:     result.rows
        });

    } catch (err) {
        console.error('[MONTHLY] Error:', err.message);
        res.status(err.status || 500).json({ error: err.status ? err.message : 'Error interno' });
    }
});

// ── GET /api/dashboard/feed ───────────────────────────
// Últimos 50 taps del día (para el log en tiempo real)
router.get('/feed', async (req, res) => {
    try {
        const { timeZone, businessDate } = await systemSettings.getBusinessTimeContext();
        const params = [timeZone, businessDate];
        const scope = buildDepartmentScopeClause({
            user: req.user,
            requestedDepartment: req.query.department,
            params,
            column: departmentExpr('e.department')
        });
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
             WHERE ${buildBusinessDayRangeSql('t.tapped_at', 1, 2)}
               ${scope.sql}
             ORDER BY t.tapped_at DESC
             LIMIT 50`
            ,
            params
        );

        res.json({ taps: result.rows, department_scopes: scope.appliedScopes });

    } catch (err) {
        console.error('[FEED] Error:', err.message);
        res.status(err.status || 500).json({ error: err.status ? err.message : 'Error interno' });
    }
});

// ── GET /api/dashboard/uid-history/:uid ─────────────
// Historial de intentos de acceso de un UID específico
router.get('/uid-history/:uid', requireManager, async (req, res) => {
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
router.get('/unknown-uids', requireManager, async (req, res) => {
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
