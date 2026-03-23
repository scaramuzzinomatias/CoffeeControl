// src/routes/tap.js
// Endpoint principal: el ESP8266 llama a POST /api/tap cuando alguien acerca la tarjeta NFC

const express  = require('express');
const pool     = require('../db/pool');
const { broadcast } = require('../ws');

const router = express.Router();

// ══════════════════════════════════════════════════════
//  POST /api/tap
//  El ESP8266 manda: { nfc_uid, machine_id }
//  Responde: 200 OK (aprobar) | 403 (denegar)
// ══════════════════════════════════════════════════════
router.post('/', async (req, res) => {
    const { nfc_uid } = req.body;
    const machine     = req.machine; // viene del middleware machineAuth

    if (!nfc_uid) {
        return res.status(400).json({ error: 'nfc_uid requerido' });
    }

    const uid = nfc_uid.toUpperCase().trim();

    try {
        // ── 1. Buscar la tarjeta NFC ────────────────────────
        const cardResult = await pool.query(
            `SELECT nc.id, nc.employee_id, e.name, e.daily_limit, e.active
             FROM nfc_cards nc
             JOIN employees e ON e.id = nc.employee_id
             WHERE nc.uid = $1 AND nc.active = true`,
            [uid]
        );

        if (cardResult.rowCount === 0) {
            await logTap({ uid, machine, approved: false, reason: 'card_unknown' });
            console.log(`[TAP] UID desconocido: ${uid}`);
            broadcast({ event: 'card_unknown', uid, machine: machine.name, machine_id: machine.id });
            return res.status(403).json({ error: 'Tarjeta no registrada', reason: 'card_unknown' });
        }

        const { employee_id, name, daily_limit, active } = cardResult.rows[0];

        if (!active) {
            await logTap({ uid, machine, employeeId: employee_id, approved: false, reason: 'inactive' });
            return res.status(403).json({ error: 'Empleado inactivo', reason: 'inactive' });
        }

        // ── 2. Contar consumo de hoy ─────────────────────────
        const countResult = await pool.query(
            `SELECT COUNT(*) AS taps_today
             FROM taps
             WHERE employee_id = $1
               AND approved    = true
               AND tapped_at  >= CURRENT_DATE
               AND tapped_at  <  CURRENT_DATE + INTERVAL '1 day'`,
            [employee_id]
        );

        const tapsToday = parseInt(countResult.rows[0].taps_today, 10);

        // ── 3. Verificar límite ──────────────────────────────
        if (tapsToday >= daily_limit) {
            await logTap({ uid, machine, employeeId: employee_id, approved: false, reason: 'limit_reached' });

            console.log(`[TAP] DENEGADO — ${name} (${tapsToday}/${daily_limit} hoy)`);

            // Notificar al dashboard en tiempo real
            broadcast({ event: 'tap_denied', uid, employee: name, employee_id, tapsToday, daily_limit, machine: machine.name });

            return res.status(403).json({
                error:       'Límite diario alcanzado',
                reason:      'limit_reached',
                employee:    name,
                taps_today:  tapsToday,
                daily_limit
            });
        }

        // ── 4. Aprobar ───────────────────────────────────────
        const tapId = await logTap({ uid, machine, employeeId: employee_id, approved: true });

        console.log(`[TAP] APROBADO — ${name} (${tapsToday + 1}/${daily_limit} hoy)`);

        // Notificar al dashboard en tiempo real
        broadcast({ event: 'tap_approved', uid, employee: name, employee_id, tapsToday: tapsToday + 1, daily_limit, machine: machine.name, tap_id: tapId });

        return res.status(200).json({
            approved:    true,
            employee:    name,
            tap_id:      tapId,
            taps_today:  tapsToday + 1,
            daily_limit
        });

    } catch (err) {
        console.error('[TAP] Error:', err.message);
        res.status(500).json({ error: 'Error interno' });
    }
});

// ══════════════════════════════════════════════════════
//  POST /api/tap/result
//  El ESP8266 informa el resultado final del expendio
//  Body: { nfc_uid, vend_success, item_id?, amount? }
// ══════════════════════════════════════════════════════
router.post('/result', async (req, res) => {
    const { nfc_uid, vend_success, item_id, amount } = req.body;
    const machine = req.machine;

    if (!nfc_uid) return res.status(400).json({ error: 'nfc_uid requerido' });

    try {
        if (vend_success) {
            await pool.query(
                `UPDATE taps SET confirmed = true, item_id = $1, amount_cents = $2
                 WHERE id = (
                    SELECT id FROM taps
                    WHERE nfc_uid    = $3
                      AND machine_id = $4
                      AND approved   = true
                      AND confirmed  IS NULL
                    ORDER BY tapped_at DESC
                    LIMIT 1
                 )`,
                [item_id, amount, nfc_uid.toUpperCase(), machine.id]
            );
            broadcast({ event: 'vend_confirmed', machine: machine.name, item_id, amount });
        } else {
            // Revertir approved para que no cuente en el límite diario
            await pool.query(
                `UPDATE taps SET confirmed = false, approved = false
                 WHERE id = (
                    SELECT id FROM taps
                    WHERE nfc_uid    = $1
                      AND machine_id = $2
                      AND approved   = true
                      AND confirmed  IS NULL
                    ORDER BY tapped_at DESC
                    LIMIT 1
                 )`,
                [nfc_uid.toUpperCase(), machine.id]
            );
            broadcast({ event: 'vend_cancelled', machine: machine.name });
        }
        res.status(200).json({ ok: true });

    } catch (err) {
        console.error('[RESULT] Error:', err.message);
        res.status(500).json({ error: 'Error interno' });
    }
});

// ══════════════════════════════════════════════════════
//  POST /api/tap/reconcile
//  El ESP llama esto al arrancar (boot/reinicio).
//  Marca como no-confirmados los taps approved=true, confirmed IS NULL
//  de esta máquina con más de 2 minutos de antigüedad.
//  Esto resuelve el Bug 4: reinicio mid-session deja taps huérfanos.
// ══════════════════════════════════════════════════════
router.post('/reconcile', async (req, res) => {
    const machine = req.machine;
    try {
        const result = await pool.query(
            `UPDATE taps
             SET confirmed = false, approved = false
             WHERE machine_id = $1
               AND approved   = true
               AND confirmed  IS NULL
               AND tapped_at  < NOW() - INTERVAL '2 minutes'
             RETURNING id`,
            [machine.id]
        );
        const count = result.rowCount;
        if (count > 0) {
            console.log(`[RECONCILE] Máquina ${machine.name}: ${count} tap(s) huérfano(s) revertido(s) al boot`);
            broadcast({ event: 'tap_reconciled', machine: machine.name, machine_id: machine.id, count });
        }
        res.status(200).json({ ok: true, reverted: count });
    } catch (err) {
        console.error('[RECONCILE] Error:', err.message);
        res.status(500).json({ error: 'Error interno' });
    }
});

// ── Helper: insertar registro en taps ────────────────
async function logTap({ uid, machine, employeeId, approved, reason }) {
    const result = await pool.query(
        `INSERT INTO taps (nfc_uid, machine_id, employee_id, approved, deny_reason)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [uid, machine.id, employeeId || null, approved, reason || null]
    );
    return result.rows[0]?.id;
}

module.exports = router;
