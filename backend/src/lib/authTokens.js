const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db/pool');
const bootstrapPool = require('../db/bootstrapPool');
const { getUserDepartmentScopes } = require('./accessScope');

const SECRET = process.env.JWT_SECRET || 'cc-dev-secret-change-in-prod';
const ACCESS_TOKEN_TTL = process.env.MOBILE_ACCESS_TOKEN_TTL || '8h';
const ACCESS_TOKEN_TTL_SECONDS = Number.parseInt(process.env.MOBILE_ACCESS_TOKEN_TTL_SECONDS || '', 10) || (8 * 60 * 60);
const REFRESH_TOKEN_DAYS = Number.parseInt(process.env.MOBILE_REFRESH_TOKEN_DAYS || '', 10) || 45;
const MOBILE_ROLES = new Set(['admin', 'gerente', 'tecnico', 'distribuidor']);

function normalizeUsername(value) {
    return String(value || '').trim().toLowerCase();
}

function normalizeDeviceName(value) {
    const normalized = String(value || '').trim();
    return normalized ? normalized.slice(0, 120) : null;
}

function normalizePlatform(value) {
    const normalized = String(value || '').trim().toLowerCase();
    return normalized ? normalized.slice(0, 30) : 'android';
}

function canUseMobileAuth(role) {
    return MOBILE_ROLES.has(String(role || '').trim().toLowerCase());
}

function hashRefreshToken(token) {
    return crypto.createHash('sha256').update(String(token || '')).digest('hex');
}

function generateRefreshToken() {
    return crypto.randomBytes(48).toString('hex');
}

async function getActiveAdminUserByUsername(username, tenantId) {
    const normalized = normalizeUsername(username);
    if (!normalized) return null;
    const result = await bootstrapPool.query(
        `SELECT id, username, password_hash, role, department,
                is_protected, active, tenant_id
         FROM admin_users
         WHERE username = $1
           AND tenant_id = $2
           AND active = true`,
        [normalized, tenantId]
    );
    return result.rowCount ? result.rows[0] : null;
}

async function verifyAdminPassword(user, password) {
    if (!user?.password_hash) return false;
    return bcrypt.compare(String(password || ''), user.password_hash);
}

async function buildAuthPayload(user, { authKind = 'panel', mobileSessionId = null } = {}) {
    const departmentScopes = await getUserDepartmentScopes(user.id, user.department);
    return {
        id: user.id,
        tenant_id: user.tenant_id,
        username: user.username,
        role: user.role,
        is_protected: Boolean(user.is_protected),
        department: user.department || null,
        department_scopes: departmentScopes,
        auth_kind: authKind,
        mobile_session_id: mobileSessionId === null || mobileSessionId === undefined
            ? null
            : Number(mobileSessionId)
    };
}

function signAccessToken(payload) {
    return jwt.sign(payload, SECRET, { expiresIn: ACCESS_TOKEN_TTL });
}

function buildUserResponse(payload) {
    return {
        id: payload.id,
        username: payload.username,
        role: payload.role,
        is_protected: Boolean(payload.is_protected),
        department: payload.department || null,
        department_scopes: Array.isArray(payload.department_scopes) ? payload.department_scopes : []
    };
}

async function createMobileSession({ user, deviceName, platform, userAgent = null }) {
    const refreshToken = generateRefreshToken();
    const refreshTokenHash = hashRefreshToken(refreshToken);
    const result = await pool.query(
        `INSERT INTO mobile_sessions (
            admin_user_id,
            device_name,
            platform,
            user_agent,
            refresh_token_hash,
            expires_at,
            last_used_at,
            tenant_id
        )
         VALUES (
            $1,
            $2,
            $3,
            $4,
            $5,
            NOW() + make_interval(days => $6),
            NOW(),
            $7
         )
         RETURNING id, device_name, platform, expires_at, created_at, last_used_at`,
        [
            user.id,
            normalizeDeviceName(deviceName),
            normalizePlatform(platform),
            userAgent || null,
            refreshTokenHash,
            REFRESH_TOKEN_DAYS,
            user.tenant_id
        ]
    );

    const session = result.rows[0];
    const payload = await buildAuthPayload(user, {
        authKind: 'mobile',
        mobileSessionId: session.id
    });

    return {
        access_token: signAccessToken(payload),
        refresh_token: refreshToken,
        expires_in: ACCESS_TOKEN_TTL_SECONDS,
        user: buildUserResponse(payload),
        session
    };
}

async function getMobileSessionByRefreshToken(refreshToken) {
    const refreshTokenHash = hashRefreshToken(refreshToken);
    const result = await pool.query(
        `SELECT
            ms.id,
            ms.admin_user_id,
            ms.device_name,
            ms.platform,
            ms.expires_at,
            ms.revoked_at,
            ms.created_at,
            ms.last_used_at,
            au.username,
            au.role,
            au.is_protected,
            au.department,
            au.active
         FROM mobile_sessions ms
         JOIN admin_users au
           ON au.id = ms.admin_user_id
         WHERE ms.refresh_token_hash = $1
         LIMIT 1`,
        [refreshTokenHash]
    );
    return result.rowCount ? result.rows[0] : null;
}

async function rotateMobileSession(refreshToken) {
    const current = await getMobileSessionByRefreshToken(refreshToken);
    if (!current || current.revoked_at || !current.active || new Date(current.expires_at).getTime() <= Date.now()) {
        return null;
    }

    const nextRefreshToken = generateRefreshToken();
    const nextRefreshTokenHash = hashRefreshToken(nextRefreshToken);
    const updated = await pool.query(
        `UPDATE mobile_sessions
         SET refresh_token_hash = $1,
             expires_at = NOW() + make_interval(days => $2),
             last_used_at = NOW()
         WHERE id = $3
           AND revoked_at IS NULL
         RETURNING id, device_name, platform, expires_at, created_at, last_used_at`,
        [
            nextRefreshTokenHash,
            REFRESH_TOKEN_DAYS,
            current.id
        ]
    );
    if (updated.rowCount === 0) return null;

    const payload = await buildAuthPayload(current, {
        authKind: 'mobile',
        mobileSessionId: current.id
    });

    return {
        access_token: signAccessToken(payload),
        refresh_token: nextRefreshToken,
        expires_in: ACCESS_TOKEN_TTL_SECONDS,
        user: buildUserResponse(payload),
        session: updated.rows[0]
    };
}

async function revokeMobileSession(refreshToken) {
    const refreshTokenHash = hashRefreshToken(refreshToken);
    const result = await pool.query(
        `UPDATE mobile_sessions
         SET revoked_at = NOW(),
             last_used_at = NOW()
         WHERE refresh_token_hash = $1
           AND revoked_at IS NULL
         RETURNING id, admin_user_id, device_name, platform`,
        [refreshTokenHash]
    );
    return result.rowCount ? result.rows[0] : null;
}

async function isMobileSessionActive(sessionId, userId, client) {
    const db = client || pool;
    const result = await db.query(
        `SELECT 1
         FROM mobile_sessions
         WHERE id = $1
           AND admin_user_id = $2
           AND revoked_at IS NULL
           AND expires_at > NOW()`,
        [sessionId, userId]
    );
    return result.rowCount > 0;
}

module.exports = {
    ACCESS_TOKEN_TTL_SECONDS,
    canUseMobileAuth,
    getActiveAdminUserByUsername,
    verifyAdminPassword,
    buildAuthPayload,
    signAccessToken,
    buildUserResponse,
    createMobileSession,
    rotateMobileSession,
    revokeMobileSession,
    isMobileSessionActive
};
