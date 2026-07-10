const express = require('express');
const { requireManager } = require('../middleware/roleAccess');
const alerts = require('../services/alerts');
const audit = require('../services/audit');

const router = express.Router();

router.get('/', requireManager, async (req, res) => {
    try {
        const settings = await alerts.getNotificationSettings(req.user.tenant_id);
        return res.json({ settings });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

router.put('/', requireManager, async (req, res) => {
    try {
        const before = await alerts.getNotificationSettings(req.user.tenant_id);
        const settings = await alerts.saveNotificationSettings(req.body || {}, req.user.tenant_id);
        await audit.logAuditEvent({
            req,
            action: 'notification_settings.update',
            entityType: 'notification_settings',
            entityId: 1,
            entityLabel: 'general',
            summary: 'Actualizó la configuración de notificaciones',
            details: {
                before: {
                    enabled: before.enabled,
                    recipient_emails: before.recipient_emails,
                    notify_employee_limit_warning: before.notify_employee_limit_warning,
                    notify_employee_daily_blocked: before.notify_employee_daily_blocked,
                    notify_machine_offline: before.notify_machine_offline,
                    notify_stock_low: before.notify_stock_low,
                    employee_limit_warning_lead: before.employee_limit_warning_lead
                },
                after: {
                    enabled: settings.enabled,
                    recipient_emails: settings.recipient_emails,
                    notify_employee_limit_warning: settings.notify_employee_limit_warning,
                    notify_employee_daily_blocked: settings.notify_employee_daily_blocked,
                    notify_machine_offline: settings.notify_machine_offline,
                    notify_stock_low: settings.notify_stock_low,
                    employee_limit_warning_lead: settings.employee_limit_warning_lead
                }
            }
        });
        return res.json({ settings });
    } catch (err) {
        const status = err.message?.startsWith('Indicá ') ? 400 : 500;
        return res.status(status).json({ error: err.message });
    }
});

router.post('/test', requireManager, async (req, res) => {
    try {
        const result = await alerts.sendTestNotification(req.body || {}, req.user.tenant_id);
        await audit.logAuditEvent({
            req,
            action: 'notification_settings.test',
            entityType: 'notification_settings',
            entityId: 1,
            entityLabel: 'general',
            summary: 'Envió una prueba manual de notificaciones',
            details: {
                recipients: result.recipients,
                email_from: result.email_from,
                sent_at: result.sent_at
            }
        });
        return res.json({ ok: true, result });
    } catch (err) {
        const validationErrors = [
            'Indicá al menos un destinatario',
            'SMTP no configurado en backend'
        ];
        const status = validationErrors.some(prefix => err.message?.startsWith(prefix)) ? 400 : 500;
        return res.status(status).json({ error: err.message });
    }
});

module.exports = router;
