const express = require('express');
const audit = require('../services/audit');
const { beginTenantTransaction } = require('../middleware/tenantTransaction');
const {
    canUseMobileAuth,
    getActiveAdminUserByUsername,
    verifyAdminPassword,
    createMobileSession,
    rotateMobileSession,
    revokeMobileSession
} = require('../lib/authTokens');

const router = express.Router();

router.post('/login', async (req, res) => {
    const { username, password, device_name, platform } = req.body || {};
    if (!username || !password) {
        return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
    }

    try {
        const tenantId = Number(req.tenant_id);
        if (!Number.isInteger(tenantId) || tenantId < 1) {
            return res.status(400).json({ error: 'Tenant no resuelto' });
        }
        const user = await getActiveAdminUserByUsername(username, tenantId);
        if (!user) return res.status(401).json({ error: 'Credenciales incorrectas' });

        const valid = await verifyAdminPassword(user, password);
        if (!valid) return res.status(401).json({ error: 'Credenciales incorrectas' });

        if (!canUseMobileAuth(user.role)) {
            return res.status(403).json({ error: 'Este rol no tiene acceso móvil habilitado' });
        }

        await beginTenantTransaction(req, res, user.tenant_id);
        const session = await createMobileSession({
            user,
            deviceName: device_name,
            platform,
            userAgent: req.headers['user-agent'] || null,
            client: req.db
        });

        await audit.logAuditEvent({
            req: Object.assign(Object.create(req), {
                user: {
                    id: user.id,
                    username: user.username,
                    role: user.role,
                    tenant_id: user.tenant_id
                }
            }),
            action: 'mobile_auth.login',
            entityType: 'mobile_session',
            entityId: session.session.id,
            entityLabel: session.user.username,
            summary: `Inició sesión móvil ${session.user.username}`,
            details: {
                platform: session.session.platform,
                device_name: session.session.device_name,
                expires_at: session.session.expires_at
            }
        });

        res.json(session);
    } catch (err) {
        console.error('[MOBILE AUTH] login error:', err.message);
        res.status(500).json({ error: 'Error interno' });
    }
});

router.post('/refresh', async (req, res) => {
    const { refresh_token } = req.body || {};
    if (!refresh_token) {
        return res.status(400).json({ error: 'refresh_token requerido' });
    }

    try {
        await beginTenantTransaction(req, res, req.tenant_id);
        const session = await rotateMobileSession(refresh_token, req.tenant_id, req.db);
        if (!session) {
            return res.status(401).json({ error: 'Sesión móvil inválida o expirada' });
        }
        res.json(session);
    } catch (err) {
        console.error('[MOBILE AUTH] refresh error:', err.message);
        res.status(500).json({ error: 'Error interno' });
    }
});

router.post('/logout', async (req, res) => {
    const { refresh_token } = req.body || {};
    if (!refresh_token) {
        return res.status(400).json({ error: 'refresh_token requerido' });
    }

    try {
        const session = await revokeMobileSession(refresh_token, req.tenant_id);
        if (!session) {
            return res.status(404).json({ error: 'Sesión móvil no encontrada o ya cerrada' });
        }
        res.json({ ok: true });
    } catch (err) {
        console.error('[MOBILE AUTH] logout error:', err.message);
        res.status(500).json({ error: 'Error interno' });
    }
});

module.exports = router;
