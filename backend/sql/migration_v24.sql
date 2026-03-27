CREATE TABLE IF NOT EXISTS mobile_sessions (
    id                 BIGSERIAL PRIMARY KEY,
    admin_user_id      INT NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
    device_name        VARCHAR(120),
    platform           VARCHAR(30) NOT NULL DEFAULT 'android',
    user_agent         VARCHAR(255),
    refresh_token_hash VARCHAR(64) NOT NULL UNIQUE,
    last_used_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at         TIMESTAMPTZ NOT NULL,
    revoked_at         TIMESTAMPTZ,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mobile_sessions_user
    ON mobile_sessions(admin_user_id, revoked_at, expires_at DESC);
