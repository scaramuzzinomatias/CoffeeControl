-- ══════════════════════════════════════════════════════
--  CoffeeControl — Migración v2
--  Ejecutar sobre la base existente: psql $DATABASE_URL -f migration_v2.sql
-- ══════════════════════════════════════════════════════

-- Usuarios administradores (login)
CREATE TABLE IF NOT EXISTS admin_users (
    id          SERIAL PRIMARY KEY,
    username    VARCHAR(60) UNIQUE NOT NULL,
    password_hash VARCHAR(128) NOT NULL,   -- bcrypt
    role        VARCHAR(20) NOT NULL DEFAULT 'admin',  -- 'admin' | 'supervisor'
    active      BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Usuario por defecto: admin / coffeecontrol2024
-- (hash bcrypt de "coffeecontrol2024", cost=10)
INSERT INTO admin_users (username, password_hash, role) VALUES
    ('admin', '$2b$10$K7L1OJ45/4Y2nIvhRVpCe.FSmYVWTMaQ7nZ4oJmZkRLgsBHH4Y5oS', 'admin')
ON CONFLICT (username) DO NOTHING;

-- Agregar campos faltantes a employees
ALTER TABLE employees
    ADD COLUMN IF NOT EXISTS dni       VARCHAR(20),
    ADD COLUMN IF NOT EXISTS legajo    VARCHAR(20),
    ADD COLUMN IF NOT EXISTS phone     VARCHAR(20),
    ADD COLUMN IF NOT EXISTS photo_url VARCHAR(200);

-- Agregar campo blocked a machines
ALTER TABLE machines
    ADD COLUMN IF NOT EXISTS blocked   BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS blocked_reason VARCHAR(120),
    ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ;

-- Vista: estado de máquinas con estadísticas
CREATE OR REPLACE VIEW machine_status AS
SELECT
    m.id,
    m.name,
    m.location,
    m.active,
    m.blocked,
    m.blocked_reason,
    m.last_seen,
    -- taps de hoy
    COUNT(t.id) FILTER (
        WHERE t.tapped_at >= CURRENT_DATE AND t.approved = true
    ) AS taps_today,
    -- taps del mes
    COUNT(t.id) FILTER (
        WHERE t.tapped_at >= DATE_TRUNC('month', NOW()) AND t.approved = true
    ) AS taps_month,
    -- costo del mes
    COALESCE(SUM(t.amount_cents) FILTER (
        WHERE t.tapped_at >= DATE_TRUNC('month', NOW()) AND t.approved = true
    ), 0) AS cost_month_cents,
    -- último tap
    MAX(t.tapped_at) AS last_tap_at
FROM machines m
LEFT JOIN taps t ON t.machine_id = m.id
GROUP BY m.id, m.name, m.location, m.active, m.blocked, m.blocked_reason, m.last_seen;

-- Vista: consumo por empleado desglosado por máquina (mes actual)
CREATE OR REPLACE VIEW employee_machine_consumption AS
SELECT
    e.id          AS employee_id,
    e.name        AS employee_name,
    e.department,
    e.legajo,
    m.id          AS machine_id,
    m.name        AS machine_name,
    m.location,
    COUNT(t.id)   AS taps_count,
    COALESCE(SUM(t.amount_cents), 0) AS spent_cents
FROM employees e
JOIN taps t ON t.employee_id = e.id AND t.approved = true
    AND t.tapped_at >= DATE_TRUNC('month', NOW())
JOIN machines m ON m.id = t.machine_id
GROUP BY e.id, e.name, e.department, e.legajo, m.id, m.name, m.location;

-- ══════════════════════════════════════════════════════
--  Roles y permisos (agregado para multi-usuario)
-- ══════════════════════════════════════════════════════
-- gerente    → acceso total
-- supervisor → puede ver dashboard, feed, reportes de SU área
--              NO puede: crear/editar empleados, bloquear máquinas, ver otros supervisores

ALTER TABLE admin_users
    ADD COLUMN IF NOT EXISTS department VARCHAR(60),  -- null = acceso a todos los departamentos
    ADD COLUMN IF NOT EXISTS full_name  VARCHAR(100);

-- Insertar supervisor de ejemplo
-- contraseña: supervisor123
INSERT INTO admin_users (username, password_hash, role, full_name, department) VALUES
    ('supervisor1', '$2b$10$K7L1OJ45/4Y2nIvhRVpCe.FSmYVWTMaQ7nZ4oJmZkRLgsBHH4Y5oS', 'supervisor', 'Supervisor IT', 'IT')
ON CONFLICT (username) DO NOTHING;
