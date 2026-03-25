const express = require('express');
const pool = require('../db/pool');
const { broadcast } = require('../ws');

const router = express.Router();

router.get('/commands/next', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, command_type, payload, queued_at
             FROM machine_commands
             WHERE machine_id = $1
               AND status = 'queued'
             ORDER BY queued_at ASC
             LIMIT 1`,
            [req.machine.id]
        );

        if (result.rowCount === 0) {
            return res.status(204).end();
        }

        const command = result.rows[0];
        await pool.query(
            `UPDATE machine_commands
             SET delivered_at = COALESCE(delivered_at, NOW())
             WHERE id = $1`,
            [command.id]
        );

        return res.json({
            command: {
                id: parseInt(command.id, 10),
                type: command.command_type,
                payload: command.payload || {},
                queued_at: command.queued_at
            }
        });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

router.post('/commands/:id/ack', async (req, res) => {
    const { status, result } = req.body || {};
    const commandId = parseInt(req.params.id, 10);

    if (!Number.isInteger(commandId)) {
        return res.status(400).json({ error: 'ID de comando inválido' });
    }
    if (!['completed', 'failed'].includes(status)) {
        return res.status(400).json({ error: 'status inválido' });
    }

    try {
        const updateResult = await pool.query(
            `UPDATE machine_commands
             SET status = $1,
                 completed_at = NOW(),
                 result = $2::jsonb
             WHERE id = $3
               AND machine_id = $4
               AND status = 'queued'
             RETURNING id, command_type`,
            [status, JSON.stringify(result || {}), commandId, req.machine.id]
        );

        if (updateResult.rowCount === 0) {
            return res.status(404).json({ error: 'Comando no encontrado o ya procesado' });
        }

        const command = updateResult.rows[0];
        broadcast({
            event: status === 'completed' ? 'machine_command_completed' : 'machine_command_failed',
            machine_id: req.machine.id,
            command_id: command.id,
            command_type: command.command_type,
            result: result || {}
        });

        return res.json({ ok: true });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

module.exports = router;
