const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const firmwareStorageDir = path.join(__dirname, '..', '..', 'storage', 'firmware');

function ensureFirmwareStorageDir() {
    fs.mkdirSync(firmwareStorageDir, { recursive: true });
    return firmwareStorageDir;
}

function sanitizeFirmwareFilename(filename) {
    const raw = String(filename || '').trim() || 'firmware.bin';
    const cleaned = raw.replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^_+/, '');
    return cleaned || 'firmware.bin';
}

function slugifyFirmwareVersion(version) {
    const raw = String(version || '').trim().toLowerCase();
    const slug = raw.replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
    return slug || 'firmware';
}

function buildStoredFirmwareName(version, filename) {
    const safeFilename = sanitizeFirmwareFilename(filename);
    const ext = path.extname(safeFilename) || '.bin';
    const baseName = path.basename(safeFilename, ext);
    const versionSlug = slugifyFirmwareVersion(version);
    return `${Date.now()}_${versionSlug}_${baseName}${ext}`;
}

function computeMd5(buffer) {
    return crypto.createHash('md5').update(buffer).digest('hex');
}

module.exports = {
    firmwareStorageDir,
    ensureFirmwareStorageDir,
    sanitizeFirmwareFilename,
    buildStoredFirmwareName,
    computeMd5
};
