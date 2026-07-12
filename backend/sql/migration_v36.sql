-- migration_v36.sql
-- Activar RLS en notification_settings (migrada a withTenantContext)
--
-- La política tenant_isolation ya fue creada en migration_v34.sql.
-- notification_settings es accedida exclusivamente via withTenantContext
-- (ver backend/src/services/alerts.js: loadNotificationSettings / saveNotificationSettings),
-- que ejecuta set_config('app.tenant_id', ...) dentro de cada transacción,
-- por lo que la política RLS se aplica correctamente.
--
-- coffeecontrol_app (rol de la aplicación) está sujeto a RLS.
-- coffeecontrol_owner (owner) y coffeecontrol_bootstrap (BYPASSRLS)
-- siguen viendo todas las filas sin restricción.

ALTER TABLE notification_settings ENABLE ROW LEVEL SECURITY;

-- Registrar esta migración
INSERT INTO schema_migrations (version, filename)
VALUES (36, 'migration_v36.sql')
ON CONFLICT (version) DO NOTHING;
