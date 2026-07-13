// src/routes/tenants.js
const express = require('express');
const bootstrapPool = require('../db/bootstrapPool');

const router = express.Router();

const SLUG_RE = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/;

function validateSlug(slug) {
    if (typeof slug !== 'string') return false;
    const trimmed = slug.trim().toLowerCase();
    if (trimmed.length < 2 || trimmed.length > 60) return false;
    if (!SLUG_RE.test(trimmed)) return false;
    return trimmed;
}

// GET / — listar tenants
router.get('/', async (req, res) => {
    try {
        const result = await bootstrapPool.query(
            `SELECT id, slug, name, active, created_at
             FROM tenants
             ORDER BY created_at DESC`
        );
        res.json({ tenants: result.rows });
    } catch (err) {
        console.error('[tenants] GET / error:', err.message);
        res.status(500).json({ error: 'Error interno' });
    }
});

// POST / — crear tenant
router.post('/', async (req, res) => {
    const { name, slug } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ error: 'Nombre de empresa requerido' });
    }
    if (!slug) {
        return res.status(400).json({ error: 'Slug requerido' });
    }

    const validatedSlug = validateSlug(slug);
    if (!validatedSlug) {
        return res.status(400).json({
            error: 'Slug inválido: solo minúsculas, números y guiones (sin espacios, sin guiones al inicio/fin)'
        });
    }

    try {
        const duplicate = await bootstrapPool.query(
            'SELECT id FROM tenants WHERE slug = $1',
            [validatedSlug]
        );
        if (duplicate.rowCount > 0) {
            return res.status(409).json({ error: 'El slug ya está en uso' });
        }

        const result = await bootstrapPool.query(
            `INSERT INTO tenants (slug, name, active)
             VALUES ($1, $2, true)
             RETURNING id, slug, name, active, created_at`,
            [validatedSlug, name.trim()]
        );

        res.status(201).json({ tenant: result.rows[0] });
    } catch (err) {
        console.error('[tenants] POST / error:', err.message);
        if (err.code === '23505') {
            return res.status(409).json({ error: 'El slug ya está en uso' });
        }
        res.status(500).json({ error: 'Error interno' });
    }
});

// PATCH /:id — actualizar tenant
router.patch('/:id', async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
        return res.status(400).json({ error: 'ID inválido' });
    }

    const allowedFields = ['name', 'slug', 'active'];
    const updates = [];
    const values = [];
    let index = 1;

    for (const field of allowedFields) {
        if (req.body[field] === undefined) continue;

        if (field === 'slug') {
            const validated = validateSlug(req.body[field]);
            if (!validated) {
                return res.status(400).json({
                    error: 'Slug inválido: solo minúsculas, números y guiones (sin espacios, sin guiones al inicio/fin)'
                });
            }
            updates.push(`slug = $${index++}`);
            values.push(validated);
        } else if (field === 'name') {
            if (typeof req.body[field] !== 'string' || !req.body[field].trim()) {
                return res.status(400).json({ error: 'Nombre inválido' });
            }
            updates.push(`name = $${index++}`);
            values.push(req.body[field].trim());
        } else if (field === 'active') {
            if (typeof req.body[field] !== 'boolean') {
                return res.status(400).json({ error: 'active debe ser booleano' });
            }
            updates.push(`active = $${index++}`);
            values.push(req.body[field]);
        }
    }

    if (updates.length === 0) {
        return res.status(400).json({ error: 'No hay campos válidos para actualizar' });
    }

    try {
        values.push(id);
        const result = await bootstrapPool.query(
            `UPDATE tenants SET ${updates.join(', ')}
             WHERE id = $${index}
             RETURNING id, slug, name, active, created_at`,
            values
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Tenant no encontrado' });
        }

        res.json({ tenant: result.rows[0] });
    } catch (err) {
        console.error('[tenants] PATCH /:id error:', err.message);
        if (err.code === '23505') {
            return res.status(409).json({ error: 'El slug ya está en uso' });
        }
        res.status(500).json({ error: 'Error interno' });
    }
});

// DELETE /:id — soft delete (desactivar)
router.delete('/:id', async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
        return res.status(400).json({ error: 'ID inválido' });
    }

    try {
        const result = await bootstrapPool.query(
            `UPDATE tenants SET active = false
             WHERE id = $1 AND active = true
             RETURNING id, slug, name, active`,
            [id]
        );

        if (result.rowCount === 0) {
            const exists = await bootstrapPool.query(
                'SELECT id, active FROM tenants WHERE id = $1',
                [id]
            );
            if (exists.rowCount === 0) {
                return res.status(404).json({ error: 'Tenant no encontrado' });
            }
            return res.status(409).json({ error: 'El tenant ya está desactivado' });
        }

        res.json({ ok: true, tenant: result.rows[0] });
    } catch (err) {
        console.error('[tenants] DELETE /:id error:', err.message);
        res.status(500).json({ error: 'Error interno' });
    }
});

module.exports = router;
