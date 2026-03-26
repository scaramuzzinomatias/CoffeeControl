CREATE TABLE IF NOT EXISTS access_levels (
    id               SERIAL PRIMARY KEY,
    code             VARCHAR(40) NOT NULL UNIQUE,
    name             VARCHAR(80) NOT NULL UNIQUE,
    description      VARCHAR(255),
    daily_limit      INT NOT NULL,
    daily_limit_mode VARCHAR(16) NOT NULL DEFAULT 'enforce',
    warning_enabled  BOOLEAN NOT NULL DEFAULT true,
    sort_order       INT NOT NULL DEFAULT 100,
    active           BOOLEAN NOT NULL DEFAULT true,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (daily_limit BETWEEN 1 AND 50),
    CHECK (daily_limit_mode IN ('enforce', 'warn_only', 'off')),
    CHECK (sort_order BETWEEN 0 AND 9999)
);

ALTER TABLE employees
    ADD COLUMN IF NOT EXISTS access_level_id INT REFERENCES access_levels(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_employees_access_level_id ON employees(access_level_id);

DROP VIEW IF EXISTS daily_consumption;
DROP VIEW IF EXISTS monthly_summary;

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
    e.id AS employee_id,
    e.name AS employee_name,
    e.department,
    e.access_level_id,
    al.name AS access_level_name,
    COALESCE(al.daily_limit, e.daily_limit) AS daily_limit,
    COALESCE(al.daily_limit_mode, e.daily_limit_mode) AS daily_limit_mode,
    COALESCE(al.warning_enabled, e.warning_enabled) AS warning_enabled,
    COUNT(t.id) FILTER (WHERE t.approved = true) AS taps_today,
    COUNT(t.id) FILTER (WHERE t.approved = true AND t.over_limit = true) AS taps_over_limit,
    COALESCE(SUM(t.amount_cents) FILTER (WHERE t.approved = true), 0) AS spent_today_cents
FROM employees e
LEFT JOIN access_levels al ON al.id = e.access_level_id
CROSS JOIN bounds b
LEFT JOIN taps t
    ON t.employee_id = e.id
    AND t.tapped_at >= b.day_start
    AND t.tapped_at < b.day_end
WHERE e.active = true
GROUP BY e.id, al.id;

CREATE VIEW monthly_summary AS
WITH cfg AS (
    SELECT COALESCE((SELECT business_timezone FROM system_settings WHERE id = 1), 'America/Argentina/Buenos_Aires') AS business_timezone
)
SELECT
    e.id AS employee_id,
    e.name AS employee_name,
    e.department,
    e.access_level_id,
    al.name AS access_level_name,
    DATE_TRUNC('month', t.tapped_at AT TIME ZONE cfg.business_timezone) AS month,
    COUNT(t.id) FILTER (WHERE t.approved = true) AS taps_total,
    COALESCE(SUM(t.amount_cents) FILTER (WHERE t.approved = true), 0) AS spent_cents
FROM employees e
LEFT JOIN access_levels al ON al.id = e.access_level_id
CROSS JOIN cfg
LEFT JOIN taps t ON t.employee_id = e.id AND t.approved = true
WHERE e.active = true
GROUP BY e.id, al.id, DATE_TRUNC('month', t.tapped_at AT TIME ZONE cfg.business_timezone);
