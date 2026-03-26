const {
    isManagerRole,
    isTechnicalRole,
    canOperateMachines,
    canViewAnalytics
} = require('../lib/accessScope');

function requireManager(req, res, next) {
    if (isManagerRole(req.user?.role)) return next();
    return res.status(403).json({ error: 'Acceso solo para gerente/admin' });
}

function requireMachineOperator(req, res, next) {
    if (canOperateMachines(req.user?.role)) return next();
    return res.status(403).json({ error: 'Acceso solo para gerente/admin/técnico' });
}

function requireAnalyticsViewer(req, res, next) {
    if (canViewAnalytics(req.user?.role)) return next();
    return res.status(403).json({ error: 'Acceso solo para gerente/admin/supervisor' });
}

module.exports = {
    isManagerRole,
    isTechnicalRole,
    requireManager,
    requireMachineOperator,
    requireAnalyticsViewer,
};
