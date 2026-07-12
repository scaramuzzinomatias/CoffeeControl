-- migration_v37.sql
-- Activa RLS en alert_events (política ya existe desde v34)
ALTER TABLE alert_events ENABLE ROW LEVEL SECURITY;

-- Registrar esta migración
INSERT INTO schema_migrations (version, filename)
VALUES (37, 'migration_v37.sql')
ON CONFLICT (version) DO NOTHING;
