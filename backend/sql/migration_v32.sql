-- ══════════════════════════════════════════════════════
--  CoffeeControl — Migración v32 — RLS: access_levels
--  Ejecutar con el rol owner:
--    psql $DATABASE_URL_OWNER -f migration_v32.sql
-- ══════════════════════════════════════════════════════
--
-- 1. Reemplazar UNIQUE globales por compuestas con tenant_id
--    (dos tenants no pueden tener code/name duplicados entre sí)
-- 2. Crear la política RLS para aislar access_levels por tenant
--    usando app.tenant_id (seteado por tenantTransaction)
--
-- ══════════════════════════════════════════════════════
--  IMPORTANTE: NO ejecuta ENABLE ROW LEVEL SECURITY
--  La activación se hace en un paso separado DESPUÉS de
--  verificar que todas las rutas usan req.db y filtran
--  por tenant_id correctamente.
-- ══════════════════════════════════════════════════════

-- 1a. Dropear constraints UNIQUE globales (nombres auto-generados
--     por PostgreSQL desde la CREATE TABLE en schema.sql y
--     migration_v21.sql)
ALTER TABLE access_levels DROP CONSTRAINT IF EXISTS access_levels_code_key;
ALTER TABLE access_levels DROP CONSTRAINT IF EXISTS access_levels_name_key;

-- 1b. Crear UNIQUE compuestas por tenant
ALTER TABLE access_levels
    ADD CONSTRAINT uq_access_levels_tenant_code
    UNIQUE (tenant_id, code);

ALTER TABLE access_levels
    ADD CONSTRAINT uq_access_levels_tenant_name
    UNIQUE (tenant_id, name);

-- 2. Crear política de aislamiento por tenant
--    USING:    SELECT, UPDATE, DELETE
--    WITH CHECK: INSERT, UPDATE (nuevo row)
CREATE POLICY tenant_isolation ON access_levels
    FOR ALL
    USING (tenant_id = current_setting('app.tenant_id')::INT)
    WITH CHECK (tenant_id = current_setting('app.tenant_id')::INT);

-- 3. Política de caída libre para el rol bootstrap
--    coffeecontrol_owner bypasea RLS por ser OWNER de las tablas
--    (mecanismo intrínseco de PostgreSQL: RLS no se aplica al owner).
--    coffeecontrol_bootstrap tiene el atributo BYPASSRLS explícito.
--    Ambos ven todas las filas sin necesidad de policy explícita.

-- ══════════════════════════════════════════════════════
--  ACTIVACIÓN (ejecutar manualmente tras verificación):
--    ALTER TABLE access_levels ENABLE ROW LEVEL SECURITY;
-- ══════════════════════════════════════════════════════

-- 4. Registrar esta migración
INSERT INTO schema_migrations (version, filename)
VALUES (32, 'migration_v32.sql')
ON CONFLICT (version) DO NOTHING;
