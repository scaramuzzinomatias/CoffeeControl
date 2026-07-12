-- migration_v34.sql
-- Creación de políticas RLS para los 11 grupos restantes.
-- Las políticas se definen (metadata) pero NO se activan porque
-- estas tablas son consultadas también vía pool (sin app.tenant_id).
-- La aislación multi-tenant se logra mediante filtros explícitos de
-- tenant_id en todos los queries JS (auditados y corregidos).
--
-- Las tablas con RLS realmente activo son solo aquellas cuyo 100 %
-- del acceso es vía req.db (que setea app.tenant_id):
--   access_levels, firmware_releases, machine_commands, nfc_cards, taps
-- (activadas en migrations v32 y v33).

CREATE POLICY tenant_isolation ON admin_user_departments
    FOR ALL
    USING (tenant_id = current_setting('app.tenant_id')::INT)
    WITH CHECK (tenant_id = current_setting('app.tenant_id')::INT);

CREATE POLICY tenant_isolation ON admin_users
    FOR ALL
    USING (tenant_id = current_setting('app.tenant_id')::INT)
    WITH CHECK (tenant_id = current_setting('app.tenant_id')::INT);

CREATE POLICY tenant_isolation ON alert_events
    FOR ALL
    USING (tenant_id = current_setting('app.tenant_id')::INT)
    WITH CHECK (tenant_id = current_setting('app.tenant_id')::INT);

CREATE POLICY tenant_isolation ON audit_logs
    FOR ALL
    USING (tenant_id = current_setting('app.tenant_id')::INT)
    WITH CHECK (tenant_id = current_setting('app.tenant_id')::INT);

CREATE POLICY tenant_isolation ON employees
    FOR ALL
    USING (tenant_id = current_setting('app.tenant_id')::INT)
    WITH CHECK (tenant_id = current_setting('app.tenant_id')::INT);

CREATE POLICY tenant_isolation ON machine_stock_items
    FOR ALL
    USING (tenant_id = current_setting('app.tenant_id')::INT)
    WITH CHECK (tenant_id = current_setting('app.tenant_id')::INT);

CREATE POLICY tenant_isolation ON machines
    FOR ALL
    USING (tenant_id = current_setting('app.tenant_id')::INT)
    WITH CHECK (tenant_id = current_setting('app.tenant_id')::INT);

CREATE POLICY tenant_isolation ON mobile_sessions
    FOR ALL
    USING (tenant_id = current_setting('app.tenant_id')::INT)
    WITH CHECK (tenant_id = current_setting('app.tenant_id')::INT);

CREATE POLICY tenant_isolation ON notification_settings
    FOR ALL
    USING (tenant_id = current_setting('app.tenant_id')::INT)
    WITH CHECK (tenant_id = current_setting('app.tenant_id')::INT);

CREATE POLICY tenant_isolation ON stock_movements
    FOR ALL
    USING (tenant_id = current_setting('app.tenant_id')::INT)
    WITH CHECK (tenant_id = current_setting('app.tenant_id')::INT);

CREATE POLICY tenant_isolation ON system_settings
    FOR ALL
    USING (tenant_id = current_setting('app.tenant_id')::INT)
    WITH CHECK (tenant_id = current_setting('app.tenant_id')::INT);

-- RLS no se activa. Ver notas al inicio del archivo.
-- ALTER TABLE admin_user_departments ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE alert_events ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE machine_stock_items ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE machines ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE mobile_sessions ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE notification_settings ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- Registrar esta migración
INSERT INTO schema_migrations (version, filename)
VALUES (34, 'migration_v34.sql')
ON CONFLICT (version) DO NOTHING;
