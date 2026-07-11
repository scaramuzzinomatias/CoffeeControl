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

function normalizeSyncedReason(reason) {
    const normalized = String(reason || '').trim().toLowerCase();
    if ([
        'card_unknown',
        'limit_reached',
        'card_inactive',
        'card_lost',
        'inactive',
        'vend_cancelled'
    ].includes(normalized)) {
        return normalized;
    }
    return '';
}

async function fetchCardContext(uid, db, tenantId) {
    const result = await db.query(
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
         JOIN employees e ON e.id = nc.employee_id AND e.tenant_id = $2
         LEFT JOIN access_levels al ON al.id = e.access_level_id AND al.tenant_id = $2
         WHERE nc.uid = $1 AND nc.tenant_id = $2`,
        [uid, tenantId]
    );
    return result.rowCount > 0 ? result.rows[0] : null;
}

async function countApprovedBeforeTap(employeeId, tappedAt, tenantId, db) {
    const timeZone = await systemSettings.getBusinessTimeZone(tenantId);
    const businessDate = formatBusinessDate(tappedAt, timeZone);
    const countResult = await db.query(
        `SELECT COUNT(*) AS cnt
         FROM taps
         WHERE employee_id = $1
           AND approved    = true
           AND ${buildBusinessDayRangeSql('tapped_at', 2, 3)}
           AND tapped_at   < $4
           AND tenant_id   = $5`,
        [employeeId, timeZone, businessDate, tappedAt, tenantId]
    );
    return parseInt(countResult.rows[0]?.cnt || '0', 10);
}

async function findExactTapByEvent({ machineId, uid, tappedAt, tenantId, db }) {
    if (!tappedAt) return null;
    const result = await db.query(
        `SELECT id, approved, confirmed, item_id, amount_cents
         FROM taps
         WHERE nfc_uid = $1
           AND machine_id = $2
           AND tapped_at = $3
           AND tenant_id = $4
         ORDER BY id DESC
         LIMIT 1`,
        [uid, machineId, tappedAt, tenantId]
    );
    return result.rowCount > 0 ? result.rows[0] : null;
}

async function findPendingApprovedTap({ machineId, uid, tappedAt, tenantId, db }) {
    if (tappedAt) {
        const exact = await db.query(
            `SELECT id, item_id, amount_cents
             FROM taps
             WHERE nfc_uid = $1
               AND machine_id = $2
               AND tapped_at = $3
               AND approved = true
               AND confirmed IS NULL
               AND tenant_id = $4
             ORDER BY id DESC
             LIMIT 1`,
            [uid, machineId, tappedAt, tenantId]
        );
        if (exact.rowCount > 0) return exact.rows[0];
    }

    const fallback = await db.query(
        `SELECT id, item_id, amount_cents
         FROM taps
         WHERE nfc_uid = $1
           AND machine_id = $2
           AND approved = true
           AND confirmed IS NULL
           AND tenant_id = $3
         ORDER BY tapped_at DESC
         LIMIT 1`,
        [uid, machineId, tenantId]
    );
    return fallback.rowCount > 0 ? fallback.rows[0] : null;
}

async function insertSyncedTapDecision({ machine, uid, approved, reason, tappedAt, db }) {
    const tenantId = machine.tenant_id;
    const existing = await findExactTapByEvent({ machineId: machine.id, uid, tappedAt, tenantId, db });
    if (existing) return existing.id;

    const card = await fetchCardContext(uid, db, tenantId);
    const employeeId = card?.employee_id || null;

    if (!approved) {
        const denyReason = normalizeSyncedReason(reason) || 'card_unknown';
        const result = await db.query(
            `INSERT INTO taps
                (nfc_uid, machine_id, employee_id, approved, deny_reason, confirmed, tapped_at, tenant_id)
             VALUES ($1, $2, $3, false, $4, false, $5, $6)
             RETURNING id`,
            [uid, machine.id, employeeId, denyReason, tappedAt, tenantId]
        );
        return result.rows[0]?.id;
    }

    let overLimit = false;
    if (employeeId) {
        const countBefore = await countApprovedBeforeTap(employeeId, tappedAt, tenantId, db);
        overLimit = shouldMarkOverLimit({
            dailyLimit: card.daily_limit,
            mode: card.daily_limit_mode,
            tapsBefore: countBefore
        });
    }

    const result = await db.query(
        `INSERT INTO taps
            (nfc_uid, machine_id, employee_id, approved, confirmed, over_limit, tapped_at, tenant_id)
         VALUES ($1, $2, $3, true, NULL, $4, $5, $6)
         RETURNING id`,
        [uid, machine.id, employeeId, overLimit, tappedAt, tenantId]
    );
    return result.rows[0]?.id;
}

async function upsertVendResult({ machine, uid, vendSuccess, itemId, amount, tappedAt, db }) {
    const tenantId = machine.tenant_id;
    const pendingTap = await findPendingApprovedTap({ machineId: machine.id, uid, tappedAt, tenantId, db });

    if (pendingTap) {
        if (vendSuccess) {
            const result = await db.query(
                `UPDATE taps
                 SET confirmed = true, item_id = $1, amount_cents = $2
                 WHERE id = $3 AND tenant_id = $4
                 RETURNING id, item_id, amount_cents`,
                [itemId || null, amount || null, pendingTap.id, tenantId]
            );
            return { tap: result.rows[0] || null, created: false, success: true };
        }

        const result = await db.query(
            `UPDATE taps
             SET confirmed = false, approved = false, deny_reason = 'vend_cancelled'
             WHERE id = $1 AND tenant_id = $2
             RETURNING id`,
            [pendingTap.id, tenantId]
        );
        return { tap: result.rows[0] || null, created: false, success: false };
    }

    const card = await fetchCardContext(uid, db, tenantId);
    const employeeId = card?.employee_id || null;

    if (vendSuccess) {
        let overLimit = false;
        if (employeeId) {
            const countBefore = await countApprovedBeforeTap(employeeId, tappedAt, tenantId, db);
            overLimit = shouldMarkOverLimit({
                dailyLimit: card.daily_limit,
                mode: card.daily_limit_mode,
                tapsBefore: countBefore
            });
        }

        const result = await db.query(
            `INSERT INTO taps
                (nfc_uid, machine_id, employee_id, approved, confirmed,
                 item_id, amount_cents, over_limit, tapped_at, tenant_id)
             VALUES ($1, $2, $3, true, true, $4, $5, $6, $7, $8)
             RETURNING id, item_id, amount_cents`,
            [uid, machine.id, employeeId, itemId || null, amount || null, overLimit, tappedAt, tenantId]
        );
        return { tap: result.rows[0] || null, created: true, success: true };
    }

    const result = await db.query(
        `INSERT INTO taps
            (nfc_uid, machine_id, employee_id, approved, deny_reason, confirmed, tapped_at, tenant_id)
         VALUES ($1, $2, $3, false, 'vend_cancelled', false, $4, $5)
         RETURNING id`,
        [uid, machine.id, employeeId, tappedAt, tenantId]
    );
    return { tap: result.rows[0] || null, created: true, success: false };
}

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
        const cardResult = await req.db.query(
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
             JOIN employees e ON e.id = nc.employee_id AND e.tenant_id = $2
             LEFT JOIN access_levels al ON al.id = e.access_level_id AND al.tenant_id = $2
             WHERE nc.uid = $1 AND nc.tenant_id = $2`,
            [uid, req.machine.tenant_id]
        );

        if (cardResult.rowCount === 0) {
            await logTap({ uid, machine, approved: false, reason: 'card_unknown', db: req.db });
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
            await logTap({ uid, machine, employeeId: employee_id, approved: false, reason: 'card_lost', db: req.db });
            broadcast({ event: 'tap_denied', uid, employee: name, employee_id, department, machine: machine.name, reason: 'card_lost' });
            return res.status(403).json({ error: 'TAG reportado como perdido', reason: 'card_lost' });
        }

        if (!card_active || resolvedCardStatus !== 'active') {
            await logTap({ uid, machine, employeeId: employee_id, approved: false, reason: 'card_inactive', db: req.db });
            broadcast({ event: 'tap_denied', uid, employee: name, employee_id, department, machine: machine.name, reason: 'card_inactive' });
            return res.status(403).json({ error: 'TAG desactivado', reason: 'card_inactive' });
        }

        if (!active) {
            await logTap({ uid, machine, employeeId: employee_id, approved: false, reason: 'inactive', db: req.db });
            return res.status(403).json({ error: 'Empleado inactivo', reason: 'inactive' });
        }

        // ── 2. Contar consumo de hoy ─────────────────────────
        const { timeZone, businessDate } = await systemSettings.getBusinessTimeContext(req.machine.tenant_id);
        const countResult = await req.db.query(
            `SELECT COUNT(*) AS taps_today
             FROM taps
             WHERE employee_id = $1
               AND approved    = true
               AND ${buildBusinessDayRangeSql('tapped_at', 2, 3)}
               AND tenant_id   = $4`,
            [employee_id, timeZone, businessDate, req.machine.tenant_id]
        );

        const tapsToday = parseInt(countResult.rows[0].taps_today, 10);

        // ── 3. Verificar límite ──────────────────────────────
        if (isLimitReached({ dailyLimit: daily_limit, mode: daily_limit_mode, tapsToday })) {
            await logTap({ uid, machine, employeeId: employee_id, approved: false, reason: 'limit_reached', db: req.db });

            console.log(`[TAP] DENEGADO — ${name} (${tapsToday}/${daily_limit} hoy)`);

            // Notificar al dashboard en tiempo real
            broadcast({ event: 'tap_denied', uid, employee: name, employee_id, department, tapsToday, daily_limit, machine: machine.name });
            alerts.notifyEmployeeDailyBlocked({
                employeeId: employee_id,
                employeeName: name,
                dailyLimit: daily_limit,
                tapsToday,
                machineName: machine.name,
                uid,
                tenantId: req.machine.tenant_id
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
            }),
            db: req.db
        });

        console.log(`[TAP] APROBADO — ${name} (${tapsToday + 1}/${daily_limit} hoy)`);

        const warningLead = await alerts.getEmployeeLimitWarningLead(req.machine.tenant_id);
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
                uid,
                tenantId: req.machine.tenant_id
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
    const { nfc_uid, vend_success, item_id, amount, tap_ts } = req.body;
    const machine = req.machine;

    if (!nfc_uid) return res.status(400).json({ error: 'nfc_uid requerido' });

    const uid = nfc_uid.toUpperCase().trim();
    const tappedAt = tap_ts ? new Date(Number(tap_ts) * 1000) : new Date();

    try {
        const outcome = await upsertVendResult({
            machine,
            uid,
            vendSuccess: !!vend_success,
            itemId: item_id,
            amount,
            tappedAt,
            db: req.db
        });

        if (vend_success && outcome.tap) {
            broadcast({
                event: 'vend_confirmed',
                machine: machine.name,
                item_id: outcome.tap.item_id,
                amount: outcome.tap.amount_cents
            });
            try {
                const stockResult = await stock.recordSale({
                    machineId: machine.id,
                    tenantId: machine.tenant_id,
                    itemId: outcome.tap.item_id,
                    tapId: outcome.tap.id
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
        } else if (!vend_success) {
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
    const startedAt = Date.now();

    console.log(`[RECONCILE] START machine=${machine.name} id=${machine.id}`);
    try {
        await req.db.query(`SET LOCAL lock_timeout = '1000ms'`);
        await req.db.query(`SET LOCAL statement_timeout = '2500ms'`);
        console.log(`[RECONCILE] QUERY machine=${machine.name} id=${machine.id}`);

        const result = await req.db.query(
            `UPDATE taps
             SET confirmed = false, approved = false
             WHERE machine_id = $1
               AND tenant_id  = $2
               AND approved   = true
               AND confirmed  IS NULL
               AND tapped_at  < NOW() - INTERVAL '2 minutes'
             RETURNING id`,
            [machine.id, machine.tenant_id]
        );
        const count = result.rowCount;
        console.log(`[RECONCILE] QUERY OK machine=${machine.name} id=${machine.id} rows=${count} after=${Date.now() - startedAt}ms`);

        if (count > 0) {
            console.log(`[RECONCILE] Máquina ${machine.name}: ${count} tap(s) huérfano(s) revertido(s) al boot`);
            broadcast({ event: 'tap_reconciled', machine: machine.name, machine_id: machine.id, count });
        }
        res.status(200).json({ ok: true, reverted: count });
    } catch (err) {
        console.error(`[RECONCILE] Error machine=${machine.name} id=${machine.id} after=${Date.now() - startedAt}ms code=${err.code || '-'} message=${err.message}`);

        if (err.code === '55P03' || err.code === '57014') {
            return res.status(503).json({ error: 'reconcile_timeout' });
        }
        res.status(500).json({ error: 'Error interno' });
    }
});

// ══════════════════════════════════════════════════════
//  POST /api/tap/decisions
//  El firmware sincroniza decisiones locales de aprobación/denegación.
//  Body: [ { uid, approved, reason?, ts } ]
// ══════════════════════════════════════════════════════
router.post('/decisions', require('../middleware/machineAuth'), async (req, res) => {
    const events = req.body;
    const machine = req.machine;

    if (!Array.isArray(events)) {
        return res.status(400).json({ error: 'Body debe ser un array JSON' });
    }
    if (events.length > 100) {
        return res.status(400).json({ error: 'Máximo 100 eventos por lote' });
    }

    let processed = 0;
    let errors = 0;

    for (const ev of events) {
        const { uid, approved, reason, ts } = ev;
        if (!uid) continue;

        const upperUid = String(uid).toUpperCase().trim();
        const tappedAt = ts ? new Date(Number(ts) * 1000) : new Date();

        try {
            await insertSyncedTapDecision({
                machine,
                uid: upperUid,
                approved: !!approved,
                reason,
                tappedAt,
                db: req.db
            });

            if (!approved) {
                const syncedReason = normalizeSyncedReason(reason) || 'card_unknown';
                if (syncedReason === 'card_unknown') {
                    broadcast({ event: 'card_unknown', uid: upperUid, machine: machine.name, machine_id: machine.id });
                } else {
                    broadcast({ event: 'tap_denied', uid: upperUid, machine: machine.name, machine_id: machine.id, reason: syncedReason });
                }
            }

            processed++;
        } catch (err) {
            console.error(`[DECISIONS] Error uid=${upperUid}:`, err.message);
            errors++;
        }
    }

    res.status(200).json({ ok: true, processed, errors });
});

// ══════════════════════════════════════════════════════
//  GET /api/tap/cards
//  El firmware ESP32-C3 descarga el cache de tarjetas para modo offline.
//  Retorna: [ { uid, daily_limit, daily_limit_mode, used_today }, ... ]
// ══════════════════════════════════════════════════════
router.get('/cards', require('../middleware/machineAuth'), async (req, res) => {
    try {
        const { timeZone, businessDate } = await systemSettings.getBusinessTimeContext(req.machine.tenant_id);
        const result = await req.db.query(
            `SELECT
                nc.uid,
                ${effectivePolicy.dailyLimit} AS daily_limit,
                ${effectivePolicy.dailyLimitMode} AS daily_limit_mode,
                COALESCE(COUNT(t.id) FILTER (
                    WHERE t.approved   = true
                      AND ${buildBusinessDayRangeSql('t.tapped_at', 1, 2)}
                ), 0)::int AS used_today
             FROM nfc_cards nc
             JOIN employees e ON e.id = nc.employee_id AND e.tenant_id = $3
             LEFT JOIN access_levels al ON al.id = e.access_level_id AND al.tenant_id = $3
             LEFT JOIN taps t ON t.employee_id = nc.employee_id
             WHERE nc.active = true
               AND nc.tenant_id = $3
               AND COALESCE(nc.status, CASE WHEN nc.active THEN 'active' ELSE 'inactive' END) = 'active'
               AND e.active = true
             GROUP BY nc.uid, e.id, al.id`
            ,
            [timeZone, businessDate, req.machine.tenant_id]
        );
        const resetResult = await req.db.query(
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

    for (const ev of events) {
        const { uid, item_id, amount, ok, ts } = ev;
        if (!uid) continue;

        const upperUid = String(uid).toUpperCase().trim();
        const tappedAt = ts ? new Date(Number(ts) * 1000) : new Date();

        try {
            const outcome = await upsertVendResult({
                machine,
                uid: upperUid,
                vendSuccess: !!ok,
                itemId: item_id,
                amount,
                tappedAt,
                db: req.db
            });

            if (ok && outcome.tap) {
                broadcast({
                    event: 'queue_event',
                    machine: machine.name,
                    uid: upperUid,
                    tap_id: outcome.tap.id
                });
            }

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
async function logTap({ uid, machine, employeeId, approved, reason, overLimit = false, db }) {
    const result = await db.query(
        `INSERT INTO taps (nfc_uid, machine_id, employee_id, approved, deny_reason, over_limit, tenant_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
        [uid, machine.id, employeeId || null, approved, reason || null, overLimit, machine.tenant_id]
    );
    return result.rows[0]?.id;
}

module.exports = router;
