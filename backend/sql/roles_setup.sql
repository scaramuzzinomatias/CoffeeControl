-- ══════════════════════════════════════════════════════
--  CoffeeControl — Roles y permisos PostgreSQL
--  Ejecutar como superusuario:
--    psql -U postgres -d coffeecontrol -f roles_setup.sql
-- ══════════════════════════════════════════════════════
--
-- Este script crea los 3 roles de la arquitectura multi-tenant:
--
--   coffeecontrol_owner     — dueño de tablas, bypasea RLS
--                             (solo scripts de administración)
--   coffeecontrol_app       — runtime de la app, sujeto a RLS
--                             (server.js, routes, services)
--   coffeecontrol_bootstrap — BYPASSRLS para queries de arranque
--                             (login, lookup de máquina por MAC,
--                              resolución de tenant por subdominio)
--
-- ══════════════════════════════════════════════════════

-- ── 1. Owner (bypasea RLS por ser owner de las tablas) ─────────
CREATE ROLE coffeecontrol_owner WITH LOGIN PASSWORD 'cambiar_password_owner';

-- Transferir ownership de TODOS los objetos existentes del schema public
-- a coffeecontrol_owner. Sin esto, ALTER TABLE … ADD COLUMN falla con
-- "must be owner of table" cuando el script corre como coffeecontrol_owner.
-- El DO $$ itera dinámicamente tablas, vistas y secuencias para cubrir
-- cualquier objeto que exista (incluyendo los creados por migraciones
-- pasadas bajo el rol postgres).
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public' LOOP
        EXECUTE format('ALTER TABLE IF EXISTS %I OWNER TO coffeecontrol_owner', r.tablename);
    END LOOP;
    FOR r IN SELECT table_name FROM information_schema.views WHERE table_schema = 'public' LOOP
        EXECUTE format('ALTER VIEW IF EXISTS %I OWNER TO coffeecontrol_owner', r.table_name);
    END LOOP;
    FOR r IN SELECT c.relname AS seqname
             FROM pg_catalog.pg_class c
             JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
             WHERE c.relkind = 'S' AND n.nspname = 'public' LOOP
        EXECUTE format('ALTER SEQUENCE IF EXISTS %I OWNER TO coffeecontrol_owner', r.seqname);
    END LOOP;
END;
$$;

ALTER SCHEMA public OWNER TO coffeecontrol_owner;

-- ── 2. Aplicación (sujeto a RLS) ──────────────────────────────
CREATE ROLE coffeecontrol_app WITH LOGIN PASSWORD 'cambiar_password_app';

GRANT USAGE ON SCHEMA public TO coffeecontrol_app;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO coffeecontrol_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO coffeecontrol_app;

-- Default privileges para tablas/secuencias que cree el owner en el futuro
ALTER DEFAULT PRIVILEGES FOR ROLE coffeecontrol_owner IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO coffeecontrol_app;
ALTER DEFAULT PRIVILEGES FOR ROLE coffeecontrol_owner IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO coffeecontrol_app;

-- ── 3. Bootstrap (BYPASSRLS para queries de arranque) ─────────
CREATE ROLE coffeecontrol_bootstrap WITH LOGIN PASSWORD 'cambiar_password_bootstrap' BYPASSRLS;

GRANT USAGE ON SCHEMA public TO coffeecontrol_bootstrap;

-- Grants a nivel de columna para minimizar blast radius.
-- Solo las columnas que cada query bootstrap necesita leer.
-- IMPORTANTE: en PostgreSQL, las columnas referenciadas en el WHERE
-- también necesitan permiso explícito, no solo las del SELECT list.

-- tenants: resolución de tenant por subdominio (resolveTenantFromHost)
GRANT SELECT (id, slug, active) ON tenants TO coffeecontrol_bootstrap;

-- admin_users: login panel + mobile
-- WHERE usa: username, tenant_id, active
GRANT SELECT (
    id,
    username,
    password_hash,
    role,
    department,
    is_protected,
    active,
    tenant_id
) ON admin_users TO coffeecontrol_bootstrap;

-- machines: lookup por MAC en machineAuth + register
-- WHERE usa: mac, active
GRANT SELECT (
    id,
    name,
    tenant_id,
    blocked,
    blocked_reason,
    mac,
    active
) ON machines TO coffeecontrol_bootstrap;

-- registerHandler necesita estas columnas adicionales vía bootstrapPool
-- (lookup técnico completo + UPDATE de estado de conexión + bump de config version)
GRANT SELECT (
    location, last_seen,
    price_cents, pricing_profile, mdb_feature_level, mdb_country_code,
    mdb_scale_factor, mdb_decimal_places, mdb_max_response_time, mdb_misc_options,
    technical_config_version, technical_config_source, technical_config_updated_at,
    last_reported_technical_config, last_reported_technical_config_at,
    current_firmware_version, desired_firmware_release_id, desired_firmware_version,
    firmware_update_status, firmware_update_message, firmware_update_started_at,
    firmware_update_completed_at,
    wifi_ssid, wifi_rssi, wifi_ip, backend_url, backend_ok, backend_error
) ON machines TO coffeecontrol_bootstrap;

GRANT UPDATE (
    last_seen, wifi_ssid, backend_url, current_firmware_version,
    wifi_rssi, wifi_ip, backend_ok, backend_error,
    last_reported_technical_config, last_reported_technical_config_at,
    technical_config_version, technical_config_source, technical_config_updated_at,
    firmware_update_status, firmware_update_message, firmware_update_completed_at,
    firmware_update_started_at, desired_firmware_release_id, desired_firmware_version
) ON machines TO coffeecontrol_bootstrap;

-- firmware_releases: register → maybeQueuePendingFirmwareUpdate → getFirmwareReleaseById
-- WHERE usa: id, tenant_id
GRANT SELECT (
    id,
    version,
    filename,
    size_bytes,
    md5,
    notes,
    created_at,
    created_by_username,
    tenant_id
) ON firmware_releases TO coffeecontrol_bootstrap;

-- machine_commands: registerHandler → maybeQueuePendingFirmwareUpdate → queueFirmwareUpdateForMachine
-- INSERT para encolar OTA, SELECT para getQueuedMachineCommand, UPDATE para completar
GRANT SELECT (id, machine_id, command_type, status, queued_at, delivered_at, tenant_id, completed_at, result, payload)
    ON machine_commands TO coffeecontrol_bootstrap;
GRANT INSERT (machine_id, command_type, payload, tenant_id)
    ON machine_commands TO coffeecontrol_bootstrap;
GRANT UPDATE (status, completed_at, result)
    ON machine_commands TO coffeecontrol_bootstrap;

-- pending_machines: register INSERT + SELECT
GRANT SELECT, INSERT, UPDATE ON pending_machines TO coffeecontrol_bootstrap;

-- Secuencias para INSERTs en pending_machines
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO coffeecontrol_bootstrap;
ALTER DEFAULT PRIVILEGES FOR ROLE coffeecontrol_owner IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO coffeecontrol_bootstrap;
