-- ══════════════════════════════════════════════════════
--  CoffeeControl — Migración v30 — Reentrega confiable de comandos remotos
--  Ejecutar: psql $DATABASE_URL -f migration_v30.sql
-- ══════════════════════════════════════════════════════

ALTER TABLE machine_commands
    DROP CONSTRAINT IF EXISTS machine_commands_status_check;

ALTER TABLE machine_commands
    ADD CONSTRAINT machine_commands_status_check
    CHECK (status IN ('queued', 'delivered', 'completed', 'failed'));

CREATE INDEX IF NOT EXISTS idx_machine_commands_machine_active
    ON machine_commands (machine_id, status, delivered_at, queued_at)
    WHERE status IN ('queued', 'delivered');
