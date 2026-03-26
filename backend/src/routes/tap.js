// src/routes/tap.js
// Endpoint principal: el ESP8266 llama a POST /api/tap cuando alguien acerca la tarjeta NFC

const express  = require('express');
const pool     = require('../db/pool');
const { broadcast } = require('../ws');
const alerts = require('../services/alerts');
const stock = require('../services/stock');
const systemSettings = require('../services/systemSettings');
const {
    normalizeLimitMode,
    isLimitReached,
    shouldWarnAfterApproval
} = require('../lib/dailyLimit');
const { effectivePolicyExpressions } = require('../lib/accessLevels');
const {
    formatBusinessDate,
    buildBusinessDayRangeSql
} = require('../lib/businessTime');

const router = express.Router();

function shouldMarkOverLimit({ dailyLimit, mode, tapsBefore }) {
    const normalizedMode = normalizeLimitMode(mode);
    const limit = parseInt(dailyLimit, 10);
    const countBefore = parseInt(tapsBefore, 10);
    return normalizedMode !== 'off'
        && Number.isInteger(limit)
        && limit > 0
        && Number.isInteger(countBefore)
        && countBefore >= limit;
}

function normalizedCardStatus(row) {
    const status = String(row?.card_status || '').trim().toLowerCase();
    if (['active', 'inactive', 'lost'].includes(status)) return status;
    return row?.card_active ? 'active' : 'inactive';
}

const effectivePolicy = effectivePolicyExpressions('e', 'al');

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
            `SELECT nc.id, nc.employee_id, nc.active AS card_active,
                    COALESCE(nc.status, CASE WHEN nc.active THEN 'active' ELSE 'inactive' END) AS card_status,
                    e.name, e.department, e.active,
                    e.access_level_id,
                    al.name AS access_level_name,
                    ${effectivePolicy.dailyLimit} AS daily_limit,
                    ${effectivePolicy.dailyLimitMode} AS daily_limit_mode,
                    ${effectivePolicy.warningEnabled} AS warning_enabled,
                    ${effectivePolicy.source} AS policy_source
             FROM nfc_cards nc
             JOIN employees e ON e.id = nc.employee_id
             LEFT JOIN access_levels al ON al.id = e.access_level_id
             WHERE nc.uid = $1`,
            [uid]
        );

        if (cardResult.rowCount === 0) {
            await logTap({ uid, machine, approved: false, reason: 'card_unknown' });
            console.log(`[TAP] UID desconocido: ${uid}`);
            broadcast({ event: 'card_unknown', uid, machine: machine.name, machine_id: machine.id });
            return res.status(403).json({ error: 'Tarjeta no registrada', reason: 'card_unknown' });
        }

        const {
            employee_id,
            name,
            department,
            card_active,
            card_status,
            daily_limit,
            daily_limit_mode,
            warning_enabled,
            active
        } = cardResult.rows[0];

        const resolvedCardStatus = normalizedCardStatus({ card_active, card_status });

        if (resolvedCardStatus === 'lost') {
            await logTap({ uid, machine, employeeId: employee_id, approved: false, reason: 'card_lost' });
            broadcast({ event: 'tap_denied', uid, employee: name, employee_id, department, machine: machine.name, reason: 'card_lost' });
            return res.status(403).json({ error: 'TAG reportado como perdido', reason: 'card_lost' });
        }

        if (!card_active || resolvedCardStatus !== 'active') {
            await logTap({ uid, machine, employeeId: employee_id, approved: false, reason: 'card_inactive' });
            broadcast({ event: 'tap_denied', uid, employee: name, employee_id, department, machine: machine.name, reason: 'card_inactive' });
            return res.status(403).json({ error: 'TAG desactivado', reason: 'card_inactive' });
        }

        if (!active) {
            await logTap({ uid, machine, employeeId: employee_id, approved: false, reason: 'inactive' });
            return res.status(403).json({ error: 'Empleado inactivo', reason: 'inactive' });
        }

        // ── 2. Contar consumo de hoy ─────────────────────────
        const { timeZone, businessDate } = await systemSettings.getBusinessTimeContext();
        const countResult = await pool.query(
            `SELECT COUNT(*) AS taps_today
             FROM taps
             WHERE employee_id = $1
               AND approved    = true
               AND ${buildBusinessDayRangeSql('tapped_at', 2, 3)}`,
            [employee_id, timeZone, businessDate]
        );

        const tapsToday = parseInt(countResult.rows[0].taps_today, 10);

        // ── 3. Verificar límite ──────────────────────────────
        if (isLimitReached({ dailyLimit: daily_limit, mode: daily_limit_mode, tapsToday })) {
            await logTap({ uid, machine, employeeId: employee_id, approved: false, reason: 'limit_reached' });

            console.log(`[TAP] DENEGADO — ${name} (${tapsToday}/${daily_limit} hoy)`);

            // Notificar al dashboard en tiempo real
            broadcast({ event: 'tap_denied', uid, employee: name, employee_id, department, tapsToday, daily_limit, machine: machine.name });
            alerts.notifyEmployeeDailyBlocked({
                employeeId: employee_id,
                employeeName: name,
                dailyLimit: daily_limit,
                tapsToday,
                machineName: machine.name,
                uid
            }).catch(err => console.error('[ALERT] Error alerta empleado bloqueado:', err.message));

            return res.status(403).json({
                error:       'Límite diario alcanzado',
                reason:      'limit_reached',
                employee:    name,
                taps_today:  tapsToday,
                daily_limit,
                daily_limit_mode
            });
        }

        // ── 4. Aprobar ───────────────────────────────────────
        const tapId = await logTap({
            uid,
            machine,
            employeeId: employee_id,
            approved: true,
            overLimit: shouldMarkOverLimit({
                dailyLimit: daily_limit,
                mode: daily_limit_mode,
                tapsBefore: tapsToday
            })
        });

        console.log(`[TAP] APROBADO — ${name} (${tapsToday + 1}/${daily_limit} hoy)`);

        const warningLead = await alerts.getEmployeeLimitWarningLead();
        if (warning_enabled && shouldWarnAfterApproval({
            dailyLimit: daily_limit,
            mode: daily_limit_mode,
            tapsBefore: tapsToday,
            warningLead
        })) {
            alerts.notifyEmployeeLimitWarning({
                employeeId: employee_id,
                dailyLimit: daily_limit,
                tapsToday: tapsToday + 1,
                machineName: machine.name,
                uid
            }).catch(err => console.error('[ALERT] Error alerta de advertencia:', err.message));
        }

        // Notificar al dashboard en tiempo real
        broadcast({
            event: 'tap_approved',
            uid,
            employee: name,
            employee_id,
            department,
            tapsToday: tapsToday + 1,
            daily_limit,
            daily_limit_mode,
            machine: machine.name,
            tap_id: tapId
        });

        return res.status(200).json({
            approved:    true,
            employee:    name,
            tap_id:      tapId,
            taps_today:  tapsToday + 1,
            daily_limit,
            daily_limit_mode
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
            const updateResult = await pool.query(
                `UPDATE taps SET confirmed = true, item_id = $1, amount_cents = $2
                 WHERE id = (
                    SELECT id FROM taps
                    WHERE nfc_uid    = $3
                      AND machine_id = $4
                      AND approved   = true
                      AND confirmed  IS NULL
                    ORDER BY tapped_at DESC
                    LIMIT 1
                 )
                 RETURNING id, item_id, amount_cents`,
                [item_id, amount, nfc_uid.toUpperCase(), machine.id]
            );
            if (updateResult.rowCount > 0) {
                const confirmedTap = updateResult.rows[0];
                broadcast({
                    event: 'vend_confirmed',
                    machine: machine.name,
                    item_id: confirmedTap.item_id,
                    amount: confirmedTap.amount_cents
                });
                try {
                    const stockResult = await stock.recordSale({
                        machineId: machine.id,
                        itemId: confirmedTap.item_id,
                        tapId: confirmedTap.id
                    });
                    if (stockResult?.configured) {
                        await alerts.syncStockLowAlert({
                            machine,
                            stockItem: stockResult.stockItem
                        });
                        broadcast({
                            event: 'machine_stock_updated',
                            machine_id: machine.id,
                            machine: machine.name
                        });
                    }
                } catch (stockErr) {
                    console.error(`[STOCK] No se pudo descontar stock en ${machine.name}:`, stockErr.message);
                }
            }
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
//  Retorna: [ { uid, daily_limit, daily_limit_mode, used_today }, ... ]
// ══════════════════════════════════════════════════════
router.get('/cards', require('../middleware/machineAuth'), async (req, res) => {
    try {
        const { timeZone, businessDate } = await systemSettings.getBusinessTimeContext();
        const result = await pool.query(
            `SELECT
                nc.uid,
                ${effectivePolicy.dailyLimit} AS daily_limit,
                ${effectivePolicy.dailyLimitMode} AS daily_limit_mode,
                COALESCE(COUNT(t.id) FILTER (
                    WHERE t.approved   = true
                      AND ${buildBusinessDayRangeSql('t.tapped_at', 1, 2)}
                ), 0)::int AS used_today
             FROM nfc_cards nc
             JOIN employees e ON e.id = nc.employee_id
             LEFT JOIN access_levels al ON al.id = e.access_level_id
             LEFT JOIN taps t ON t.employee_id = nc.employee_id
             WHERE nc.active = true
               AND COALESCE(nc.status, CASE WHEN nc.active THEN 'active' ELSE 'inactive' END) = 'active'
               AND e.active = true
             GROUP BY nc.uid, e.id, al.id`
            ,
            [timeZone, businessDate]
        );
        const resetResult = await pool.query(
            `SELECT EXTRACT(EPOCH FROM ((($2::date + INTERVAL '1 day')::timestamp) AT TIME ZONE $1))::bigint AS next_reset_at`,
            [timeZone, businessDate]
        );
        res.json({
            date: businessDate,
            business_timezone: timeZone,
            next_reset_at: parseInt(resetResult.rows[0]?.next_reset_at || '0', 10) || 0,
            cards: result.rows
        });
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
    const timeZone = await systemSettings.getBusinessTimeZone();

    for (const ev of events) {
        const { uid, item_id, amount, ok, ts } = ev;
        if (!uid) continue;

        const upperUid = String(uid).toUpperCase().trim();
        // ts es Unix timestamp en segundos; si falta, usar "ahora"
        const tappedAt = ts ? new Date(Number(ts) * 1000) : new Date();

        try {
            // Buscar tarjeta y empleado
            const cardResult = await pool.query(
                `SELECT nc.employee_id, nc.active AS card_active,
                        COALESCE(nc.status, CASE WHEN nc.active THEN 'active' ELSE 'inactive' END) AS card_status,
                        e.name, e.active,
                        e.access_level_id,
                        al.name AS access_level_name,
                        ${effectivePolicy.dailyLimit} AS daily_limit,
                        ${effectivePolicy.dailyLimitMode} AS daily_limit_mode,
                        ${effectivePolicy.warningEnabled} AS warning_enabled,
                        ${effectivePolicy.source} AS policy_source
                 FROM nfc_cards nc
                 JOIN employees e ON e.id = nc.employee_id
                 LEFT JOIN access_levels al ON al.id = e.access_level_id
                 WHERE nc.uid = $1`,
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

            const {
                employee_id,
                name,
                card_active,
                card_status,
                daily_limit,
                daily_limit_mode,
                warning_enabled,
                active
            } = cardResult.rows[0];

            const resolvedCardStatus = normalizedCardStatus({ card_active, card_status });

            if (resolvedCardStatus === 'lost') {
                await pool.query(
                    `INSERT INTO taps
                        (nfc_uid, machine_id, employee_id, approved, deny_reason, confirmed, tapped_at)
                     VALUES ($1, $2, $3, false, 'card_lost', false, $4)`,
                    [upperUid, machine.id, employee_id, tappedAt]
                );
                processed++;
                continue;
            }

            if (!card_active || resolvedCardStatus !== 'active') {
                await pool.query(
                    `INSERT INTO taps
                        (nfc_uid, machine_id, employee_id, approved, deny_reason, confirmed, tapped_at)
                     VALUES ($1, $2, $3, false, 'card_inactive', false, $4)`,
                    [upperUid, machine.id, employee_id, tappedAt]
                );
                processed++;
                continue;
            }

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
            const businessDate = formatBusinessDate(tappedAt, timeZone);

            const countResult = await pool.query(
                `SELECT COUNT(*) AS cnt
                 FROM taps
                 WHERE employee_id = $1
                   AND approved    = true
                   AND ${buildBusinessDayRangeSql('tapped_at', 2, 3)}
                   AND tapped_at   < $4`,
                [employee_id, timeZone, businessDate, tappedAt]
            );
            const countBefore = parseInt(countResult.rows[0].cnt, 10);
            const overLimit = shouldMarkOverLimit({
                dailyLimit: daily_limit,
                mode: daily_limit_mode,
                tapsBefore: countBefore
            });

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

            const warningLead = await alerts.getEmployeeLimitWarningLead();
            if (warning_enabled && shouldWarnAfterApproval({
                dailyLimit: daily_limit,
                mode: daily_limit_mode,
                tapsBefore: countBefore,
                warningLead
            })) {
                alerts.notifyEmployeeLimitWarning({
                    employeeId: employee_id,
                    dailyLimit: daily_limit,
                    tapsToday: countBefore + 1,
                    machineName: machine.name,
                    uid: upperUid
                }).catch(err => console.error(`[ALERT] Error alerta advertencia uid=${upperUid}:`, err.message));
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
async function logTap({ uid, machine, employeeId, approved, reason, overLimit = false }) {
    const result = await pool.query(
        `INSERT INTO taps (nfc_uid, machine_id, employee_id, approved, deny_reason, over_limit)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [uid, machine.id, employeeId || null, approved, reason || null, overLimit]
    );
    return result.rows[0]?.id;
}

module.exports = router;
