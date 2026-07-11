const express = require('express');
const pool = require('../db/pool');
const systemSettings = require('../services/systemSettings');
const { buildDepartmentScopeClause } = require('../lib/accessScope');
const { requireManager, requireAnalyticsViewer } = require('../middleware/roleAccess');
const { classifyStockStatus } = require('../services/stock');
const {
    normalizeAccessLevelFilter,
    buildAccessLevelClause,
    effectivePolicyExpressions
} = require('../lib/accessLevels');

const router = express.Router();
router.use(requireAnalyticsViewer);
const effectivePolicy = effectivePolicyExpressions('e', 'al');

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

function normalizeTextFilter(value, max = 120) {
    return String(value || '').trim().slice(0, max);
}

function departmentExpr(column) {
    return `COALESCE(NULLIF(TRIM(${column}), ''), 'Sin área')`;
}

function buildBusinessDateRangeSql(column, fromParamIndex, toParamIndex, timeZoneParamIndex) {
    return `${column} >= (($${fromParamIndex}::date)::timestamp AT TIME ZONE $${timeZoneParamIndex})
            AND ${column} < ((($${toParamIndex}::date + INTERVAL '1 day')::timestamp) AT TIME ZONE $${timeZoneParamIndex})`;
}

async function getReportRange(req) {
    const { timeZone, businessDate, monthStart } = await systemSettings.getBusinessTimeContext(req.user.tenant_id);
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

function toInt(value, fallback = 0) {
    const parsed = parseInt(value, 10);
    return Number.isInteger(parsed) ? parsed : fallback;
}

function reportErrorStatus(err) {
    if (err.status) return err.status;
    if (err.message?.startsWith('Fecha inválida')) return 400;
    if (err.message === 'Nivel de acceso inválido') return 400;
    return 500;
}

function serializeStockReportItem(row) {
    const base = {
        id: toInt(row.id, 0),
        machine_id: toInt(row.machine_id, 0),
        item_id: toInt(row.item_id, 0),
        product_name: row.product_name || '',
        slot_label: row.slot_label || null,
        capacity_units: toInt(row.capacity_units, 0),
        current_units: toInt(row.current_units, 0),
        min_units: toInt(row.min_units, 0),
        active: row.active !== false,
    };
    const status = classifyStockStatus(base);
    const fillPct = base.capacity_units > 0
        ? Math.round((Math.max(base.current_units, 0) / base.capacity_units) * 100)
        : null;
    return {
        ...base,
        machine_name: row.machine_name || '',
        location: row.location || null,
        status: status.key,
        status_label: status.label,
        status_badge: status.badge,
        fill_pct: fillPct,
        sales_units: toInt(row.sales_units, 0),
        restocked_units: toInt(row.restocked_units, 0),
        adjustment_delta: toInt(row.adjustment_delta, 0),
        last_movement_at: row.last_movement_at || null,
        last_sale_at: row.last_sale_at || null,
        last_restock_at: row.last_restock_at || null,
        updated_at: row.updated_at || null
    };
}

function serializeStockReportMovement(row) {
    return {
        id: toInt(row.id, 0),
        machine_id: toInt(row.machine_id, 0),
        stock_item_id: toInt(row.stock_item_id, null),
        item_id: toInt(row.item_id, 0),
        machine_name: row.machine_name || '',
        location: row.location || null,
        product_name: row.product_name || `Selección ${row.item_id || 's/d'}`,
        slot_label: row.slot_label || null,
        movement_type: row.movement_type || '',
        quantity_delta: toInt(row.quantity_delta, 0),
        previous_units: toInt(row.previous_units, null),
        current_units: toInt(row.current_units, null),
        actor_username: row.actor_username || null,
        note: row.note || null,
        created_at: row.created_at || null
    };
}

function buildStockReportSummary(items, movementSummaryRow) {
    const activeItems = items.filter(item => item.active);
    return {
        configured_items: activeItems.length,
        machines_with_stock: new Set(activeItems.map(item => item.machine_id)).size,
        low_items: activeItems.filter(item => item.status === 'low').length,
        empty_items: activeItems.filter(item => item.status === 'empty').length,
        inactive_items: items.filter(item => !item.active).length,
        total_units: activeItems.reduce((acc, item) => acc + (item.current_units || 0), 0),
        sales_units: toInt(movementSummaryRow?.sales_units, 0),
        restocked_units: toInt(movementSummaryRow?.restocked_units, 0),
        adjustment_delta: toInt(movementSummaryRow?.adjustment_delta, 0),
        unconfigured_sales: toInt(movementSummaryRow?.unconfigured_sales, 0),
        total_movements: toInt(movementSummaryRow?.total_movements, 0),
        last_movement_at: movementSummaryRow?.last_movement_at || null
    };
}

router.get('/overview', async (req, res) => {
    try {
        const range = await getReportRange(req);
        const accessLevelFilter = normalizeAccessLevelFilter(req.query.access_level_id);
        const params = [range.from, range.to, range.timeZone];
        const scope = buildDepartmentScopeClause({
            user: req.user,
            requestedDepartment: req.query.department,
            params,
            column: departmentExpr('e_filter.department')
        });
        const accessLevel = buildAccessLevelClause({
            filter: accessLevelFilter,
            params,
            column: 'e_filter.access_level_id'
        });
        params.push(req.user.tenant_id);
        const tenantIdIdx = params.length;
        const departmentClause = scope.sql
            ? ` AND EXISTS (
                    SELECT 1
                    FROM employees e_filter
                    WHERE e_filter.id = t.employee_id
                      AND e_filter.tenant_id = $${tenantIdIdx}
                      ${scope.sql}
                      ${accessLevel.sql}
                )`
            : accessLevel.sql
                ? ` AND EXISTS (
                        SELECT 1
                        FROM employees e_filter
                        WHERE e_filter.id = t.employee_id
                          AND e_filter.tenant_id = $${tenantIdIdx}
                          ${accessLevel.sql}
                    )`
                : '';
        const summaryResult = await req.db.query(
            `SELECT
                COUNT(t.id) FILTER (WHERE t.approved = true) AS approved_taps,
                COUNT(t.id) FILTER (WHERE t.approved = false) AS denied_taps,
                COUNT(t.id) AS total_events,
                COALESCE(SUM(t.amount_cents) FILTER (WHERE t.approved = true), 0) AS spent_cents,
                COUNT(DISTINCT t.machine_id) FILTER (WHERE t.approved = true) AS machines_with_sales,
                COUNT(DISTINCT t.employee_id) FILTER (WHERE t.approved = true) AS employees_with_sales
             FROM taps t
             WHERE ${buildBusinessDateRangeSql('t.tapped_at', 1, 2, 3)}
               AND t.tenant_id = $${tenantIdIdx}
               ${departmentClause}`,
            params
        );

        const seriesResult = await req.db.query(
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
                AND t.tenant_id = $${tenantIdIdx}
                ${departmentClause}
              GROUP BY days.business_day
              ORDER BY days.business_day`,
            params
        );

        return res.json({
            ...reportMeta(range),
            department: req.query.department ? normalizeTextFilter(req.query.department, 80) : null,
            access_level_filter: accessLevel.value,
            department_scopes: scope.appliedScopes,
            summary: summaryResult.rows[0],
            by_day: seriesResult.rows
        });
    } catch (err) {
        const status = reportErrorStatus(err);
        return res.status(status).json({ error: err.message });
    }
});

router.get('/machines', async (req, res) => {
    try {
        const range = await getReportRange(req);
        const accessLevelFilter = normalizeAccessLevelFilter(req.query.access_level_id);
        const params = [range.from, range.to, range.timeZone];
        const scope = buildDepartmentScopeClause({
            user: req.user,
            requestedDepartment: req.query.department,
            params,
            column: departmentExpr('e_filter.department')
        });
        const accessLevel = buildAccessLevelClause({
            filter: accessLevelFilter,
            params,
            column: 'e_filter.access_level_id'
        });
        params.push(req.user.tenant_id);
        const result = await req.db.query(
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
               AND t.tenant_id = $${params.length}
               AND ${buildBusinessDateRangeSql('t.tapped_at', 1, 2, 3)}
             LEFT JOIN employees e_filter ON e_filter.id = t.employee_id
              AND e_filter.tenant_id = $${params.length}
             WHERE m.active = true
               AND m.tenant_id = $${params.length}
               ${scope.sql}
               ${accessLevel.sql}
             GROUP BY m.id, m.name, m.location
             ORDER BY spent_cents DESC, taps_count DESC, m.name`,
            params
        );

        return res.json({
            ...reportMeta(range),
            department: req.query.department ? normalizeTextFilter(req.query.department, 80) : null,
            access_level_filter: accessLevel.value,
            department_scopes: scope.appliedScopes,
            machines: result.rows
        });
    } catch (err) {
        const status = reportErrorStatus(err);
        return res.status(status).json({ error: err.message });
    }
});

router.get('/machines/:id/employees', async (req, res) => {
    try {
        const range = await getReportRange(req);
        const accessLevelFilter = normalizeAccessLevelFilter(req.query.access_level_id);
        const params = [req.params.id, range.from, range.to, range.timeZone];
        const scope = buildDepartmentScopeClause({
            user: req.user,
            requestedDepartment: req.query.department,
            params,
            column: departmentExpr('e.department')
        });
        const accessLevel = buildAccessLevelClause({
            filter: accessLevelFilter,
            params,
            column: 'e.access_level_id'
        });
        const result = await req.db.query(
            `SELECT
                e.id,
                e.name AS employee_name,
                e.legajo,
                e.department,
                e.access_level_id,
                al.name AS access_level_name,
                ${effectivePolicy.dailyLimit} AS daily_limit,
                ${effectivePolicy.dailyLimitMode} AS daily_limit_mode,
                ${effectivePolicy.source} AS policy_source,
                COUNT(t.id) FILTER (WHERE t.approved = true) AS taps_count,
                COUNT(t.id) FILTER (WHERE t.approved = false) AS denied_taps,
                COALESCE(SUM(t.amount_cents) FILTER (WHERE t.approved = true), 0) AS spent_cents
             FROM taps t
             JOIN employees e ON e.id = t.employee_id AND e.tenant_id = $${params.length + 1}
             LEFT JOIN access_levels al ON al.id = e.access_level_id AND al.tenant_id = $${params.length + 1}
             WHERE t.machine_id = $1
               AND t.tenant_id = $${params.length + 1}
               AND ${buildBusinessDateRangeSql('t.tapped_at', 2, 3, 4)}
               ${scope.sql}
               ${accessLevel.sql}
             GROUP BY e.id, al.id
             ORDER BY spent_cents DESC, taps_count DESC, e.name`,
            params.concat([req.user.tenant_id])
        );
        return res.json({
            ...reportMeta(range),
            department: req.query.department ? normalizeTextFilter(req.query.department, 80) : null,
            access_level_filter: accessLevel.value,
            department_scopes: scope.appliedScopes,
            employees: result.rows
        });
    } catch (err) {
        const status = reportErrorStatus(err);
        return res.status(status).json({ error: err.message });
    }
});

router.get('/employees', async (req, res) => {
    try {
        const range = await getReportRange(req);
        const employeeSearch = normalizeTextFilter(req.query.employee_search, 120);
        const accessLevelFilter = normalizeAccessLevelFilter(req.query.access_level_id);
        const params = [range.from, range.to, range.timeZone];
        const whereClauses = ['e.active = true'];
        const scope = buildDepartmentScopeClause({
            user: req.user,
            requestedDepartment: req.query.department,
            params,
            column: departmentExpr('e.department')
        });
        const accessLevel = buildAccessLevelClause({
            filter: accessLevelFilter,
            params,
            column: 'e.access_level_id'
        });
        if (scope.sql) whereClauses.push(scope.sql.replace(/^ AND /, ''));
        if (accessLevel.sql) whereClauses.push(accessLevel.sql.replace(/^ AND /, ''));
        whereClauses.push(`e.tenant_id = $${params.length + 1}`);
        if (employeeSearch) {
            params.push(`%${employeeSearch}%`);
            whereClauses.push(`(
                e.name ILIKE $${params.length}
                OR COALESCE(e.legajo, '') ILIKE $${params.length}
                OR COALESCE(e.email, '') ILIKE $${params.length}
                OR COALESCE(e.dni, '') ILIKE $${params.length}
                OR COALESCE(e.phone, '') ILIKE $${params.length}
            )`);
        }

        const result = await req.db.query(
            `SELECT
                e.id,
                e.name,
                e.legajo,
                e.department,
                e.access_level_id,
                al.name AS access_level_name,
                ${effectivePolicy.dailyLimit} AS daily_limit,
                ${effectivePolicy.dailyLimitMode} AS daily_limit_mode,
                ${effectivePolicy.warningEnabled} AS warning_enabled,
                ${effectivePolicy.source} AS policy_source,
                COUNT(t.id) FILTER (WHERE t.approved = true) AS taps_count,
                COUNT(t.id) FILTER (WHERE t.approved = false) AS denied_taps,
                COALESCE(SUM(t.amount_cents) FILTER (WHERE t.approved = true), 0) AS spent_cents,
                COUNT(DISTINCT t.machine_id) FILTER (WHERE t.approved = true) AS machines_count,
                MAX(t.tapped_at) AS last_tap_at
             FROM employees e
             LEFT JOIN access_levels al ON al.id = e.access_level_id AND al.tenant_id = $${params.length + 1}
             LEFT JOIN taps t
                ON t.employee_id = e.id
                AND t.tenant_id = $${params.length + 1}
                AND ${buildBusinessDateRangeSql('t.tapped_at', 1, 2, 3)}
             WHERE ${whereClauses.join(' AND ')}
             GROUP BY e.id, al.id
             ORDER BY spent_cents DESC, taps_count DESC, e.name`,
             params.concat([req.user.tenant_id])
        );

        return res.json({
            ...reportMeta(range),
            department: req.query.department ? normalizeTextFilter(req.query.department, 80) : null,
            access_level_filter: accessLevel.value,
            department_scopes: scope.appliedScopes,
            employee_search: employeeSearch || null,
            employees: result.rows
        });
    } catch (err) {
        const status = reportErrorStatus(err);
        return res.status(status).json({ error: err.message });
    }
});

router.get('/employees/:id/machines', async (req, res) => {
    try {
        const range = await getReportRange(req);
        const accessLevelFilter = normalizeAccessLevelFilter(req.query.access_level_id);
        const params = [req.params.id, range.from, range.to, range.timeZone];
        const scope = buildDepartmentScopeClause({
            user: req.user,
            requestedDepartment: req.query.department,
            params,
            column: departmentExpr('e.department')
        });
        const accessLevel = buildAccessLevelClause({
            filter: accessLevelFilter,
            params,
            column: 'e.access_level_id'
        });
        params.push(req.user.tenant_id);
        const result = await req.db.query(
            `SELECT
                m.id,
                m.name AS machine_name,
                m.location,
                COUNT(t.id) FILTER (WHERE t.approved = true) AS taps_count,
                COUNT(t.id) FILTER (WHERE t.approved = false) AS denied_taps,
                COALESCE(SUM(t.amount_cents) FILTER (WHERE t.approved = true), 0) AS spent_cents,
                MAX(t.tapped_at) AS last_tap_at
             FROM taps t
             JOIN employees e ON e.id = t.employee_id
              AND e.tenant_id = $${params.length}
             JOIN machines m ON m.id = t.machine_id
              AND m.tenant_id = $${params.length}
             WHERE t.employee_id = $1
               AND t.tenant_id = $${params.length}
               AND ${buildBusinessDateRangeSql('t.tapped_at', 2, 3, 4)}
               ${scope.sql}
               ${accessLevel.sql}
             GROUP BY m.id, m.name, m.location
             ORDER BY spent_cents DESC, taps_count DESC, m.name`,
            params
        );
        return res.json({
            ...reportMeta(range),
            department: req.query.department ? normalizeTextFilter(req.query.department, 80) : null,
            access_level_filter: accessLevel.value,
            department_scopes: scope.appliedScopes,
            machines: result.rows
        });
    } catch (err) {
        const status = reportErrorStatus(err);
        return res.status(status).json({ error: err.message });
    }
});

router.get('/departments', async (req, res) => {
    try {
        const range = await getReportRange(req);
        const accessLevelFilter = normalizeAccessLevelFilter(req.query.access_level_id);
        const params = [range.from, range.to, range.timeZone];
        const whereClauses = ['e.active = true'];
        const scope = buildDepartmentScopeClause({
            user: req.user,
            requestedDepartment: req.query.department,
            params,
            column: departmentExpr('e.department')
        });
        const accessLevel = buildAccessLevelClause({
            filter: accessLevelFilter,
            params,
            column: 'e.access_level_id'
        });
        if (scope.sql) whereClauses.push(scope.sql.replace(/^ AND /, ''));
        if (accessLevel.sql) whereClauses.push(accessLevel.sql.replace(/^ AND /, ''));
        params.push(req.user.tenant_id);
        const tenantIdIdx = params.length;
        const result = await req.db.query(
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
               AND t.tenant_id = $${tenantIdIdx}
               AND ${buildBusinessDateRangeSql('t.tapped_at', 1, 2, 3)}
             WHERE ${whereClauses.join(' AND ')}
               AND e.tenant_id = $${tenantIdIdx}
             GROUP BY COALESCE(NULLIF(TRIM(e.department), ''), 'Sin área')
             ORDER BY spent_cents DESC, taps_count DESC, department`,
            params
        );
        return res.json({
            ...reportMeta(range),
            department: req.query.department ? normalizeTextFilter(req.query.department, 80) : null,
            access_level_filter: accessLevel.value,
            department_scopes: scope.appliedScopes,
            departments: result.rows
        });
    } catch (err) {
        const status = reportErrorStatus(err);
        return res.status(status).json({ error: err.message });
    }
});

router.get('/recent-taps', async (req, res) => {
    try {
        const range = await getReportRange(req);
        const limit = normalizeLimit(req.query.limit, 30, 100);
        const machineId = parseInt(req.query.machine_id, 10);
        const employeeId = parseInt(req.query.employee_id, 10);
        const accessLevelFilter = normalizeAccessLevelFilter(req.query.access_level_id);

        const clauses = [buildBusinessDateRangeSql('t.tapped_at', 1, 2, 3)];
        const params = [range.from, range.to, range.timeZone];
        const scope = buildDepartmentScopeClause({
            user: req.user,
            requestedDepartment: req.query.department,
            params,
            column: departmentExpr('e.department')
        });
        const accessLevel = buildAccessLevelClause({
            filter: accessLevelFilter,
            params,
            column: 'e.access_level_id'
        });
        if (scope.sql) clauses.push(scope.sql.replace(/^ AND /, ''));
        if (accessLevel.sql) clauses.push(accessLevel.sql.replace(/^ AND /, ''));

        if (Number.isInteger(machineId)) {
            params.push(machineId);
            clauses.push(`t.machine_id = $${params.length}`);
        }
        if (Number.isInteger(employeeId)) {
            params.push(employeeId);
            clauses.push(`t.employee_id = $${params.length}`);
        }

        // ═══════════════════════════════════════════════════════
        //  Los índices se capturan en variables inmediatamente
        //  después de cada push() y se usan explícitamente en el
        //  template literal. NO se lee params.length dentro del
        //  SQL porque el template se evalúa una sola vez: dos
        //  lecturas de params.length darían el mismo valor,
        //  haciendo que dos placeholders $N apunten al mismo
        //  parámetro — bug de indexado cross-tenant.
        // ═══════════════════════════════════════════════════════
        params.push(req.user.tenant_id);
        const tenantIdIdx = params.length;
        params.push(limit);
        const limitIdx = params.length;

        const result = await req.db.query(
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
                e.access_level_id,
                al.name AS access_level_name,
                m.name AS machine_name,
                m.location
             FROM taps t
             LEFT JOIN employees e ON e.id = t.employee_id AND e.tenant_id = $${tenantIdIdx}
             LEFT JOIN access_levels al ON al.id = e.access_level_id AND al.tenant_id = $${tenantIdIdx}
             JOIN machines m ON m.id = t.machine_id AND m.tenant_id = $${tenantIdIdx}
             WHERE ${clauses.join(' AND ')}
               AND t.tenant_id = $${tenantIdIdx}
             ORDER BY t.tapped_at DESC
             LIMIT $${limitIdx}`,
            params
        );

        return res.json({
            ...reportMeta(range),
            department: req.query.department ? normalizeTextFilter(req.query.department, 80) : null,
            access_level_filter: accessLevel.value,
            department_scopes: scope.appliedScopes,
            taps: result.rows
        });
    } catch (err) {
        const status = reportErrorStatus(err);
        return res.status(status).json({ error: err.message });
    }
});

router.get('/stock', requireManager, async (req, res) => {
    try {
        const range = await getReportRange(req);
        const params = [range.from, range.to, range.timeZone];
        const movementRangeSql = buildBusinessDateRangeSql('sm.created_at', 1, 2, 3);

        const itemsResult = await pool.query(
            `WITH movement_summary AS (
                SELECT
                    sm.stock_item_id,
                    COALESCE(SUM(CASE WHEN sm.movement_type = 'sale' THEN ABS(sm.quantity_delta) ELSE 0 END), 0) AS sales_units,
                    COALESCE(SUM(CASE WHEN sm.movement_type = 'restock' THEN GREATEST(sm.quantity_delta, 0) ELSE 0 END), 0) AS restocked_units,
                    COALESCE(SUM(CASE WHEN sm.movement_type = 'adjustment' THEN sm.quantity_delta ELSE 0 END), 0) AS adjustment_delta,
                    MAX(sm.created_at) AS last_movement_at,
                    MAX(sm.created_at) FILTER (WHERE sm.movement_type = 'sale') AS last_sale_at,
                    MAX(sm.created_at) FILTER (WHERE sm.movement_type = 'restock') AS last_restock_at
                FROM stock_movements sm
                WHERE ${movementRangeSql}
                  AND sm.stock_item_id IS NOT NULL
                GROUP BY sm.stock_item_id
            )
            SELECT
                si.id,
                si.machine_id,
                si.item_id,
                si.product_name,
                si.slot_label,
                si.capacity_units,
                si.current_units,
                si.min_units,
                si.active,
                si.updated_at,
                m.name AS machine_name,
                m.location,
                ms.sales_units,
                ms.restocked_units,
                ms.adjustment_delta,
                ms.last_movement_at,
                ms.last_sale_at,
                ms.last_restock_at
             FROM machine_stock_items si
             JOIN machines m ON m.id = si.machine_id
             LEFT JOIN movement_summary ms ON ms.stock_item_id = si.id
             WHERE m.active = true
             ORDER BY
                CASE
                    WHEN si.active = false THEN 3
                    WHEN si.current_units <= 0 THEN 0
                    WHEN si.current_units <= si.min_units THEN 1
                    ELSE 2
                END,
                si.current_units ASC,
                m.name ASC,
                si.item_id ASC`,
            params
        );

        const movementSummaryResult = await pool.query(
            `SELECT
                COALESCE(SUM(CASE WHEN movement_type = 'sale' THEN ABS(quantity_delta) ELSE 0 END), 0) AS sales_units,
                COALESCE(SUM(CASE WHEN movement_type = 'restock' THEN GREATEST(quantity_delta, 0) ELSE 0 END), 0) AS restocked_units,
                COALESCE(SUM(CASE WHEN movement_type = 'adjustment' THEN quantity_delta ELSE 0 END), 0) AS adjustment_delta,
                COALESCE(SUM(CASE WHEN movement_type = 'unconfigured_sale' THEN ABS(quantity_delta) ELSE 0 END), 0) AS unconfigured_sales,
                COUNT(*) AS total_movements,
                MAX(created_at) AS last_movement_at
             FROM stock_movements
             WHERE ${buildBusinessDateRangeSql('created_at', 1, 2, 3)}`,
            params
        );

        const recentMovementsResult = await pool.query(
            `SELECT
                sm.id,
                sm.machine_id,
                sm.stock_item_id,
                sm.item_id,
                sm.movement_type,
                sm.quantity_delta,
                sm.previous_units,
                sm.current_units,
                sm.note,
                sm.created_at,
                m.name AS machine_name,
                m.location,
                au.username AS actor_username,
                COALESCE(si.product_name, CONCAT('Selección ', sm.item_id::text)) AS product_name,
                si.slot_label
             FROM stock_movements sm
             JOIN machines m ON m.id = sm.machine_id
             LEFT JOIN machine_stock_items si ON si.id = sm.stock_item_id
             LEFT JOIN admin_users au ON au.id = sm.actor_user_id
             WHERE ${buildBusinessDateRangeSql('sm.created_at', 1, 2, 3)}
             ORDER BY sm.created_at DESC, sm.id DESC
             LIMIT 40`,
            params
        );

        const items = itemsResult.rows.map(serializeStockReportItem);
        const summary = buildStockReportSummary(items, movementSummaryResult.rows[0]);
        return res.json({
            ...reportMeta(range),
            summary,
            critical_items: items.filter(item => item.status === 'empty' || item.status === 'low').slice(0, 12),
            items,
            recent_movements: recentMovementsResult.rows.map(serializeStockReportMovement)
        });
    } catch (err) {
        const status = reportErrorStatus(err);
        return res.status(status).json({ error: err.message });
    }
});

module.exports = router;
