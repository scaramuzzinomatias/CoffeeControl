const express = require('express');
const { requireCardOperator } = require('../middleware/roleAccess');
const {
    searchEmployeesForCardOps,
    lookupCardByUid,
    registerOrAssignCard,
    updateCardAssignment
} = require('../lib/nfcCards');

const router = express.Router();

router.use(requireCardOperator);

router.get('/employees/search', async (req, res) => {
    try {
        const employees = await searchEmployeesForCardOps(req.query.q, { limit: req.query.limit });
        res.json({
            employees,
            query: String(req.query.q || '').trim()
        });
    } catch (err) {
        res.status(err.status || 500).json({ error: err.message });
    }
});

router.get('/cards/lookup/:uid', async (req, res) => {
    try {
        const card = await lookupCardByUid(req.params.uid);
        res.json({
            found: Boolean(card),
            card
        });
    } catch (err) {
        res.status(err.status || 500).json({ error: err.message });
    }
});

router.post('/employees/:id/cards', async (req, res) => {
    const { uid, label } = req.body || {};
    if (!uid) return res.status(400).json({ error: 'uid requerido' });

    try {
        const result = await registerOrAssignCard({
            req,
            employeeId: Number.parseInt(req.params.id, 10),
            uid,
            label,
            source: 'mobile-tech'
        });
        res.status(201).json(result);
    } catch (err) {
        res.status(err.status || 500).json({ error: err.message });
    }
});

router.patch('/employees/:id/cards/:cardId', async (req, res) => {
    const { label, employee_id, status, active } = req.body || {};
    try {
        const result = await updateCardAssignment({
            req,
            cardId: Number.parseInt(req.params.cardId, 10),
            label,
            employeeId: employee_id ?? Number.parseInt(req.params.id, 10),
            status,
            active,
            source: 'mobile-tech'
        });
        res.json(result);
    } catch (err) {
        res.status(err.status || 500).json({ error: err.message });
    }
});

module.exports = router;
