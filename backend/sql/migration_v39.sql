-- migration_v39.sql
-- Activa RLS en admin_user_departments (política ya existe desde v34)
ALTER TABLE admin_user_departments ENABLE ROW LEVEL SECURITY;

-- Registrar esta migración
INSERT INTO schema_migrations (version, filename)
VALUES (39, 'migration_v39.sql')
ON CONFLICT (version) DO NOTHING;
