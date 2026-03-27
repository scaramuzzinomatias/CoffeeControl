// src/middleware/authJwt.js — verifica JWT y adjunta req.user
const jwt    = require('jsonwebtoken');
const { isMobileSessionActive } = require('../lib/authTokens');
const SECRET = process.env.JWT_SECRET || 'cc-dev-secret-change-in-prod';

module.exports = async function authJwt(req, res, next) {
    const header = req.headers['authorization'];
    const token  = header && header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Token requerido' });
    try {
        req.user = jwt.verify(token, SECRET);
        if (req.user?.auth_kind === 'mobile' && req.user?.mobile_session_id) {
            const active = await isMobileSessionActive(req.user.mobile_session_id, req.user.id);
            if (!active) {
                return res.status(401).json({ error: 'Sesión móvil inválida o cerrada' });
            }
        }
        next();
    } catch (err) {
        res.status(401).json({ error: 'Token inválido o expirado' });
    }
};
