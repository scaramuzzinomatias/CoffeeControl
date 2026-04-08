const fs = require('fs');
const path = require('path');
const express = require('express');
const pool = require('../db/pool');
const { firmwareStorageDir } = require('../lib/firmwareStorage');

const router = express.Router();

router.get('/releases/:id/download', async (req, res) => {
    const releaseId = parseInt(req.params.id, 10);
    if (!Number.isInteger(releaseId)) {
        return res.status(400).json({ error: 'ID de release inválido' });
    }

    try {
        const result = await pool.query(
            `SELECT fr.id,
                    fr.version,
                    fr.filename,
                    fr.storage_path,
                    fr.content_type,
                    fr.size_bytes,
                    fr.md5
             FROM machines m
             JOIN firmware_releases fr ON fr.id = m.desired_firmware_release_id
             WHERE m.id = $1
               AND fr.id = $2`,
            [req.machine.id, releaseId]
        );
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Release OTA no autorizada para esta máquina.' });
        }

        const release = result.rows[0];
        const filePath = path.join(firmwareStorageDir, release.storage_path);
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'El binario OTA no está disponible en disco.' });
        }

        res.setHeader('Content-Type', release.content_type || 'application/octet-stream');
        res.setHeader('Content-Length', String(release.size_bytes));
        res.setHeader('Content-Disposition', `attachment; filename="${release.filename}"`);
        res.setHeader('X-Firmware-Version', release.version);
        res.setHeader('X-Firmware-MD5', release.md5);
        return res.sendFile(filePath);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

module.exports = router;
