const express = require('express');
const pool = require('../db/pool');
const bootstrapPool = require('../db/bootstrapPool');
const { broadcast } = require('../ws');
const {
    requireManager,
    requireMachineOperator,
    requireMachineSetup,
    requireMachineTechnicalConfig
} = require('../middleware/roleAccess');
const alerts = require('../services/alerts');
const audit = require('../services/audit');
const stock = require('../services/stock');

const router = express.Router();
const MACHINE_ONLINE_WINDOW_MS = 180000;
const DEFAULT_MACHINE_TECH_CONFIG = Object.freeze({
    price_cents: 1200,
    pricing_profile: 'rubino_half_credit',
    mdb_feature_level: 1,
    mdb_country_code: 50,
    mdb_scale_factor: 100,
    mdb_decimal_places: 2,
    mdb_max_response_time: 5,
    mdb_misc_options: 0,
    config_version: 1,
    config_source: 'backend',
    config_updated_at: null
});
const MACHINE_TECH_CONFIG_FIELDS = Object.freeze([
    'price_cents',
    'pricing_profile',
    'mdb_feature_level',
    'mdb_country_code',
    'mdb_scale_factor',
    'mdb_decimal_places',
    'mdb_max_response_time',
    'mdb_misc_options'
]);
const MACHINE_TECH_META_FIELDS = Object.freeze([
    'technical_config_version',
    'technical_config_source',
    'technical_config_updated_at'
]);
const MACHINE_TECH_REPORTED_FIELDS = Object.freeze([
    'last_reported_technical_config',
    'last_reported_technical_config_at'
]);
const MACHINE_OTA_FIELDS = Object.freeze([
    'current_firmware_version',
    'desired_firmware_release_id',
    'desired_firmware_version',
    'firmware_update_status',
    'firmware_update_message',
    'firmware_update_started_at',
    'firmware_update_completed_at'
]);
const MACHINE_TECH_CONFIG_SQL = MACHINE_TECH_CONFIG_FIELDS.join(', ');
const MACHINE_TECH_META_SQL = MACHINE_TECH_META_FIELDS.join(', ');
const MACHINE_TECH_REPORTED_SQL = MACHINE_TECH_REPORTED_FIELDS.join(', ');
const MACHINE_OTA_SQL = MACHINE_OTA_FIELDS.join(', ');
const MACHINE_TECH_CONFIG_SELECT = `id, name, location, last_seen, ${MACHINE_TECH_CONFIG_SQL}, ${MACHINE_TECH_META_SQL}, ${MACHINE_TECH_REPORTED_SQL}, ${MACHINE_OTA_SQL}`;
const MACHINE_TECH_FIELD_LABELS = Object.freeze({
    price_cents: 'Precio',
    pricing_profile: 'Perfil MDB',
    mdb_feature_level: 'Feature level',
    mdb_country_code: 'Country code',
    mdb_scale_factor: 'Scale factor',
    mdb_decimal_places: 'Decimal places',
    mdb_max_response_time: 'Max response time',
    mdb_misc_options: 'Misc options',
    config_version: 'Config version',
    config_source: 'Config source'
});

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

function normalizeFirmwareVersion(value) {
    if (typeof value !== 'string') return null;
    const version = value.trim();
    return version ? version.slice(0, 80) : null;
}

function normalizePositiveInteger(value) {
    const parsed = normalizeOptionalInteger(value);
    if (parsed === null) return null;
    return parsed > 0 ? parsed : null;
}

function normalizePricingProfile(value) {
    if (typeof value !== 'string') return null;
    const profile = value.trim();
    if (!profile) return null;
    return ['rubino_half_credit', 'identity'].includes(profile) ? profile : null;
}

function normalizeConfigSource(value, fallback = null) {
    if (typeof value !== 'string') return fallback;
    const source = value.trim().toLowerCase();
    if (!source) return fallback;
    return ['backend', 'portal', 'factory', 'unknown'].includes(source) ? source : fallback;
}

function normalizeByteValue(value) {
    const parsed = normalizeOptionalInteger(value);
    if (parsed === null) return null;
    return parsed >= 0 && parsed <= 255 ? parsed : null;
}

function normalizeWordValue(value) {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'number') {
        return Number.isInteger(value) && value >= 0 && value <= 65535 ? value : null;
    }

    const raw = String(value).trim();
    if (!raw) return null;
    let parsed = null;
    if (/^0x[0-9a-f]+$/i.test(raw)) {
        parsed = Number.parseInt(raw, 16);
    } else if (/^\d+$/.test(raw)) {
        parsed = Number.parseInt(raw, 10);
    }
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > 65535) return null;
    return parsed;
}

function parseMachineId(value) {
    const parsed = parseInt(value, 10);
    return Number.isInteger(parsed) ? parsed : null;
}

function buildMachineTechnicalConfig(machine) {
    return {
        price_cents: Number(machine?.price_cents || DEFAULT_MACHINE_TECH_CONFIG.price_cents),
        pricing_profile: normalizePricingProfile(machine?.pricing_profile) || DEFAULT_MACHINE_TECH_CONFIG.pricing_profile,
        mdb_feature_level: Number(machine?.mdb_feature_level ?? DEFAULT_MACHINE_TECH_CONFIG.mdb_feature_level),
        mdb_country_code: Number(machine?.mdb_country_code ?? DEFAULT_MACHINE_TECH_CONFIG.mdb_country_code),
        mdb_scale_factor: Number(machine?.mdb_scale_factor ?? DEFAULT_MACHINE_TECH_CONFIG.mdb_scale_factor),
        mdb_decimal_places: Number(machine?.mdb_decimal_places ?? DEFAULT_MACHINE_TECH_CONFIG.mdb_decimal_places),
        mdb_max_response_time: Number(machine?.mdb_max_response_time ?? DEFAULT_MACHINE_TECH_CONFIG.mdb_max_response_time),
        mdb_misc_options: Number(machine?.mdb_misc_options ?? DEFAULT_MACHINE_TECH_CONFIG.mdb_misc_options),
        config_version: Number(machine?.technical_config_version ?? machine?.config_version ?? DEFAULT_MACHINE_TECH_CONFIG.config_version),
        config_source: normalizeConfigSource(machine?.technical_config_source ?? machine?.config_source, DEFAULT_MACHINE_TECH_CONFIG.config_source),
        config_updated_at: machine?.technical_config_updated_at ?? machine?.config_updated_at ?? DEFAULT_MACHINE_TECH_CONFIG.config_updated_at
    };
}

function buildMachineOtaState(machine, release = null) {
    return {
        current_firmware_version: normalizeFirmwareVersion(machine?.current_firmware_version),
        desired_firmware_release_id: machine?.desired_firmware_release_id ? Number(machine.desired_firmware_release_id) : null,
        desired_firmware_version: normalizeFirmwareVersion(machine?.desired_firmware_version),
        firmware_update_status: machine?.firmware_update_status || 'idle',
        firmware_update_message: machine?.firmware_update_message || '',
        firmware_update_started_at: machine?.firmware_update_started_at || null,
        firmware_update_completed_at: machine?.firmware_update_completed_at || null,
        desired_release: release ? {
            id: Number(release.id),
            version: release.version,
            filename: release.filename,
            size_bytes: Number(release.size_bytes),
            md5: release.md5,
            notes: release.notes || '',
            created_at: release.created_at,
            created_by_username: release.created_by_username || null
        } : null
    };
}

function buildReportedMachineTechnicalSnapshot(machine) {
    const raw = machine?.last_reported_technical_config;
    if (!raw || typeof raw !== 'object') return null;
    return buildMachineTechnicalConfig(raw);
}

function buildMachineTechnicalDrift(desiredConfig, reportedConfig) {
    if (!reportedConfig) return [];
    return [...MACHINE_TECH_CONFIG_FIELDS, 'config_version', 'config_source']
        .filter(field => desiredConfig[field] !== reportedConfig[field])
        .map(field => ({
            field,
            label: MACHINE_TECH_FIELD_LABELS[field] || field,
            desired: desiredConfig[field],
            reported: reportedConfig[field]
        }));
}

async function getLastMachineTechnicalAudit(machineId) {
    const result = await pool.query(
        `SELECT action,
                actor_username,
                actor_role,
                summary,
                details,
                created_at
         FROM audit_logs
         WHERE entity_type = 'machine'
           AND entity_id = $1
           AND action IN ('machine.update_technical_config', 'machine.update')
         ORDER BY created_at DESC, id DESC
         LIMIT 1`,
        [String(machineId)]
    );
    if (result.rowCount === 0) return null;
    const row = result.rows[0];
    return {
        action: row.action,
        actor_username: row.actor_username,
        actor_role: row.actor_role,
        summary: row.summary,
        created_at: row.created_at,
        config_sync: row.details?.config_sync || null
    };
}

async function buildMachineTechnicalSupport(machine) {
    const desiredConfig = buildMachineTechnicalConfig(machine);
    const reportedConfig = buildReportedMachineTechnicalSnapshot(machine);
    const drift = buildMachineTechnicalDrift(desiredConfig, reportedConfig);
    const lastBackendChange = await getLastMachineTechnicalAudit(machine?.id);
    return {
        status: reportedConfig ? (drift.length ? 'drift' : 'in_sync') : 'not_reported',
        reported_config: reportedConfig,
        reported_at: machine?.last_reported_technical_config_at || null,
        drift,
        last_backend_change: lastBackendChange
    };
}

function machineTechnicalConfigChanged(previousMachine, updatedMachine) {
    const previous = buildMachineTechnicalConfig(previousMachine);
    const next = buildMachineTechnicalConfig(updatedMachine);
    return [...MACHINE_TECH_CONFIG_FIELDS, 'config_version', 'config_source'].some(field => previous[field] !== next[field]);
}

function buildReportedMachineTechnicalConfig(machine, body = {}) {
    const base = buildMachineTechnicalConfig(machine);
    const reported = { ...base };

    if (body.price_cents !== undefined) {
        const value = normalizePositiveInteger(body.price_cents);
        if (value !== null) reported.price_cents = value;
    }
    if (body.pricing_profile !== undefined) {
        const value = normalizePricingProfile(body.pricing_profile);
        if (value) reported.pricing_profile = value;
    }
    if (body.mdb_feature_level !== undefined) {
        const value = normalizeByteValue(body.mdb_feature_level);
        if (value !== null) reported.mdb_feature_level = value;
    }
    if (body.mdb_country_code !== undefined) {
        const value = normalizeWordValue(body.mdb_country_code);
        if (value !== null) reported.mdb_country_code = value;
    }
    if (body.mdb_scale_factor !== undefined) {
        const value = normalizeByteValue(body.mdb_scale_factor);
        if (value !== null) reported.mdb_scale_factor = value;
    }
    if (body.mdb_decimal_places !== undefined) {
        const value = normalizeByteValue(body.mdb_decimal_places);
        if (value !== null) reported.mdb_decimal_places = value;
    }
    if (body.mdb_max_response_time !== undefined) {
        const value = normalizeByteValue(body.mdb_max_response_time);
        if (value !== null) reported.mdb_max_response_time = value;
    }
    if (body.mdb_misc_options !== undefined) {
        const value = normalizeByteValue(body.mdb_misc_options);
        if (value !== null) reported.mdb_misc_options = value;
    }

    const version = normalizePositiveInteger(body.config_version);
    if (version !== null) reported.config_version = version;
    reported.config_source = normalizeConfigSource(body.config_source, reported.config_source);
    return reported;
}

async function bumpMachineTechnicalConfigVersion(client, machineId, baseVersion, machineTenantId, source = 'backend') {
    const result = await client.query(
        `UPDATE machines
         SET technical_config_version = GREATEST(COALESCE(technical_config_version, 1), $2) + 1,
             technical_config_source = $3,
             technical_config_updated_at = NOW()
         WHERE id = $1
           AND tenant_id = $4
         RETURNING ${MACHINE_TECH_CONFIG_SELECT}`,
        [machineId, Math.max(1, Number(baseVersion) || 1), normalizeConfigSource(source, 'backend'), machineTenantId]
    );
    return result.rows[0] || null;
}

async function syncMachineTechnicalConfig({ req, previousMachine, updatedMachine }) {
    if (!machineTechnicalConfigChanged(previousMachine, updatedMachine)) {
        return 'unchanged';
    }

    const existing = await req.db.query(
        `SELECT id
         FROM machine_commands
         WHERE machine_id = $1
           AND tenant_id = $2
           AND status = 'queued'
         ORDER BY queued_at DESC
         LIMIT 1`,
        [updatedMachine.id, req.user.tenant_id]
    );

    if (existing.rowCount > 0) {
        return 'queued_command_exists';
    }

    if (!isMachineOnline(updatedMachine.last_seen)) {
        return 'pending_reconnect';
    }

    await queueMachineCommand({
        db: req.db,
        machineId: updatedMachine.id,
        machineName: updatedMachine.name,
        commandType: 'config_update',
        payload: buildMachineTechnicalConfig(updatedMachine),
        req,
        tenantId: req.user.tenant_id
    });
    return 'queued';
}

function parseTechnicalConfigBody(body = {}) {
    const hasOwn = (key) => Object.prototype.hasOwnProperty.call(body, key);
    const patch = {};
    let touched = false;

    if (hasOwn('price_cents')) {
        const value = normalizePositiveInteger(body.price_cents);
        if (value === null) throw new Error('price_cents inválido');
        patch.price_cents = value;
        touched = true;
    }

    if (hasOwn('pricing_profile')) {
        const value = normalizePricingProfile(body.pricing_profile);
        if (!value) throw new Error('pricing_profile inválido');
        patch.pricing_profile = value;
        touched = true;
    }

    if (hasOwn('mdb_feature_level')) {
        const value = normalizeByteValue(body.mdb_feature_level);
        if (value === null) throw new Error('mdb_feature_level inválido');
        patch.mdb_feature_level = value;
        touched = true;
    }

    if (hasOwn('mdb_country_code')) {
        const value = normalizeWordValue(body.mdb_country_code);
        if (value === null) throw new Error('mdb_country_code inválido');
        patch.mdb_country_code = value;
        touched = true;
    }

    if (hasOwn('mdb_scale_factor')) {
        const value = normalizeByteValue(body.mdb_scale_factor);
        if (value === null) throw new Error('mdb_scale_factor inválido');
        patch.mdb_scale_factor = value;
        touched = true;
    }

    if (hasOwn('mdb_decimal_places')) {
        const value = normalizeByteValue(body.mdb_decimal_places);
        if (value === null) throw new Error('mdb_decimal_places inválido');
        patch.mdb_decimal_places = value;
        touched = true;
    }

    if (hasOwn('mdb_max_response_time')) {
        const value = normalizeByteValue(body.mdb_max_response_time);
        if (value === null) throw new Error('mdb_max_response_time inválido');
        patch.mdb_max_response_time = value;
        touched = true;
    }

    if (hasOwn('mdb_misc_options')) {
        const value = normalizeByteValue(body.mdb_misc_options);
        if (value === null) throw new Error('mdb_misc_options inválido');
        patch.mdb_misc_options = value;
        touched = true;
    }

    if (!touched) {
        throw new Error('Sin cambios de configuración técnica');
    }

    return patch;
}

function serializeFirmwareRelease(row) {
    return {
        id: Number(row.id),
        version: row.version,
        filename: row.filename,
        size_bytes: Number(row.size_bytes),
        md5: row.md5,
        notes: row.notes || '',
        created_at: row.created_at,
        created_by_username: row.created_by_username || null
    };
}

function buildFirmwareCommandPayload(release) {
    return {
        release_id: Number(release.id),
        version: release.version,
        size_bytes: Number(release.size_bytes),
        md5: release.md5,
        download_path: `/api/machine-firmware/releases/${Number(release.id)}/download`
    };
}

async function getFirmwareReleaseById(db, tenantId, releaseId) {
    const result = await db.query(
        `SELECT id, version, filename, size_bytes, md5, notes, created_at, created_by_username
         FROM firmware_releases
         WHERE id = $1
           AND tenant_id = $2`,
        [releaseId, tenantId]
    );
    return result.rows[0] || null;
}

function otaCanQueueAfterRegister(status) {
    return ['queued', 'in_progress', 'pending_reconnect'].includes(status || 'idle');
}

async function queueMachineCommand({ db, machineId, machineName, commandType, payload, req, tenantId }) {
    const insertResult = await db.query(
        `INSERT INTO machine_commands(machine_id, command_type, payload, tenant_id)
         VALUES ($1, $2, $3::jsonb, $4)
         RETURNING id, machine_id, command_type, payload, status, queued_at`,
        [machineId, commandType, JSON.stringify(payload || {}), tenantId]
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

async function getActiveMachineById(db, tenantId, machineId) {
    const result = await db.query(
        `SELECT id, name, location, last_seen
         FROM machines
         WHERE id = $1
           AND tenant_id = $2
           AND active = true`,
        [machineId, tenantId]
    );
    return result.rows[0] || null;
}

async function getQueuedMachineCommand(db, tenantId, machineId) {
    const result = await db.query(
        `SELECT id, command_type, status
         FROM machine_commands
         WHERE machine_id = $1
           AND tenant_id = $2
           AND status IN ('queued', 'delivered')
         ORDER BY
           CASE WHEN status = 'delivered' THEN 0 ELSE 1 END,
           delivered_at DESC NULLS LAST,
           queued_at DESC
         LIMIT 1`,
        [machineId, tenantId]
    );
    return result.rows[0] || null;
}

async function queueFirmwareUpdateForMachine({ machine, release, req, db, tenantId, statusWhenQueued = 'queued', messageWhenQueued = null }) {
    const payload = buildFirmwareCommandPayload(release);
    const queuedCommand = await queueMachineCommand({
        db,
        machineId: machine.id,
        machineName: machine.name,
        commandType: 'firmware_update',
        payload,
        req,
        tenantId
    });

    await db.query(
        `UPDATE machines
         SET desired_firmware_release_id = $2,
             desired_firmware_version = $3,
             firmware_update_status = $4,
             firmware_update_message = $5,
             firmware_update_started_at = NULL,
             firmware_update_completed_at = NULL
         WHERE id = $1
           AND tenant_id = $6`,
        [
            machine.id,
            release.id,
            release.version,
            statusWhenQueued,
            messageWhenQueued || `Release ${release.version} encolada para OTA`,
            tenantId
        ]
    );

    return queuedCommand;
}

async function maybeQueuePendingFirmwareUpdate(db, tenantId, machine) {
    if (!machine?.desired_firmware_release_id || !machine?.desired_firmware_version) {
        return machine;
    }

    const currentVersion = normalizeFirmwareVersion(machine.current_firmware_version);
    if (currentVersion && currentVersion === machine.desired_firmware_version) {
        await db.query(
            `UPDATE machine_commands
             SET status = 'completed',
                 completed_at = COALESCE(completed_at, NOW()),
                 result = COALESCE(result, '{}'::jsonb) || jsonb_build_object('message', $2::text, 'version', $3::text)
             WHERE machine_id = $1
               AND tenant_id = $4
               AND command_type = 'firmware_update'
               AND status IN ('queued', 'delivered')`,
            [machine.id, `Firmware ${currentVersion} activo`, currentVersion, tenantId]
        );
        const synced = await db.query(
            `UPDATE machines
             SET firmware_update_status = 'success',
                 firmware_update_message = $2,
                 firmware_update_completed_at = NOW()
             WHERE id = $1
               AND tenant_id = $3
             RETURNING ${MACHINE_TECH_CONFIG_SELECT}`,
            [machine.id, `Firmware ${currentVersion} activo`, tenantId]
        );
        return synced.rows[0] || machine;
    }

    if (!otaCanQueueAfterRegister(machine.firmware_update_status)) {
        return machine;
    }

    const existing = await getQueuedMachineCommand(db, tenantId, machine.id);
    if (existing) {
        const pending = await db.query(
            `UPDATE machines
             SET firmware_update_status = 'pending_reconnect',
                 firmware_update_message = $2
             WHERE id = $1
               AND tenant_id = $3
             RETURNING ${MACHINE_TECH_CONFIG_SELECT}`,
            [machine.id, `OTA pendiente; hay otro comando remoto en cola (${existing.command_type})`, tenantId]
        );
        return pending.rows[0] || machine;
    }

    const release = await getFirmwareReleaseById(db, tenantId, machine.desired_firmware_release_id);
    if (!release) {
        const failed = await db.query(
            `UPDATE machines
             SET firmware_update_status = 'failed',
                 firmware_update_message = $2,
                 firmware_update_completed_at = NOW()
             WHERE id = $1
               AND tenant_id = $3
             RETURNING ${MACHINE_TECH_CONFIG_SELECT}`,
            [machine.id, 'La release OTA deseada ya no existe en backend', tenantId]
        );
        return failed.rows[0] || machine;
    }

    await queueFirmwareUpdateForMachine({
        machine,
        release,
        db,
        tenantId,
        req: null,
        statusWhenQueued: 'queued',
        messageWhenQueued: `Release ${release.version} encolada al reconectarse`
    });

    const refreshed = await db.query(
        `SELECT ${MACHINE_TECH_CONFIG_SELECT}
         FROM machines
         WHERE id = $1
           AND tenant_id = $2`,
        [machine.id, tenantId]
    );
    return refreshed.rows[0] || machine;
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

// Separado como función nombrada para exportarlo y montarlo
// con su propio middleware (resolveTenantFromHost + checkRegistrationSecret)
// sin pasar por authJwt. Ver server.js. No hay router.post('/register', ...)
// porque esa ruta se monta explícitamente en server.js (app.post).
async function registerHandler(req, res) {
    const {
        mac,
        wifi_ssid,
        backend_url,
        price_cents,
        pricing_profile,
        firmware_version,
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
    const pricingProfile = normalizePricingProfile(pricing_profile);
    const firmwareVersion = normalizeFirmwareVersion(firmware_version);
    const reportedConfigVersion = normalizePositiveInteger(req.body?.config_version);
    const reportedConfigSource = normalizeConfigSource(req.body?.config_source, 'unknown');
    const wifiRssi = normalizeOptionalInteger(wifi_rssi);
    const wifiIp = normalizeOptionalString(wifi_ip, 45);
    const backendOk = typeof backend_ok === 'boolean' ? backend_ok : null;
    const backendError = normalizeOptionalString(backend_error, 255);

    try {
        const approved = await bootstrapPool.query(
            `SELECT id, name, ${MACHINE_TECH_CONFIG_SQL}, ${MACHINE_TECH_META_SQL}
             FROM machines
             WHERE mac = $1
               AND active = true`,
            [macClean]
        );

        if (approved.rowCount > 0) {
            const reportedConfig = buildReportedMachineTechnicalConfig(approved.rows[0], {
                price_cents: reportedPriceCents,
                pricing_profile: pricingProfile,
                mdb_feature_level: req.body?.mdb_feature_level,
                mdb_country_code: req.body?.mdb_country_code,
                mdb_scale_factor: req.body?.mdb_scale_factor,
                mdb_decimal_places: req.body?.mdb_decimal_places,
                mdb_max_response_time: req.body?.mdb_max_response_time,
                mdb_misc_options: req.body?.mdb_misc_options,
                config_version: reportedConfigVersion,
                config_source: reportedConfigSource
            });
            const updateResult = await bootstrapPool.query(
                `UPDATE machines
                 SET last_seen = NOW(),
                    wifi_ssid = COALESCE($2, wifi_ssid),
                    backend_url = COALESCE($3, backend_url),
                     current_firmware_version = COALESCE($4, current_firmware_version),
                     wifi_rssi = COALESCE($5, wifi_rssi),
                     wifi_ip = COALESCE($6, wifi_ip),
                     backend_ok = COALESCE($7, backend_ok),
                     backend_error = $8,
                     last_reported_technical_config = $9::jsonb,
                     last_reported_technical_config_at = NOW()
                 WHERE mac = $1
                 RETURNING ${MACHINE_TECH_CONFIG_SELECT}`,
                [macClean, wifiSsid, backendUrl, firmwareVersion, wifiRssi, wifiIp, backendOk, backendError, JSON.stringify(reportedConfig)]
            );
            let machineState = updateResult.rows[0];
            const desiredConfig = buildMachineTechnicalConfig(machineState);
            const deviceMismatch = [...MACHINE_TECH_CONFIG_FIELDS, 'config_version', 'config_source']
                .some(field => reportedConfig[field] !== desiredConfig[field]);
            if (deviceMismatch && (reportedConfig.config_version >= desiredConfig.config_version)) {
                machineState = await bumpMachineTechnicalConfigVersion(
                    bootstrapPool,
                    machineState.id,
                    reportedConfigVersion,
                    req.tenant_id,
                    'backend'
                ) || machineState;
            }
            machineState = await maybeQueuePendingFirmwareUpdate(bootstrapPool, req.tenant_id, machineState);
            alerts.resolveMachineOffline(machineState.id, req.tenant_id).catch(err => console.error('[ALERT] Error resolviendo offline:', err.message));
            return res.status(200).json({
                status: 'approved',
                machine: approved.rows[0].name,
                config: buildMachineTechnicalConfig(machineState),
                ota: buildMachineOtaState(machineState)
            });
        }

        const pending = await bootstrapPool.query(
            'SELECT id FROM pending_machines WHERE mac = $1',
            [macClean]
        );

        if (pending.rowCount > 0) {
            await bootstrapPool.query('UPDATE pending_machines SET last_ping = NOW() WHERE mac = $1', [macClean]);
            return res.status(202).json({ status: 'pending' });
        }

        await bootstrapPool.query(
            'INSERT INTO pending_machines(mac, tenant_id) VALUES ($1, $2)',
            [macClean, req.tenant_id]
        );
        console.log('[REG] Nueva pendiente:', macClean);
        broadcast({ event: 'machine_pending', mac: macClean, message: `Nueva máquina pendiente: ${macClean}` });
        return res.status(202).json({ status: 'pending' });
    } catch (err) {
        console.error('[REG] Error:', err.message);
        return res.status(500).json({ error: err.message });
    }
}

router.get('/pending', requireMachineSetup, async (req, res) => {
    try {
        const result = await req.db.query(
            'SELECT id, mac, first_seen, last_ping FROM pending_machines WHERE approved = false AND tenant_id = $1 ORDER BY first_seen DESC',
            [req.user.tenant_id]
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
        const pending = await req.db.query(
            'SELECT id, mac, tenant_id FROM pending_machines WHERE id = $1 AND tenant_id = $2',
            [req.params.id, req.user.tenant_id]
        );
        if (pending.rowCount === 0) return res.status(404).json({ error: 'No encontrada' });

        const mac = pending.rows[0].mac;
        const machineTenantId = pending.rows[0].tenant_id;
        const machine = await req.db.query(
            `INSERT INTO machines(name, location, mac, secret, active, price_cents, tenant_id)
             VALUES ($1, $2, $3, $3, true, $4, $5)
             ON CONFLICT(mac) DO UPDATE
             SET name = $1, location = $2, active = true, price_cents = $4, tenant_id = $5
             RETURNING *`,
            [name.trim(), location?.trim() || null, mac, priceCents, machineTenantId]
        );

        await req.db.query('UPDATE pending_machines SET approved = true WHERE id = $1 AND tenant_id = $2', [req.params.id, machineTenantId]);
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
        const pending = await req.db.query(
            'DELETE FROM pending_machines WHERE id = $1 AND tenant_id = $2 RETURNING id, mac',
            [req.params.id, req.user.tenant_id]
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
        const result = await req.db.query('SELECT * FROM machine_status WHERE active = true AND tenant_id = $1 ORDER BY id', [req.user.tenant_id]);
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
        const result = await req.db.query(
            `INSERT INTO machines(name, location, mac, secret, price_cents, tenant_id)
             VALUES ($1, $2, $3, $3, $4, $5)
             RETURNING *`,
            [name.trim(), location?.trim() || null, mac.toUpperCase().replace(/[^A-F0-9]/g, ''), priceCents, req.user.tenant_id]
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

router.get('/:id/technical-config', requireMachineTechnicalConfig, async (req, res) => {
    try {
        const result = await req.db.query(
            `SELECT ${MACHINE_TECH_CONFIG_SELECT}
             FROM machines
             WHERE id = $1
               AND tenant_id = $2`,
            [req.params.id, req.user.tenant_id]
        );
        if (result.rowCount === 0) return res.status(404).json({ error: 'No encontrada' });
        const machine = result.rows[0];
        res.json({
            machine: {
                id: machine.id,
                name: machine.name,
                location: machine.location
            },
            technical_config: buildMachineTechnicalConfig(machine),
            support: await buildMachineTechnicalSupport(machine)
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.patch('/:id/technical-config', requireMachineTechnicalConfig, async (req, res) => {
    let patch;
    try {
        patch = parseTechnicalConfigBody(req.body || {});
    } catch (err) {
        return res.status(400).json({ error: err.message });
    }

    try {
        const before = await req.db.query(
            `SELECT ${MACHINE_TECH_CONFIG_SELECT}
             FROM machines
             WHERE id = $1
               AND tenant_id = $2`,
            [req.params.id, req.user.tenant_id]
        );
        if (before.rowCount === 0) return res.status(404).json({ error: 'No encontrada' });

        const previousMachine = before.rows[0];
        const result = await req.db.query(
            `UPDATE machines
             SET price_cents = COALESCE($1, price_cents),
                 pricing_profile = COALESCE($2, pricing_profile),
                 mdb_feature_level = COALESCE($3, mdb_feature_level),
                 mdb_country_code = COALESCE($4, mdb_country_code),
                 mdb_scale_factor = COALESCE($5, mdb_scale_factor),
                 mdb_decimal_places = COALESCE($6, mdb_decimal_places),
                 mdb_max_response_time = COALESCE($7, mdb_max_response_time),
                 mdb_misc_options = COALESCE($8, mdb_misc_options)
             WHERE id = $9
               AND tenant_id = $10
             RETURNING ${MACHINE_TECH_CONFIG_SELECT}`,
            [
                patch.price_cents,
                patch.pricing_profile,
                patch.mdb_feature_level,
                patch.mdb_country_code,
                patch.mdb_scale_factor,
                patch.mdb_decimal_places,
                patch.mdb_max_response_time,
                patch.mdb_misc_options,
                req.params.id,
                req.user.tenant_id
            ]
        );

        let updatedMachine = result.rows[0];
        if (machineTechnicalConfigChanged(previousMachine, updatedMachine)) {
            updatedMachine = await bumpMachineTechnicalConfigVersion(
                req.db,
                updatedMachine.id,
                previousMachine.technical_config_version || previousMachine.config_version || 1,
                req.user.tenant_id,
                'backend'
            ) || updatedMachine;
        }
        const configSync = await syncMachineTechnicalConfig({ req, previousMachine, updatedMachine });

        await audit.logAuditEvent({
            req,
            action: 'machine.update_technical_config',
            entityType: 'machine',
            entityId: updatedMachine.id,
            entityLabel: updatedMachine.name,
            summary: `Actualizó la configuración técnica de ${updatedMachine.name}`,
            details: {
                before: buildMachineTechnicalConfig(previousMachine),
                after: buildMachineTechnicalConfig(updatedMachine),
                config_sync: configSync
            }
        });

        res.json({
            machine: {
                id: updatedMachine.id,
                name: updatedMachine.name,
                location: updatedMachine.location
            },
            technical_config: buildMachineTechnicalConfig(updatedMachine),
            config_sync: configSync,
            support: await buildMachineTechnicalSupport(updatedMachine)
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/:id/ota', requireMachineTechnicalConfig, async (req, res) => {
    try {
        const machineResult = await req.db.query(
            `SELECT ${MACHINE_TECH_CONFIG_SELECT}
             FROM machines
             WHERE id = $1
               AND tenant_id = $2`,
            [req.params.id, req.user.tenant_id]
        );
        if (machineResult.rowCount === 0) return res.status(404).json({ error: 'No encontrada' });

        const machine = machineResult.rows[0];
        let desiredRelease = null;
        if (machine.desired_firmware_release_id) {
            desiredRelease = await getFirmwareReleaseById(req.db, req.user.tenant_id, machine.desired_firmware_release_id);
        }

        const releasesResult = await req.db.query(
            `SELECT id, version, filename, size_bytes, md5, notes, created_at, created_by_username
             FROM firmware_releases
             WHERE tenant_id = $1
             ORDER BY created_at DESC, id DESC`,
            [req.user.tenant_id]
        );

        res.json({
            machine: {
                id: machine.id,
                name: machine.name,
                location: machine.location,
                last_seen: machine.last_seen
            },
            ota: buildMachineOtaState(machine, desiredRelease),
            releases: releasesResult.rows.map(serializeFirmwareRelease)
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/:id/ota/deploy', requireMachineTechnicalConfig, async (req, res) => {
    const machineId = parseMachineId(req.params.id);
    const releaseId = normalizePositiveInteger(req.body?.release_id);

    if (!machineId || !releaseId) {
        return res.status(400).json({ error: 'machine_id/release_id inválidos' });
    }

    try {
        const machineResult = await req.db.query(
            `SELECT ${MACHINE_TECH_CONFIG_SELECT}
             FROM machines
             WHERE id = $1
               AND tenant_id = $2
               AND active = true`,
            [machineId, req.user.tenant_id]
        );
        if (machineResult.rowCount === 0) {
            return res.status(404).json({ error: 'No encontrada' });
        }

        const machine = machineResult.rows[0];
        const release = await getFirmwareReleaseById(req.db, req.user.tenant_id, releaseId);
        if (!release) {
            return res.status(404).json({ error: 'Release OTA no encontrada' });
        }

        if (normalizeFirmwareVersion(machine.current_firmware_version) === release.version) {
            return res.status(409).json({ error: 'La máquina ya reporta esa versión de firmware.' });
        }

        const existing = await getQueuedMachineCommand(req.db, req.user.tenant_id, machine.id);
        let otaStatus = isMachineOnline(machine.last_seen) ? 'queued' : 'pending_reconnect';
        let otaMessage = isMachineOnline(machine.last_seen)
            ? `Release ${release.version} encolada para OTA`
            : `Release ${release.version} lista para aplicar al reconectarse`;

        if (existing) {
            otaStatus = 'pending_reconnect';
            otaMessage = `Release ${release.version} pendiente; ya existe un comando remoto en cola (${existing.command_type})`;
        }

        await req.db.query(
            `UPDATE machines
             SET desired_firmware_release_id = $2,
                 desired_firmware_version = $3,
                 firmware_update_status = $4,
                 firmware_update_message = $5,
                 firmware_update_started_at = NULL,
                 firmware_update_completed_at = NULL
             WHERE id = $1
               AND tenant_id = $6`,
            [machine.id, release.id, release.version, otaStatus, otaMessage, req.user.tenant_id]
        );

        let queuedCommand = null;
        if (!existing && isMachineOnline(machine.last_seen)) {
            queuedCommand = await queueFirmwareUpdateForMachine({
                machine,
                release,
                req,
                db: req.db,
                tenantId: req.user.tenant_id,
                statusWhenQueued: 'queued',
                messageWhenQueued: otaMessage
            });
        }

        await audit.logAuditEvent({
            req,
            action: 'machine.deploy_firmware',
            entityType: 'machine',
            entityId: machine.id,
            entityLabel: machine.name,
            summary: `Programó OTA ${release.version} para ${machine.name}`,
            details: {
                release: serializeFirmwareRelease(release),
                status: otaStatus,
                queued_command_id: queuedCommand ? Number(queuedCommand.id) : null
            }
        });

        const refreshedResult = await req.db.query(
            `SELECT ${MACHINE_TECH_CONFIG_SELECT}
             FROM machines
             WHERE id = $1
               AND tenant_id = $2`,
            [machine.id, req.user.tenant_id]
        );
        const refreshed = refreshedResult.rows[0];

        res.status(201).json({
            machine: {
                id: refreshed.id,
                name: refreshed.name,
                location: refreshed.location
            },
            ota: buildMachineOtaState(refreshed, release),
            command: queuedCommand ? {
                id: Number(queuedCommand.id),
                type: queuedCommand.command_type
            } : null
        });
    } catch (err) {
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
        const before = await req.db.query(
            `SELECT ${MACHINE_TECH_CONFIG_SELECT}
             FROM machines
             WHERE id = $1
               AND tenant_id = $2`,
            [req.params.id, req.user.tenant_id]
        );
        if (before.rowCount === 0) return res.status(404).json({ error: 'No encontrada' });
        const previousMachine = before.rows[0];
        const result = await req.db.query(
            `UPDATE machines
             SET name = COALESCE($1, name),
                 location = COALESCE($2, location),
                 price_cents = COALESCE($3, price_cents)
             WHERE id = $4
               AND tenant_id = $5
             RETURNING ${MACHINE_TECH_CONFIG_SELECT}`,
            [name, location, priceCents, req.params.id, req.user.tenant_id]
        );
        let updatedMachine = result.rows[0];
        if (machineTechnicalConfigChanged(previousMachine, updatedMachine)) {
            updatedMachine = await bumpMachineTechnicalConfigVersion(
                req.db,
                updatedMachine.id,
                previousMachine.technical_config_version || previousMachine.config_version || 1,
                req.user.tenant_id,
                'backend'
            ) || updatedMachine;
        }
        const configSync = await syncMachineTechnicalConfig({ req, previousMachine, updatedMachine });

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
        const machineResult = await req.db.query(
            `SELECT id, name, last_seen
             FROM machines
             WHERE id = $1
               AND tenant_id = $2
               AND active = true`,
            [machineId, req.user.tenant_id]
        );
        if (machineResult.rowCount === 0) {
            return res.status(404).json({ error: 'No encontrada' });
        }

        const machine = machineResult.rows[0];
        if (!isMachineOnline(machine.last_seen)) {
            return res.status(409).json({ error: 'La máquina está offline. Los comandos remotos solo se envían a equipos online.' });
        }

        const existing = await req.db.query(
            `SELECT id
             FROM machine_commands
             WHERE machine_id = $1
               AND tenant_id = $2
               AND status = 'queued'
             ORDER BY queued_at DESC
             LIMIT 1`,
            [machineId, req.user.tenant_id]
        );
        if (existing.rowCount > 0) {
            return res.status(409).json({ error: 'Ya hay un comando pendiente para esta máquina.' });
        }

        const queuedCommand = await queueMachineCommand({
            db: req.db,
            machineId: machine.id,
            machineName: machine.name,
            commandType,
            payload: normalizedPayload,
            req,
            tenantId: req.user.tenant_id
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
        const result = await req.db.query(
            `SELECT id, machine_id, command_type, payload, status, queued_at, delivered_at, completed_at, result
             FROM machine_commands
             WHERE id = $1 AND machine_id = $2 AND tenant_id = $3`,
            [commandId, machineId, req.user.tenant_id]
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
        const result = await req.db.query(
            'UPDATE machines SET blocked = true, blocked_reason = $1 WHERE id = $2 AND tenant_id = $3 RETURNING id, name, blocked_reason',
            [reason || 'Bloqueada por administrador', req.params.id, req.user.tenant_id]
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
        const result = await req.db.query(
            'UPDATE machines SET blocked = false, blocked_reason = NULL WHERE id = $1 AND tenant_id = $2 RETURNING id, name',
            [req.params.id, req.user.tenant_id]
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
        const result = await req.db.query(
            'UPDATE machines SET active = false WHERE id = $1 AND tenant_id = $2 RETURNING id, name, mac, location',
            [req.params.id, req.user.tenant_id]
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
        const machine = await getActiveMachineById(req.db, req.user.tenant_id, machineId);
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
        const machine = await getActiveMachineById(req.db, req.user.tenant_id, machineId);
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
        const machine = await getActiveMachineById(req.db, req.user.tenant_id, machineId);
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
        const machine = await getActiveMachineById(req.db, req.user.tenant_id, machineId);
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
        const machine = await getActiveMachineById(req.db, req.user.tenant_id, machineId);
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
        const result = await req.db.query(
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
              AND e.tenant_id = $3
             WHERE t.machine_id = $1
             ORDER BY t.tapped_at DESC
             LIMIT $2`,
            [req.params.id, limit, req.user.tenant_id]
        );
        res.json({ taps: result.rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
module.exports.registerHandler = registerHandler;
