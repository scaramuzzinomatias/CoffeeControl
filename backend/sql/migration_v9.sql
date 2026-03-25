-- ══════════════════════════════════════════════════════
--  CoffeeControl — Migración v9 — Configuración de notificaciones
--  Ejecutar: psql $DATABASE_URL -f migration_v9.sql
-- ══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS notification_settings (
    id                                SMALLINT PRIMARY KEY DEFAULT 1,
    enabled                           BOOLEAN NOT NULL DEFAULT true,
    recipient_emails                  TEXT NOT NULL DEFAULT '',
    notify_employee_daily_blocked     BOOLEAN NOT NULL DEFAULT true,
    notify_machine_offline            BOOLEAN NOT NULL DEFAULT true,
    notify_machine_backend_down       BOOLEAN NOT NULL DEFAULT true,
    created_at                        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT notification_settings_singleton_check CHECK (id = 1)
);
