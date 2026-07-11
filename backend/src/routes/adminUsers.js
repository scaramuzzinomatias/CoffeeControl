// src/routes/adminUsers.js
// Gestión de usuarios del panel (solo accesible por gerente)

const express = require('express');
const bcrypt  = require('bcryptjs');

const audit = require('../services/audit');
const { normalizeDepartmentList } = require('../lib/accessScope');

const router  = express.Router();

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

function legacyDepartmentFromScopes(scopes, fallbackDepartment = null) {
    const normalizedScopes = normalizeDepartmentList(scopes);
    if (normalizedScopes.length) return normalizedScopes[0];
    return normalizeOptionalString(fallbackDepartment);
}

async function syncUserDepartmentScopes(client, userId, scopes, tenantId) {
    const normalizedScopes = normalizeDepartmentList(scopes);
    await client.query(
        'DELETE FROM admin_user_departments WHERE admin_user_id = $1 AND tenant_id = $2',
        [userId, tenantId]
    );
    if (!normalizedScopes.length) return normalizedScopes;

    const values = [];
    const params = [];
    normalizedScopes.forEach((department, index) => {
        const base = index * 3;
        params.push(userId, department, tenantId);
        values.push(`($${base + 1}, $${base + 2}, $${base + 3})`);
    });

    await client.query(
        `INSERT INTO admin_user_departments (admin_user_id, department, tenant_id)
         VALUES ${values.join(', ')}`,
        params
    );
    return normalizedScopes;
}

function mapUserWithScopes(user, departmentScopes) {
    return {
        ...user,
        is_protected: Boolean(user?.is_protected),
        department_scopes: normalizeDepartmentList(
            Array.isArray(departmentScopes) && departmentScopes.length
                ? departmentScopes
                : (user?.department ? [user.department] : [])
        )
    };
}

async function rejectProtectedAccountMutation(req, res, targetUser, attemptedAction) {
    await audit.logAuditEvent({
        req,
        action: 'admin_user.protected_denied',
        entityType: 'admin_user',
        entityId: targetUser.id,
        entityLabel: targetUser.username,
        summary: `Intentó modificar la cuenta protegida ${targetUser.username}`,
        details: {
            attempted_action: attemptedAction,
            target_role: targetUser.role,
            is_protected: true
        }
    });
    return res.status(403).json({ error: 'La cuenta protegida solo puede modificarse desde soporte local' });
}

// Middleware: solo gerente/admin puede gestionar usuarios
function onlyGerente(req, res, next) {
    if (req.user.role !== 'gerente' && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Acceso solo para gerente/admin' });
    }
    next();
}

// GET /api/admin-users
router.get('/', onlyGerente, async (req, res) => {
    try {
        const result = await req.db.query(
            `SELECT au.id,
                    au.username,
                    au.full_name,
                    au.email,
                    au.role,
                    au.is_protected,
                    au.department,
                    au.active,
                    au.created_at,
                    COALESCE(
                        array_remove(array_agg(DISTINCT aud.department) FILTER (WHERE aud.department IS NOT NULL), NULL),
                        ARRAY[]::varchar[]
                    ) AS department_scopes
             FROM admin_users au
             LEFT JOIN admin_user_departments aud
               ON aud.admin_user_id = au.id
             WHERE au.tenant_id = $1
             GROUP BY au.id
             ORDER BY au.role, au.username`,
            [req.user.tenant_id]
        );
        res.json({ users: result.rows.map(row => mapUserWithScopes(row, row.department_scopes)) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/admin-users — crear usuario
router.post('/', onlyGerente, async (req, res) => {
    const { username, password, role, full_name, department, email, department_scopes } = req.body;

    if (!username || !password)
        return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
    if (Object.prototype.hasOwnProperty.call(req.body, 'is_protected'))
        return res.status(403).json({ error: 'Las cuentas protegidas solo pueden configurarse desde soporte local' });
    if (!['gerente', 'supervisor', 'admin', 'tecnico', 'distribuidor'].includes(role))
        return res.status(400).json({ error: 'Rol inválido' });
    if (password.length < 8)
        return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });

    const requestedScopes = role === 'supervisor'
        ? normalizeDepartmentList(
            Object.prototype.hasOwnProperty.call(req.body, 'department_scopes')
                ? department_scopes
                : department
        )
        : [];

    try {
        const hash = await bcrypt.hash(password, 10);
        const legacyDepartment = role === 'supervisor'
            ? legacyDepartmentFromScopes(requestedScopes, department)
            : normalizeOptionalString(department);
        const result = await req.db.query(
            `INSERT INTO admin_users (username, password_hash, role, full_name, department, email, tenant_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING id, username, full_name, email, role, is_protected, department, active`,
            [
                username.trim().toLowerCase(),
                hash,
                role,
                normalizeOptionalString(full_name),
                legacyDepartment,
                normalizeOptionalString(email),
                req.user.tenant_id
            ]
        );
        const scopes = await syncUserDepartmentScopes(req.db, result.rows[0].id, requestedScopes, req.user.tenant_id);
        const user = mapUserWithScopes(result.rows[0], scopes);
        await audit.logAuditEvent({
            req,
            action: 'admin_user.create',
            entityType: 'admin_user',
            entityId: user.id,
            entityLabel: user.username,
            summary: `Creó el usuario ${user.username}`,
            details: {
                role: user.role,
                department: user.department,
                department_scopes: user.department_scopes,
                email: user.email,
                active: user.active
            }
        });
        res.status(201).json({ user });
    } catch (err) {
        if (err.code === '23505')
            return res.status(409).json({ error: 'El nombre de usuario ya existe' });
        res.status(500).json({ error: err.message });
    }
});

// PATCH /api/admin-users/:id — editar
router.patch('/:id', onlyGerente, async (req, res) => {
    const { full_name, role, department, email, active, password, department_scopes } = req.body;

    // No permitir cambiar el propio rol
    if (parseInt(req.params.id) === req.user.id && role && role !== req.user.role)
        return res.status(400).json({ error: 'No podés cambiar tu propio rol' });

    try {
        const before = await req.db.query(
            `SELECT id, username, full_name, email, role, is_protected, department, active
             FROM admin_users
             WHERE id = $1 AND tenant_id = $2`,
            [req.params.id, req.user.tenant_id]
        );
        if (before.rowCount === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }
        const beforeScopesResult = await req.db.query(
            `SELECT department
             FROM admin_user_departments
             WHERE admin_user_id = $1 AND tenant_id = $2
             ORDER BY LOWER(department), department`,
            [req.params.id, req.user.tenant_id]
        );
        const beforeUser = mapUserWithScopes(
            before.rows[0],
            beforeScopesResult.rows.map(row => row.department)
        );

        if (beforeUser.is_protected) {
            return rejectProtectedAccountMutation(req, res, beforeUser, 'update');
        }

        const nextRole = role || beforeUser.role;
        if (!['gerente', 'supervisor', 'admin', 'tecnico', 'distribuidor'].includes(nextRole)) {
            return res.status(400).json({ error: 'Rol inválido' });
        }
        const scopesProvided = Object.prototype.hasOwnProperty.call(req.body, 'department_scopes');
        const nextScopes = nextRole === 'supervisor'
            ? normalizeDepartmentList(scopesProvided ? department_scopes : beforeUser.department_scopes)
            : [];
        const departmentProvided = Object.prototype.hasOwnProperty.call(req.body, 'department');
        const nextFullName = Object.prototype.hasOwnProperty.call(req.body, 'full_name')
            ? normalizeOptionalString(full_name)
            : beforeUser.full_name;
        const nextEmail = Object.prototype.hasOwnProperty.call(req.body, 'email')
            ? normalizeOptionalString(email)
            : beforeUser.email;
        const nextActive = Object.prototype.hasOwnProperty.call(req.body, 'active')
            ? (normalizeOptionalBoolean(active) ?? beforeUser.active)
            : beforeUser.active;
        const nextDepartment = nextRole === 'supervisor'
            ? legacyDepartmentFromScopes(
                nextScopes,
                departmentProvided ? department : beforeUser.department
            )
            : (departmentProvided ? normalizeOptionalString(department) : beforeUser.department);

        let hashUpdate = '';
        const params = [
            nextFullName,
            nextRole,
            nextDepartment,
            nextEmail,
            nextActive,
            req.params.id
        ];

        if (password) {
            if (password.length < 8)
                return res.status(400).json({ error: 'Contraseña mínima 8 caracteres' });
            const hash = await bcrypt.hash(password, 10);
            hashUpdate = ', password_hash = $7';
            params.push(hash);
        }

        params.push(req.user.tenant_id);
        const result = await req.db.query(
            `UPDATE admin_users SET
                full_name  = $1,
                role       = $2,
                department = $3,
                email      = $4,
                active     = $5
                ${hashUpdate}
              WHERE id = $6 AND tenant_id = $${params.length}
              RETURNING id, username, full_name, email, role, is_protected, department, active`,
            params
        );
        const scopes = await syncUserDepartmentScopes(req.db, result.rows[0].id, nextScopes, req.user.tenant_id);
        const user = mapUserWithScopes(result.rows[0], scopes);
        await audit.logAuditEvent({
            req,
            action: user.active === false && beforeUser.active !== false
                ? 'admin_user.deactivate'
                : 'admin_user.update',
            entityType: 'admin_user',
            entityId: user.id,
            entityLabel: user.username,
            summary: user.active === false && beforeUser.active !== false
                ? `Desactivó el usuario ${user.username}`
                : `Actualizó el usuario ${user.username}`,
            details: {
                before: beforeUser,
                after: user,
                password_changed: Boolean(password)
            }
        });
        res.json({ user });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/admin-users/:id — desactivar
router.delete('/:id', onlyGerente, async (req, res) => {
    if (parseInt(req.params.id) === req.user.id)
        return res.status(400).json({ error: 'No podés eliminar tu propia cuenta' });
    try {
        const before = await req.db.query(
            `SELECT id, username, role, is_protected, department, email, active
             FROM admin_users
             WHERE id = $1 AND tenant_id = $2`,
            [req.params.id, req.user.tenant_id]
        );
        if (before.rowCount === 0)
            return res.status(404).json({ error: 'Usuario no encontrado' });
        if (before.rows[0].is_protected)
            return rejectProtectedAccountMutation(req, res, before.rows[0], 'deactivate');

        const result = await req.db.query(
            `UPDATE admin_users
             SET active=false
             WHERE id=$1 AND tenant_id=$2
             RETURNING id, username, role, is_protected, department, email`,
            [req.params.id, req.user.tenant_id]
        );
        await audit.logAuditEvent({
            req,
            action: 'admin_user.deactivate',
            entityType: 'admin_user',
            entityId: result.rows[0].id,
            entityLabel: result.rows[0].username,
            summary: `Desactivó el usuario ${result.rows[0].username}`,
            details: result.rows[0]
        });
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
