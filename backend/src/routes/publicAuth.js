// src/routes/publicAuth.js
//
// Rutas de autenticación que NO dependen de que el tenant ya esté resuelto.
// Se usan desde la pantalla de login, antes de saber a qué empresa
// pertenece el usuario.
const express = require('express');
const bootstrapPool = require('../db/bootstrapPool');
const { tenantCheckLimiter } = require('../middleware/rateLimiters');

const router = express.Router();

// GET /api/auth/tenant-check?slug=xxx
// Devuelve si un slug de empresa existe y está activo, sin exponer el
// listado completo de tenants.
router.get('/tenant-check', tenantCheckLimiter, async (req, res) => {
    const raw = req.query.slug;
    if (!raw || typeof raw !== 'string') {
        return res.status(400).json({ error: 'slug requerido' });
    }
    const slug = raw.trim().toLowerCase();
    if (!slug) {
        return res.status(400).json({ error: 'slug requerido' });
    }
    try {
        const result = await bootstrapPool.query(
            'SELECT name FROM tenants WHERE slug = $1 AND active = true',
            [slug]
        );
        if (result.rowCount === 0) {
            return res.json({ valid: false });
        }
        res.json({ valid: true, name: result.rows[0].name });
    } catch (err) {
        console.error('[publicAuth] tenant-check error:', err.message);
        res.status(500).json({ error: 'Error interno' });
    }
});

module.exports = router;
