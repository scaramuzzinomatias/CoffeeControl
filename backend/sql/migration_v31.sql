-- ══════════════════════════════════════════════════════
--  CoffeeControl — Migración v31 — Multi-tenant: tenants + tenant_id
--  Ejecutar: psql $DATABASE_URL_OWNER -f migration_v31.sql
-- ══════════════════════════════════════════════════════
--
-- Esta migración agrega la columna tenant_id a todas las tablas
-- de negocio y crea la tabla tenants.
--
-- NOTA sobre UNIQUE constraints existentes:
--   employees.email, nfc_cards.uid, admin_users.username,
--   firmware_releases.version, firmware_releases.storage_path
--   permanecen como UNIQUE global. Si durante la migración de datos
--   (Fase 6) dos clientes tienen valores iguales, se manejará como
--   conflicto manual, igual que con MACs duplicadas.
--
-- ══════════════════════════════════════════════════════

-- 1. Crear tabla tenants
CREATE TABLE IF NOT EXISTS tenants (
    id          SERIAL PRIMARY KEY,
    slug        VARCHAR(60) NOT NULL UNIQUE,
    name        VARCHAR(120) NOT NULL,
    domain      VARCHAR(255),
    settings    JSONB NOT NULL DEFAULT '{}'::jsonb,
    active      BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Insertar tenant legacy (id=1) para backfill de datos existentes
INSERT INTO tenants (id, slug, name, domain)
VALUES (1, 'legacy', 'Migración Legacy', 'legacy.localhost')
ON CONFLICT (id) DO NOTHING;

-- 3. Agregar tenant_id a todas las tablas de negocio
--    Cada ALTER TABLE: ADD COLUMN con DEFAULT = 1 (legacy), luego SET NOT NULL

-- 3a. employees
ALTER TABLE employees
    ADD COLUMN tenant_id INT NOT NULL DEFAULT 1
    REFERENCES tenants(id);
CREATE INDEX IF NOT EXISTS idx_employees_tenant_id ON employees(tenant_id);

-- 3b. access_levels
ALTER TABLE access_levels
    ADD COLUMN tenant_id INT NOT NULL DEFAULT 1
    REFERENCES tenants(id);
CREATE INDEX IF NOT EXISTS idx_access_levels_tenant_id ON access_levels(tenant_id);

-- 3c. nfc_cards
ALTER TABLE nfc_cards
    ADD COLUMN tenant_id INT NOT NULL DEFAULT 1
    REFERENCES tenants(id);
CREATE INDEX IF NOT EXISTS idx_nfc_cards_tenant_id ON nfc_cards(tenant_id);

-- 3d. machines (mantiene UNIQUE(mac) global)
ALTER TABLE machines
    ADD COLUMN tenant_id INT NOT NULL DEFAULT 1
    REFERENCES tenants(id);
CREATE INDEX IF NOT EXISTS idx_machines_tenant_id ON machines(tenant_id);

-- 3e. firmware_releases
ALTER TABLE firmware_releases
    ADD COLUMN tenant_id INT NOT NULL DEFAULT 1
    REFERENCES tenants(id);
CREATE INDEX IF NOT EXISTS idx_firmware_releases_tenant_id ON firmware_releases(tenant_id);

-- 3f. alert_events (PK es alert_key VARCHAR, no SERIAL)
ALTER TABLE alert_events
    ADD COLUMN tenant_id INT NOT NULL DEFAULT 1
    REFERENCES tenants(id);
CREATE INDEX IF NOT EXISTS idx_alert_events_tenant_id ON alert_events(tenant_id);

-- 3g. notification_settings (singleton por tenant — cambiar PK)
ALTER TABLE notification_settings
    ADD COLUMN tenant_id INT NOT NULL DEFAULT 1
    REFERENCES tenants(id);
ALTER TABLE notification_settings
    DROP CONSTRAINT IF EXISTS notification_settings_pkey CASCADE;
ALTER TABLE notification_settings
    ADD PRIMARY KEY (tenant_id, id);
CREATE INDEX IF NOT EXISTS idx_notification_settings_tenant_id ON notification_settings(tenant_id);

-- 3h. system_settings (singleton por tenant — cambiar PK)
ALTER TABLE system_settings
    ADD COLUMN tenant_id INT NOT NULL DEFAULT 1
    REFERENCES tenants(id);
ALTER TABLE system_settings
    DROP CONSTRAINT IF EXISTS system_settings_pkey CASCADE;
ALTER TABLE system_settings
    ADD PRIMARY KEY (tenant_id, id);
CREATE INDEX IF NOT EXISTS idx_system_settings_tenant_id ON system_settings(tenant_id);

-- 3i. admin_users
ALTER TABLE admin_users
    ADD COLUMN tenant_id INT NOT NULL DEFAULT 1
    REFERENCES tenants(id);
CREATE INDEX IF NOT EXISTS idx_admin_users_tenant_id ON admin_users(tenant_id);

-- 3j. admin_user_departments
ALTER TABLE admin_user_departments
    ADD COLUMN tenant_id INT NOT NULL DEFAULT 1
    REFERENCES tenants(id);
CREATE INDEX IF NOT EXISTS idx_admin_user_departments_tenant_id ON admin_user_departments(tenant_id);

-- 3k. mobile_sessions (sin RLS, pero con tenant_id para integridad)
ALTER TABLE mobile_sessions
    ADD COLUMN tenant_id INT NOT NULL DEFAULT 1
    REFERENCES tenants(id);
CREATE INDEX IF NOT EXISTS idx_mobile_sessions_tenant_id ON mobile_sessions(tenant_id);

-- 3l. audit_logs
ALTER TABLE audit_logs
    ADD COLUMN tenant_id INT NOT NULL DEFAULT 1
    REFERENCES tenants(id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_id ON audit_logs(tenant_id);

-- 3m. machine_stock_items
ALTER TABLE machine_stock_items
    ADD COLUMN tenant_id INT NOT NULL DEFAULT 1
    REFERENCES tenants(id);
CREATE INDEX IF NOT EXISTS idx_machine_stock_items_tenant_id ON machine_stock_items(tenant_id);

-- 3n. taps
ALTER TABLE taps
    ADD COLUMN tenant_id INT NOT NULL DEFAULT 1
    REFERENCES tenants(id);
CREATE INDEX IF NOT EXISTS idx_taps_tenant_id ON taps(tenant_id);

-- 3o. stock_movements
ALTER TABLE stock_movements
    ADD COLUMN tenant_id INT NOT NULL DEFAULT 1
    REFERENCES tenants(id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_tenant_id ON stock_movements(tenant_id);

-- 3p. machine_commands
ALTER TABLE machine_commands
    ADD COLUMN tenant_id INT NOT NULL DEFAULT 1
    REFERENCES tenants(id);
CREATE INDEX IF NOT EXISTS idx_machine_commands_tenant_id ON machine_commands(tenant_id);

-- 3q. pending_machines (mantiene UNIQUE(mac) global)
ALTER TABLE pending_machines
    ADD COLUMN tenant_id INT NOT NULL DEFAULT 1
    REFERENCES tenants(id);
CREATE INDEX IF NOT EXISTS idx_pending_machines_tenant_id ON pending_machines(tenant_id);

-- 4. Recrear vistas con tenant_id en SELECT y GROUP BY
--    Nota: las vistas NO filtran por tenant_id. Las rutas agregan
--    WHERE tenant_id = $N al consultarlas.

-- 4a. machine_status (última versión: migration_v29)
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
    m.tenant_id,
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
    m.tenant_id,
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

-- 4b. daily_consumption (última versión: migration_v21, con access_levels)
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
    e.id AS employee_id,
    e.name AS employee_name,
    e.department,
    e.access_level_id,
    al.name AS access_level_name,
    e.tenant_id,
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
GROUP BY e.id, e.tenant_id, al.id;

-- 4c. monthly_summary (última versión: migration_v21)
DROP VIEW IF EXISTS monthly_summary;

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
    e.tenant_id,
    DATE_TRUNC('month', t.tapped_at AT TIME ZONE cfg.business_timezone) AS month,
    COUNT(t.id) FILTER (WHERE t.approved = true) AS taps_total,
    COALESCE(SUM(t.amount_cents) FILTER (WHERE t.approved = true), 0) AS spent_cents
FROM employees e
LEFT JOIN access_levels al ON al.id = e.access_level_id
CROSS JOIN cfg
LEFT JOIN taps t ON t.employee_id = e.id AND t.approved = true
WHERE e.active = true
GROUP BY e.id, e.tenant_id, al.id, DATE_TRUNC('month', t.tapped_at AT TIME ZONE cfg.business_timezone);

-- 4d. employee_machine_consumption (última versión: migration_v14)
DROP VIEW IF EXISTS employee_machine_consumption;

CREATE VIEW employee_machine_consumption AS
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
    e.tenant_id,
    m.id AS machine_id,
    m.name AS machine_name,
    m.location,
    m.tenant_id AS machine_tenant_id,
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
GROUP BY e.id, e.name, e.department, e.legajo, e.tenant_id, m.id, m.name, m.location, m.tenant_id;

-- 5. Registrar esta migración
INSERT INTO schema_migrations (version, filename)
VALUES (31, 'migration_v31.sql')
ON CONFLICT (version) DO NOTHING;
