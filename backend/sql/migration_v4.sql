-- ══════════════════════════════════════════════════════
--  CoffeeControl — Migración v4 — Modo offline firmware v3
--  Ejecutar: psql $DATABASE_URL -f migration_v4.sql
-- ══════════════════════════════════════════════════════

-- Columna over_limit: marca taps offline que superaron el límite diario
-- (el café se dispensó físicamente pero el ESP estaba offline y no pudo verificar)
ALTER TABLE taps
    ADD COLUMN IF NOT EXISTS over_limit BOOLEAN NOT NULL DEFAULT false;

-- Índice para consultas de auditoría de eventos over_limit
CREATE INDEX IF NOT EXISTS idx_taps_over_limit
    ON taps (employee_id, tapped_at)
    WHERE over_limit = true;

-- Vista actualizada: incluye over_limit en el resumen diario
CREATE OR REPLACE VIEW daily_consumption AS
SELECT
    e.id          AS employee_id,
    e.name        AS employee_name,
    e.department,
    e.daily_limit,
    COUNT(t.id) FILTER (WHERE t.approved = true)                         AS taps_today,
    COUNT(t.id) FILTER (WHERE t.approved = true AND t.over_limit = true) AS taps_over_limit,
    COALESCE(SUM(t.amount_cents) FILTER (WHERE t.approved = true), 0)   AS spent_today_cents
FROM employees e
LEFT JOIN taps t
    ON t.employee_id = e.id
    AND t.tapped_at >= CURRENT_DATE
    AND t.tapped_at <  CURRENT_DATE + INTERVAL '1 day'
WHERE e.active = true
GROUP BY e.id, e.name, e.department, e.daily_limit;
