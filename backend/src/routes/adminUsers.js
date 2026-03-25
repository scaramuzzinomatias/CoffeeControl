// src/routes/adminUsers.js
// Gestión de usuarios del panel (solo accesible por gerente)

const express = require('express');
const bcrypt  = require('bcryptjs');
const pool    = require('../db/pool');
const audit = require('../services/audit');

const router  = express.Router();

function normalizeOptionalString(value) {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed || null;
}

// Middleware: solo gerente puede gestionar usuarios
function onlyGerente(req, res, next) {
    if (req.user.role !== 'gerente' && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Solo el gerente puede gestionar usuarios' });
    }
    next();
}

// GET /api/admin-users
router.get('/', onlyGerente, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, username, full_name, email, role, department, active, created_at
             FROM admin_users ORDER BY role, username`
        );
        res.json({ users: result.rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/admin-users — crear usuario
router.post('/', onlyGerente, async (req, res) => {
    const { username, password, role, full_name, department, email } = req.body;

    if (!username || !password)
        return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
    if (!['gerente', 'supervisor', 'admin'].includes(role))
        return res.status(400).json({ error: 'Rol inválido' });
    if (password.length < 8)
        return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });

    try {
        const hash = await bcrypt.hash(password, 10);
        const result = await pool.query(
            `INSERT INTO admin_users (username, password_hash, role, full_name, department, email)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING id, username, full_name, email, role, department, active`,
            [
                username.trim().toLowerCase(),
                hash,
                role,
                normalizeOptionalString(full_name),
                normalizeOptionalString(department),
                normalizeOptionalString(email)
            ]
        );
        await audit.logAuditEvent({
            req,
            action: 'admin_user.create',
            entityType: 'admin_user',
            entityId: result.rows[0].id,
            entityLabel: result.rows[0].username,
            summary: `Creó el usuario ${result.rows[0].username}`,
            details: {
                role: result.rows[0].role,
                department: result.rows[0].department,
                email: result.rows[0].email,
                active: result.rows[0].active
            }
        });
        res.status(201).json({ user: result.rows[0] });
    } catch (err) {
        if (err.code === '23505')
            return res.status(409).json({ error: 'El nombre de usuario ya existe' });
        res.status(500).json({ error: err.message });
    }
});

// PATCH /api/admin-users/:id — editar
router.patch('/:id', onlyGerente, async (req, res) => {
    const { full_name, role, department, email, active, password } = req.body;

    // No permitir cambiar el propio rol
    if (parseInt(req.params.id) === req.user.id && role && role !== req.user.role)
        return res.status(400).json({ error: 'No podés cambiar tu propio rol' });

    try {
        const before = await pool.query(
            `SELECT id, username, full_name, email, role, department, active
             FROM admin_users
             WHERE id = $1`,
            [req.params.id]
        );
        if (before.rowCount === 0)
            return res.status(404).json({ error: 'Usuario no encontrado' });
        let hashUpdate = '';
        const params = [
            normalizeOptionalString(full_name),
            role || null,
            normalizeOptionalString(department),
            normalizeOptionalString(email),
            active,
            req.params.id
        ];

        if (password) {
            if (password.length < 8)
                return res.status(400).json({ error: 'Contraseña mínima 8 caracteres' });
            const hash = await bcrypt.hash(password, 10);
            hashUpdate = ', password_hash = $7';
            params.push(hash);
        }

        const result = await pool.query(
            `UPDATE admin_users SET
                full_name  = COALESCE($1, full_name),
                role       = COALESCE($2, role),
                department = COALESCE($3, department),
                email      = COALESCE($4, email),
                active     = COALESCE($5, active)
                ${hashUpdate}
             WHERE id = $6
             RETURNING id, username, full_name, email, role, department, active`,
            params
        );
        await audit.logAuditEvent({
            req,
            action: result.rows[0].active === false && before.rows[0].active !== false
                ? 'admin_user.deactivate'
                : 'admin_user.update',
            entityType: 'admin_user',
            entityId: result.rows[0].id,
            entityLabel: result.rows[0].username,
            summary: result.rows[0].active === false && before.rows[0].active !== false
                ? `Desactivó el usuario ${result.rows[0].username}`
                : `Actualizó el usuario ${result.rows[0].username}`,
            details: {
                before: before.rows[0],
                after: result.rows[0],
                password_changed: Boolean(password)
            }
        });
        res.json({ user: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/admin-users/:id — desactivar
router.delete('/:id', onlyGerente, async (req, res) => {
    if (parseInt(req.params.id) === req.user.id)
        return res.status(400).json({ error: 'No podés eliminar tu propia cuenta' });
    try {
        const result = await pool.query(
            `UPDATE admin_users
             SET active=false
             WHERE id=$1
             RETURNING id, username, role, department, email`,
            [req.params.id]
        );
        if (result.rowCount === 0)
            return res.status(404).json({ error: 'Usuario no encontrado' });
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
