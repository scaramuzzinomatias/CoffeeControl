const pool = require('../db/pool');

const MANAGER_ROLES = new Set(['admin', 'gerente']);
const TECHNICAL_ROLES = new Set(['tecnico', 'distribuidor']);
const MACHINE_SETUP_ROLES = new Set(['admin', 'gerente', 'distribuidor']);
const ANALYTICS_ROLES = new Set(['admin', 'gerente', 'supervisor']);

function isManagerRole(role) {
    return MANAGER_ROLES.has(role);
}

function isTechnicalRole(role) {
    return TECHNICAL_ROLES.has(role);
}

function canManageMachineSetup(role) {
    return MACHINE_SETUP_ROLES.has(role);
}

function canOperateMachines(role) {
    return isManagerRole(role) || isTechnicalRole(role);
}

function canViewAnalytics(role) {
    return ANALYTICS_ROLES.has(role);
}

function normalizeDepartmentName(value) {
    return String(value || '').trim().slice(0, 60);
}

function normalizeDepartmentList(values) {
    const rawValues = Array.isArray(values)
        ? values
        : (values === null || values === undefined
            ? []
            : String(values).split(/[\n,;]+/));

    const seen = new Set();
    const items = [];
    for (const value of rawValues) {
        const normalized = normalizeDepartmentName(value);
        if (!normalized) continue;
        const key = normalized.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        items.push(normalized);
    }
    return items;
}

function departmentsEqual(a, b) {
    return normalizeDepartmentName(a).toLowerCase() === normalizeDepartmentName(b).toLowerCase();
}

async function getUserDepartmentScopes(userId, fallbackDepartment = null) {
    const result = await pool.query(
        `SELECT department
         FROM admin_user_departments
         WHERE admin_user_id = $1
         ORDER BY LOWER(department), department`,
        [userId]
    );
    const scopes = normalizeDepartmentList(result.rows.map(row => row.department));
    if (scopes.length) return scopes;
    return normalizeDepartmentList(fallbackDepartment ? [fallbackDepartment] : []);
}

function buildDepartmentScopeClause({ user, requestedDepartment, params, column }) {
    const requested = normalizeDepartmentName(requestedDepartment);
    const scopes = normalizeDepartmentList(user?.department_scopes || []);

    if (isManagerRole(user?.role)) {
        if (!requested) return { sql: '', appliedScopes: [] };
        params.push(requested);
        return {
            sql: ` AND ${column} = $${params.length}`,
            appliedScopes: [requested]
        };
    }

    if (user?.role !== 'supervisor') {
        const err = new Error('Este rol no puede consultar datos por área');
        err.status = 403;
        throw err;
    }

    if (!scopes.length) {
        if (!requested) return { sql: '', appliedScopes: [] };
        params.push(requested);
        return {
            sql: ` AND ${column} = $${params.length}`,
            appliedScopes: [requested]
        };
    }

    if (requested) {
        if (!scopes.some(scope => departmentsEqual(scope, requested))) {
            const err = new Error('Área fuera de alcance para este supervisor');
            err.status = 403;
            throw err;
        }
        params.push(requested);
        return {
            sql: ` AND ${column} = $${params.length}`,
            appliedScopes: [requested]
        };
    }

    params.push(scopes);
    return {
        sql: ` AND ${column} = ANY($${params.length}::text[])`,
        appliedScopes: scopes
    };
}

module.exports = {
    isManagerRole,
    isTechnicalRole,
    canManageMachineSetup,
    canOperateMachines,
    canViewAnalytics,
    normalizeDepartmentName,
    normalizeDepartmentList,
    departmentsEqual,
    getUserDepartmentScopes,
    buildDepartmentScopeClause
};
