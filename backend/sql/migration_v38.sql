-- migration_v38.sql
-- Activa RLS en employees (política ya existe desde v34)
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

-- Registrar esta migración
INSERT INTO schema_migrations (version, filename)
VALUES (38, 'migration_v38.sql')
ON CONFLICT (version) DO NOTHING;
