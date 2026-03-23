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

// ══════════════════════════════════════════════════════
//  GET /api/tap/cards
//  El firmware ESP32-C3 descarga el cache de tarjetas para modo offline.
//  Retorna: [ { uid, daily_limit, used_today }, ... ]
// ══════════════════════════════════════════════════════
router.get('/cards', require('../middleware/machineAuth'), async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT
                nc.uid,
                e.daily_limit,
                COALESCE(COUNT(t.id) FILTER (
                    WHERE t.approved   = true
                      AND t.tapped_at >= CURRENT_DATE
                      AND t.tapped_at <  CURRENT_DATE + INTERVAL '1 day'
                ), 0)::int AS used_today
             FROM nfc_cards nc
             JOIN employees e ON e.id = nc.employee_id
             LEFT JOIN taps t ON t.employee_id = nc.employee_id
             WHERE nc.active = true AND e.active = true
             GROUP BY nc.uid, e.daily_limit`
        );
        res.json(result.rows);
    } catch (err) {
        console.error('[CARDS] Error:', err.message);
        res.status(500).json({ error: 'Error interno' });
    }
});

// ══════════════════════════════════════════════════════
//  POST /api/tap/queue
//  El firmware envía eventos acumulados offline en lotes.
//  Body: [ { uid, item_id, amount, ok, ts }, ... ]
//    uid  — UID hex de la tarjeta
//    ok   — true = venta exitosa, false = cancelada/fallida
//    ts   — Unix timestamp del evento (segundos)
//  Retorna: { ok, processed, errors }
// ══════════════════════════════════════════════════════
router.post('/queue', require('../middleware/machineAuth'), async (req, res) => {
    const events  = req.body;
    const machine = req.machine;

    if (!Array.isArray(events)) {
        return res.status(400).json({ error: 'Body debe ser un array JSON' });
    }
    if (events.length > 100) {
        return res.status(400).json({ error: 'Máximo 100 eventos por lote' });
    }

    let processed = 0;
    let errors    = 0;

    for (const ev of events) {
        const { uid, item_id, amount, ok, ts } = ev;
        if (!uid) continue;

        const upperUid = String(uid).toUpperCase().trim();
        // ts es Unix timestamp en segundos; si falta, usar "ahora"
        const tappedAt = ts ? new Date(Number(ts) * 1000) : new Date();

        try {
            // Buscar tarjeta y empleado
            const cardResult = await pool.query(
                `SELECT nc.employee_id, e.daily_limit, e.active
                 FROM nfc_cards nc
                 JOIN employees e ON e.id = nc.employee_id
                 WHERE nc.uid = $1 AND nc.active = true`,
                [upperUid]
            );

            if (cardResult.rowCount === 0) {
                // Tarjeta desconocida: registrar como rechazada
                await pool.query(
                    `INSERT INTO taps
                        (nfc_uid, machine_id, employee_id, approved, deny_reason, confirmed, tapped_at)
                     VALUES ($1, $2, NULL, false, 'card_unknown', NULL, $3)`,
                    [upperUid, machine.id, tappedAt]
                );
                processed++;
                continue;
            }

            const { employee_id, daily_limit, active } = cardResult.rows[0];

            if (!active || !ok) {
                // Empleado inactivo o venta fallida → no cuenta contra el límite
                await pool.query(
                    `INSERT INTO taps
                        (nfc_uid, machine_id, employee_id, approved, deny_reason, confirmed, tapped_at)
                     VALUES ($1, $2, $3, false, $4, false, $5)`,
                    [upperUid, machine.id, employee_id,
                     active ? null : 'inactive', tappedAt]
                );
                processed++;
                continue;
            }

            // ok = true: café dispensado offline
            // Verificar si superó el límite: contar taps aprobados ese día ANTES de este evento
            const dayStart = new Date(tappedAt);
            dayStart.setUTCHours(0, 0, 0, 0);
            const dayEnd = new Date(dayStart);
            dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

            const countResult = await pool.query(
                `SELECT COUNT(*) AS cnt
                 FROM taps
                 WHERE employee_id = $1
                   AND approved    = true
                   AND tapped_at  >= $2
                   AND tapped_at   < $3
                   AND tapped_at   < $4`,
                [employee_id, dayStart, dayEnd, tappedAt]
            );
            const countBefore = parseInt(countResult.rows[0].cnt, 10);
            const overLimit   = countBefore >= daily_limit;

            await pool.query(
                `INSERT INTO taps
                    (nfc_uid, machine_id, employee_id, approved, confirmed,
                     item_id, amount_cents, over_limit, tapped_at)
                 VALUES ($1, $2, $3, true, true, $4, $5, $6, $7)`,
                [upperUid, machine.id, employee_id,
                 item_id || null, amount || null, overLimit, tappedAt]
            );

            if (overLimit) {
                console.log(`[QUEUE] over_limit: uid=${upperUid} (${countBefore}/${daily_limit} ese dia)`);
            }
            broadcast({ event: 'queue_event', machine: machine.name, uid: upperUid, over_limit: overLimit });
            processed++;

        } catch (err) {
            console.error(`[QUEUE] Error uid=${upperUid}:`, err.message);
            errors++;
        }
    }

    console.log(`[QUEUE] Máquina ${machine.name}: ${processed} procesados, ${errors} errores`);
    res.status(200).json({ ok: true, processed, errors });
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
