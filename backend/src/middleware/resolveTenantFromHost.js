// src/middleware/resolveTenantFromHost.js
//
// Resuelve req.tenant_id a partir del header Host (subdominio → slug).
// Usa bootstrapPool porque corre antes de que exista contexto de tenant.
//
// En producción con proxy Nginx, el header original llega por
// X-Forwarded-Host. Este middleware respeta ese header si está presente.

const bootstrapPool = require('../db/bootstrapPool');

async function resolveTenantFromHost(req, res, next) {
    const host = req.headers['x-forwarded-host'] || req.headers['host'];
    if (!host) {
        return res.status(400).json({ error: 'Host header requerido' });
    }

    const slug = host.split('.')[0].toLowerCase();
    if (!slug) {
        return res.status(400).json({ error: 'Host header inválido', host });
    }

    try {
        const result = await bootstrapPool.query(
            'SELECT id, slug, active FROM tenants WHERE slug = $1 AND active = true',
            [slug]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Tenant no encontrado', slug });
        }

        req.tenant_id = result.rows[0].id;
        next();
    } catch (err) {
        console.error('[resolveTenant] Error:', err.message);
        res.status(500).json({ error: 'Error interno' });
    }
}

module.exports = resolveTenantFromHost;
