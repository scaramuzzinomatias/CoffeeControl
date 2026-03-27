const pool = require('../db/pool');
const audit = require('../services/audit');

function normalizeOptionalString(value) {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed || null;
}

function normalizeOptionalBoolean(value) {
    if (typeof value === 'boolean') return value;
    if (value === 'true') return true;
    if (value === 'false') return false;
    return null;
}

function normalizeCardUid(value) {
    const normalized = String(value || '').trim().toUpperCase();
    if (!/^[A-Z0-9]{4,20}$/.test(normalized)) {
        const err = new Error('UID de TAG NFC inválido');
        err.status = 400;
        throw err;
    }
    return normalized;
}

function normalizeCardStatus(value, { allowNull = false } = {}) {
    if (value === null || value === undefined || value === '') {
        return allowNull ? null : 'active';
    }
    const normalized = String(value).trim().toLowerCase();
    if (['active', 'inactive', 'lost'].includes(normalized)) return normalized;
    const err = new Error('Estado de TAG NFC inválido');
    err.status = 400;
    throw err;
}

function cardStatusFromLegacy(active, status = null) {
    if (status && ['active', 'inactive', 'lost'].includes(String(status).trim().toLowerCase())) {
        return String(status).trim().toLowerCase();
    }
    return active ? 'active' : 'inactive';
}

function mapCardRow(row) {
    if (!row) return null;
    return {
        ...row,
        active: Boolean(row.active),
        status: cardStatusFromLegacy(row.active, row.status)
    };
}

async function getEmployeeForCardOperation(employeeId) {
    const result = await pool.query(
        `SELECT id, name, department, email, active
         FROM employees
         WHERE id = $1`,
        [employeeId]
    );
    if (!result.rowCount) {
        const err = new Error('Empleado no encontrado');
        err.status = 404;
        throw err;
    }
    if (!result.rows[0].active) {
        const err = new Error('El empleado está inactivo');
        err.status = 400;
        throw err;
    }
    return result.rows[0];
}

async function searchEmployeesForCardOps(query, { limit = 20 } = {}) {
    const normalized = String(query || '').trim();
    if (normalized.length < 2) return [];
    const result = await pool.query(
        `SELECT
            e.id,
            e.name,
            e.department,
            e.email,
            e.dni,
            e.legajo,
            e.active,
            COALESCE(
                json_agg(
                    json_build_object(
                        'id', nc.id,
                        'uid', nc.uid,
                        'label', nc.label,
                        'active', nc.active,
                        'status', COALESCE(nc.status, CASE WHEN nc.active THEN 'active' ELSE 'inactive' END)
                    )
                    ORDER BY nc.id
                ) FILTER (WHERE nc.id IS NOT NULL),
                '[]'::json
            ) AS nfc_cards
         FROM employees e
         LEFT JOIN nfc_cards nc
           ON nc.employee_id = e.id
         WHERE e.active = true
           AND (
                e.name ILIKE $1
             OR COALESCE(e.email, '') ILIKE $1
             OR COALESCE(e.legajo, '') ILIKE $1
             OR COALESCE(e.dni, '') ILIKE $1
           )
         GROUP BY e.id
         ORDER BY e.name
         LIMIT $2`,
        [`%${normalized}%`, Math.min(Math.max(Number.parseInt(limit, 10) || 20, 1), 50)]
    );
    return result.rows;
}

async function lookupCardByUid(uid) {
    const normalizedUid = normalizeCardUid(uid);
    const result = await pool.query(
        `SELECT
            nc.id,
            nc.uid,
            nc.label,
            nc.employee_id,
            nc.active,
            COALESCE(nc.status, CASE WHEN nc.active THEN 'active' ELSE 'inactive' END) AS status,
            e.name AS employee_name,
            e.department AS employee_department,
            e.email AS employee_email
         FROM nfc_cards nc
         LEFT JOIN employees e
           ON e.id = nc.employee_id
         WHERE nc.uid = $1`,
        [normalizedUid]
    );
    return result.rowCount ? mapCardRow(result.rows[0]) : null;
}

async function registerOrAssignCard({ req, employeeId, uid, label, source = 'panel' }) {
    const normalizedUid = normalizeCardUid(uid);
    const employee = await getEmployeeForCardOperation(employeeId);
    const before = await lookupCardByUid(normalizedUid);

    const result = await pool.query(
        `INSERT INTO nfc_cards (uid, employee_id, label)
         VALUES ($1, $2, $3)
         ON CONFLICT (uid) DO UPDATE SET
            employee_id = EXCLUDED.employee_id,
            label = EXCLUDED.label,
            active = true,
            status = 'active'
         RETURNING id, uid, label, employee_id, active, status`,
        [
            normalizedUid,
            employeeId,
            normalizeOptionalString(label) || 'Tarjeta'
        ]
    );

    const card = mapCardRow({
        ...result.rows[0],
        employee_name: employee.name
    });

    const action = before ? 'nfc_card.update' : 'nfc_card.create';
    const summary = before
        ? before.employee_id === employee.id
            ? `Reactivó o actualizó el TAG ${card.uid} de ${employee.name}`
            : `Reasignó el TAG ${card.uid} a ${employee.name}`
        : `Asoció el TAG ${card.uid} a ${employee.name}`;

    await audit.logAuditEvent({
        req,
        action,
        entityType: 'nfc_card',
        entityId: card.id,
        entityLabel: card.uid,
        summary,
        details: {
            source,
            before,
            after: {
                ...card,
                employee_name: employee.name
            }
        }
    });

    return { card: { ...card, employee_name: employee.name }, employee };
}

async function updateCardAssignment({
    req,
    cardId,
    label,
    employeeId,
    status,
    active,
    source = 'panel'
}) {
    const beforeResult = await pool.query(
        `SELECT
            nc.id,
            nc.uid,
            nc.label,
            nc.employee_id,
            nc.active,
            COALESCE(nc.status, CASE WHEN nc.active THEN 'active' ELSE 'inactive' END) AS status,
            e.name AS employee_name
         FROM nfc_cards nc
         LEFT JOIN employees e
           ON e.id = nc.employee_id
         WHERE nc.id = $1`,
        [cardId]
    );
    if (!beforeResult.rowCount) {
        const err = new Error('TAG NFC no encontrado');
        err.status = 404;
        throw err;
    }

    const before = mapCardRow(beforeResult.rows[0]);
    const normalizedActive = normalizeOptionalBoolean(active);
    const nextEmployeeId = employeeId ?? null;
    let targetEmployee = null;
    if (nextEmployeeId !== null) {
        targetEmployee = await getEmployeeForCardOperation(nextEmployeeId);
    }

    const normalizedStatus = status === undefined
        ? null
        : normalizeCardStatus(status, { allowNull: true });
    const finalStatus = normalizedStatus !== null
        ? normalizedStatus
        : nextEmployeeId !== null
            ? 'active'
            : normalizedActive === null
                ? null
                : normalizedActive
                    ? 'active'
                    : 'inactive';

    const result = await pool.query(
        `UPDATE nfc_cards SET
            status = COALESCE($1, status, CASE WHEN active THEN 'active' ELSE 'inactive' END),
            active = CASE
                        WHEN COALESCE($1, status, CASE WHEN active THEN 'active' ELSE 'inactive' END) = 'active' THEN true
                        ELSE false
                     END,
            label = COALESCE($2, label),
            employee_id = COALESCE($3::int, employee_id)
         WHERE id = $4
         RETURNING id, uid, label, employee_id, active, status`,
        [
            finalStatus,
            normalizeOptionalString(label),
            nextEmployeeId,
            cardId
        ]
    );

    const card = mapCardRow({
        ...result.rows[0],
        employee_name: targetEmployee?.name || before.employee_name
    });

    const summary = nextEmployeeId !== null && nextEmployeeId !== before.employee_id
        ? `Reasignó el TAG ${card.uid} a ${targetEmployee?.name || `empleado ${card.employee_id}`}`
        : card.status === 'lost'
            ? `Marcó el TAG ${card.uid} como perdido`
            : card.status === 'inactive'
                ? `Dio de baja el TAG ${card.uid}`
                : `Actualizó el TAG ${card.uid}`;

    await audit.logAuditEvent({
        req,
        action: card.status === 'inactive' ? 'nfc_card.deactivate' : 'nfc_card.update',
        entityType: 'nfc_card',
        entityId: card.id,
        entityLabel: card.uid,
        summary,
        details: {
            source,
            before,
            after: {
                ...card,
                employee_name: targetEmployee?.name || before.employee_name || null
            }
        }
    });

    return {
        card: {
            ...card,
            employee_name: targetEmployee?.name || before.employee_name || null
        }
    };
}

async function deactivateCard({
    req,
    cardId,
    employeeId,
    source = 'panel'
}) {
    const result = await pool.query(
        `UPDATE nfc_cards
         SET active = false,
             status = 'inactive'
         WHERE id = $1
           AND employee_id = $2
         RETURNING id, uid, label, employee_id, active, status`,
        [cardId, employeeId]
    );
    if (!result.rowCount) {
        const err = new Error('TAG NFC no encontrado');
        err.status = 404;
        throw err;
    }

    const card = mapCardRow(result.rows[0]);
    await audit.logAuditEvent({
        req,
        action: 'nfc_card.deactivate',
        entityType: 'nfc_card',
        entityId: card.id,
        entityLabel: card.uid,
        summary: `Dio de baja el TAG ${card.uid}`,
        details: {
            source,
            employee_id: card.employee_id,
            label: card.label
        }
    });

    return { card };
}

module.exports = {
    normalizeCardUid,
    normalizeCardStatus,
    cardStatusFromLegacy,
    searchEmployeesForCardOps,
    lookupCardByUid,
    registerOrAssignCard,
    updateCardAssignment,
    deactivateCard
};
