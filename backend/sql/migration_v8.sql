-- ══════════════════════════════════════════════════════
--  CoffeeControl — Migración v8 — Alertas por email
--  Ejecutar: psql $DATABASE_URL -f migration_v8.sql
-- ══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS alert_events (
    alert_key        VARCHAR(160) PRIMARY KEY,
    alert_type       VARCHAR(40) NOT NULL,
    status           VARCHAR(16) NOT NULL DEFAULT 'open',
    machine_id       INT REFERENCES machines(id) ON DELETE SET NULL,
    employee_id      INT REFERENCES employees(id) ON DELETE SET NULL,
    first_seen_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_notified_at TIMESTAMPTZ,
    resolved_at      TIMESTAMPTZ,
    payload          JSONB,
    CONSTRAINT alert_events_status_check
        CHECK (status IN ('open', 'resolved'))
);

CREATE INDEX IF NOT EXISTS idx_alert_events_status_type
    ON alert_events (status, alert_type);

CREATE INDEX IF NOT EXISTS idx_alert_events_machine
    ON alert_events (machine_id, status);

CREATE INDEX IF NOT EXISTS idx_alert_events_employee
    ON alert_events (employee_id, status);
