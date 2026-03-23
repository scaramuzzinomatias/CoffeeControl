-- ══════════════════════════════════════════════════════
--  CoffeeControl — Migración v3 — Autoregistro por MAC
-- ══════════════════════════════════════════════════════

-- Reemplazar el campo "secret" por "mac" en machines
ALTER TABLE machines
    ADD COLUMN IF NOT EXISTS mac VARCHAR(20) UNIQUE;

-- Máquinas pendientes de aprobación
CREATE TABLE IF NOT EXISTS pending_machines (
    id          SERIAL PRIMARY KEY,
    mac         VARCHAR(20) UNIQUE NOT NULL,
    first_seen  TIMESTAMPTZ DEFAULT NOW(),
    last_ping   TIMESTAMPTZ DEFAULT NOW(),
    approved    BOOLEAN NOT NULL DEFAULT false
);

-- Actualizar el middleware de autenticación:
-- En lugar de buscar por secret, busca por MAC en la columna machines.mac
-- Las MACs en pending_machines son las que esperan aprobación del admin

-- Índice para búsqueda rápida por MAC
CREATE INDEX IF NOT EXISTS idx_machines_mac ON machines (mac);
