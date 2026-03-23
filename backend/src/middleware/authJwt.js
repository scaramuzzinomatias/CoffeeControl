// src/middleware/authJwt.js — verifica JWT y adjunta req.user
const jwt    = require('jsonwebtoken');
const SECRET = process.env.JWT_SECRET || 'cc-dev-secret-change-in-prod';

module.exports = function authJwt(req, res, next) {
    const header = req.headers['authorization'];
    const token  = header && header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Token requerido' });
    try {
        req.user = jwt.verify(token, SECRET);
        next();
    } catch (err) {
        res.status(401).json({ error: 'Token inválido o expirado' });
    }
};
