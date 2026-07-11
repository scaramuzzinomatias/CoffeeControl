const express = require('express');
const { requireManager } = require('../middleware/roleAccess');
const systemSettings = require('../services/systemSettings');
const audit = require('../services/audit');

const router = express.Router();

router.get('/', requireManager, async (req, res) => {
    try {
        const settings = await systemSettings.getSystemSettings(req.user.tenant_id);
        return res.json({ settings });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

router.put('/', requireManager, async (req, res) => {
    try {
        const before = await systemSettings.getSystemSettings(req.user.tenant_id);
        const settings = await systemSettings.saveSystemSettings(req.user.tenant_id, req.body || {});
        await audit.logAuditEvent({
            req,
            action: 'system_settings.update',
            entityType: 'system_settings',
            entityId: 1,
            entityLabel: 'general',
            summary: 'Actualizó la zona horaria operativa',
            details: {
                before: { business_timezone: before.business_timezone },
                after: { business_timezone: settings.business_timezone }
            }
        });
        return res.json({ settings });
    } catch (err) {
        const status = err.message?.startsWith('Zona horaria inválida') ? 400 : 500;
        return res.status(status).json({ error: err.message });
    }
});

module.exports = router;
