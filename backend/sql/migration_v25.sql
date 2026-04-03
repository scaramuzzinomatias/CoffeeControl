-- ══════════════════════════════════════════════════════
--  CoffeeControl — Migración v25 — Precio configurable por máquina
--  Ejecutar: psql $DATABASE_URL -f migration_v25.sql
-- ══════════════════════════════════════════════════════

ALTER TABLE machines
ADD COLUMN IF NOT EXISTS price_cents INT NOT NULL DEFAULT 1200;

UPDATE machines
SET price_cents = 1200
WHERE price_cents IS NULL OR price_cents <= 0;

ALTER TABLE machines
DROP CONSTRAINT IF EXISTS machines_price_cents_check;

ALTER TABLE machines
ADD CONSTRAINT machines_price_cents_check
CHECK (price_cents > 0);

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
    m.price_cents,
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
    m.backend_error
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
    m.price_cents,
    m.wifi_ssid,
    m.backend_url,
    m.wifi_rssi,
    m.wifi_ip,
    m.backend_ok,
    m.backend_error;
