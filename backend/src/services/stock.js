const pool = require('../db/pool');

function stockError(statusCode, message) {
    const err = new Error(message);
    err.statusCode = statusCode;
    return err;
}

function parseInteger(value, fallback = null) {
    if (value === null || value === undefined || value === '') return fallback;
    const parsed = parseInt(value, 10);
    return Number.isInteger(parsed) ? parsed : fallback;
}

function classifyStockStatus(item) {
    if (!item.active) return { key: 'inactive', label: 'Inactivo', badge: 'bw' };
    if ((item.current_units || 0) <= 0) return { key: 'empty', label: 'Sin stock', badge: 'bd' };
    if ((item.current_units || 0) <= (item.min_units || 0)) return { key: 'low', label: 'Bajo', badge: 'bw' };
    return { key: 'ok', label: 'OK', badge: 'bs' };
}

function serializeStockItem(row) {
    const item = {
        id: parseInteger(row.id, 0),
        machine_id: parseInteger(row.machine_id, 0),
        item_id: parseInteger(row.item_id, 0),
        product_name: row.product_name || '',
        slot_label: row.slot_label || null,
        capacity_units: parseInteger(row.capacity_units, 0),
        current_units: parseInteger(row.current_units, 0),
        min_units: parseInteger(row.min_units, 0),
        active: row.active !== false,
        created_at: row.created_at,
        updated_at: row.updated_at
    };
    const status = classifyStockStatus(item);
    const fillPct = item.capacity_units > 0
        ? Math.round((Math.max(item.current_units, 0) / item.capacity_units) * 100)
        : null;
    return {
        ...item,
        status: status.key,
        status_label: status.label,
        status_badge: status.badge,
        fill_pct: fillPct
    };
}

function serializeStockMovement(row) {
    return {
        id: parseInteger(row.id, 0),
        machine_id: parseInteger(row.machine_id, 0),
        stock_item_id: parseInteger(row.stock_item_id, null),
        item_id: parseInteger(row.item_id, null),
        movement_type: row.movement_type,
        quantity_delta: parseInteger(row.quantity_delta, 0),
        previous_units: parseInteger(row.previous_units, null),
        current_units: parseInteger(row.current_units, null),
        tap_id: parseInteger(row.tap_id, null),
        actor_user_id: parseInteger(row.actor_user_id, null),
        actor_username: row.actor_username || null,
        product_name: row.product_name || null,
        slot_label: row.slot_label || null,
        note: row.note || null,
        created_at: row.created_at
    };
}

function buildSummary(items) {
    return items.reduce((acc, item) => {
        if (item.active) {
            acc.configured_items += 1;
            acc.total_units += item.current_units;
            if (item.status === 'low') acc.low_items += 1;
            if (item.status === 'empty') acc.empty_items += 1;
        } else {
            acc.inactive_items += 1;
        }
        return acc;
    }, {
        configured_items: 0,
        low_items: 0,
        empty_items: 0,
        inactive_items: 0,
        total_units: 0
    });
}

function sanitizeOptionalString(value, maxLen) {
    if (value === null || value === undefined) return null;
    const trimmed = String(value).trim();
    if (!trimmed) return null;
    return trimmed.slice(0, maxLen);
}

function validateStockDraft(input = {}, { partial = false } = {}) {
    const itemId = parseInteger(input.item_id, null);
    const capacityUnits = parseInteger(input.capacity_units, null);
    const currentUnits = parseInteger(input.current_units, null);
    const minUnits = parseInteger(input.min_units, null);
    const active = input.active === undefined ? undefined : !!input.active;
    const productName = input.product_name === undefined ? undefined : sanitizeOptionalString(input.product_name, 120);
    const slotLabel = input.slot_label === undefined ? undefined : sanitizeOptionalString(input.slot_label, 40);

    if (!partial || input.item_id !== undefined) {
        if (!Number.isInteger(itemId) || itemId < 0) {
            throw stockError(400, 'El número de selección (item_id) debe ser un entero positivo o cero.');
        }
    }
    if (!partial || input.product_name !== undefined) {
        if (!productName) {
            throw stockError(400, 'El nombre del producto es requerido.');
        }
    }
    if (!partial || input.capacity_units !== undefined) {
        if (!Number.isInteger(capacityUnits) || capacityUnits < 0) {
            throw stockError(400, 'La capacidad debe ser un entero mayor o igual a cero.');
        }
    }
    if (!partial || input.current_units !== undefined) {
        if (!Number.isInteger(currentUnits) || currentUnits < 0) {
            throw stockError(400, 'El stock actual debe ser un entero mayor o igual a cero.');
        }
    }
    if (!partial || input.min_units !== undefined) {
        if (!Number.isInteger(minUnits) || minUnits < 0) {
            throw stockError(400, 'El mínimo de alerta debe ser un entero mayor o igual a cero.');
        }
    }

    return {
        item_id: itemId,
        product_name: productName,
        slot_label: slotLabel,
        capacity_units: capacityUnits,
        current_units: currentUnits,
        min_units: minUnits,
        active
    };
}

async function withTransaction(work) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await work(client);
        await client.query('COMMIT');
        return result;
    } catch (err) {
        try { await client.query('ROLLBACK'); } catch (_) {}
        throw err;
    } finally {
        client.release();
    }
}

async function getMachineStock(machineId, tenantId, { includeInactive = true, movementLimit = 20 } = {}) {
    const machineIdInt = parseInteger(machineId, null);
    if (!Number.isInteger(machineIdInt)) {
        throw stockError(400, 'ID de máquina inválido.');
    }
    const tenantIdInt = parseInteger(tenantId, null);
    const itemParams = [machineIdInt, tenantIdInt];
    const inactiveSql = includeInactive ? '' : 'AND si.active = true';
    const itemsResult = await pool.query(
        `SELECT
            si.id,
            si.machine_id,
            si.item_id,
            si.product_name,
            si.slot_label,
            si.capacity_units,
            si.current_units,
            si.min_units,
            si.active,
            si.created_at,
            si.updated_at
         FROM machine_stock_items si
         WHERE si.machine_id = $1
           AND si.tenant_id = $2
           ${inactiveSql}
         ORDER BY si.active DESC, si.item_id ASC, si.id ASC`,
        itemParams
    );
    const items = itemsResult.rows.map(serializeStockItem);
    const movementsResult = await pool.query(
        `SELECT
            sm.id,
            sm.machine_id,
            sm.stock_item_id,
            sm.item_id,
            sm.movement_type,
            sm.quantity_delta,
            sm.previous_units,
            sm.current_units,
            sm.tap_id,
            sm.actor_user_id,
            au.username AS actor_username,
            COALESCE(si.product_name, CONCAT('Selección ', sm.item_id::text)) AS product_name,
            si.slot_label,
            sm.note,
            sm.created_at
         FROM stock_movements sm
         LEFT JOIN machine_stock_items si ON si.id = sm.stock_item_id
         LEFT JOIN admin_users au ON au.id = sm.actor_user_id
         WHERE sm.machine_id = $1
           AND sm.tenant_id = $2
         ORDER BY sm.created_at DESC, sm.id DESC
         LIMIT $3`,
        [machineIdInt, tenantIdInt, Math.min(Math.max(parseInteger(movementLimit, 20) || 20, 1), 100)]
    );
    return {
        summary: buildSummary(items),
        items,
        movements: movementsResult.rows.map(serializeStockMovement)
    };
}

async function getMachineStockSummaryMap(machineIds = [], tenantId = null) {
    const ids = (Array.isArray(machineIds) ? machineIds : [])
        .map(id => parseInteger(id, null))
        .filter(id => Number.isInteger(id));
    if (!ids.length) return new Map();

    const tenantIdInt = parseInteger(tenantId, null);
    const result = await pool.query(
        `SELECT
            machine_id,
            COUNT(*) FILTER (WHERE active = true) AS configured_items,
            COUNT(*) FILTER (WHERE active = true AND current_units > 0 AND current_units <= min_units) AS low_items,
            COUNT(*) FILTER (WHERE active = true AND current_units <= 0) AS empty_items,
            COUNT(*) FILTER (WHERE active = false) AS inactive_items,
            COALESCE(SUM(current_units) FILTER (WHERE active = true), 0) AS total_units
         FROM machine_stock_items
         WHERE machine_id = ANY($1::int[])
           AND tenant_id = $2
         GROUP BY machine_id`,
        [ids, tenantIdInt]
    );

    const map = new Map();
    for (const row of result.rows) {
        map.set(parseInteger(row.machine_id, 0), {
            configured_items: parseInteger(row.configured_items, 0),
            low_items: parseInteger(row.low_items, 0),
            empty_items: parseInteger(row.empty_items, 0),
            inactive_items: parseInteger(row.inactive_items, 0),
            total_units: parseInteger(row.total_units, 0)
        });
    }
    return map;
}

async function createStockItem({
    machineId,
    tenantId,
    itemId,
    productName,
    slotLabel,
    capacityUnits,
    currentUnits,
    minUnits,
    active = true,
    actorUserId = null,
    note = null
}) {
    const draft = validateStockDraft({
        item_id: itemId,
        product_name: productName,
        slot_label: slotLabel,
        capacity_units: capacityUnits,
        current_units: currentUnits,
        min_units: minUnits,
        active
    });
    const tenantIdInt = parseInteger(tenantId, null);

    return withTransaction(async (client) => {
        const insertResult = await client.query(
            `INSERT INTO machine_stock_items(
                machine_id,
                tenant_id,
                item_id,
                product_name,
                slot_label,
                capacity_units,
                current_units,
                min_units,
                active
             )
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             RETURNING *`,
            [
                machineId,
                tenantIdInt,
                draft.item_id,
                draft.product_name,
                draft.slot_label,
                draft.capacity_units,
                draft.current_units,
                draft.min_units,
                draft.active !== false
            ]
        );
        const stockItem = serializeStockItem(insertResult.rows[0]);

        if (stockItem.current_units !== 0) {
            await client.query(
                `INSERT INTO stock_movements(
                    machine_id,
                    tenant_id,
                    stock_item_id,
                    item_id,
                    movement_type,
                    quantity_delta,
                    previous_units,
                    current_units,
                    actor_user_id,
                    note
                 )
                 VALUES ($1, $2, $3, $4, 'adjustment', $5, 0, $6, $7, $8)`,
                [
                    machineId,
                    tenantIdInt,
                    stockItem.id,
                    stockItem.item_id,
                    stockItem.current_units,
                    stockItem.current_units,
                    actorUserId,
                    sanitizeOptionalString(note, 255) || 'Configuración inicial de stock'
                ]
            );
        }

        return { stockItem };
    });
}

async function updateStockItem({
    machineId,
    tenantId,
    stockItemId,
    itemId,
    productName,
    slotLabel,
    capacityUnits,
    currentUnits,
    minUnits,
    active,
    actorUserId = null,
    note = null
}) {
    const draft = validateStockDraft({
        item_id: itemId,
        product_name: productName,
        slot_label: slotLabel,
        capacity_units: capacityUnits,
        current_units: currentUnits,
        min_units: minUnits,
        active
    }, { partial: true });
    const tenantIdInt = parseInteger(tenantId, null);

    return withTransaction(async (client) => {
        const existingResult = await client.query(
            `SELECT *
             FROM machine_stock_items
             WHERE id = $1 AND machine_id = $2 AND tenant_id = $3
             FOR UPDATE`,
            [stockItemId, machineId, tenantIdInt]
        );
        if (existingResult.rowCount === 0) {
            throw stockError(404, 'Selección de stock no encontrada.');
        }

        const before = serializeStockItem(existingResult.rows[0]);
        const next = {
            item_id: draft.item_id ?? before.item_id,
            product_name: draft.product_name ?? before.product_name,
            slot_label: draft.slot_label === undefined ? before.slot_label : draft.slot_label,
            capacity_units: draft.capacity_units ?? before.capacity_units,
            current_units: draft.current_units ?? before.current_units,
            min_units: draft.min_units ?? before.min_units,
            active: draft.active === undefined ? before.active : draft.active
        };

        const updateResult = await client.query(
            `UPDATE machine_stock_items
             SET item_id = $1,
                 product_name = $2,
                 slot_label = $3,
                 capacity_units = $4,
                 current_units = $5,
                 min_units = $6,
                 active = $7,
                 updated_at = NOW()
             WHERE id = $8 AND machine_id = $9 AND tenant_id = $10
             RETURNING *`,
            [
                next.item_id,
                next.product_name,
                next.slot_label,
                next.capacity_units,
                next.current_units,
                next.min_units,
                next.active,
                stockItemId,
                machineId,
                tenantIdInt
            ]
        );

        const after = serializeStockItem(updateResult.rows[0]);
        if (after.current_units !== before.current_units) {
            await client.query(
                `INSERT INTO stock_movements(
                    machine_id,
                    tenant_id,
                    stock_item_id,
                    item_id,
                    movement_type,
                    quantity_delta,
                    previous_units,
                    current_units,
                    actor_user_id,
                    note
                 )
                 VALUES ($1, $2, $3, $4, 'adjustment', $5, $6, $7, $8, $9)`,
                [
                    machineId,
                    tenantIdInt,
                    after.id,
                    after.item_id,
                    after.current_units - before.current_units,
                    before.current_units,
                    after.current_units,
                    actorUserId,
                    sanitizeOptionalString(note, 255) || 'Ajuste desde configuración de stock'
                ]
            );
        }

        return { before, stockItem: after };
    });
}

async function restockStockItem({
    machineId,
    tenantId,
    stockItemId,
    quantity,
    actorUserId = null,
    note = null
}) {
    const quantityInt = parseInteger(quantity, null);
    if (!Number.isInteger(quantityInt) || quantityInt <= 0) {
        throw stockError(400, 'La reposición debe ser un entero mayor a cero.');
    }
    const tenantIdInt = parseInteger(tenantId, null);

    return withTransaction(async (client) => {
        const existingResult = await client.query(
            `SELECT *
             FROM machine_stock_items
             WHERE id = $1 AND machine_id = $2 AND tenant_id = $3
             FOR UPDATE`,
            [stockItemId, machineId, tenantIdInt]
        );
        if (existingResult.rowCount === 0) {
            throw stockError(404, 'Selección de stock no encontrada.');
        }

        const before = serializeStockItem(existingResult.rows[0]);
        const updateResult = await client.query(
            `UPDATE machine_stock_items
             SET current_units = current_units + $1,
                 updated_at = NOW()
             WHERE id = $2 AND machine_id = $3 AND tenant_id = $4
             RETURNING *`,
            [quantityInt, stockItemId, machineId, tenantIdInt]
        );
        const after = serializeStockItem(updateResult.rows[0]);

        await client.query(
            `INSERT INTO stock_movements(
                machine_id,
                tenant_id,
                stock_item_id,
                item_id,
                movement_type,
                quantity_delta,
                previous_units,
                current_units,
                actor_user_id,
                note
             )
             VALUES ($1, $2, $3, $4, 'restock', $5, $6, $7, $8, $9)`,
            [
                machineId,
                tenantIdInt,
                after.id,
                after.item_id,
                quantityInt,
                before.current_units,
                after.current_units,
                actorUserId,
                sanitizeOptionalString(note, 255) || 'Reposición manual'
            ]
        );

        return { before, stockItem: after };
    });
}

async function adjustStockItem({
    machineId,
    tenantId,
    stockItemId,
    currentUnits,
    actorUserId = null,
    note = null
}) {
    const currentUnitsInt = parseInteger(currentUnits, null);
    if (!Number.isInteger(currentUnitsInt) || currentUnitsInt < 0) {
        throw stockError(400, 'El nuevo stock debe ser un entero mayor o igual a cero.');
    }
    const tenantIdInt = parseInteger(tenantId, null);

    return withTransaction(async (client) => {
        const existingResult = await client.query(
            `SELECT *
             FROM machine_stock_items
             WHERE id = $1 AND machine_id = $2 AND tenant_id = $3
             FOR UPDATE`,
            [stockItemId, machineId, tenantIdInt]
        );
        if (existingResult.rowCount === 0) {
            throw stockError(404, 'Selección de stock no encontrada.');
        }

        const before = serializeStockItem(existingResult.rows[0]);
        const updateResult = await client.query(
            `UPDATE machine_stock_items
             SET current_units = $1,
                 updated_at = NOW()
             WHERE id = $2 AND machine_id = $3 AND tenant_id = $4
             RETURNING *`,
            [currentUnitsInt, stockItemId, machineId, tenantIdInt]
        );
        const after = serializeStockItem(updateResult.rows[0]);
        if (after.current_units !== before.current_units) {
            await client.query(
                `INSERT INTO stock_movements(
                    machine_id,
                    tenant_id,
                    stock_item_id,
                    item_id,
                    movement_type,
                    quantity_delta,
                    previous_units,
                    current_units,
                    actor_user_id,
                    note
                 )
                 VALUES ($1, $2, $3, $4, 'adjustment', $5, $6, $7, $8, $9)`,
                [
                    machineId,
                    tenantIdInt,
                    after.id,
                    after.item_id,
                    after.current_units - before.current_units,
                    before.current_units,
                    after.current_units,
                    actorUserId,
                    sanitizeOptionalString(note, 255) || 'Ajuste manual'
                ]
            );
        }

        return { before, stockItem: after };
    });
}

async function recordSale({
    machineId,
    tenantId,
    itemId,
    tapId = null
}) {
    const itemIdInt = parseInteger(itemId, null);
    if (!Number.isInteger(itemIdInt) || itemIdInt < 0) {
        return { applied: false, configured: false, reason: 'invalid_item_id' };
    }
    const tenantIdInt = parseInteger(tenantId, null);

    return withTransaction(async (client) => {
        const itemResult = await client.query(
            `SELECT *
             FROM machine_stock_items
             WHERE machine_id = $1
               AND tenant_id = $2
               AND item_id = $3
               AND active = true
             LIMIT 1
             FOR UPDATE`,
            [machineId, tenantIdInt, itemIdInt]
        );

        if (itemResult.rowCount === 0) {
            await client.query(
                `INSERT INTO stock_movements(
                    machine_id,
                    tenant_id,
                    stock_item_id,
                    item_id,
                    movement_type,
                    quantity_delta,
                    tap_id,
                    note
                 )
                 VALUES ($1, $2, NULL, $3, 'unconfigured_sale', -1, $4, $5)`,
                [
                    machineId,
                    tenantIdInt,
                    itemIdInt,
                    tapId,
                    'Venta confirmada para una selección sin stock configurado'
                ]
            );
            return { applied: true, configured: false, reason: 'unconfigured_selection' };
        }

        const before = serializeStockItem(itemResult.rows[0]);
        const updateResult = await client.query(
            `UPDATE machine_stock_items
             SET current_units = current_units - 1,
                 updated_at = NOW()
             WHERE id = $1
             RETURNING *`,
            [before.id]
        );
        const after = serializeStockItem(updateResult.rows[0]);

        await client.query(
            `INSERT INTO stock_movements(
                machine_id,
                tenant_id,
                stock_item_id,
                item_id,
                movement_type,
                quantity_delta,
                previous_units,
                current_units,
                tap_id,
                note
             )
             VALUES ($1, $2, $3, $4, 'sale', -1, $5, $6, $7, $8)`,
            [
                machineId,
                tenantIdInt,
                after.id,
                after.item_id,
                before.current_units,
                after.current_units,
                tapId,
                'Descuento automático por expendio confirmado'
            ]
        );

        return { applied: true, configured: true, before, stockItem: after };
    });
}

module.exports = {
    classifyStockStatus,
    validateStockDraft,
    getMachineStock,
    getMachineStockSummaryMap,
    createStockItem,
    updateStockItem,
    restockStockItem,
    adjustStockItem,
    recordSale
};
