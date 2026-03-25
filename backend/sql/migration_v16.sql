-- ══════════════════════════════════════════════════════
--  CoffeeControl — Migración v16 — Auditoría de acciones administrativas
--  Ejecutar: psql $DATABASE_URL -f migration_v16.sql
-- ══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS audit_logs (
    id               BIGSERIAL PRIMARY KEY,
    actor_user_id    INT REFERENCES admin_users(id) ON DELETE SET NULL,
    actor_username   VARCHAR(60),
    actor_role       VARCHAR(20),
    actor_ip         VARCHAR(80),
    actor_user_agent VARCHAR(255),
    action           VARCHAR(80) NOT NULL,
    entity_type      VARCHAR(40) NOT NULL,
    entity_id        VARCHAR(80),
    entity_label     VARCHAR(160),
    summary          VARCHAR(255) NOT NULL,
    details          JSONB,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at
    ON audit_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity
    ON audit_logs (entity_type, entity_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor
    ON audit_logs (actor_user_id, created_at DESC);
