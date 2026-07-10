const jwt = require('jsonwebtoken');
const { isMobileSessionActive } = require('../lib/authTokens');
const { beginTenantTransaction } = require('./tenantTransaction');
const SECRET = process.env.JWT_SECRET || 'cc-dev-secret-change-in-prod';

module.exports = async function authJwt(req, res, next) {
    const header = req.headers['authorization'];
    const token = header && header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Token requerido' });

    try {
        req.user = jwt.verify(token, SECRET);

        const tenantId = req.user.tenant_id;
        if (!tenantId) {
            return res.status(401).json({ error: 'Token sin contexto de tenant' });
        }

        await beginTenantTransaction(req, res, tenantId);

        if (req.user?.auth_kind === 'mobile' && req.user?.mobile_session_id) {
            const active = await isMobileSessionActive(
                req.user.mobile_session_id,
                req.user.id,
                req.db
            );
            if (!active) {
                return res.status(401).json({ error: 'Sesión móvil inválida o cerrada' });
            }
        }

        next();
    } catch (err) {
        if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token inválido o expirado' });
        }
        console.error('[authJwt] Error:', err.message);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Error interno' });
        }
    }
};
