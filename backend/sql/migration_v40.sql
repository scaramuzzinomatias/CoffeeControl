-- migration_v40.sql
-- Activa RLS en audit_logs (política ya existe desde v34)
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Registrar esta migración
INSERT INTO schema_migrations (version, filename)
VALUES (40, 'migration_v40.sql')
ON CONFLICT (version) DO NOTHING;
