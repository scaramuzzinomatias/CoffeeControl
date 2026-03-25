-- ══════════════════════════════════════════════════════
--  CoffeeControl — Migración v7 — Telemetría de red por máquina
--  Ejecutar: psql $DATABASE_URL -f migration_v7.sql
-- ══════════════════════════════════════════════════════

ALTER TABLE machines
    ADD COLUMN IF NOT EXISTS wifi_rssi     INT,
    ADD COLUMN IF NOT EXISTS wifi_ip       VARCHAR(45),
    ADD COLUMN IF NOT EXISTS backend_ok    BOOLEAN,
    ADD COLUMN IF NOT EXISTS backend_error VARCHAR(255);

CREATE OR REPLACE VIEW machine_status AS
SELECT
    m.id,
    m.name,
    m.location,
    m.active,
    m.blocked,
    m.blocked_reason,
    m.last_seen,
    COUNT(t.id) FILTER (
        WHERE t.tapped_at >= CURRENT_DATE AND t.approved = true
    ) AS taps_today,
    COUNT(t.id) FILTER (
        WHERE t.tapped_at >= DATE_TRUNC('month', NOW()) AND t.approved = true
    ) AS taps_month,
    COALESCE(SUM(t.amount_cents) FILTER (
        WHERE t.tapped_at >= DATE_TRUNC('month', NOW()) AND t.approved = true
    ), 0) AS cost_month_cents,
    MAX(t.tapped_at) AS last_tap_at,
    m.wifi_ssid,
    m.backend_url,
    m.wifi_rssi,
    m.wifi_ip,
    m.backend_ok,
    m.backend_error
FROM machines m
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
    m.backend_error;
