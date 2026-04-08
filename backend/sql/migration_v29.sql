CREATE TABLE IF NOT EXISTS firmware_releases (
    id                  SERIAL PRIMARY KEY,
    version             VARCHAR(80) NOT NULL UNIQUE,
    filename            VARCHAR(180) NOT NULL,
    storage_path        VARCHAR(255) NOT NULL UNIQUE,
    content_type        VARCHAR(80) NOT NULL DEFAULT 'application/octet-stream',
    size_bytes          INT NOT NULL,
    md5                 CHAR(32) NOT NULL,
    notes               TEXT,
    created_by_user_id  INT REFERENCES admin_users(id) ON DELETE SET NULL,
    created_by_username VARCHAR(60),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (size_bytes > 0),
    CHECK (md5 ~ '^[0-9a-f]{32}$')
);

ALTER TABLE machines
    ADD COLUMN IF NOT EXISTS current_firmware_version VARCHAR(80),
    ADD COLUMN IF NOT EXISTS desired_firmware_release_id INT REFERENCES firmware_releases(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS desired_firmware_version VARCHAR(80),
    ADD COLUMN IF NOT EXISTS firmware_update_status VARCHAR(24) NOT NULL DEFAULT 'idle',
    ADD COLUMN IF NOT EXISTS firmware_update_message VARCHAR(255),
    ADD COLUMN IF NOT EXISTS firmware_update_started_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS firmware_update_completed_at TIMESTAMPTZ;

UPDATE machines
SET firmware_update_status = 'idle'
WHERE firmware_update_status IS NULL
   OR firmware_update_status NOT IN ('idle', 'queued', 'in_progress', 'pending_reconnect', 'failed', 'success');

ALTER TABLE machines
    DROP CONSTRAINT IF EXISTS machines_firmware_update_status_check;

ALTER TABLE machines
    ADD CONSTRAINT machines_firmware_update_status_check
    CHECK (firmware_update_status IN ('idle', 'queued', 'in_progress', 'pending_reconnect', 'failed', 'success'));

DROP VIEW IF EXISTS machine_status;

CREATE VIEW machine_status AS
WITH cfg AS (
    SELECT COALESCE((SELECT business_timezone FROM system_settings WHERE id = 1), 'America/Argentina/Buenos_Aires') AS business_timezone
),
bounds AS (
    SELECT
        business_timezone,
        (((CURRENT_TIMESTAMP AT TIME ZONE business_timezone)::date)::timestamp AT TIME ZONE business_timezone) AS day_start,
        ((((CURRENT_TIMESTAMP AT TIME ZONE business_timezone)::date + INTERVAL '1 day')::timestamp) AT TIME ZONE business_timezone) AS day_end,
        (DATE_TRUNC('month', CURRENT_TIMESTAMP AT TIME ZONE business_timezone) AT TIME ZONE business_timezone) AS month_start,
        ((DATE_TRUNC('month', CURRENT_TIMESTAMP AT TIME ZONE business_timezone) + INTERVAL '1 month') AT TIME ZONE business_timezone) AS month_end
    FROM cfg
)
SELECT
    m.id,
    m.name,
    m.location,
    m.active,
    m.blocked,
    m.blocked_reason,
    m.last_seen,
    COUNT(t.id) FILTER (
        WHERE t.approved = true
          AND t.tapped_at >= b.day_start
          AND t.tapped_at <  b.day_end
    ) AS taps_today,
    COUNT(t.id) FILTER (
        WHERE t.approved = true
          AND t.tapped_at >= b.month_start
          AND t.tapped_at <  b.month_end
    ) AS taps_month,
    COALESCE(SUM(t.amount_cents) FILTER (
        WHERE t.approved = true
          AND t.tapped_at >= b.month_start
          AND t.tapped_at <  b.month_end
    ), 0) AS cost_month_cents,
    MAX(t.tapped_at) AS last_tap_at,
    m.wifi_ssid,
    m.backend_url,
    m.wifi_rssi,
    m.wifi_ip,
    m.backend_ok,
    m.backend_error,
    m.current_firmware_version,
    m.desired_firmware_version,
    m.firmware_update_status,
    m.firmware_update_message,
    m.firmware_update_started_at,
    m.firmware_update_completed_at
FROM machines m
CROSS JOIN bounds b
LEFT JOIN taps t ON t.machine_id = m.id
GROUP BY
    m.id,
    m.name,
    m.location,
    m.active,
    m.blocked,
    m.blocked_reason,
    m.last_seen,
    m.wifi_ssid,
    m.backend_url,
    m.wifi_rssi,
    m.wifi_ip,
    m.backend_ok,
    m.backend_error,
    m.current_firmware_version,
    m.desired_firmware_version,
    m.firmware_update_status,
    m.firmware_update_message,
    m.firmware_update_started_at,
    m.firmware_update_completed_at;
