const express = require('express');
const pool = require('../db/pool');
const systemSettings = require('../services/systemSettings');
const { buildDepartmentScopeClause } = require('../lib/accessScope');
const { requireAnalyticsViewer } = require('../middleware/roleAccess');

const router = express.Router();
router.use(requireAnalyticsViewer);

function departmentExpr(column) {
    return `COALESCE(NULLIF(TRIM(${column}), ''), 'Sin área')`;
}

function normalizeLimit(value, fallback = 40, max = 100) {
    const parsed = parseInt(value, 10);
    if (!Number.isInteger(parsed) || parsed < 1) return fallback;
    return Math.min(parsed, max);
}

function normalizeTextFilter(value, max = 80) {
    return String(value || '').trim().slice(0, max);
}

function alertTypeMeta(type, payload) {
    const emptyStock = payload?.status === 'empty' || payload?.status_key === 'empty';
    switch (type) {
        case 'employee_limit_warning':
            return { label: 'Advertencia de límite', severity: 'warn' };
        case 'employee_daily_blocked':
            return { label: 'Empleado bloqueado', severity: 'danger' };
        case 'machine_offline':
            return { label: 'Máquina offline', severity: 'danger' };
        case 'machine_backend_down':
            return { label: 'Backend sin respuesta', severity: 'warn' };
        case 'stock_low':
            return { label: emptyStock ? 'Sin stock' : 'Stock bajo', severity: emptyStock ? 'danger' : 'warn' };
        default:
            return { label: type || 'Alerta', severity: 'warn' };
    }
}

function compactParts(parts) {
    return parts.map(value => String(value || '').trim()).filter(Boolean);
}

function buildAlertPresentation(row) {
    const payload = row.payload && typeof row.payload === 'object' ? row.payload : {};
    const meta = alertTypeMeta(row.alert_type, payload);
    const machineLabel = compactParts([row.machine_name, row.machine_location]).join(' · ');
    const employeeLabel = compactParts([row.employee_name, row.employee_department]).join(' · ');

    let message = '';
    let highlight = '';

    switch (row.alert_type) {
        case 'employee_limit_warning':
            message = employeeLabel || 'Un empleado está cerca de su límite diario.';
            highlight = payload?.progress_label || payload?.daily_limit
                ? `Consumo ${payload?.taps_today ?? '?'} / ${payload?.daily_limit ?? '?'}`
                : '';
            break;
        case 'employee_daily_blocked':
            message = employeeLabel || 'Un empleado fue bloqueado por límite diario.';
            highlight = payload?.deny_reason === 'limit_reached'
                ? 'No puede seguir consumiendo hoy'
                : 'Límite diario alcanzado';
            break;
        case 'machine_offline':
            message = machineLabel || 'Una máquina dejó de reportar al backend.';
            highlight = 'No reporta telemetría reciente';
            break;
        case 'machine_backend_down':
            message = machineLabel || 'Una máquina reporta backend sin respuesta.';
            highlight = payload?.backend_error || 'La máquina está online, pero el backend no respondió';
            break;
        case 'stock_low': {
            const productLabel = compactParts([payload?.product_name, payload?.slot_label]).join(' · ');
            message = compactParts([machineLabel, productLabel]).join(' · ') || 'Una selección quedó en estado crítico.';
            const units = compactParts([
                Number.isInteger(payload?.current_units) ? `Quedan ${payload.current_units}` : '',
                Number.isInteger(payload?.min_units) ? `mínimo ${payload.min_units}` : ''
            ]).join(' · ');
            highlight = units || (payload?.status_label || meta.label);
            break;
        }
        default:
            message = machineLabel || employeeLabel || 'Hay una alerta operativa abierta.';
            highlight = '';
            break;
    }

    return {
        alert_key: row.alert_key,
        alert_type: row.alert_type,
        alert_type_label: meta.label,
        severity: meta.severity,
        title: meta.label,
        message,
        highlight,
        machine_id: row.machine_id ? Number(row.machine_id) : null,
        machine_name: row.machine_name || null,
        machine_location: row.machine_location || null,
        machine_last_seen: row.machine_last_seen || null,
        employee_id: row.employee_id ? Number(row.employee_id) : null,
        employee_name: row.employee_name || null,
        employee_department: row.employee_department || null,
        first_seen_at: row.first_seen_at || null,
        last_seen_at: row.last_seen_at || null,
        last_notified_at: row.last_notified_at || null,
        payload
    };
}

function buildSummary(alerts) {
    const summary = {
        total_open: alerts.length,
        danger_count: 0,
        warn_count: 0,
        by_type: []
    };
    const byType = new Map();

    for (const alert of alerts) {
        if (alert.severity === 'danger') summary.danger_count += 1;
        if (alert.severity === 'warn') summary.warn_count += 1;

        const current = byType.get(alert.alert_type) || {
            alert_type: alert.alert_type,
            label: alert.alert_type_label,
            severity: alert.severity,
            count: 0
        };
        current.count += 1;
        if (alert.severity === 'danger') current.severity = 'danger';
        byType.set(alert.alert_type, current);
    }

    summary.by_type = [...byType.values()].sort((a, b) => {
        if (a.severity !== b.severity) return a.severity === 'danger' ? -1 : 1;
        return b.count - a.count;
    });
    return summary;
}

router.get('/active', async (req, res) => {
    try {
        const { timeZone } = await systemSettings.getBusinessTimeContext();
        const params = [];
        const scope = buildDepartmentScopeClause({
            user: req.user,
            requestedDepartment: req.query.department,
            params,
            column: departmentExpr('e.department')
        });
        const limit = normalizeLimit(req.query.limit);
        params.push(req.user.tenant_id);
        const tenantIdIdx = params.length;
        params.push(limit);

        const result = await req.db.query(
            `SELECT
                ae.alert_key,
                ae.alert_type,
                ae.machine_id,
                ae.employee_id,
                ae.first_seen_at,
                ae.last_seen_at,
                ae.last_notified_at,
                ae.payload,
                m.name AS machine_name,
                m.location AS machine_location,
                m.last_seen AS machine_last_seen,
                e.name AS employee_name,
                ${departmentExpr('e.department')} AS employee_department
             FROM alert_events ae
             LEFT JOIN machines m ON m.id = ae.machine_id AND m.tenant_id = $${tenantIdIdx}
             LEFT JOIN employees e ON e.id = ae.employee_id
              AND e.tenant_id = $${tenantIdIdx}
             WHERE ae.status = 'open'
               AND ae.tenant_id = $${tenantIdIdx}
               ${scope.sql}
             ORDER BY COALESCE(ae.last_notified_at, ae.last_seen_at, ae.first_seen_at) DESC, ae.alert_key
             LIMIT $${params.length}`,
            params
        );

        const alerts = result.rows.map(buildAlertPresentation);
        return res.json({
            business_timezone: timeZone,
            department: req.query.department ? normalizeTextFilter(req.query.department) : null,
            department_scopes: scope.appliedScopes,
            summary: buildSummary(alerts),
            alerts
        });
    } catch (err) {
        return res.status(err.status || 500).json({ error: err.status ? err.message : 'Error interno' });
    }
});

module.exports = router;
