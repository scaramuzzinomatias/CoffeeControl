const fs = require('fs');
const path = require('path');
const express = require('express');
const pool = require('../db/pool');
const audit = require('../services/audit');
const { requireMachineTechnicalConfig } = require('../middleware/roleAccess');
const {
    firmwareStorageDir,
    ensureFirmwareStorageDir,
    sanitizeFirmwareFilename,
    buildStoredFirmwareName,
    computeMd5
} = require('../lib/firmwareStorage');

const router = express.Router();
const MAX_FIRMWARE_UPLOAD_BYTES = 4 * 1024 * 1024;

function normalizeFirmwareVersion(value) {
    if (typeof value !== 'string') return null;
    const version = value.trim();
    return version ? version.slice(0, 80) : null;
}

function normalizeFirmwareNotes(value) {
    if (typeof value !== 'string') return null;
    const notes = value.trim();
    return notes ? notes.slice(0, 2000) : null;
}

function serializeRelease(row) {
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

router.get('/releases', requireMachineTechnicalConfig, async (_req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, version, filename, size_bytes, md5, notes, created_at, created_by_username
             FROM firmware_releases
             ORDER BY created_at DESC, id DESC`
        );
        return res.json({ releases: result.rows.map(serializeRelease) });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

router.post(
    '/releases',
    requireMachineTechnicalConfig,
    express.raw({ type: 'application/octet-stream', limit: `${MAX_FIRMWARE_UPLOAD_BYTES}b` }),
    async (req, res) => {
        const version = normalizeFirmwareVersion(req.headers['x-firmware-version']);
        const filename = sanitizeFirmwareFilename(req.headers['x-firmware-filename']);
        const notes = normalizeFirmwareNotes(req.headers['x-firmware-notes']);
        const contentType = String(req.headers['content-type'] || 'application/octet-stream').slice(0, 80);
        const binary = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);

        if (!version) {
            return res.status(400).json({ error: 'Header X-Firmware-Version requerido' });
        }
        if (!binary.length) {
            return res.status(400).json({ error: 'El binario OTA está vacío.' });
        }
        if (binary.length > MAX_FIRMWARE_UPLOAD_BYTES) {
            return res.status(400).json({ error: 'El binario OTA supera el tamaño máximo permitido.' });
        }

        ensureFirmwareStorageDir();
        const storageName = buildStoredFirmwareName(version, filename);
        const targetPath = path.join(firmwareStorageDir, storageName);
        const md5 = computeMd5(binary);

        try {
            fs.writeFileSync(targetPath, binary);
            const insert = await pool.query(
                `INSERT INTO firmware_releases(
                    version,
                    filename,
                    storage_path,
                    content_type,
                    size_bytes,
                    md5,
                    notes,
                    created_by_user_id,
                    created_by_username
                 )
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                 RETURNING id, version, filename, size_bytes, md5, notes, created_at, created_by_username`,
                [
                    version,
                    filename,
                    storageName,
                    contentType,
                    binary.length,
                    md5,
                    notes,
                    req.user?.id || null,
                    req.user?.username || null
                ]
            );

            await audit.logAuditEvent({
                req,
                action: 'firmware_release.create',
                entityType: 'firmware_release',
                entityId: insert.rows[0].id,
                entityLabel: version,
                summary: `Subió el firmware ${version}`,
                details: {
                    version,
                    filename,
                    size_bytes: binary.length,
                    md5,
                    notes: notes || null
                }
            });

            return res.status(201).json({ release: serializeRelease(insert.rows[0]) });
        } catch (err) {
            try {
                if (fs.existsSync(targetPath)) fs.unlinkSync(targetPath);
            } catch (_) {}

            if (err.code === '23505') {
                return res.status(409).json({ error: 'Ya existe una release OTA con esa versión.' });
            }
            return res.status(500).json({ error: err.message });
        }
    }
);

module.exports = router;
