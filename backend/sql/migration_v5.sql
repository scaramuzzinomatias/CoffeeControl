-- ══════════════════════════════════════════════════════
--  CoffeeControl — Migración v5 — Comandos remotos a máquinas
--  Ejecutar: psql $DATABASE_URL -f migration_v5.sql
-- ══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS machine_commands (
    id           BIGSERIAL PRIMARY KEY,
    machine_id    INT NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
    command_type  VARCHAR(40) NOT NULL,
    payload       JSONB NOT NULL DEFAULT '{}'::jsonb,
    status        VARCHAR(20) NOT NULL DEFAULT 'queued',
    queued_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    delivered_at  TIMESTAMPTZ,
    completed_at  TIMESTAMPTZ,
    result        JSONB NOT NULL DEFAULT '{}'::jsonb,
    CONSTRAINT machine_commands_status_check
        CHECK (status IN ('queued', 'completed', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_machine_commands_machine_status
    ON machine_commands (machine_id, status, queued_at);

CREATE INDEX IF NOT EXISTS idx_machine_commands_queued
    ON machine_commands (queued_at)
    WHERE status = 'queued';
