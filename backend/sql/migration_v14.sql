-- ══════════════════════════════════════════════════════
--  CoffeeControl — Migración v14 — Zona horaria operativa global
--  Ejecutar: psql $DATABASE_URL -f migration_v14.sql
-- ══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS system_settings (
    id                SMALLINT PRIMARY KEY DEFAULT 1,
    business_timezone VARCHAR(80) NOT NULL DEFAULT 'America/Argentina/Buenos_Aires',
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (id = 1)
);

INSERT INTO system_settings(id, business_timezone)
VALUES (1, COALESCE(NULLIF(current_setting('app.business_timezone', true), ''), 'America/Argentina/Buenos_Aires'))
ON CONFLICT (id) DO NOTHING;

DROP VIEW IF EXISTS daily_consumption;
CREATE VIEW daily_consumption AS
WITH cfg AS (
    SELECT COALESCE((SELECT business_timezone FROM system_settings WHERE id = 1), 'America/Argentina/Buenos_Aires') AS business_timezone
),
bounds AS (
    SELECT
        business_timezone,
        (((CURRENT_TIMESTAMP AT TIME ZONE business_timezone)::date)::timestamp AT TIME ZONE business_timezone) AS day_start,
        ((((CURRENT_TIMESTAMP AT TIME ZONE business_timezone)::date + INTERVAL '1 day')::timestamp) AT TIME ZONE business_timezone) AS day_end
    FROM cfg
)
SELECT
    e.id          AS employee_id,
    e.name        AS employee_name,
    e.department,
    e.daily_limit,
    e.daily_limit_mode,
    e.warning_enabled,
    COUNT(t.id) FILTER (WHERE t.approved = true) AS taps_today,
    COUNT(t.id) FILTER (WHERE t.approved = true AND t.over_limit = true) AS taps_over_limit,
    COALESCE(SUM(t.amount_cents) FILTER (WHERE t.approved = true), 0) AS spent_today_cents
FROM employees e
CROSS JOIN bounds b
LEFT JOIN taps t
    ON t.employee_id = e.id
   AND t.tapped_at >= b.day_start
   AND t.tapped_at <  b.day_end
WHERE e.active = true
GROUP BY e.id, e.name, e.department, e.daily_limit, e.daily_limit_mode, e.warning_enabled;

DROP VIEW IF EXISTS monthly_summary;
CREATE VIEW monthly_summary AS
WITH cfg AS (
    SELECT COALESCE((SELECT business_timezone FROM system_settings WHERE id = 1), 'America/Argentina/Buenos_Aires') AS business_timezone
)
SELECT
    e.id AS employee_id,
    e.name AS employee_name,
    e.department,
    DATE_TRUNC('month', t.tapped_at AT TIME ZONE cfg.business_timezone) AS month,
    COUNT(t.id) FILTER (WHERE t.approved = true) AS taps_total,
    COALESCE(SUM(t.amount_cents) FILTER (WHERE t.approved = true), 0) AS spent_cents
FROM employees e
CROSS JOIN cfg
LEFT JOIN taps t ON t.employee_id = e.id
WHERE e.active = true
GROUP BY e.id, e.name, e.department, DATE_TRUNC('month', t.tapped_at AT TIME ZONE cfg.business_timezone);

CREATE OR REPLACE VIEW machine_status AS
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
    m.wifi_ssid,
    m.backend_url,
    m.wifi_rssi,
    m.wifi_ip,
    m.backend_ok,
    m.backend_error;

CREATE OR REPLACE VIEW employee_machine_consumption AS
WITH cfg AS (
    SELECT COALESCE((SELECT business_timezone FROM system_settings WHERE id = 1), 'America/Argentina/Buenos_Aires') AS business_timezone
),
bounds AS (
    SELECT
        business_timezone,
        (DATE_TRUNC('month', CURRENT_TIMESTAMP AT TIME ZONE business_timezone) AT TIME ZONE business_timezone) AS month_start,
        ((DATE_TRUNC('month', CURRENT_TIMESTAMP AT TIME ZONE business_timezone) + INTERVAL '1 month') AT TIME ZONE business_timezone) AS month_end
    FROM cfg
)
SELECT
    e.id AS employee_id,
    e.name AS employee_name,
    e.department,
    e.legajo,
    m.id AS machine_id,
    m.name AS machine_name,
    m.location,
    COUNT(t.id) AS taps_count,
    COALESCE(SUM(t.amount_cents), 0) AS spent_cents
FROM employees e
CROSS JOIN bounds b
JOIN taps t
    ON t.employee_id = e.id
   AND t.approved = true
   AND t.tapped_at >= b.month_start
   AND t.tapped_at <  b.month_end
JOIN machines m ON m.id = t.machine_id
GROUP BY e.id, e.name, e.department, e.legajo, m.id, m.name, m.location;
