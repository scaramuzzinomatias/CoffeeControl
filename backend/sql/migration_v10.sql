-- ══════════════════════════════════════════════════════
--  CoffeeControl — Migración v10 — Límite diario editable + aviso previo
--  Ejecutar: psql $DATABASE_URL -f migration_v10.sql
-- ══════════════════════════════════════════════════════

ALTER TABLE employees
    ADD COLUMN IF NOT EXISTS daily_limit_mode VARCHAR(16) NOT NULL DEFAULT 'enforce',
    ADD COLUMN IF NOT EXISTS warning_enabled BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE admin_users
    ADD COLUMN IF NOT EXISTS email VARCHAR(120);

ALTER TABLE notification_settings
    ADD COLUMN IF NOT EXISTS notify_employee_limit_warning BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE taps
    ADD COLUMN IF NOT EXISTS over_limit BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_taps_over_limit
    ON taps (employee_id, tapped_at)
    WHERE over_limit = true;

UPDATE employees
SET daily_limit_mode = 'enforce'
WHERE daily_limit_mode IS NULL;

UPDATE employees
SET warning_enabled = true
WHERE warning_enabled IS NULL;

DROP VIEW IF EXISTS daily_consumption;

CREATE VIEW daily_consumption AS
SELECT
    e.id          AS employee_id,
    e.name        AS employee_name,
    e.department,
    e.daily_limit,
    e.daily_limit_mode,
    e.warning_enabled,
    COUNT(t.id) FILTER (WHERE t.approved = true)  AS taps_today,
    COUNT(t.id) FILTER (WHERE t.approved = true AND t.over_limit = true) AS taps_over_limit,
    COALESCE(SUM(t.amount_cents) FILTER (WHERE t.approved = true), 0) AS spent_today_cents
FROM employees e
LEFT JOIN taps t
    ON t.employee_id = e.id
    AND t.tapped_at >= CURRENT_DATE
    AND t.tapped_at <  CURRENT_DATE + INTERVAL '1 day'
WHERE e.active = true
GROUP BY e.id, e.name, e.department, e.daily_limit, e.daily_limit_mode, e.warning_enabled;
