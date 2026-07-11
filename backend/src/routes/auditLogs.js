const express = require('express');
const { requireManager } = require('../middleware/roleAccess');
const audit = require('../services/audit');

const router = express.Router();

router.get('/', requireManager, async (req, res) => {
    try {
        const logs = await audit.getAuditLogs({
            entityType: req.query.entity_type || '',
            action: req.query.action || '',
            q: req.query.q || '',
            limit: req.query.limit || 200,
            tenantId: req.user.tenant_id
        });
        return res.json({ logs });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

module.exports = router;
