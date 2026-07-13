// src/routes/auth.js
const express = require('express');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const pool    = require('../db/pool');
const bootstrapPool = require('../db/bootstrapPool');
const audit = require('../services/audit');
const { getUserDepartmentScopes } = require('../lib/accessScope');
const { beginTenantTransaction } = require('../middleware/tenantTransaction');

const router  = express.Router();
const SECRET  = process.env.JWT_SECRET || 'cc-dev-secret-change-in-prod';

// POST /api/auth/login
router.post('/login', require('../middleware/rateLimiters').loginLimiter, async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password)
        return res.status(400).json({ error: 'Usuario y contraseña requeridos' });

    try {
        const tenantId = Number(req.tenant_id);
        if (!Number.isInteger(tenantId) || tenantId < 1) {
            return res.status(400).json({ error: 'Tenant no resuelto' });
        }
        const result = await bootstrapPool.query(
            `SELECT id, username, password_hash, role, department,
                    is_protected, active, tenant_id
             FROM admin_users
             WHERE username = $1
               AND tenant_id = $2
               AND active = true`,
            [username.trim().toLowerCase(), tenantId]
        );

        if (result.rowCount === 0)
            return res.status(401).json({ error: 'Credenciales incorrectas' });

        const user = result.rows[0];
        const valid = await bcrypt.compare(password, user.password_hash);

        if (!valid)
            return res.status(401).json({ error: 'Credenciales incorrectas' });

        await beginTenantTransaction(req, res, user.tenant_id);
        const departmentScopes = await getUserDepartmentScopes(user.id, user.tenant_id, user.department, req.db);
        const token = jwt.sign(
            {
                id: user.id,
                tenant_id: user.tenant_id,
                username: user.username,
                role: user.role,
                is_protected: Boolean(user.is_protected),
                department: user.department || null,
                department_scopes: departmentScopes
            },
            SECRET,
            { expiresIn: '8h' }
        );

        res.json({
            token,
            username: user.username,
            role: user.role,
            is_protected: Boolean(user.is_protected),
            department: user.department || null,
            department_scopes: departmentScopes
        });

    } catch (err) {
        console.error('[AUTH] Error:', err.message);
        res.status(500).json({ error: 'Error interno' });
    }
});

// POST /api/auth/change-password
router.post('/change-password', require('../middleware/authJwt'), async (req, res) => {
    const { current_password, new_password } = req.body;

    if (!new_password || new_password.length < 8)
        return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 8 caracteres' });

    try {
        const result = await req.db.query(
            'SELECT username, password_hash, is_protected FROM admin_users WHERE id = $1',
            [req.user.id]
        );

        if (result.rowCount === 0)
            return res.status(404).json({ error: 'Usuario no encontrado' });

        if (result.rows[0].is_protected) {
            await audit.logAuditEvent({
                req,
                action: 'auth.change_password_denied',
                entityType: 'admin_user',
                entityId: req.user.id,
                entityLabel: result.rows[0].username,
                summary: `Intentó cambiar la contraseña de la cuenta protegida ${result.rows[0].username}`
            });
            return res.status(403).json({ error: 'La cuenta protegida solo puede cambiar su contraseña desde soporte local' });
        }

        const valid = await bcrypt.compare(current_password, result.rows[0].password_hash);
        if (!valid) return res.status(401).json({ error: 'Contraseña actual incorrecta' });

        const hash = await bcrypt.hash(new_password, 10);
        await req.db.query('UPDATE admin_users SET password_hash = $1 WHERE id = $2', [hash, req.user.id]);
        await audit.logAuditEvent({
            req,
            action: 'auth.change_password',
            entityType: 'admin_user',
            entityId: req.user.id,
            entityLabel: req.user.username,
            summary: `Cambió su contraseña (${req.user.username})`
        });

        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: 'Error interno' });
    }
});

module.exports = router;
