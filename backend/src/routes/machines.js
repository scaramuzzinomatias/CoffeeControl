const express = require('express');
const pool = require('../db/pool');
const { broadcast } = require('../ws');
const { requireManager, requireMachineOperator, requireMachineSetup } = require('../middleware/roleAccess');
const alerts = require('../services/alerts');
const audit = require('../services/audit');
const stock = require('../services/stock');

const router = express.Router();
const MACHINE_ONLINE_WINDOW_MS = 180000;

function isMachineOnline(lastSeen) {
    if (!lastSeen) return false;
    return (Date.now() - new Date(lastSeen).getTime()) < MACHINE_ONLINE_WINDOW_MS;
}

function normalizeOptionalString(value, maxLen) {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    return trimmed.slice(0, maxLen);
}

function normalizeOptionalInteger(value) {
    if (value === null || value === undefined || value === '') return null;
    const parsed = parseInt(value, 10);
    return Number.isInteger(parsed) ? parsed : null;
}

function normalizePositiveInteger(value) {
    const parsed = normalizeOptionalInteger(value);
    if (parsed === null) return null;
    return parsed > 0 ? parsed : null;
}

function parseMachineId(value) {
    const parsed = parseInt(value, 10);
    return Number.isInteger(parsed) ? parsed : null;
}

async function queueMachineCommand({ machineId, machineName, commandType, payload, req }) {
    const insertResult = await pool.query(
        `INSERT INTO machine_commands(machine_id, command_type, payload)
         VALUES ($1, $2, $3::jsonb)
         RETURNING id, machine_id, command_type, payload, status, queued_at`,
        [machineId, commandType, JSON.stringify(payload || {})]
    );

    if (req) {
        await audit.logAuditEvent({
            req,
            action: 'machine.command_queue',
            entityType: 'machine',
            entityId: machineId,
            entityLabel: machineName,
            summary: `Encoló el comando ${commandType} para ${machineName}`,
            details: {
                command_id: parseInt(insertResult.rows[0].id, 10),
                command_type: commandType,
                payload: payload || {}
            }
        });
    }

    broadcast({
        event: 'machine_command_queued',
        machine_id: machineId,
        machine: machineName,
        command_type: commandType
    });

    return insertResult.rows[0];
}

async function getActiveMachineById(machineId) {
    const result = await pool.query(
        `SELECT id, name, location, last_seen
         FROM machines
         WHERE id = $1
           AND active = true`,
        [machineId]
    );
    return result.rows[0] || null;
}

function syncStockAlert(machine, stockItem) {
    return alerts.syncStockLowAlert({ machine, stockItem })
        .catch(err => console.error(`[ALERT] Error stock bajo ${machine?.name || machine?.id || '?'}/${stockItem?.id || '?'}:`, err.message));
}

function normalizeCommandPayload(type, payload) {
    if (type === 'reboot') {
        return {};
    }

    if (type === 'wifi_scan') {
        return {};
    }

    if (type === 'diagnostics_snapshot') {
        const limit = normalizePositiveInteger(payload?.limit);
        if (limit !== null && limit > 32) {
            throw new Error('El límite de diagnóstico no puede superar 32 eventos');
        }
        return limit ? { limit } : {};
    }

    if (type === 'wifi_update') {
        const ssid = String(payload?.ssid || '').trim();
        const pass = typeof payload?.pass === 'string' ? payload.pass : '';
        const url = String(payload?.url || '').trim();
        const preservePassword = payload?.preserve_password === true;

        if (!ssid) {
            throw new Error('El SSID es requerido');
        }
        if (ssid.length > 64) {
            throw new Error('El SSID es demasiado largo');
        }
        if (pass.length > 128) {
            throw new Error('La contraseña WiFi es demasiado larga');
        }
        if (url && !/^https?:\/\//i.test(url)) {
            throw new Error('La URL del backend debe comenzar con http:// o https://');
        }

        return { ssid, pass, url, preserve_password: preservePassword };
    }

    throw new Error('Tipo de comando no soportado');
}

router.post('/register', async (req, res) => {
    const {
        mac,
        wifi_ssid,
        backend_url,
        price_cents,
        pricing_profile,
        wifi_rssi,
        wifi_ip,
        backend_ok,
        backend_error
    } = req.body || {};
    if (!mac) return res.status(400).json({ error: 'mac requerida' });

    const macClean = mac.toUpperCase().replace(/[^A-F0-9]/g, '');
    const wifiSsid = normalizeOptionalString(wifi_ssid, 64);
    const backendUrl = normalizeOptionalString(backend_url, 255);
    const reportedPriceCents = normalizePositiveInteger(price_cents);
    const pricingProfile = normalizeOptionalString(pricing_profile, 40);
    const wifiRssi = normalizeOptionalInteger(wifi_rssi);
    const wifiIp = normalizeOptionalString(wifi_ip, 45);
    const backendOk = typeof backend_ok === 'boolean' ? backend_ok : null;
    const backendError = normalizeOptionalString(backend_error, 255);

    try {
        const approved = await pool.query(
            'SELECT id, name, price_cents FROM machines WHERE mac = $1 AND active = true',
            [macClean]
        );

        if (approved.rowCount > 0) {
            const updateResult = await pool.query(
                `UPDATE machines
                 SET last_seen = NOW(),
                     wifi_ssid = COALESCE($2, wifi_ssid),
                     backend_url = COALESCE($3, backend_url),
                     wifi_rssi = COALESCE($4, wifi_rssi),
                     wifi_ip = COALESCE($5, wifi_ip),
                     backend_ok = COALESCE($6, backend_ok),
                     backend_error = $7
                 WHERE mac = $1
                 RETURNING id, name, location, last_seen, wifi_ssid, wifi_ip, backend_url, backend_ok, backend_error, price_cents`,
                [macClean, wifiSsid, backendUrl, wifiRssi, wifiIp, backendOk, backendError]
            );
            const machineState = updateResult.rows[0];
            alerts.resolveMachineOffline(machineState.id).catch(err => console.error('[ALERT] Error resolviendo offline:', err.message));
            return res.status(200).json({
                status: 'approved',
                machine: approved.rows[0].name,
                config: {
                    price_cents: Number(machineState.price_cents || reportedPriceCents || 1200),
                    pricing_profile: pricingProfile || 'rubino_half_credit'
                }
            });
        }

        const pending = await pool.query(
            'SELECT id FROM pending_machines WHERE mac = $1',
            [macClean]
        );

        if (pending.rowCount > 0) {
            await pool.query('UPDATE pending_machines SET last_ping = NOW() WHERE mac = $1', [macClean]);
            return res.status(202).json({ status: 'pending' });
        }

        await pool.query('INSERT INTO pending_machines(mac) VALUES ($1)', [macClean]);
        console.log('[REG] Nueva pendiente:', macClean);
        broadcast({ event: 'machine_pending', mac: macClean, message: `Nueva máquina pendiente: ${macClean}` });
        return res.status(202).json({ status: 'pending' });
    } catch (err) {
        console.error('[REG] Error:', err.message);
        return res.status(500).json({ error: err.message });
    }
});

router.get('/pending', requireMachineSetup, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id, mac, first_seen, last_ping FROM pending_machines WHERE approved = false ORDER BY first_seen DESC'
        );
        res.json({ pending: result.rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/pending/:id/approve', requireMachineSetup, async (req, res) => {
    const { name, location, price_cents } = req.body;
    if (!name) return res.status(400).json({ error: 'nombre requerido' });
    const priceCents = normalizePositiveInteger(price_cents) || 1200;

    try {
        const pending = await pool.query(
            'SELECT id, mac FROM pending_machines WHERE id = $1',
            [req.params.id]
        );
        if (pending.rowCount === 0) return res.status(404).json({ error: 'No encontrada' });

        const mac = pending.rows[0].mac;
        const machine = await pool.query(
            `INSERT INTO machines(name, location, mac, secret, active, price_cents)
             VALUES ($1, $2, $3, $3, true, $4)
             ON CONFLICT(mac) DO UPDATE
             SET name = $1, location = $2, active = true, price_cents = $4
             RETURNING *`,
            [name.trim(), location?.trim() || null, mac, priceCents]
        );

        await pool.query('UPDATE pending_machines SET approved = true WHERE id = $1', [req.params.id]);
        broadcast({ event: 'machine_approved', mac, machine: name });
        await audit.logAuditEvent({
            req,
            action: 'machine.approve_pending',
            entityType: 'machine',
            entityId: machine.rows[0].id,
            entityLabel: machine.rows[0].name,
            summary: `Aprobó la máquina pendiente ${machine.rows[0].name}`,
            details: {
                pending_id: pending.rows[0].id,
                mac,
                location: machine.rows[0].location,
                price_cents: machine.rows[0].price_cents
            }
        });
        res.status(201).json({ machine: machine.rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/pending/:id/reject', requireMachineSetup, async (req, res) => {
    try {
        const pending = await pool.query(
            'DELETE FROM pending_machines WHERE id = $1 RETURNING id, mac',
            [req.params.id]
        );
        if (pending.rowCount === 0) return res.status(404).json({ error: 'No encontrada' });
        await audit.logAuditEvent({
            req,
            action: 'machine.reject_pending',
            entityType: 'pending_machine',
            entityId: pending.rows[0].id,
            entityLabel: pending.rows[0].mac,
            summary: `Rechazó la máquina pendiente ${pending.rows[0].mac}`,
            details: {
                mac: pending.rows[0].mac
            }
        });
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/', requireMachineOperator, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM machine_status WHERE active = true ORDER BY id');
        const stockSummaryMap = await stock.getMachineStockSummaryMap(result.rows.map(row => row.id));
        const now = Date.now();
        const machines = result.rows.map(machine => ({
            ...machine,
            online: machine.last_seen ? (now - new Date(machine.last_seen).getTime()) < 180000 : false,
            stock_summary: stockSummaryMap.get(machine.id) || {
                configured_items: 0,
                low_items: 0,
                empty_items: 0,
                inactive_items: 0,
                total_units: 0
            }
        }));
        res.json({ machines });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/', requireManager, async (req, res) => {
    const { name, location, mac, price_cents } = req.body;
    if (!name || !mac) return res.status(400).json({ error: 'name y mac requeridos' });
    const priceCents = normalizePositiveInteger(price_cents) || 1200;

    try {
        const result = await pool.query(
            `INSERT INTO machines(name, location, mac, secret, price_cents)
             VALUES ($1, $2, $3, $3, $4)
             RETURNING *`,
            [name.trim(), location?.trim() || null, mac.toUpperCase().replace(/[^A-F0-9]/g, ''), priceCents]
        );
        await audit.logAuditEvent({
            req,
            action: 'machine.create',
            entityType: 'machine',
            entityId: result.rows[0].id,
            entityLabel: result.rows[0].name,
            summary: `Creó la máquina ${result.rows[0].name}`,
            details: {
                mac: result.rows[0].mac,
                location: result.rows[0].location,
                price_cents: result.rows[0].price_cents
            }
        });
        res.status(201).json({ machine: result.rows[0] });
    } catch (err) {
        if (err.code === '23505') return res.status(409).json({ error: 'MAC ya registrada' });
        res.status(500).json({ error: err.message });
    }
});

router.patch('/:id', requireMachineSetup, async (req, res) => {
    const { name, location, price_cents } = req.body;
    const priceCents = price_cents === undefined ? undefined : normalizePositiveInteger(price_cents);
    if (price_cents !== undefined && priceCents === null) {
        return res.status(400).json({ error: 'price_cents inválido' });
    }
    try {
        const before = await pool.query(
            'SELECT id, name, location, price_cents, last_seen FROM machines WHERE id = $1',
            [req.params.id]
        );
        if (before.rowCount === 0) return res.status(404).json({ error: 'No encontrada' });
        const previousMachine = before.rows[0];
        const result = await pool.query(
            'UPDATE machines SET name = COALESCE($1, name), location = COALESCE($2, location), price_cents = COALESCE($3, price_cents) WHERE id = $4 RETURNING *',
            [name, location, priceCents, req.params.id]
        );
        const updatedMachine = result.rows[0];
        let configSync = 'unchanged';

        if (priceCents !== undefined && Number(previousMachine.price_cents) !== Number(updatedMachine.price_cents)) {
            const existing = await pool.query(
                `SELECT id
                 FROM machine_commands
                 WHERE machine_id = $1
                   AND status = 'queued'
                 ORDER BY queued_at DESC
                 LIMIT 1`,
                [updatedMachine.id]
            );

            if (existing.rowCount > 0) {
                configSync = 'queued_command_exists';
            } else if (isMachineOnline(updatedMachine.last_seen)) {
                await queueMachineCommand({
                    machineId: updatedMachine.id,
                    machineName: updatedMachine.name,
                    commandType: 'config_update',
                    payload: {
                        price_cents: Number(updatedMachine.price_cents)
                    },
                    req
                });
                configSync = 'queued';
            } else {
                configSync = 'pending_reconnect';
            }
        }

        await audit.logAuditEvent({
            req,
            action: 'machine.update',
            entityType: 'machine',
            entityId: updatedMachine.id,
            entityLabel: updatedMachine.name,
            summary: `Actualizó la máquina ${updatedMachine.name}`,
            details: {
                before: previousMachine,
                after: {
                    id: updatedMachine.id,
                    name: updatedMachine.name,
                    location: updatedMachine.location,
                    price_cents: updatedMachine.price_cents
                },
                config_sync: configSync
            }
        });
        res.json({ machine: updatedMachine, config_sync: configSync });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/:id/commands', requireMachineOperator, async (req, res) => {
    const { type, payload } = req.body || {};
    const machineId = parseInt(req.params.id, 10);

    if (!Number.isInteger(machineId)) {
        return res.status(400).json({ error: 'ID de máquina inválido' });
    }
    try {
        const commandType = String(type || '').trim();
        const normalizedPayload = normalizeCommandPayload(commandType, payload || {});
        const machineResult = await pool.query(
            `SELECT id, name, last_seen
             FROM machines
             WHERE id = $1 AND active = true`,
            [machineId]
        );
        if (machineResult.rowCount === 0) {
            return res.status(404).json({ error: 'No encontrada' });
        }

        const machine = machineResult.rows[0];
        if (!isMachineOnline(machine.last_seen)) {
            return res.status(409).json({ error: 'La máquina está offline. Los comandos remotos solo se envían a equipos online.' });
        }

        const existing = await pool.query(
            `SELECT id
             FROM machine_commands
             WHERE machine_id = $1
               AND status = 'queued'
             ORDER BY queued_at DESC
             LIMIT 1`,
            [machineId]
        );
        if (existing.rowCount > 0) {
            return res.status(409).json({ error: 'Ya hay un comando pendiente para esta máquina.' });
        }

        const queuedCommand = await queueMachineCommand({
            machineId: machine.id,
            machineName: machine.name,
            commandType,
            payload: normalizedPayload,
            req
        });

        return res.status(201).json({
            command: {
                ...queuedCommand,
                id: parseInt(queuedCommand.id, 10)
            }
        });
    } catch (err) {
        if (err.message === 'Tipo de comando no soportado'
            || err.message === 'El SSID es requerido'
            || err.message === 'El SSID es demasiado largo'
            || err.message === 'La contraseña WiFi es demasiado larga'
            || err.message === 'La URL del backend debe comenzar con http:// o https://'
            || err.message === 'El límite de diagnóstico no puede superar 32 eventos') {
            return res.status(400).json({ error: err.message });
        }
        return res.status(500).json({ error: err.message });
    }
});

router.get('/:id/commands/:commandId', requireMachineOperator, async (req, res) => {
    const machineId = parseInt(req.params.id, 10);
    const commandId = parseInt(req.params.commandId, 10);
    if (!Number.isInteger(machineId) || !Number.isInteger(commandId)) {
        return res.status(400).json({ error: 'ID inválido' });
    }

    try {
        const result = await pool.query(
            `SELECT id, machine_id, command_type, payload, status, queued_at, delivered_at, completed_at, result
             FROM machine_commands
             WHERE id = $1 AND machine_id = $2`,
            [commandId, machineId]
        );
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Comando no encontrado' });
        }

        const command = result.rows[0];
        return res.json({
            command: {
                ...command,
                id: parseInt(command.id, 10),
                machine_id: parseInt(command.machine_id, 10)
            }
        });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

router.post('/:id/block', requireManager, async (req, res) => {
    const { reason } = req.body;
    try {
        const result = await pool.query(
            'UPDATE machines SET blocked = true, blocked_reason = $1 WHERE id = $2 RETURNING id, name, blocked_reason',
            [reason || 'Bloqueada por administrador', req.params.id]
        );
        if (result.rowCount === 0) return res.status(404).json({ error: 'No encontrada' });
        broadcast({ event: 'machine_blocked', machine_id: parseInt(req.params.id, 10), machine: result.rows[0].name });
        await audit.logAuditEvent({
            req,
            action: 'machine.block',
            entityType: 'machine',
            entityId: result.rows[0].id,
            entityLabel: result.rows[0].name,
            summary: `Bloqueó la máquina ${result.rows[0].name}`,
            details: {
                reason: result.rows[0].blocked_reason
            }
        });
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/:id/unblock', requireManager, async (req, res) => {
    try {
        const result = await pool.query(
            'UPDATE machines SET blocked = false, blocked_reason = NULL WHERE id = $1 RETURNING id, name',
            [req.params.id]
        );
        if (result.rowCount === 0) return res.status(404).json({ error: 'No encontrada' });
        broadcast({ event: 'machine_unblocked', machine_id: parseInt(req.params.id, 10) });
        await audit.logAuditEvent({
            req,
            action: 'machine.unblock',
            entityType: 'machine',
            entityId: result.rows[0].id,
            entityLabel: result.rows[0].name,
            summary: `Desbloqueó la máquina ${result.rows[0].name}`
        });
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/:id', requireManager, async (req, res) => {
    try {
        const result = await pool.query(
            'UPDATE machines SET active = false WHERE id = $1 RETURNING id, name, mac, location',
            [req.params.id]
        );
        if (result.rowCount === 0) return res.status(404).json({ error: 'No encontrada' });
        broadcast({ event: 'machine_deleted', machine_id: parseInt(req.params.id, 10) });
        await audit.logAuditEvent({
            req,
            action: 'machine.deactivate',
            entityType: 'machine',
            entityId: result.rows[0].id,
            entityLabel: result.rows[0].name,
            summary: `Dio de baja la máquina ${result.rows[0].name}`,
            details: {
                mac: result.rows[0].mac,
                location: result.rows[0].location
            }
        });
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/:id/stock', requireMachineOperator, async (req, res) => {
    const machineId = parseMachineId(req.params.id);
    if (!machineId) {
        return res.status(400).json({ error: 'ID de máquina inválido' });
    }
    try {
        const machine = await getActiveMachineById(machineId);
        if (!machine) return res.status(404).json({ error: 'No encontrada' });
        const data = await stock.getMachineStock(machineId);
        return res.json({
            machine: {
                id: machine.id,
                name: machine.name,
                location: machine.location
            },
            summary: data.summary,
            items: data.items,
            movements: data.movements
        });
    } catch (err) {
        return res.status(err.statusCode || 500).json({ error: err.message });
    }
});

router.post('/:id/stock', requireMachineOperator, async (req, res) => {
    const machineId = parseMachineId(req.params.id);
    if (!machineId) {
        return res.status(400).json({ error: 'ID de máquina inválido' });
    }
    try {
        const machine = await getActiveMachineById(machineId);
        if (!machine) return res.status(404).json({ error: 'No encontrada' });
        const created = await stock.createStockItem({
            machineId,
            itemId: req.body?.item_id,
            productName: req.body?.product_name,
            slotLabel: req.body?.slot_label,
            capacityUnits: req.body?.capacity_units,
            currentUnits: req.body?.current_units,
            minUnits: req.body?.min_units,
            active: req.body?.active !== false,
            actorUserId: req.user?.id || null,
            note: req.body?.note
        });
        await audit.logAuditEvent({
            req,
            action: 'stock_item.create',
            entityType: 'stock_item',
            entityId: created.stockItem.id,
            entityLabel: `${machine.name} · selección ${created.stockItem.item_id}`,
            summary: `Configuró stock para ${machine.name} · selección ${created.stockItem.item_id}`,
            details: {
                machine_id: machine.id,
                machine_name: machine.name,
                after: created.stockItem
            }
        });
        await syncStockAlert(machine, created.stockItem);
        broadcast({
            event: 'machine_stock_updated',
            machine_id: machine.id,
            machine: machine.name
        });
        return res.status(201).json({ stock_item: created.stockItem });
    } catch (err) {
        if (err.code === '23505') {
            return res.status(409).json({ error: 'La selección ya tiene stock configurado para esta máquina.' });
        }
        return res.status(err.statusCode || 500).json({ error: err.message });
    }
});

router.patch('/:id/stock/:stockItemId', requireMachineOperator, async (req, res) => {
    const machineId = parseMachineId(req.params.id);
    const stockItemId = parseInt(req.params.stockItemId, 10);
    if (!machineId || !Number.isInteger(stockItemId)) {
        return res.status(400).json({ error: 'ID inválido' });
    }
    try {
        const machine = await getActiveMachineById(machineId);
        if (!machine) return res.status(404).json({ error: 'No encontrada' });
        const result = await stock.updateStockItem({
            machineId,
            stockItemId,
            itemId: req.body?.item_id,
            productName: req.body?.product_name,
            slotLabel: req.body?.slot_label,
            capacityUnits: req.body?.capacity_units,
            currentUnits: req.body?.current_units,
            minUnits: req.body?.min_units,
            active: req.body?.active,
            actorUserId: req.user?.id || null,
            note: req.body?.note
        });
        await audit.logAuditEvent({
            req,
            action: 'stock_item.update',
            entityType: 'stock_item',
            entityId: result.stockItem.id,
            entityLabel: `${machine.name} · selección ${result.stockItem.item_id}`,
            summary: `Actualizó stock en ${machine.name} · selección ${result.stockItem.item_id}`,
            details: {
                machine_id: machine.id,
                machine_name: machine.name,
                before: result.before,
                after: result.stockItem
            }
        });
        await syncStockAlert(machine, result.stockItem);
        broadcast({
            event: 'machine_stock_updated',
            machine_id: machine.id,
            machine: machine.name
        });
        return res.json({ stock_item: result.stockItem });
    } catch (err) {
        if (err.code === '23505') {
            return res.status(409).json({ error: 'La selección ya está en uso por otra configuración de esta máquina.' });
        }
        return res.status(err.statusCode || 500).json({ error: err.message });
    }
});

router.post('/:id/stock/:stockItemId/restock', requireMachineOperator, async (req, res) => {
    const machineId = parseMachineId(req.params.id);
    const stockItemId = parseInt(req.params.stockItemId, 10);
    if (!machineId || !Number.isInteger(stockItemId)) {
        return res.status(400).json({ error: 'ID inválido' });
    }
    try {
        const machine = await getActiveMachineById(machineId);
        if (!machine) return res.status(404).json({ error: 'No encontrada' });
        const result = await stock.restockStockItem({
            machineId,
            stockItemId,
            quantity: req.body?.quantity,
            actorUserId: req.user?.id || null,
            note: req.body?.note
        });
        await audit.logAuditEvent({
            req,
            action: 'stock_item.restock',
            entityType: 'stock_item',
            entityId: result.stockItem.id,
            entityLabel: `${machine.name} · selección ${result.stockItem.item_id}`,
            summary: `Repuso stock en ${machine.name} · selección ${result.stockItem.item_id}`,
            details: {
                machine_id: machine.id,
                machine_name: machine.name,
                quantity: req.body?.quantity,
                before: result.before,
                after: result.stockItem
            }
        });
        await syncStockAlert(machine, result.stockItem);
        broadcast({
            event: 'machine_stock_updated',
            machine_id: machine.id,
            machine: machine.name
        });
        return res.json({ stock_item: result.stockItem });
    } catch (err) {
        return res.status(err.statusCode || 500).json({ error: err.message });
    }
});

router.post('/:id/stock/:stockItemId/adjust', requireMachineOperator, async (req, res) => {
    const machineId = parseMachineId(req.params.id);
    const stockItemId = parseInt(req.params.stockItemId, 10);
    if (!machineId || !Number.isInteger(stockItemId)) {
        return res.status(400).json({ error: 'ID inválido' });
    }
    try {
        const machine = await getActiveMachineById(machineId);
        if (!machine) return res.status(404).json({ error: 'No encontrada' });
        const result = await stock.adjustStockItem({
            machineId,
            stockItemId,
            currentUnits: req.body?.current_units,
            actorUserId: req.user?.id || null,
            note: req.body?.note
        });
        await audit.logAuditEvent({
            req,
            action: 'stock_item.adjust',
            entityType: 'stock_item',
            entityId: result.stockItem.id,
            entityLabel: `${machine.name} · selección ${result.stockItem.item_id}`,
            summary: `Ajustó stock en ${machine.name} · selección ${result.stockItem.item_id}`,
            details: {
                machine_id: machine.id,
                machine_name: machine.name,
                before: result.before,
                after: result.stockItem
            }
        });
        await syncStockAlert(machine, result.stockItem);
        broadcast({
            event: 'machine_stock_updated',
            machine_id: machine.id,
            machine: machine.name
        });
        return res.json({ stock_item: result.stockItem });
    } catch (err) {
        return res.status(err.statusCode || 500).json({ error: err.message });
    }
});

router.get('/:id/taps', requireManager, async (req, res) => {
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
    try {
        const result = await pool.query(
            `SELECT
                t.id,
                e.name AS employee_name,
                e.legajo,
                t.approved,
                t.deny_reason,
                t.amount_cents,
                t.tapped_at
             FROM taps t
             JOIN employees e ON e.id = t.employee_id
             WHERE t.machine_id = $1
             ORDER BY t.tapped_at DESC
             LIMIT $2`,
            [req.params.id, limit]
        );
        res.json({ taps: result.rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
