module.exports = function authSuperadmin(req, res, next) {
    const secret = process.env.SUPERADMIN_SECRET;
    if (!secret) return res.status(503).json({ error: 'Superadmin no configurado' });
    const provided = req.headers['x-superadmin-secret'];
    if (!provided || provided !== secret) return res.status(401).json({ error: 'Clave superadmin incorrecta' });
    next();
};
