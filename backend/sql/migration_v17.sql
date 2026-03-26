-- ══════════════════════════════════════════════════════
--  CoffeeControl — Migración v17
--  Supervisor con múltiples áreas asignadas
-- ══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS admin_user_departments (
    admin_user_id INT NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
    department    VARCHAR(60) NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (admin_user_id, department)
);

CREATE INDEX IF NOT EXISTS idx_admin_user_departments_department
    ON admin_user_departments (department);

INSERT INTO admin_user_departments (admin_user_id, department)
SELECT
    au.id,
    TRIM(au.department)
FROM admin_users au
WHERE au.department IS NOT NULL
  AND TRIM(au.department) <> ''
ON CONFLICT (admin_user_id, department) DO NOTHING;
