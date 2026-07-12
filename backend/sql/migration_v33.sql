-- migration_v33.sql
-- Activación de RLS (políticas): firmware_releases, nfc_cards, machine_commands, taps
-- Grupo A: 100% del acceso vía req.db, que ya setea app.tenant_id por transacción
-- (ver inventario completo en el chat de continuidad de la migración multi-tenant)

CREATE POLICY tenant_isolation ON firmware_releases
    FOR ALL
    USING (tenant_id = current_setting('app.tenant_id')::INT)
    WITH CHECK (tenant_id = current_setting('app.tenant_id')::INT);

CREATE POLICY tenant_isolation ON nfc_cards
    FOR ALL
    USING (tenant_id = current_setting('app.tenant_id')::INT)
    WITH CHECK (tenant_id = current_setting('app.tenant_id')::INT);

CREATE POLICY tenant_isolation ON machine_commands
    FOR ALL
    USING (tenant_id = current_setting('app.tenant_id')::INT)
    WITH CHECK (tenant_id = current_setting('app.tenant_id')::INT);

CREATE POLICY tenant_isolation ON taps
    FOR ALL
    USING (tenant_id = current_setting('app.tenant_id')::INT)
    WITH CHECK (tenant_id = current_setting('app.tenant_id')::INT);

-- La activación (ENABLE ROW LEVEL SECURITY) queda deliberadamente comentada,
-- igual que en migration_v32.sql. Se activa manualmente tabla por tabla,
-- corriendo la suite completa entre cada ALTER TABLE, y recién se descomenta
-- acá una vez confirmadas las 4 activaciones.

ALTER TABLE firmware_releases ENABLE ROW LEVEL SECURITY;
ALTER TABLE nfc_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE machine_commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE taps ENABLE ROW LEVEL SECURITY;

-- Registrar esta migración
INSERT INTO schema_migrations (version, filename)
VALUES (33, 'migration_v33.sql')
ON CONFLICT (version) DO NOTHING;
