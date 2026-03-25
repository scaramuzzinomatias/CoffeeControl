// src/routes/auth.js
const express = require('express');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const pool    = require('../db/pool');
const audit = require('../services/audit');

const router  = express.Router();
const SECRET  = process.env.JWT_SECRET || 'cc-dev-secret-change-in-prod';

// POST /api/auth/login
router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password)
        return res.status(400).json({ error: 'Usuario y contraseña requeridos' });

    try {
        const result = await pool.query(
            'SELECT * FROM admin_users WHERE username = $1 AND active = true',
            [username.trim().toLowerCase()]
        );

        if (result.rowCount === 0)
            return res.status(401).json({ error: 'Credenciales incorrectas' });

        const user = result.rows[0];
        const valid = await bcrypt.compare(password, user.password_hash);

        if (!valid)
            return res.status(401).json({ error: 'Credenciales incorrectas' });

        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role },
            SECRET,
            { expiresIn: '8h' }
        );

        res.json({ token, username: user.username, role: user.role });

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
        const result = await pool.query(
            'SELECT password_hash FROM admin_users WHERE id = $1',
            [req.user.id]
        );

        const valid = await bcrypt.compare(current_password, result.rows[0].password_hash);
        if (!valid) return res.status(401).json({ error: 'Contraseña actual incorrecta' });

        const hash = await bcrypt.hash(new_password, 10);
        await pool.query('UPDATE admin_users SET password_hash = $1 WHERE id = $2', [hash, req.user.id]);
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
