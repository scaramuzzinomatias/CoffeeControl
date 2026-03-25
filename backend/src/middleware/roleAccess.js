const MANAGER_ROLES = new Set(['admin', 'gerente']);

function isManagerRole(role) {
    return MANAGER_ROLES.has(role);
}

function requireManager(req, res, next) {
    if (isManagerRole(req.user?.role)) return next();
    return res.status(403).json({ error: 'Acceso solo para gerente/admin' });
}

module.exports = {
    isManagerRole,
    requireManager,
};
