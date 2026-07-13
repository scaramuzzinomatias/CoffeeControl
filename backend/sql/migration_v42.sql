-- migration_v42.sql
-- Activa RLS en mobile_sessions (política ya existe desde v34)
ALTER TABLE mobile_sessions ENABLE ROW LEVEL SECURITY;

-- Registrar esta migración
INSERT INTO schema_migrations (version, filename)
VALUES (42, 'migration_v42.sql')
ON CONFLICT (version) DO NOTHING;
