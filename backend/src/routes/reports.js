const express = require('express');
const pool = require('../db/pool');
const systemSettings = require('../services/systemSettings');

const router = express.Router();

function normalizeDateInput(value) {
    const raw = String(value || '').trim();
    if (!raw) return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
        throw new Error('Fecha inválida. Usá el formato YYYY-MM-DD.');
    }
    return raw;
}

function normalizeLimit(value, fallback = 20, max = 100) {
    const parsed = parseInt(value, 10);
    if (!Number.isInteger(parsed) || parsed < 1) return fallback;
    return Math.min(parsed, max);
}

function buildBusinessDateRangeSql(column, fromParamIndex, toParamIndex, timeZoneParamIndex) {
    return `${column} >= (($${fromParamIndex}::date)::timestamp AT TIME ZONE $${timeZoneParamIndex})
            AND ${column} < ((($${toParamIndex}::date + INTERVAL '1 day')::timestamp) AT TIME ZONE $${timeZoneParamIndex})`;
}

async function getReportRange(req) {
    const { timeZone, businessDate, monthStart } = await systemSettings.getBusinessTimeContext();
    let from = normalizeDateInput(req.query.from) || monthStart;
    let to = normalizeDateInput(req.query.to) || businessDate;
    if (from > to) [from, to] = [to, from];
    return { timeZone, from, to };
}

function reportMeta(range) {
    return {
        from: range.from,
        to: range.to,
        business_timezone: range.timeZone
    };
}

router.get('/overview', async (req, res) => {
    try {
        const range = await getReportRange(req);
        const summaryResult = await pool.query(
            `SELECT
                COUNT(t.id) FILTER (WHERE t.approved = true) AS approved_taps,
                COUNT(t.id) FILTER (WHERE t.approved = false) AS denied_taps,
                COUNT(t.id) AS total_events,
                COALESCE(SUM(t.amount_cents) FILTER (WHERE t.approved = true), 0) AS spent_cents,
                COUNT(DISTINCT t.machine_id) FILTER (WHERE t.approved = true) AS machines_with_sales,
                COUNT(DISTINCT t.employee_id) FILTER (WHERE t.approved = true) AS employees_with_sales
             FROM taps t
             WHERE ${buildBusinessDateRangeSql('t.tapped_at', 1, 2, 3)}`,
            [range.from, range.to, range.timeZone]
        );

        const seriesResult = await pool.query(
            `WITH days AS (
                SELECT generate_series($1::date, $2::date, INTERVAL '1 day')::date AS business_day
             )
             SELECT
                TO_CHAR(days.business_day, 'YYYY-MM-DD') AS business_date,
                COUNT(t.id) FILTER (WHERE t.approved = true) AS approved_taps,
                COUNT(t.id) FILTER (WHERE t.approved = false) AS denied_taps,
                COALESCE(SUM(t.amount_cents) FILTER (WHERE t.approved = true), 0) AS spent_cents
             FROM days
             LEFT JOIN taps t
               ON t.tapped_at >= (days.business_day::timestamp AT TIME ZONE $3)
              AND t.tapped_at < (((days.business_day + INTERVAL '1 day')::timestamp) AT TIME ZONE $3)
             GROUP BY days.business_day
             ORDER BY days.business_day`,
            [range.from, range.to, range.timeZone]
        );

        return res.json({
            ...reportMeta(range),
            summary: summaryResult.rows[0],
            by_day: seriesResult.rows
        });
    } catch (err) {
        const status = err.message?.startsWith('Fecha inválida') ? 400 : 500;
        return res.status(status).json({ error: err.message });
    }
});

router.get('/machines', async (req, res) => {
    try {
        const range = await getReportRange(req);
        const department = String(req.query.department || '').trim();
        const params = [range.from, range.to, range.timeZone];
        const departmentClause = department
            ? `AND COALESCE(NULLIF(TRIM(e_filter.department), ''), 'Sin área') = $4`
            : '';
        if (department) params.push(department);
        const result = await pool.query(
            `SELECT
                m.id,
                m.name,
                m.location,
                COUNT(t.id) FILTER (WHERE t.approved = true) AS taps_count,
                COUNT(t.id) FILTER (WHERE t.approved = false) AS denied_taps,
                COALESCE(SUM(t.amount_cents) FILTER (WHERE t.approved = true), 0) AS spent_cents,
                COUNT(DISTINCT t.employee_id) FILTER (WHERE t.approved = true) AS employees_count,
                MAX(t.tapped_at) AS last_tap_at
             FROM machines m
             LEFT JOIN taps t
               ON t.machine_id = m.id
              AND ${buildBusinessDateRangeSql('t.tapped_at', 1, 2, 3)}
             LEFT JOIN employees e_filter ON e_filter.id = t.employee_id
             WHERE m.active = true
               ${departmentClause}
             GROUP BY m.id, m.name, m.location
             ORDER BY spent_cents DESC, taps_count DESC, m.name`,
            params
        );

        return res.json({
            ...reportMeta(range),
            department: department || null,
            machines: result.rows
        });
    } catch (err) {
        const status = err.message?.startsWith('Fecha inválida') ? 400 : 500;
        return res.status(status).json({ error: err.message });
    }
});

router.get('/machines/:id/employees', async (req, res) => {
    try {
        const range = await getReportRange(req);
        const result = await pool.query(
            `SELECT
                e.id,
                e.name AS employee_name,
                e.legajo,
                e.department,
                COUNT(t.id) FILTER (WHERE t.approved = true) AS taps_count,
                COUNT(t.id) FILTER (WHERE t.approved = false) AS denied_taps,
                COALESCE(SUM(t.amount_cents) FILTER (WHERE t.approved = true), 0) AS spent_cents
             FROM taps t
             JOIN employees e ON e.id = t.employee_id
             WHERE t.machine_id = $1
               AND ${buildBusinessDateRangeSql('t.tapped_at', 2, 3, 4)}
             GROUP BY e.id, e.name, e.legajo, e.department
             ORDER BY spent_cents DESC, taps_count DESC, e.name`,
            [req.params.id, range.from, range.to, range.timeZone]
        );
        return res.json({
            ...reportMeta(range),
            employees: result.rows
        });
    } catch (err) {
        const status = err.message?.startsWith('Fecha inválida') ? 400 : 500;
        return res.status(status).json({ error: err.message });
    }
});

router.get('/employees', async (req, res) => {
    try {
        const range = await getReportRange(req);
        const department = String(req.query.department || '').trim();
        const params = [range.from, range.to, range.timeZone];
        const departmentClause = department
            ? `AND COALESCE(NULLIF(TRIM(e.department), ''), 'Sin área') = $4`
            : '';
        if (department) params.push(department);

        const result = await pool.query(
            `SELECT
                e.id,
                e.name,
                e.legajo,
                e.department,
                e.daily_limit,
                e.daily_limit_mode,
                COUNT(t.id) FILTER (WHERE t.approved = true) AS taps_count,
                COUNT(t.id) FILTER (WHERE t.approved = false) AS denied_taps,
                COALESCE(SUM(t.amount_cents) FILTER (WHERE t.approved = true), 0) AS spent_cents,
                COUNT(DISTINCT t.machine_id) FILTER (WHERE t.approved = true) AS machines_count,
                MAX(t.tapped_at) AS last_tap_at
             FROM employees e
             LEFT JOIN taps t
               ON t.employee_id = e.id
              AND ${buildBusinessDateRangeSql('t.tapped_at', 1, 2, 3)}
             WHERE e.active = true
               ${departmentClause}
             GROUP BY e.id, e.name, e.legajo, e.department, e.daily_limit, e.daily_limit_mode
             ORDER BY spent_cents DESC, taps_count DESC, e.name`,
            params
        );

        return res.json({
            ...reportMeta(range),
            department: department || null,
            employees: result.rows
        });
    } catch (err) {
        const status = err.message?.startsWith('Fecha inválida') ? 400 : 500;
        return res.status(status).json({ error: err.message });
    }
});

router.get('/employees/:id/machines', async (req, res) => {
    try {
        const range = await getReportRange(req);
        const result = await pool.query(
            `SELECT
                m.id,
                m.name AS machine_name,
                m.location,
                COUNT(t.id) FILTER (WHERE t.approved = true) AS taps_count,
                COUNT(t.id) FILTER (WHERE t.approved = false) AS denied_taps,
                COALESCE(SUM(t.amount_cents) FILTER (WHERE t.approved = true), 0) AS spent_cents,
                MAX(t.tapped_at) AS last_tap_at
             FROM taps t
             JOIN machines m ON m.id = t.machine_id
             WHERE t.employee_id = $1
               AND ${buildBusinessDateRangeSql('t.tapped_at', 2, 3, 4)}
             GROUP BY m.id, m.name, m.location
             ORDER BY spent_cents DESC, taps_count DESC, m.name`,
            [req.params.id, range.from, range.to, range.timeZone]
        );
        return res.json({
            ...reportMeta(range),
            machines: result.rows
        });
    } catch (err) {
        const status = err.message?.startsWith('Fecha inválida') ? 400 : 500;
        return res.status(status).json({ error: err.message });
    }
});

router.get('/departments', async (req, res) => {
    try {
        const range = await getReportRange(req);
        const result = await pool.query(
            `SELECT
                COALESCE(NULLIF(TRIM(e.department), ''), 'Sin área') AS department,
                COUNT(t.id) FILTER (WHERE t.approved = true) AS taps_count,
                COUNT(t.id) FILTER (WHERE t.approved = false) AS denied_taps,
                COALESCE(SUM(t.amount_cents) FILTER (WHERE t.approved = true), 0) AS spent_cents,
                COUNT(DISTINCT e.id) AS employees_count,
                COUNT(DISTINCT t.machine_id) FILTER (WHERE t.approved = true) AS machines_count
             FROM employees e
             LEFT JOIN taps t
               ON t.employee_id = e.id
              AND ${buildBusinessDateRangeSql('t.tapped_at', 1, 2, 3)}
             WHERE e.active = true
             GROUP BY COALESCE(NULLIF(TRIM(e.department), ''), 'Sin área')
             ORDER BY spent_cents DESC, taps_count DESC, department`,
            [range.from, range.to, range.timeZone]
        );
        return res.json({
            ...reportMeta(range),
            departments: result.rows
        });
    } catch (err) {
        const status = err.message?.startsWith('Fecha inválida') ? 400 : 500;
        return res.status(status).json({ error: err.message });
    }
});

router.get('/recent-taps', async (req, res) => {
    try {
        const range = await getReportRange(req);
        const limit = normalizeLimit(req.query.limit, 30, 100);
        const machineId = parseInt(req.query.machine_id, 10);
        const employeeId = parseInt(req.query.employee_id, 10);
        const department = String(req.query.department || '').trim();

        const clauses = [buildBusinessDateRangeSql('t.tapped_at', 1, 2, 3)];
        const params = [range.from, range.to, range.timeZone];

        if (Number.isInteger(machineId)) {
            params.push(machineId);
            clauses.push(`t.machine_id = $${params.length}`);
        }
        if (Number.isInteger(employeeId)) {
            params.push(employeeId);
            clauses.push(`t.employee_id = $${params.length}`);
        }
        if (department) {
            params.push(department);
            clauses.push(`COALESCE(NULLIF(TRIM(e.department), ''), 'Sin área') = $${params.length}`);
        }

        params.push(limit);
        const result = await pool.query(
            `SELECT
                t.id,
                t.nfc_uid,
                t.approved,
                t.deny_reason,
                t.amount_cents,
                t.confirmed,
                t.tapped_at,
                e.name AS employee_name,
                e.legajo,
                m.name AS machine_name,
                m.location
             FROM taps t
             LEFT JOIN employees e ON e.id = t.employee_id
             JOIN machines m ON m.id = t.machine_id
             WHERE ${clauses.join(' AND ')}
             ORDER BY t.tapped_at DESC
             LIMIT $${params.length}`,
            params
        );

        return res.json({
            ...reportMeta(range),
            taps: result.rows
        });
    } catch (err) {
        const status = err.message?.startsWith('Fecha inválida') ? 400 : 500;
        return res.status(status).json({ error: err.message });
    }
});

module.exports = router;
