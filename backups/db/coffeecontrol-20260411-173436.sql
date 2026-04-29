--
-- PostgreSQL database dump
--

\restrict t0w2XKzZmnQutpqiFnJC3h0zNssBCMUcudtRTdcQT9AGAmte8Zxavom1AjPK1q4

-- Dumped from database version 15.15
-- Dumped by pg_dump version 15.15

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

ALTER TABLE IF EXISTS ONLY public.taps DROP CONSTRAINT IF EXISTS taps_machine_id_fkey;
ALTER TABLE IF EXISTS ONLY public.taps DROP CONSTRAINT IF EXISTS taps_employee_id_fkey;
ALTER TABLE IF EXISTS ONLY public.stock_movements DROP CONSTRAINT IF EXISTS stock_movements_tap_id_fkey;
ALTER TABLE IF EXISTS ONLY public.stock_movements DROP CONSTRAINT IF EXISTS stock_movements_stock_item_id_fkey;
ALTER TABLE IF EXISTS ONLY public.stock_movements DROP CONSTRAINT IF EXISTS stock_movements_machine_id_fkey;
ALTER TABLE IF EXISTS ONLY public.stock_movements DROP CONSTRAINT IF EXISTS stock_movements_actor_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.nfc_cards DROP CONSTRAINT IF EXISTS nfc_cards_employee_id_fkey;
ALTER TABLE IF EXISTS ONLY public.mobile_sessions DROP CONSTRAINT IF EXISTS mobile_sessions_admin_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.machines DROP CONSTRAINT IF EXISTS machines_desired_firmware_release_id_fkey;
ALTER TABLE IF EXISTS ONLY public.machine_stock_items DROP CONSTRAINT IF EXISTS machine_stock_items_machine_id_fkey;
ALTER TABLE IF EXISTS ONLY public.machine_commands DROP CONSTRAINT IF EXISTS machine_commands_machine_id_fkey;
ALTER TABLE IF EXISTS ONLY public.firmware_releases DROP CONSTRAINT IF EXISTS firmware_releases_created_by_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.employees DROP CONSTRAINT IF EXISTS employees_access_level_id_fkey;
ALTER TABLE IF EXISTS ONLY public.audit_logs DROP CONSTRAINT IF EXISTS audit_logs_actor_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.alert_events DROP CONSTRAINT IF EXISTS alert_events_machine_id_fkey;
ALTER TABLE IF EXISTS ONLY public.alert_events DROP CONSTRAINT IF EXISTS alert_events_employee_id_fkey;
ALTER TABLE IF EXISTS ONLY public.admin_user_departments DROP CONSTRAINT IF EXISTS admin_user_departments_admin_user_id_fkey;
CREATE OR REPLACE VIEW public.monthly_summary AS
SELECT
    NULL::integer AS employee_id,
    NULL::character varying(100) AS employee_name,
    NULL::character varying(60) AS department,
    NULL::integer AS access_level_id,
    NULL::character varying(80) AS access_level_name,
    NULL::timestamp without time zone AS month,
    NULL::bigint AS taps_total,
    NULL::bigint AS spent_cents;
CREATE OR REPLACE VIEW public.daily_consumption AS
SELECT
    NULL::integer AS employee_id,
    NULL::character varying(100) AS employee_name,
    NULL::character varying(60) AS department,
    NULL::integer AS access_level_id,
    NULL::character varying(80) AS access_level_name,
    NULL::integer AS daily_limit,
    NULL::character varying(16) AS daily_limit_mode,
    NULL::boolean AS warning_enabled,
    NULL::bigint AS taps_today,
    NULL::bigint AS taps_over_limit,
    NULL::bigint AS spent_today_cents;
DROP INDEX IF EXISTS public.idx_taps_over_limit;
DROP INDEX IF EXISTS public.idx_taps_machine;
DROP INDEX IF EXISTS public.idx_taps_employee_date;
DROP INDEX IF EXISTS public.idx_stock_movements_stock_item_created;
DROP INDEX IF EXISTS public.idx_stock_movements_machine_created;
DROP INDEX IF EXISTS public.idx_nfc_uid;
DROP INDEX IF EXISTS public.idx_mobile_sessions_user;
DROP INDEX IF EXISTS public.idx_machines_mac;
DROP INDEX IF EXISTS public.idx_machine_stock_items_machine_item;
DROP INDEX IF EXISTS public.idx_machine_stock_items_machine_active;
DROP INDEX IF EXISTS public.idx_machine_commands_queued;
DROP INDEX IF EXISTS public.idx_machine_commands_machine_status;
DROP INDEX IF EXISTS public.idx_employees_access_level_id;
DROP INDEX IF EXISTS public.idx_audit_logs_entity;
DROP INDEX IF EXISTS public.idx_audit_logs_created_at;
DROP INDEX IF EXISTS public.idx_audit_logs_actor;
DROP INDEX IF EXISTS public.idx_alert_events_status_type;
DROP INDEX IF EXISTS public.idx_alert_events_machine;
DROP INDEX IF EXISTS public.idx_alert_events_employee;
DROP INDEX IF EXISTS public.idx_admin_user_departments_department;
ALTER TABLE IF EXISTS ONLY public.taps DROP CONSTRAINT IF EXISTS taps_pkey;
ALTER TABLE IF EXISTS ONLY public.system_settings DROP CONSTRAINT IF EXISTS system_settings_pkey;
ALTER TABLE IF EXISTS ONLY public.stock_movements DROP CONSTRAINT IF EXISTS stock_movements_pkey;
ALTER TABLE IF EXISTS ONLY public.schema_migrations DROP CONSTRAINT IF EXISTS schema_migrations_pkey;
ALTER TABLE IF EXISTS ONLY public.pending_machines DROP CONSTRAINT IF EXISTS pending_machines_pkey;
ALTER TABLE IF EXISTS ONLY public.pending_machines DROP CONSTRAINT IF EXISTS pending_machines_mac_key;
ALTER TABLE IF EXISTS ONLY public.notification_settings DROP CONSTRAINT IF EXISTS notification_settings_pkey;
ALTER TABLE IF EXISTS ONLY public.nfc_cards DROP CONSTRAINT IF EXISTS nfc_cards_uid_key;
ALTER TABLE IF EXISTS ONLY public.nfc_cards DROP CONSTRAINT IF EXISTS nfc_cards_pkey;
ALTER TABLE IF EXISTS ONLY public.mobile_sessions DROP CONSTRAINT IF EXISTS mobile_sessions_refresh_token_hash_key;
ALTER TABLE IF EXISTS ONLY public.mobile_sessions DROP CONSTRAINT IF EXISTS mobile_sessions_pkey;
ALTER TABLE IF EXISTS ONLY public.machines DROP CONSTRAINT IF EXISTS machines_pkey;
ALTER TABLE IF EXISTS ONLY public.machines DROP CONSTRAINT IF EXISTS machines_mac_key;
ALTER TABLE IF EXISTS ONLY public.machine_stock_items DROP CONSTRAINT IF EXISTS machine_stock_items_pkey;
ALTER TABLE IF EXISTS ONLY public.machine_commands DROP CONSTRAINT IF EXISTS machine_commands_pkey;
ALTER TABLE IF EXISTS ONLY public.firmware_releases DROP CONSTRAINT IF EXISTS firmware_releases_version_key;
ALTER TABLE IF EXISTS ONLY public.firmware_releases DROP CONSTRAINT IF EXISTS firmware_releases_storage_path_key;
ALTER TABLE IF EXISTS ONLY public.firmware_releases DROP CONSTRAINT IF EXISTS firmware_releases_pkey;
ALTER TABLE IF EXISTS ONLY public.employees DROP CONSTRAINT IF EXISTS employees_pkey;
ALTER TABLE IF EXISTS ONLY public.employees DROP CONSTRAINT IF EXISTS employees_email_key;
ALTER TABLE IF EXISTS ONLY public.audit_logs DROP CONSTRAINT IF EXISTS audit_logs_pkey;
ALTER TABLE IF EXISTS ONLY public.alert_events DROP CONSTRAINT IF EXISTS alert_events_pkey;
ALTER TABLE IF EXISTS ONLY public.admin_users DROP CONSTRAINT IF EXISTS admin_users_username_key;
ALTER TABLE IF EXISTS ONLY public.admin_users DROP CONSTRAINT IF EXISTS admin_users_pkey;
ALTER TABLE IF EXISTS ONLY public.admin_user_departments DROP CONSTRAINT IF EXISTS admin_user_departments_pkey;
ALTER TABLE IF EXISTS ONLY public.access_levels DROP CONSTRAINT IF EXISTS access_levels_pkey;
ALTER TABLE IF EXISTS ONLY public.access_levels DROP CONSTRAINT IF EXISTS access_levels_name_key;
ALTER TABLE IF EXISTS ONLY public.access_levels DROP CONSTRAINT IF EXISTS access_levels_code_key;
ALTER TABLE IF EXISTS public.taps ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.stock_movements ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.pending_machines ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.nfc_cards ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.mobile_sessions ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.machines ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.machine_stock_items ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.machine_commands ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.firmware_releases ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.employees ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.audit_logs ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.admin_users ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.access_levels ALTER COLUMN id DROP DEFAULT;
DROP SEQUENCE IF EXISTS public.taps_id_seq;
DROP SEQUENCE IF EXISTS public.stock_movements_id_seq;
DROP TABLE IF EXISTS public.stock_movements;
DROP TABLE IF EXISTS public.schema_migrations;
DROP SEQUENCE IF EXISTS public.pending_machines_id_seq;
DROP TABLE IF EXISTS public.pending_machines;
DROP TABLE IF EXISTS public.notification_settings;
DROP SEQUENCE IF EXISTS public.nfc_cards_id_seq;
DROP TABLE IF EXISTS public.nfc_cards;
DROP VIEW IF EXISTS public.monthly_summary;
DROP SEQUENCE IF EXISTS public.mobile_sessions_id_seq;
DROP TABLE IF EXISTS public.mobile_sessions;
DROP SEQUENCE IF EXISTS public.machines_id_seq;
DROP SEQUENCE IF EXISTS public.machine_stock_items_id_seq;
DROP TABLE IF EXISTS public.machine_stock_items;
DROP VIEW IF EXISTS public.machine_status;
DROP SEQUENCE IF EXISTS public.machine_commands_id_seq;
DROP TABLE IF EXISTS public.machine_commands;
DROP SEQUENCE IF EXISTS public.firmware_releases_id_seq;
DROP TABLE IF EXISTS public.firmware_releases;
DROP SEQUENCE IF EXISTS public.employees_id_seq;
DROP VIEW IF EXISTS public.employee_machine_consumption;
DROP TABLE IF EXISTS public.taps;
DROP TABLE IF EXISTS public.system_settings;
DROP TABLE IF EXISTS public.machines;
DROP TABLE IF EXISTS public.employees;
DROP VIEW IF EXISTS public.daily_consumption;
DROP SEQUENCE IF EXISTS public.audit_logs_id_seq;
DROP TABLE IF EXISTS public.audit_logs;
DROP TABLE IF EXISTS public.alert_events;
DROP SEQUENCE IF EXISTS public.admin_users_id_seq;
DROP TABLE IF EXISTS public.admin_users;
DROP TABLE IF EXISTS public.admin_user_departments;
DROP SEQUENCE IF EXISTS public.access_levels_id_seq;
DROP TABLE IF EXISTS public.access_levels;
SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: access_levels; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.access_levels (
    id integer NOT NULL,
    code character varying(40) NOT NULL,
    name character varying(80) NOT NULL,
    description character varying(255),
    daily_limit integer NOT NULL,
    daily_limit_mode character varying(16) DEFAULT 'enforce'::character varying NOT NULL,
    warning_enabled boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 100 NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT access_levels_daily_limit_check CHECK (((daily_limit >= 1) AND (daily_limit <= 50))),
    CONSTRAINT access_levels_daily_limit_mode_check CHECK (((daily_limit_mode)::text = ANY ((ARRAY['enforce'::character varying, 'warn_only'::character varying, 'off'::character varying])::text[]))),
    CONSTRAINT access_levels_sort_order_check CHECK (((sort_order >= 0) AND (sort_order <= 9999)))
);


--
-- Name: access_levels_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.access_levels_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: access_levels_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.access_levels_id_seq OWNED BY public.access_levels.id;


--
-- Name: admin_user_departments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_user_departments (
    admin_user_id integer NOT NULL,
    department character varying(60) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: admin_users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_users (
    id integer NOT NULL,
    username character varying(60) NOT NULL,
    password_hash character varying(128) NOT NULL,
    role character varying(20) DEFAULT 'admin'::character varying NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    department character varying(60),
    full_name character varying(100),
    email character varying(120),
    is_protected boolean DEFAULT false NOT NULL,
    CONSTRAINT admin_users_role_check CHECK (((role)::text = ANY ((ARRAY['admin'::character varying, 'gerente'::character varying, 'supervisor'::character varying, 'tecnico'::character varying, 'distribuidor'::character varying])::text[])))
);


--
-- Name: admin_users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.admin_users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: admin_users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.admin_users_id_seq OWNED BY public.admin_users.id;


--
-- Name: alert_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.alert_events (
    alert_key character varying(160) NOT NULL,
    alert_type character varying(40) NOT NULL,
    status character varying(16) DEFAULT 'open'::character varying NOT NULL,
    machine_id integer,
    employee_id integer,
    first_seen_at timestamp with time zone DEFAULT now() NOT NULL,
    last_seen_at timestamp with time zone DEFAULT now() NOT NULL,
    last_notified_at timestamp with time zone,
    resolved_at timestamp with time zone,
    payload jsonb,
    CONSTRAINT alert_events_status_check CHECK (((status)::text = ANY ((ARRAY['open'::character varying, 'resolved'::character varying])::text[])))
);


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_logs (
    id bigint NOT NULL,
    actor_user_id integer,
    actor_username character varying(60),
    actor_role character varying(20),
    actor_ip character varying(80),
    actor_user_agent character varying(255),
    action character varying(80) NOT NULL,
    entity_type character varying(40) NOT NULL,
    entity_id character varying(80),
    entity_label character varying(160),
    summary character varying(255) NOT NULL,
    details jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: audit_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.audit_logs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: audit_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.audit_logs_id_seq OWNED BY public.audit_logs.id;


--
-- Name: daily_consumption; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.daily_consumption AS
SELECT
    NULL::integer AS employee_id,
    NULL::character varying(100) AS employee_name,
    NULL::character varying(60) AS department,
    NULL::integer AS access_level_id,
    NULL::character varying(80) AS access_level_name,
    NULL::integer AS daily_limit,
    NULL::character varying(16) AS daily_limit_mode,
    NULL::boolean AS warning_enabled,
    NULL::bigint AS taps_today,
    NULL::bigint AS taps_over_limit,
    NULL::bigint AS spent_today_cents;


--
-- Name: employees; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employees (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    department character varying(60),
    email character varying(120),
    daily_limit integer DEFAULT 4 NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    dni character varying(20),
    legajo character varying(20),
    phone character varying(20),
    photo_url character varying(200),
    daily_limit_mode character varying(16) DEFAULT 'enforce'::character varying NOT NULL,
    warning_enabled boolean DEFAULT true NOT NULL,
    access_level_id integer
);


--
-- Name: machines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.machines (
    id integer NOT NULL,
    name character varying(60) NOT NULL,
    location character varying(100),
    secret character varying(64) NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    blocked boolean DEFAULT false NOT NULL,
    blocked_reason character varying(120),
    last_seen timestamp with time zone,
    mac character varying(20),
    wifi_ssid character varying(64),
    backend_url character varying(255),
    wifi_rssi integer,
    wifi_ip character varying(45),
    backend_ok boolean,
    backend_error character varying(255),
    price_cents integer DEFAULT 1200 NOT NULL,
    pricing_profile character varying(40) DEFAULT 'rubino_half_credit'::character varying NOT NULL,
    mdb_feature_level smallint DEFAULT 1 NOT NULL,
    mdb_country_code integer DEFAULT 50 NOT NULL,
    mdb_scale_factor smallint DEFAULT 100 NOT NULL,
    mdb_decimal_places smallint DEFAULT 2 NOT NULL,
    mdb_max_response_time smallint DEFAULT 5 NOT NULL,
    mdb_misc_options smallint DEFAULT 0 NOT NULL,
    technical_config_version integer DEFAULT 1 NOT NULL,
    technical_config_source character varying(20) DEFAULT 'backend'::character varying NOT NULL,
    technical_config_updated_at timestamp with time zone DEFAULT now() NOT NULL,
    last_reported_technical_config jsonb,
    last_reported_technical_config_at timestamp with time zone,
    current_firmware_version character varying(80),
    desired_firmware_release_id integer,
    desired_firmware_version character varying(80),
    firmware_update_status character varying(24) DEFAULT 'idle'::character varying NOT NULL,
    firmware_update_message character varying(255),
    firmware_update_started_at timestamp with time zone,
    firmware_update_completed_at timestamp with time zone,
    CONSTRAINT machines_firmware_update_status_check CHECK (((firmware_update_status)::text = ANY ((ARRAY['idle'::character varying, 'queued'::character varying, 'in_progress'::character varying, 'pending_reconnect'::character varying, 'failed'::character varying, 'success'::character varying])::text[]))),
    CONSTRAINT machines_mdb_country_code_check CHECK (((mdb_country_code >= 0) AND (mdb_country_code <= 65535))),
    CONSTRAINT machines_mdb_decimal_places_check CHECK (((mdb_decimal_places >= 0) AND (mdb_decimal_places <= 255))),
    CONSTRAINT machines_mdb_feature_level_check CHECK (((mdb_feature_level >= 0) AND (mdb_feature_level <= 255))),
    CONSTRAINT machines_mdb_max_response_time_check CHECK (((mdb_max_response_time >= 0) AND (mdb_max_response_time <= 255))),
    CONSTRAINT machines_mdb_misc_options_check CHECK (((mdb_misc_options >= 0) AND (mdb_misc_options <= 255))),
    CONSTRAINT machines_mdb_scale_factor_check CHECK (((mdb_scale_factor >= 0) AND (mdb_scale_factor <= 255))),
    CONSTRAINT machines_price_cents_check CHECK ((price_cents > 0)),
    CONSTRAINT machines_pricing_profile_check CHECK (((pricing_profile)::text = ANY ((ARRAY['rubino_half_credit'::character varying, 'identity'::character varying])::text[]))),
    CONSTRAINT machines_technical_config_source_check CHECK (((technical_config_source)::text = ANY ((ARRAY['backend'::character varying, 'portal'::character varying, 'factory'::character varying, 'unknown'::character varying])::text[]))),
    CONSTRAINT machines_technical_config_version_check CHECK ((technical_config_version >= 1))
);


--
-- Name: system_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.system_settings (
    id smallint DEFAULT 1 NOT NULL,
    business_timezone character varying(80) DEFAULT 'America/Argentina/Buenos_Aires'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT system_settings_id_check CHECK ((id = 1))
);


--
-- Name: taps; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.taps (
    id bigint NOT NULL,
    employee_id integer,
    machine_id integer NOT NULL,
    nfc_uid character varying(20) NOT NULL,
    approved boolean NOT NULL,
    deny_reason character varying(40),
    item_id integer,
    amount_cents integer,
    confirmed boolean,
    tapped_at timestamp with time zone DEFAULT now(),
    over_limit boolean DEFAULT false NOT NULL
);


--
-- Name: employee_machine_consumption; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.employee_machine_consumption AS
 WITH cfg AS (
         SELECT COALESCE(( SELECT system_settings.business_timezone
                   FROM public.system_settings
                  WHERE (system_settings.id = 1)), 'America/Argentina/Buenos_Aires'::character varying) AS business_timezone
        ), bounds AS (
         SELECT cfg.business_timezone,
            (date_trunc('month'::text, (CURRENT_TIMESTAMP AT TIME ZONE cfg.business_timezone)) AT TIME ZONE cfg.business_timezone) AS month_start,
            ((date_trunc('month'::text, (CURRENT_TIMESTAMP AT TIME ZONE cfg.business_timezone)) + '1 mon'::interval) AT TIME ZONE cfg.business_timezone) AS month_end
           FROM cfg
        )
 SELECT e.id AS employee_id,
    e.name AS employee_name,
    e.department,
    e.legajo,
    m.id AS machine_id,
    m.name AS machine_name,
    m.location,
    count(t.id) AS taps_count,
    COALESCE(sum(t.amount_cents), (0)::bigint) AS spent_cents
   FROM (((public.employees e
     CROSS JOIN bounds b)
     JOIN public.taps t ON (((t.employee_id = e.id) AND (t.approved = true) AND (t.tapped_at >= b.month_start) AND (t.tapped_at < b.month_end))))
     JOIN public.machines m ON ((m.id = t.machine_id)))
  GROUP BY e.id, e.name, e.department, e.legajo, m.id, m.name, m.location;


--
-- Name: employees_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.employees_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: employees_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.employees_id_seq OWNED BY public.employees.id;


--
-- Name: firmware_releases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.firmware_releases (
    id integer NOT NULL,
    version character varying(80) NOT NULL,
    filename character varying(180) NOT NULL,
    storage_path character varying(255) NOT NULL,
    content_type character varying(80) DEFAULT 'application/octet-stream'::character varying NOT NULL,
    size_bytes integer NOT NULL,
    md5 character(32) NOT NULL,
    notes text,
    created_by_user_id integer,
    created_by_username character varying(60),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT firmware_releases_md5_check CHECK ((md5 ~ '^[0-9a-f]{32}$'::text)),
    CONSTRAINT firmware_releases_size_bytes_check CHECK ((size_bytes > 0))
);


--
-- Name: firmware_releases_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.firmware_releases_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: firmware_releases_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.firmware_releases_id_seq OWNED BY public.firmware_releases.id;


--
-- Name: machine_commands; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.machine_commands (
    id bigint NOT NULL,
    machine_id integer NOT NULL,
    command_type character varying(40) NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    status character varying(20) DEFAULT 'queued'::character varying NOT NULL,
    queued_at timestamp with time zone DEFAULT now() NOT NULL,
    delivered_at timestamp with time zone,
    completed_at timestamp with time zone,
    result jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT machine_commands_status_check CHECK (((status)::text = ANY ((ARRAY['queued'::character varying, 'completed'::character varying, 'failed'::character varying])::text[])))
);


--
-- Name: machine_commands_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.machine_commands_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: machine_commands_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.machine_commands_id_seq OWNED BY public.machine_commands.id;


--
-- Name: machine_status; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.machine_status AS
 WITH cfg AS (
         SELECT COALESCE(( SELECT system_settings.business_timezone
                   FROM public.system_settings
                  WHERE (system_settings.id = 1)), 'America/Argentina/Buenos_Aires'::character varying) AS business_timezone
        ), bounds AS (
         SELECT cfg.business_timezone,
            ((((CURRENT_TIMESTAMP AT TIME ZONE cfg.business_timezone))::date)::timestamp without time zone AT TIME ZONE cfg.business_timezone) AS day_start,
            ((((CURRENT_TIMESTAMP AT TIME ZONE cfg.business_timezone))::date + '1 day'::interval) AT TIME ZONE cfg.business_timezone) AS day_end,
            (date_trunc('month'::text, (CURRENT_TIMESTAMP AT TIME ZONE cfg.business_timezone)) AT TIME ZONE cfg.business_timezone) AS month_start,
            ((date_trunc('month'::text, (CURRENT_TIMESTAMP AT TIME ZONE cfg.business_timezone)) + '1 mon'::interval) AT TIME ZONE cfg.business_timezone) AS month_end
           FROM cfg
        )
 SELECT m.id,
    m.name,
    m.location,
    m.active,
    m.blocked,
    m.blocked_reason,
    m.last_seen,
    count(t.id) FILTER (WHERE ((t.approved = true) AND (t.tapped_at >= b.day_start) AND (t.tapped_at < b.day_end))) AS taps_today,
    count(t.id) FILTER (WHERE ((t.approved = true) AND (t.tapped_at >= b.month_start) AND (t.tapped_at < b.month_end))) AS taps_month,
    COALESCE(sum(t.amount_cents) FILTER (WHERE ((t.approved = true) AND (t.tapped_at >= b.month_start) AND (t.tapped_at < b.month_end))), (0)::bigint) AS cost_month_cents,
    max(t.tapped_at) AS last_tap_at,
    m.wifi_ssid,
    m.backend_url,
    m.wifi_rssi,
    m.wifi_ip,
    m.backend_ok,
    m.backend_error,
    m.current_firmware_version,
    m.desired_firmware_version,
    m.firmware_update_status,
    m.firmware_update_message,
    m.firmware_update_started_at,
    m.firmware_update_completed_at
   FROM ((public.machines m
     CROSS JOIN bounds b)
     LEFT JOIN public.taps t ON ((t.machine_id = m.id)))
  GROUP BY m.id, m.name, m.location, m.active, m.blocked, m.blocked_reason, m.last_seen, m.wifi_ssid, m.backend_url, m.wifi_rssi, m.wifi_ip, m.backend_ok, m.backend_error, m.current_firmware_version, m.desired_firmware_version, m.firmware_update_status, m.firmware_update_message, m.firmware_update_started_at, m.firmware_update_completed_at;


--
-- Name: machine_stock_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.machine_stock_items (
    id integer NOT NULL,
    machine_id integer NOT NULL,
    item_id integer NOT NULL,
    product_name character varying(120) NOT NULL,
    slot_label character varying(40),
    capacity_units integer DEFAULT 0 NOT NULL,
    current_units integer DEFAULT 0 NOT NULL,
    min_units integer DEFAULT 0 NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT machine_stock_items_capacity_units_check CHECK ((capacity_units >= 0)),
    CONSTRAINT machine_stock_items_item_id_check CHECK ((item_id >= 0)),
    CONSTRAINT machine_stock_items_min_units_check CHECK ((min_units >= 0))
);


--
-- Name: machine_stock_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.machine_stock_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: machine_stock_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.machine_stock_items_id_seq OWNED BY public.machine_stock_items.id;


--
-- Name: machines_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.machines_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: machines_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.machines_id_seq OWNED BY public.machines.id;


--
-- Name: mobile_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mobile_sessions (
    id bigint NOT NULL,
    admin_user_id integer NOT NULL,
    device_name character varying(120),
    platform character varying(30) DEFAULT 'android'::character varying NOT NULL,
    user_agent character varying(255),
    refresh_token_hash character varying(64) NOT NULL,
    last_used_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    revoked_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: mobile_sessions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.mobile_sessions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: mobile_sessions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.mobile_sessions_id_seq OWNED BY public.mobile_sessions.id;


--
-- Name: monthly_summary; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.monthly_summary AS
SELECT
    NULL::integer AS employee_id,
    NULL::character varying(100) AS employee_name,
    NULL::character varying(60) AS department,
    NULL::integer AS access_level_id,
    NULL::character varying(80) AS access_level_name,
    NULL::timestamp without time zone AS month,
    NULL::bigint AS taps_total,
    NULL::bigint AS spent_cents;


--
-- Name: nfc_cards; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.nfc_cards (
    id integer NOT NULL,
    uid character varying(20) NOT NULL,
    employee_id integer NOT NULL,
    label character varying(60),
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    status character varying(16) DEFAULT 'active'::character varying NOT NULL,
    CONSTRAINT nfc_cards_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'inactive'::character varying, 'lost'::character varying])::text[])))
);


--
-- Name: nfc_cards_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.nfc_cards_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: nfc_cards_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.nfc_cards_id_seq OWNED BY public.nfc_cards.id;


--
-- Name: notification_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notification_settings (
    id smallint DEFAULT 1 NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    recipient_emails text DEFAULT ''::text NOT NULL,
    notify_employee_daily_blocked boolean DEFAULT true NOT NULL,
    notify_machine_offline boolean DEFAULT true NOT NULL,
    notify_machine_backend_down boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    notify_employee_limit_warning boolean DEFAULT false NOT NULL,
    employee_limit_warning_lead smallint DEFAULT 1 NOT NULL,
    notify_stock_low boolean DEFAULT false NOT NULL,
    CONSTRAINT notification_settings_employee_limit_warning_lead_check CHECK (((employee_limit_warning_lead >= 1) AND (employee_limit_warning_lead <= 10))),
    CONSTRAINT notification_settings_singleton_check CHECK ((id = 1))
);


--
-- Name: pending_machines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pending_machines (
    id integer NOT NULL,
    mac character varying(20) NOT NULL,
    first_seen timestamp with time zone DEFAULT now(),
    last_ping timestamp with time zone DEFAULT now(),
    approved boolean DEFAULT false NOT NULL
);


--
-- Name: pending_machines_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.pending_machines_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: pending_machines_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.pending_machines_id_seq OWNED BY public.pending_machines.id;


--
-- Name: schema_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schema_migrations (
    version integer NOT NULL,
    filename character varying(120) NOT NULL,
    applied_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: stock_movements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stock_movements (
    id bigint NOT NULL,
    machine_id integer NOT NULL,
    stock_item_id integer,
    item_id integer NOT NULL,
    movement_type character varying(24) NOT NULL,
    quantity_delta integer NOT NULL,
    previous_units integer,
    current_units integer,
    tap_id bigint,
    actor_user_id integer,
    note character varying(255),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT stock_movements_movement_type_check CHECK (((movement_type)::text = ANY ((ARRAY['sale'::character varying, 'restock'::character varying, 'adjustment'::character varying, 'unconfigured_sale'::character varying])::text[])))
);


--
-- Name: stock_movements_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.stock_movements_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: stock_movements_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.stock_movements_id_seq OWNED BY public.stock_movements.id;


--
-- Name: taps_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.taps_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: taps_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.taps_id_seq OWNED BY public.taps.id;


--
-- Name: access_levels id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.access_levels ALTER COLUMN id SET DEFAULT nextval('public.access_levels_id_seq'::regclass);


--
-- Name: admin_users id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_users ALTER COLUMN id SET DEFAULT nextval('public.admin_users_id_seq'::regclass);


--
-- Name: audit_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs ALTER COLUMN id SET DEFAULT nextval('public.audit_logs_id_seq'::regclass);


--
-- Name: employees id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees ALTER COLUMN id SET DEFAULT nextval('public.employees_id_seq'::regclass);


--
-- Name: firmware_releases id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.firmware_releases ALTER COLUMN id SET DEFAULT nextval('public.firmware_releases_id_seq'::regclass);


--
-- Name: machine_commands id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.machine_commands ALTER COLUMN id SET DEFAULT nextval('public.machine_commands_id_seq'::regclass);


--
-- Name: machine_stock_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.machine_stock_items ALTER COLUMN id SET DEFAULT nextval('public.machine_stock_items_id_seq'::regclass);


--
-- Name: machines id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.machines ALTER COLUMN id SET DEFAULT nextval('public.machines_id_seq'::regclass);


--
-- Name: mobile_sessions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mobile_sessions ALTER COLUMN id SET DEFAULT nextval('public.mobile_sessions_id_seq'::regclass);


--
-- Name: nfc_cards id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nfc_cards ALTER COLUMN id SET DEFAULT nextval('public.nfc_cards_id_seq'::regclass);


--
-- Name: pending_machines id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pending_machines ALTER COLUMN id SET DEFAULT nextval('public.pending_machines_id_seq'::regclass);


--
-- Name: stock_movements id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_movements ALTER COLUMN id SET DEFAULT nextval('public.stock_movements_id_seq'::regclass);


--
-- Name: taps id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.taps ALTER COLUMN id SET DEFAULT nextval('public.taps_id_seq'::regclass);


--
-- Data for Name: access_levels; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.access_levels (id, code, name, description, daily_limit, daily_limit_mode, warning_enabled, sort_order, active, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: admin_user_departments; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.admin_user_departments (admin_user_id, department, created_at) FROM stdin;
2	IT	2026-03-25 14:01:27.247824-03
7	QA	2026-03-25 14:01:27.247824-03
8	QA	2026-03-25 14:01:27.247824-03
\.


--
-- Data for Name: admin_users; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.admin_users (id, username, password_hash, role, active, created_at, department, full_name, email, is_protected) FROM stdin;
54	dist.smoke	$2a$10$jXDgJe5ttDGi0HGvB5SKN.FcnAQcvkKswDsHVJpI4TY6qvg79g2ju	distribuidor	f	2026-03-26 18:25:24.895911-03	\N	Distribuidor Smoke	\N	f
32	tmp.tecnico.verificacion	$2a$10$gw60frO49rzRH9L0f2mp1uhvfZ5NnXZ71H/4N8W6BrrCmi51mFlge	tecnico	f	2026-03-25 16:49:19.133388-03	\N	Tecnico Temporal	tmp.tecnico.verificacion@example.com	f
39	tmp.tecnico.smoke	$2a$10$k9nUhKFsP2aAgz28P2iPx.3HKpCxfxxJwoApNbNlowl61Y6ki.LVm	tecnico	f	2026-03-26 11:53:36.681096-03	\N	Tecnico Smoke	tmp.tecnico.smoke@example.com	f
8	audit_sup_232227	$2a$10$AFm1Uwr8G1PGWY.0yr7sh.oGHhQ9MRSBQI26s1rOT/bmC9Umweu2C	supervisor	f	2026-03-24 20:22:27.38721-03	QA	Supervisor Auditoria	\N	f
2	supervisor1	$2a$10$meCz6uJjpI8rS/7fR/KaFeYsf21.ZIRpIme80r7z300bk10X/T6Am	supervisor	f	2026-03-22 20:24:34.834147-03	IT	Supervisor IT	\N	f
44	tecnico.prueba.login	$2a$10$/uzCY8ulSHRqkQ.hKRJWM.n460azFjmWlThocT5wGEx1JAMI.LVpi	tecnico	f	2026-03-26 16:41:21.339378-03	\N	Tecnico Prueba	tecnico.prueba.login@example.com	f
43	tecnico	$2a$10$7/ow2IMtkOdiqQ/J5PPN7.LDY3gL4mXNu7xKgetQnUvzgXcygOPTS	tecnico	t	2026-03-26 15:21:39.971376-03	\N	Percam	\N	f
7	audit_sup_232201	$2a$10$rOCFyXHTpKDoTl0Cvhng8.rEV//bTpJS5MoEztLQtK3oVNZwqi3sC	supervisor	f	2026-03-24 20:22:01.649494-03	QA	Supervisor Auditoria	\N	f
1	admin	$2a$10$V.a1qNi2zNRRT2pIKSqkMe5ao6C9C4gK7JZzHP14NP8WKaCyNjtay	admin	t	2026-03-22 20:24:34.815203-03	\N	\N	\N	t
\.


--
-- Data for Name: alert_events; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.alert_events (alert_key, alert_type, status, machine_id, employee_id, first_seen_at, last_seen_at, last_notified_at, resolved_at, payload) FROM stdin;
employee-limit-warning-13-2026-03-24	employee_limit_warning	open	\N	\N	2026-03-24 17:19:43.28029-03	2026-03-24 17:19:43.28029-03	2026-03-24 17:19:46.502441-03	\N	{"uid": "TEST1234", "department": "IT", "taps_today": 4, "daily_limit": 5, "machine_name": "Prueba Codex", "business_date": "2026-03-24", "employee_name": "Codex Warning 1774383583151"}
stock-low-20-7	stock_low	resolved	\N	\N	2026-03-25 16:03:57.484618-03	2026-03-25 16:03:57.56034-03	\N	2026-03-25 16:03:57.56034-03	{"status": "low", "item_id": 35341, "location": "QA lab", "min_units": 3, "slot_label": "C3", "machine_name": "itest_1774465435803_machine", "product_name": "itest_1774465435803_low_stock", "status_label": "Bajo", "current_units": 2, "stock_item_id": 7, "capacity_units": 8}
employee-limit-warning-12-2026-04-02	employee_limit_warning	open	\N	12	2026-04-02 15:29:41.594869-03	2026-04-02 15:29:49.458766-03	\N	\N	{"uid": "6AEBB01A", "department": "Socia Gerente", "taps_today": 9, "daily_limit": 8, "machine_name": "ESP32C3", "warning_lead": 1, "business_date": "2026-04-02", "employee_name": "Lorena Villalobos", "remaining_cups": 0, "warning_trigger": "7/8"}
stock-low-22-14	stock_low	resolved	\N	\N	2026-03-25 16:45:04.340294-03	2026-03-25 16:45:04.397772-03	\N	2026-03-25 16:45:04.397772-03	{"status": "low", "item_id": 33630, "location": "QA lab", "min_units": 3, "slot_label": "C3", "machine_name": "itest_1774467902622_machine", "product_name": "itest_1774467902622_low_stock", "status_label": "Bajo", "current_units": 2, "stock_item_id": 14, "capacity_units": 8}
machine-offline-14	machine_offline	open	14	\N	2026-03-24 15:43:35.709542-03	2026-04-07 22:20:33.334932-03	2026-03-24 17:44:16.644157-03	\N	{"wifi_ip": "192.168.1.93", "location": "Piso 1", "last_seen": "2026-04-08T01:17:09.159Z", "wifi_ssid": "Tiziana", "backend_url": "http://192.168.1.76:3000", "machine_name": "ESP32C3"}
stock-low-19-4	stock_low	resolved	\N	\N	2026-03-25 16:00:39.372551-03	2026-03-25 16:00:42.866462-03	2026-03-25 16:00:42.781109-03	2026-03-25 16:00:42.866462-03	{"status": "low", "item_id": 33788, "location": "QA lab", "min_units": 3, "slot_label": "C3", "machine_name": "itest_1774465237710_machine", "product_name": "itest_1774465237710_low_stock", "status_label": "Bajo", "current_units": 2, "stock_item_id": 4, "capacity_units": 8}
stock-low-21-10	stock_low	resolved	\N	\N	2026-03-25 16:25:14.569494-03	2026-03-25 16:25:14.631311-03	\N	2026-03-25 16:25:14.631311-03	{"status": "low", "item_id": 31346, "location": "QA lab", "min_units": 3, "slot_label": "C3", "machine_name": "itest_1774466712864_machine", "product_name": "itest_1774466712864_low_stock", "status_label": "Bajo", "current_units": 2, "stock_item_id": 10, "capacity_units": 8}
stock-low-21-13	stock_low	resolved	\N	\N	2026-03-25 16:25:14.850133-03	2026-03-25 16:25:14.857719-03	\N	2026-03-25 16:25:14.857719-03	{"status": "low", "item_id": 45908, "location": "QA lab", "min_units": 3, "slot_label": "D4", "machine_name": "itest_1774466712864_machine", "product_name": "itest_1774466712864_stock_report", "status_label": "Bajo", "current_units": 2, "stock_item_id": 13, "capacity_units": 10}
stock-low-22-17	stock_low	resolved	\N	\N	2026-03-25 16:45:04.611103-03	2026-03-25 16:45:04.621247-03	\N	2026-03-25 16:45:04.621247-03	{"status": "low", "item_id": 43599, "location": "QA lab", "min_units": 3, "slot_label": "D4", "machine_name": "itest_1774467902622_machine", "product_name": "itest_1774467902622_stock_report", "status_label": "Bajo", "current_units": 2, "stock_item_id": 17, "capacity_units": 10}
stock-low-23-19	stock_low	resolved	\N	\N	2026-03-25 16:54:00.875343-03	2026-03-25 16:54:00.947128-03	\N	2026-03-25 16:54:00.947128-03	{"status": "low", "item_id": 34812, "location": "QA lab", "min_units": 3, "slot_label": "C3", "machine_name": "itest_1774468438794_machine", "product_name": "itest_1774468438794_low_stock", "status_label": "Bajo", "current_units": 2, "stock_item_id": 19, "capacity_units": 8}
stock-low-23-22	stock_low	resolved	\N	\N	2026-03-25 16:54:01.21016-03	2026-03-25 16:54:01.220225-03	\N	2026-03-25 16:54:01.220225-03	{"status": "low", "item_id": 43654, "location": "QA lab", "min_units": 3, "slot_label": "D4", "machine_name": "itest_1774468438794_machine", "product_name": "itest_1774468438794_stock_report", "status_label": "Bajo", "current_units": 2, "stock_item_id": 22, "capacity_units": 10}
stock-low-24-24	stock_low	resolved	\N	\N	2026-03-26 11:53:06.484888-03	2026-03-26 11:53:06.545493-03	\N	2026-03-26 11:53:06.545493-03	{"status": "low", "item_id": 33860, "location": "QA lab", "min_units": 3, "slot_label": "C3", "machine_name": "itest_1774536784659_machine", "product_name": "itest_1774536784659_low_stock", "status_label": "Bajo", "current_units": 2, "stock_item_id": 24, "capacity_units": 8}
stock-low-24-27	stock_low	resolved	\N	\N	2026-03-26 11:53:06.76222-03	2026-03-26 11:53:06.769779-03	\N	2026-03-26 11:53:06.769779-03	{"status": "low", "item_id": 44852, "location": "QA lab", "min_units": 3, "slot_label": "D4", "machine_name": "itest_1774536784659_machine", "product_name": "itest_1774536784659_stock_report", "status_label": "Bajo", "current_units": 2, "stock_item_id": 27, "capacity_units": 10}
stock-low-25-29	stock_low	resolved	\N	\N	2026-03-26 12:33:23.988227-03	2026-03-26 12:33:24.04737-03	\N	2026-03-26 12:33:24.04737-03	{"status": "low", "item_id": 33305, "location": "QA lab", "min_units": 3, "slot_label": "C3", "machine_name": "itest_1774539202223_machine", "product_name": "itest_1774539202223_low_stock", "status_label": "Bajo", "current_units": 2, "stock_item_id": 29, "capacity_units": 8}
stock-low-25-32	stock_low	resolved	\N	\N	2026-03-26 12:33:24.410742-03	2026-03-26 12:33:24.420072-03	\N	2026-03-26 12:33:24.420072-03	{"status": "low", "item_id": 46596, "location": "QA lab", "min_units": 3, "slot_label": "D4", "machine_name": "itest_1774539202223_machine", "product_name": "itest_1774539202223_stock_report", "status_label": "Bajo", "current_units": 2, "stock_item_id": 32, "capacity_units": 10}
stock-low-26-34	stock_low	resolved	\N	\N	2026-03-26 18:03:52.26397-03	2026-03-26 18:03:52.433931-03	\N	2026-03-26 18:03:52.433931-03	{"status": "low", "item_id": 37302, "location": "QA lab", "min_units": 3, "slot_label": "C3", "machine_name": "itest_1774559025804_machine", "product_name": "itest_1774559025804_low_stock", "status_label": "Bajo", "current_units": 2, "stock_item_id": 34, "capacity_units": 8}
stock-low-26-37	stock_low	resolved	\N	\N	2026-03-26 18:03:54.150882-03	2026-03-26 18:03:54.1773-03	\N	2026-03-26 18:03:54.1773-03	{"status": "low", "item_id": 41133, "location": "QA lab", "min_units": 3, "slot_label": "D4", "machine_name": "itest_1774559025804_machine", "product_name": "itest_1774559025804_stock_report", "status_label": "Bajo", "current_units": 2, "stock_item_id": 37, "capacity_units": 10}
stock-low-27-39	stock_low	resolved	\N	\N	2026-03-26 18:22:53.964125-03	2026-03-26 18:22:54.053654-03	\N	2026-03-26 18:22:54.053654-03	{"status": "low", "item_id": 32728, "location": "QA lab", "min_units": 3, "slot_label": "C3", "machine_name": "itest_1774560171829_machine", "product_name": "itest_1774560171829_low_stock", "status_label": "Bajo", "current_units": 2, "stock_item_id": 39, "capacity_units": 8}
stock-low-27-42	stock_low	resolved	\N	\N	2026-03-26 18:22:54.528029-03	2026-03-26 18:22:54.538514-03	\N	2026-03-26 18:22:54.538514-03	{"status": "low", "item_id": 46338, "location": "QA lab", "min_units": 3, "slot_label": "D4", "machine_name": "itest_1774560171829_machine", "product_name": "itest_1774560171829_stock_report", "status_label": "Bajo", "current_units": 2, "stock_item_id": 42, "capacity_units": 10}
machine-offline-13	machine_offline	open	13	\N	2026-03-24 15:43:35.703119-03	2026-04-07 22:20:33.341254-03	2026-03-24 16:15:12.880649-03	\N	{"wifi_ip": null, "location": "Casa", "last_seen": "2026-03-23T16:09:43.534Z", "wifi_ssid": null, "backend_url": null, "machine_name": "TEST"}
stock-low-29-44	stock_low	resolved	\N	\N	2026-03-26 19:04:04.616074-03	2026-03-26 19:04:04.711893-03	\N	2026-03-26 19:04:04.711893-03	{"status": "low", "item_id": 33836, "location": "QA lab", "min_units": 3, "slot_label": "C3", "machine_name": "itest_1774562642494_machine", "product_name": "itest_1774562642494_low_stock", "status_label": "Bajo", "current_units": 2, "stock_item_id": 44, "capacity_units": 8}
stock-low-29-47	stock_low	resolved	\N	\N	2026-03-26 19:04:05.165695-03	2026-03-26 19:04:05.175576-03	\N	2026-03-26 19:04:05.175576-03	{"status": "low", "item_id": 49580, "location": "QA lab", "min_units": 3, "slot_label": "D4", "machine_name": "itest_1774562642494_machine", "product_name": "itest_1774562642494_stock_report", "status_label": "Bajo", "current_units": 2, "stock_item_id": 47, "capacity_units": 10}
stock-low-31-49	stock_low	resolved	\N	\N	2026-03-27 13:16:41.613258-03	2026-03-27 13:16:41.68174-03	\N	2026-03-27 13:16:41.68174-03	{"status": "low", "item_id": 30857, "location": "QA lab", "min_units": 3, "slot_label": "C3", "machine_name": "itest_1774628199617_machine", "product_name": "itest_1774628199617_low_stock", "status_label": "Bajo", "current_units": 2, "stock_item_id": 49, "capacity_units": 8}
stock-low-31-52	stock_low	resolved	\N	\N	2026-03-27 13:16:42.052807-03	2026-03-27 13:16:42.061893-03	\N	2026-03-27 13:16:42.061893-03	{"status": "low", "item_id": 43267, "location": "QA lab", "min_units": 3, "slot_label": "D4", "machine_name": "itest_1774628199617_machine", "product_name": "itest_1774628199617_stock_report", "status_label": "Bajo", "current_units": 2, "stock_item_id": 52, "capacity_units": 10}
stock-low-33-54	stock_low	resolved	\N	\N	2026-03-27 13:17:18.216804-03	2026-03-27 13:17:18.276911-03	\N	2026-03-27 13:17:18.276911-03	{"status": "low", "item_id": 36818, "location": "QA lab", "min_units": 3, "slot_label": "C3", "machine_name": "itest_1774628236372_machine", "product_name": "itest_1774628236372_low_stock", "status_label": "Bajo", "current_units": 2, "stock_item_id": 54, "capacity_units": 8}
stock-low-33-57	stock_low	resolved	\N	\N	2026-03-27 13:17:18.631484-03	2026-03-27 13:17:18.640861-03	\N	2026-03-27 13:17:18.640861-03	{"status": "low", "item_id": 47621, "location": "QA lab", "min_units": 3, "slot_label": "D4", "machine_name": "itest_1774628236372_machine", "product_name": "itest_1774628236372_stock_report", "status_label": "Bajo", "current_units": 2, "stock_item_id": 57, "capacity_units": 10}
stock-low-35-59	stock_low	resolved	\N	\N	2026-03-27 17:02:41.765528-03	2026-03-27 17:02:41.889744-03	\N	2026-03-27 17:02:41.889744-03	{"status": "low", "item_id": 34363, "location": "QA lab", "min_units": 3, "slot_label": "C3", "machine_name": "itest_1774641757751_machine", "product_name": "itest_1774641757751_low_stock", "status_label": "Bajo", "current_units": 2, "stock_item_id": 59, "capacity_units": 8}
stock-low-35-62	stock_low	resolved	\N	\N	2026-03-27 17:02:42.748352-03	2026-03-27 17:02:42.766986-03	\N	2026-03-27 17:02:42.766986-03	{"status": "low", "item_id": 46756, "location": "QA lab", "min_units": 3, "slot_label": "D4", "machine_name": "itest_1774641757751_machine", "product_name": "itest_1774641757751_stock_report", "status_label": "Bajo", "current_units": 2, "stock_item_id": 62, "capacity_units": 10}
\.


--
-- Data for Name: audit_logs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.audit_logs (id, actor_user_id, actor_username, actor_role, actor_ip, actor_user_agent, action, entity_type, entity_id, entity_label, summary, details, created_at) FROM stdin;
1	1	admin	admin	127.0.0.1	Mozilla/5.0 (Windows NT; Windows NT 10.0; es-AR) WindowsPowerShell/5.1.26100.7920	notification_settings.update	notification_settings	1	general	Actualizó la configuración de notificaciones	{"after": {"enabled": true, "recipient_emails": "mscaramuzzino@ieasrl.com.ar", "notify_machine_offline": false, "employee_limit_warning_lead": 1, "notify_employee_daily_blocked": false, "notify_employee_limit_warning": false}, "before": {"enabled": true, "recipient_emails": "mscaramuzzino@ieasrl.com.ar", "notify_machine_offline": false, "employee_limit_warning_lead": 1, "notify_employee_daily_blocked": false, "notify_employee_limit_warning": false}}	2026-03-24 20:21:31.54862-03
2	1	admin	admin	127.0.0.1	Mozilla/5.0 (Windows NT; Windows NT 10.0; es-AR) WindowsPowerShell/5.1.26100.7920	system_settings.update	system_settings	1	general	Actualizó la zona horaria operativa	{"after": {"business_timezone": "America/Argentina/Buenos_Aires"}, "before": {"business_timezone": "America/Argentina/Buenos_Aires"}}	2026-03-24 20:21:31.600314-03
3	1	admin	admin	127.0.0.1	Mozilla/5.0 (Windows NT; Windows NT 10.0; es-AR) WindowsPowerShell/5.1.26100.7920	employee.create	employee	18	AUDIT TEMP 20260324232131	Creó el empleado AUDIT TEMP 20260324232131	{"email": null, "department": "QA", "daily_limit": 4, "warning_enabled": true, "daily_limit_mode": "warn_only"}	2026-03-24 20:21:31.674364-03
4	1	admin	admin	127.0.0.1	Mozilla/5.0 (Windows NT; Windows NT 10.0; es-AR) WindowsPowerShell/5.1.26100.7920	employee.update	employee	18	AUDIT TEMP 20260324232131	Actualizó el empleado AUDIT TEMP 20260324232131	{"after": {"id": 18, "dni": null, "name": "AUDIT TEMP 20260324232131", "email": null, "phone": "123456", "active": true, "legajo": null, "department": "QA", "daily_limit": 5, "warning_enabled": false, "daily_limit_mode": "warn_only"}, "before": {"id": 18, "dni": null, "name": "AUDIT TEMP 20260324232131", "email": null, "phone": null, "active": true, "legajo": null, "department": "QA", "daily_limit": 4, "warning_enabled": true, "daily_limit_mode": "warn_only"}}	2026-03-24 20:21:31.708891-03
5	1	admin	admin	127.0.0.1	Mozilla/5.0 (Windows NT; Windows NT 10.0; es-AR) WindowsPowerShell/5.1.26100.7920	nfc_card.create	nfc_card	17	AUD24232131	Asoció el TAG AUD24232131 a AUDIT TEMP 20260324232131	{"label": "Tarjeta auditoria", "status": "active", "employee_id": 18, "employee_name": "AUDIT TEMP 20260324232131"}	2026-03-24 20:21:31.757015-03
6	1	admin	admin	127.0.0.1	Mozilla/5.0 (Windows NT; Windows NT 10.0; es-AR) WindowsPowerShell/5.1.26100.7920	nfc_card.update	nfc_card	17	AUD24232131	Marcó el TAG AUD24232131 como perdido	{"after": {"id": 17, "uid": "AUD24232131", "label": "Tarjeta auditoria", "active": false, "status": "lost", "employee_id": 18, "employee_name": "AUDIT TEMP 20260324232131"}, "before": {"id": 17, "uid": "AUD24232131", "label": "Tarjeta auditoria", "active": true, "status": "active", "employee_id": 18, "employee_name": "AUDIT TEMP 20260324232131"}}	2026-03-24 20:21:31.804479-03
7	1	admin	admin	127.0.0.1	Mozilla/5.0 (Windows NT; Windows NT 10.0; es-AR) WindowsPowerShell/5.1.26100.7920	employee.deactivate	employee	18	AUDIT TEMP 20260324232131	Dio de baja el empleado AUDIT TEMP 20260324232131	\N	2026-03-24 20:21:31.874616-03
8	1	admin	admin	127.0.0.1	Mozilla/5.0 (Windows NT; Windows NT 10.0; es-AR) WindowsPowerShell/5.1.26100.7920	notification_settings.update	notification_settings	1	general	Actualizó la configuración de notificaciones	{"after": {"enabled": true, "recipient_emails": "mscaramuzzino@ieasrl.com.ar", "notify_machine_offline": false, "employee_limit_warning_lead": 1, "notify_employee_daily_blocked": false, "notify_employee_limit_warning": false}, "before": {"enabled": true, "recipient_emails": "mscaramuzzino@ieasrl.com.ar", "notify_machine_offline": false, "employee_limit_warning_lead": 1, "notify_employee_daily_blocked": false, "notify_employee_limit_warning": false}}	2026-03-24 20:22:01.388875-03
9	1	admin	admin	127.0.0.1	Mozilla/5.0 (Windows NT; Windows NT 10.0; es-AR) WindowsPowerShell/5.1.26100.7920	system_settings.update	system_settings	1	general	Actualizó la zona horaria operativa	{"after": {"business_timezone": "America/Argentina/Buenos_Aires"}, "before": {"business_timezone": "America/Argentina/Buenos_Aires"}}	2026-03-24 20:22:01.406474-03
10	1	admin	admin	127.0.0.1	Mozilla/5.0 (Windows NT; Windows NT 10.0; es-AR) WindowsPowerShell/5.1.26100.7920	employee.create	employee	19	AUDIT TEMP 20260324232201	Creó el empleado AUDIT TEMP 20260324232201	{"email": null, "department": "QA", "daily_limit": 4, "warning_enabled": true, "daily_limit_mode": "warn_only"}	2026-03-24 20:22:01.446155-03
11	1	admin	admin	127.0.0.1	Mozilla/5.0 (Windows NT; Windows NT 10.0; es-AR) WindowsPowerShell/5.1.26100.7920	employee.update	employee	19	AUDIT TEMP 20260324232201	Actualizó el empleado AUDIT TEMP 20260324232201	{"after": {"id": 19, "dni": null, "name": "AUDIT TEMP 20260324232201", "email": null, "phone": "123456", "active": true, "legajo": null, "department": "QA", "daily_limit": 5, "warning_enabled": false, "daily_limit_mode": "warn_only"}, "before": {"id": 19, "dni": null, "name": "AUDIT TEMP 20260324232201", "email": null, "phone": null, "active": true, "legajo": null, "department": "QA", "daily_limit": 4, "warning_enabled": true, "daily_limit_mode": "warn_only"}}	2026-03-24 20:22:01.45697-03
12	1	admin	admin	127.0.0.1	Mozilla/5.0 (Windows NT; Windows NT 10.0; es-AR) WindowsPowerShell/5.1.26100.7920	nfc_card.create	nfc_card	18	AUD24232201	Asoció el TAG AUD24232201 a AUDIT TEMP 20260324232201	{"label": "Tarjeta auditoria", "status": "active", "employee_id": 19, "employee_name": "AUDIT TEMP 20260324232201"}	2026-03-24 20:22:01.477244-03
13	1	admin	admin	127.0.0.1	Mozilla/5.0 (Windows NT; Windows NT 10.0; es-AR) WindowsPowerShell/5.1.26100.7920	nfc_card.update	nfc_card	18	AUD24232201	Marcó el TAG AUD24232201 como perdido	{"after": {"id": 18, "uid": "AUD24232201", "label": "Tarjeta auditoria", "active": false, "status": "lost", "employee_id": 19, "employee_name": "AUDIT TEMP 20260324232201"}, "before": {"id": 18, "uid": "AUD24232201", "label": "Tarjeta auditoria", "active": true, "status": "active", "employee_id": 19, "employee_name": "AUDIT TEMP 20260324232201"}}	2026-03-24 20:22:01.490169-03
14	1	admin	admin	127.0.0.1	Mozilla/5.0 (Windows NT; Windows NT 10.0; es-AR) WindowsPowerShell/5.1.26100.7920	employee.deactivate	employee	19	AUDIT TEMP 20260324232201	Dio de baja el empleado AUDIT TEMP 20260324232201	\N	2026-03-24 20:22:01.500383-03
15	1	admin	admin	127.0.0.1	Mozilla/5.0 (Windows NT; Windows NT 10.0; es-AR) WindowsPowerShell/5.1.26100.7920	admin_user.create	admin_user	7	audit_sup_232201	Creó el usuario audit_sup_232201	{"role": "supervisor", "email": null, "active": true, "department": "QA"}	2026-03-24 20:22:01.65138-03
16	1	admin	admin	127.0.0.1	Mozilla/5.0 (Windows NT; Windows NT 10.0; es-AR) WindowsPowerShell/5.1.26100.7920	admin_user.deactivate	admin_user	7	audit_sup_232201	Desactivó el usuario audit_sup_232201	{"id": 7, "role": "supervisor", "email": null, "username": "audit_sup_232201", "department": "QA"}	2026-03-24 20:22:01.765641-03
17	1	admin	admin	127.0.0.1	Mozilla/5.0 (Windows NT; Windows NT 10.0; es-AR) WindowsPowerShell/5.1.26100.7920	admin_user.create	admin_user	8	audit_sup_232227	Creó el usuario audit_sup_232227	{"role": "supervisor", "email": null, "active": true, "department": "QA"}	2026-03-24 20:22:27.3903-03
18	1	admin	admin	127.0.0.1	Mozilla/5.0 (Windows NT; Windows NT 10.0; es-AR) WindowsPowerShell/5.1.26100.7920	admin_user.deactivate	admin_user	8	audit_sup_232227	Desactivó el usuario audit_sup_232227	{"id": 8, "role": "supervisor", "email": null, "username": "audit_sup_232227", "department": "QA"}	2026-03-24 20:22:27.556404-03
19	1	admin	admin	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Microsoft Windows 10.0.26200; es-AR) PowerShell/7.5.5	admin_user.create	admin_user	9	scope_multi_test	Creó el usuario scope_multi_test	{"role": "supervisor", "email": null, "active": true, "department": null}	2026-03-25 14:02:26.594434-03
20	1	admin	admin	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Microsoft Windows 10.0.26200; es-AR) PowerShell/7.5.5	admin_user.create	admin_user	10	scope_multi_test	Creó el usuario scope_multi_test	{"role": "supervisor", "email": null, "active": true, "department": "IT", "department_scopes": ["IT", "Ventas"]}	2026-03-25 14:03:39.646741-03
21	1	admin	admin	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Microsoft Windows 10.0.26200; es-AR) PowerShell/7.5.5	admin_user.create	admin_user	11	scope_multi_real	Creó el usuario scope_multi_real	{"role": "supervisor", "email": null, "active": true, "department": "Gerencia", "department_scopes": ["Gerencia", "Socia Gerente"]}	2026-03-25 14:04:11.209349-03
167	1	admin	admin	127.0.0.1	node	admin_user.create	admin_user	54	dist.smoke	Creó el usuario dist.smoke	{"role": "distribuidor", "email": null, "active": true, "department": null, "department_scopes": []}	2026-03-26 18:25:25.03273-03
776	1	admin	admin	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	machine.command_queue	machine	14	ESP32C3	Encoló el comando diagnostics_snapshot para ESP32C3	{"payload": {"limit": 20}, "command_id": 111, "command_type": "diagnostics_snapshot"}	2026-04-04 16:19:32.709365-03
777	1	admin	admin	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	machine.command_queue	machine	14	ESP32C3	Encoló el comando diagnostics_snapshot para ESP32C3	{"payload": {"limit": 20}, "command_id": 112, "command_type": "diagnostics_snapshot"}	2026-04-04 16:22:45.370562-03
914	1	admin	admin	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Microsoft Windows 10.0.26200; es-AR) PowerShell/7.5.5	firmware_release.create	firmware_release	4	3.1.1	Subió el firmware 3.1.1	{"md5": "b0d78da7d3231b82ce57d4ba94c745d7", "notes": "OTA validation release 3.1.1", "version": "3.1.1", "filename": "coffeecontrol-esp32c3-3.1.1.bin", "size_bytes": 1007200}	2026-04-07 19:37:23.964388-03
915	1	admin	admin	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Microsoft Windows 10.0.26200; es-AR) PowerShell/7.5.5	machine.command_queue	machine	14	ESP32C3	Encoló el comando firmware_update para ESP32C3	{"payload": {"md5": "b0d78da7d3231b82ce57d4ba94c745d7", "version": "3.1.1", "release_id": 4, "size_bytes": 1007200, "download_path": "/api/machine-firmware/releases/4/download"}, "command_id": 139, "command_type": "firmware_update"}	2026-04-07 19:37:24.032863-03
916	1	admin	admin	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Microsoft Windows 10.0.26200; es-AR) PowerShell/7.5.5	machine.deploy_firmware	machine	14	ESP32C3	Programó OTA 3.1.1 para ESP32C3	{"status": "queued", "release": {"id": 4, "md5": "b0d78da7d3231b82ce57d4ba94c745d7", "notes": "OTA validation release 3.1.1", "version": "3.1.1", "filename": "coffeecontrol-esp32c3-3.1.1.bin", "created_at": "2026-04-07T22:37:23.956Z", "size_bytes": 1007200, "created_by_username": "admin"}, "queued_command_id": 139}	2026-04-07 19:37:24.036069-03
31	1	admin	admin	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	stock_item.create	stock_item	3	TEST · selección 0	Configuró stock para TEST · selección 0	{"after": {"id": 3, "active": true, "status": "ok", "item_id": 0, "fill_pct": 100, "min_units": 40, "created_at": "2026-03-25T18:52:46.599Z", "machine_id": 13, "slot_label": null, "updated_at": "2026-03-25T18:52:46.599Z", "product_name": "Cafe", "status_badge": "bs", "status_label": "OK", "current_units": 400, "capacity_units": 400}, "machine_id": 13, "machine_name": "TEST"}	2026-03-25 15:52:46.610767-03
271	43	tecnico	tecnico	192.168.1.70	okhttp/5.3.0	machine.command_queue	machine	14	ESP32C3	Encoló el comando wifi_scan para ESP32C3	{"payload": {}, "command_id": 34, "command_type": "wifi_scan"}	2026-03-27 18:53:13.872987-03
274	1	admin	admin	192.168.1.76	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	machine.command_queue	machine	14	ESP32C3	Encoló el comando wifi_scan para ESP32C3	{"payload": {}, "command_id": 36, "command_type": "wifi_scan"}	2026-03-27 21:44:48.904676-03
168	1	admin	admin	127.0.0.1	node	admin_user.deactivate	admin_user	54	dist.smoke	Desactivó el usuario dist.smoke	{"id": 54, "role": "distribuidor", "email": null, "username": "dist.smoke", "department": null, "is_protected": false}	2026-03-26 18:25:25.198616-03
778	1	admin	admin	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	machine.command_queue	machine	14	ESP32C3	Encoló el comando diagnostics_snapshot para ESP32C3	{"payload": {"limit": 20}, "command_id": 113, "command_type": "diagnostics_snapshot"}	2026-04-04 17:12:36.702854-03
917	1	admin	admin	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Microsoft Windows 10.0.26200; es-AR) PowerShell/7.5.5	machine.command_queue	machine	14	ESP32C3	Encoló el comando diagnostics_snapshot para ESP32C3	{"payload": {"limit": 20}, "command_id": 140, "command_type": "diagnostics_snapshot"}	2026-04-07 21:50:29.193745-03
39	1	admin	admin	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Microsoft Windows 10.0.26200; es-AR) PowerShell/7.5.5	notification_settings.update	notification_settings	1	general	Actualizó la configuración de notificaciones	{"after": {"enabled": true, "notify_stock_low": true, "recipient_emails": "mscaramuzzino@ieasrl.com.ar", "notify_machine_offline": false, "employee_limit_warning_lead": 1, "notify_employee_daily_blocked": false, "notify_employee_limit_warning": false}, "before": {"enabled": true, "notify_stock_low": false, "recipient_emails": "mscaramuzzino@ieasrl.com.ar", "notify_machine_offline": false, "employee_limit_warning_lead": 1, "notify_employee_daily_blocked": false, "notify_employee_limit_warning": false}}	2026-03-25 16:03:26.298942-03
40	1	admin	admin	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Microsoft Windows 10.0.26200; es-AR) PowerShell/7.5.5	notification_settings.update	notification_settings	1	general	Actualizó la configuración de notificaciones	{"after": {"enabled": true, "notify_stock_low": false, "recipient_emails": "mscaramuzzino@ieasrl.com.ar", "notify_machine_offline": false, "employee_limit_warning_lead": 1, "notify_employee_daily_blocked": false, "notify_employee_limit_warning": false}, "before": {"enabled": true, "notify_stock_low": true, "recipient_emails": "mscaramuzzino@ieasrl.com.ar", "notify_machine_offline": false, "employee_limit_warning_lead": 1, "notify_employee_daily_blocked": false, "notify_employee_limit_warning": false}}	2026-03-25 16:03:26.314038-03
109	1	admin	admin	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	admin_user.deactivate	admin_user	7	audit_sup_232201	Desactivó el usuario audit_sup_232201	{"id": 7, "role": "supervisor", "email": null, "username": "audit_sup_232201", "department": "QA"}	2026-03-26 15:03:53.172031-03
110	1	admin	admin	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	admin_user.deactivate	admin_user	7	audit_sup_232201	Desactivó el usuario audit_sup_232201	{"id": 7, "role": "supervisor", "email": null, "username": "audit_sup_232201", "department": "QA"}	2026-03-26 15:03:57.378345-03
111	1	admin	admin	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	admin_user.deactivate	admin_user	7	audit_sup_232201	Desactivó el usuario audit_sup_232201	{"id": 7, "role": "supervisor", "email": null, "username": "audit_sup_232201", "department": "QA"}	2026-03-26 15:04:00.864943-03
112	1	admin	admin	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	admin_user.deactivate	admin_user	7	audit_sup_232201	Desactivó el usuario audit_sup_232201	{"id": 7, "role": "supervisor", "email": null, "username": "audit_sup_232201", "department": "QA"}	2026-03-26 15:04:04.453035-03
113	1	admin	admin	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	admin_user.deactivate	admin_user	8	audit_sup_232227	Desactivó el usuario audit_sup_232227	{"id": 8, "role": "supervisor", "email": null, "username": "audit_sup_232227", "department": "QA"}	2026-03-26 15:04:06.982474-03
114	1	admin	admin	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	admin_user.deactivate	admin_user	7	audit_sup_232201	Desactivó el usuario audit_sup_232201	{"id": 7, "role": "supervisor", "email": null, "username": "audit_sup_232201", "department": "QA"}	2026-03-26 15:04:24.474321-03
115	1	admin	admin	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	admin_user.deactivate	admin_user	8	audit_sup_232227	Desactivó el usuario audit_sup_232227	{"id": 8, "role": "supervisor", "email": null, "username": "audit_sup_232227", "department": "QA"}	2026-03-26 15:04:31.310714-03
116	1	admin	admin	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	admin_user.deactivate	admin_user	2	supervisor1	Desactivó el usuario supervisor1	{"id": 2, "role": "supervisor", "email": null, "username": "supervisor1", "department": "IT"}	2026-03-26 15:04:35.515782-03
117	1	admin	admin	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	admin_user.create	admin_user	43	tecnico	Creó el usuario tecnico	{"role": "tecnico", "email": null, "active": true, "department": null, "department_scopes": []}	2026-03-26 15:21:40.313027-03
118	1	admin	admin	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	admin_user.update	admin_user	43	tecnico	Actualizó el usuario tecnico	{"after": {"id": 43, "role": "tecnico", "email": null, "active": true, "username": "tecnico", "full_name": "Percam", "department": null, "department_scopes": []}, "before": {"id": 43, "role": "tecnico", "email": null, "active": true, "username": "tecnico", "full_name": "Percam", "department": null, "department_scopes": []}, "password_changed": true}	2026-03-26 15:22:59.340999-03
119	1	admin	admin	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	admin_user.deactivate	admin_user	7	audit_sup_232201	Desactivó el usuario audit_sup_232201	{"id": 7, "role": "supervisor", "email": null, "username": "audit_sup_232201", "department": "QA"}	2026-03-26 16:54:07.259784-03
142	1	admin	admin	127.0.0.1	node	auth.change_password_denied	admin_user	1	admin	Intentó cambiar la contraseña de la cuenta protegida admin	\N	2026-03-26 18:08:44.218833-03
779	1	admin	admin	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	machine.command_queue	machine	14	ESP32C3	Encoló el comando diagnostics_snapshot para ESP32C3	{"payload": {"limit": 20}, "command_id": 114, "command_type": "diagnostics_snapshot"}	2026-04-04 17:19:26.184596-03
353	1	admin	admin	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	machine.command_queue	machine	14	ESP32C3	Encoló el comando wifi_scan para ESP32C3	{"payload": {}, "command_id": 43, "command_type": "wifi_scan"}	2026-03-28 08:33:35.919552-03
356	1	admin	admin	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	employee.update	employee	12	Lorena Villalobos	Actualizó el empleado Lorena Villalobos	{"after": {"id": 12, "dni": "30867888", "name": "Lorena Villalobos", "email": "lorena@smartq.io", "phone": "2235854433", "active": true, "legajo": "GER001", "department": "Socia Gerente", "daily_limit": 8, "access_level_id": null, "warning_enabled": true, "daily_limit_mode": "warn_only", "access_level_name": null}, "before": {"id": 12, "dni": "30867888", "name": "Lorena Villalobos", "email": "lorena@smartq.io", "phone": "2235854433", "active": true, "legajo": "GER001", "department": "Socia Gerente", "daily_limit": 8, "access_level_id": null, "warning_enabled": true, "daily_limit_mode": "enforce"}}	2026-03-28 11:33:41.528511-03
358	1	admin	admin	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	machine.command_queue	machine	14	ESP32C3	Encoló el comando wifi_scan para ESP32C3	{"payload": {}, "command_id": 45, "command_type": "wifi_scan"}	2026-04-02 12:02:25.709459-03
742	1	admin	admin	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	machine.command_queue	machine	14	ESP32C3	Encoló el comando diagnostics_snapshot para ESP32C3	{"payload": {"limit": 20}, "command_id": 103, "command_type": "diagnostics_snapshot"}	2026-04-04 14:51:30.57453-03
743	1	admin	admin	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	machine.command_queue	machine	14	ESP32C3	Encoló el comando diagnostics_snapshot para ESP32C3	{"payload": {"limit": 20}, "command_id": 104, "command_type": "diagnostics_snapshot"}	2026-04-04 14:53:41.514085-03
744	1	admin	admin	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	machine.command_queue	machine	14	ESP32C3	Encoló el comando diagnostics_snapshot para ESP32C3	{"payload": {"limit": 20}, "command_id": 105, "command_type": "diagnostics_snapshot"}	2026-04-04 15:08:40.017766-03
354	1	admin	admin	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	nfc_card.update	nfc_card	12	0A30FC80	Actualizó el TAG 0A30FC80	{"after": {"id": 12, "uid": "0A30FC80", "label": "Llavero", "active": true, "status": "active", "employee_id": 11, "employee_name": "Mateo Scaramuzzino"}, "before": {"id": 12, "uid": "0A30FC80", "label": "Llavero", "active": false, "status": "inactive", "employee_id": 11, "employee_name": "Mateo Scaramuzzino"}, "source": "panel"}	2026-03-28 11:09:17.711506-03
357	1	admin	admin	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	machine.command_queue	machine	14	ESP32C3	Encoló el comando reboot para ESP32C3	{"payload": {}, "command_id": 44, "command_type": "reboot"}	2026-03-31 18:48:58.610257-03
609	43	tecnico	tecnico	127.0.0.1	node	machine.command_queue	machine	14	ESP32C3	Encoló el comando diagnostics_snapshot para ESP32C3	{"payload": {"limit": 20}, "command_id": 74, "command_type": "diagnostics_snapshot"}	2026-04-04 11:14:43.785296-03
611	43	tecnico	tecnico	127.0.0.1	node	machine.command_queue	machine	14	ESP32C3	Encoló el comando diagnostics_snapshot para ESP32C3	{"payload": {"limit": 24}, "command_id": 76, "command_type": "diagnostics_snapshot"}	2026-04-04 11:24:26.120621-03
811	1	admin	admin	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	machine.command_queue	machine	14	ESP32C3	Encoló el comando diagnostics_snapshot para ESP32C3	{"payload": {"limit": 20}, "command_id": 120, "command_type": "diagnostics_snapshot"}	2026-04-04 17:33:25.773201-03
269	43	tecnico	tecnico	192.168.123.133	okhttp/5.3.0	stock_item.adjust	stock_item	3	TEST · selección 0	Ajustó stock en TEST · selección 0	{"after": {"id": 3, "active": true, "status": "ok", "item_id": 0, "fill_pct": 100, "min_units": 40, "created_at": "2026-03-25T18:52:46.599Z", "machine_id": 13, "slot_label": null, "updated_at": "2026-03-27T20:15:50.888Z", "product_name": "Cafe", "status_badge": "bs", "status_label": "OK", "current_units": 400, "capacity_units": 400}, "before": {"id": 3, "active": true, "status": "ok", "item_id": 0, "fill_pct": 100, "min_units": 40, "created_at": "2026-03-25T18:52:46.599Z", "machine_id": 13, "slot_label": null, "updated_at": "2026-03-25T18:52:46.599Z", "product_name": "Cafe", "status_badge": "bs", "status_label": "OK", "current_units": 400, "capacity_units": 400}, "machine_id": 13, "machine_name": "TEST"}	2026-03-27 17:15:50.892501-03
270	43	tecnico	tecnico	192.168.123.133	okhttp/5.3.0	stock_item.restock	stock_item	3	TEST · selección 0	Repuso stock en TEST · selección 0	{"after": {"id": 3, "active": true, "status": "ok", "item_id": 0, "fill_pct": 125, "min_units": 40, "created_at": "2026-03-25T18:52:46.599Z", "machine_id": 13, "slot_label": null, "updated_at": "2026-03-27T20:15:58.910Z", "product_name": "Cafe", "status_badge": "bs", "status_label": "OK", "current_units": 500, "capacity_units": 400}, "before": {"id": 3, "active": true, "status": "ok", "item_id": 0, "fill_pct": 100, "min_units": 40, "created_at": "2026-03-25T18:52:46.599Z", "machine_id": 13, "slot_label": null, "updated_at": "2026-03-27T20:15:50.888Z", "product_name": "Cafe", "status_badge": "bs", "status_label": "OK", "current_units": 400, "capacity_units": 400}, "quantity": 100, "machine_id": 13, "machine_name": "TEST"}	2026-03-27 17:15:58.914752-03
273	43	tecnico	tecnico	192.168.1.70	okhttp/5.3.0	machine.command_queue	machine	14	ESP32C3	Encoló el comando wifi_scan para ESP32C3	{"payload": {}, "command_id": 35, "command_type": "wifi_scan"}	2026-03-27 20:32:26.527577-03
272	43	tecnico	tecnico	192.168.1.70	okhttp/5.3.0	nfc_card.update	nfc_card	13	6AEBB01A	Reactivó o actualizó el TAG 6AEBB01A de Lorena Villalobos	{"after": {"id": 13, "uid": "6AEBB01A", "label": "TAG tecnico", "active": true, "status": "active", "employee_id": 12, "employee_name": "Lorena Villalobos"}, "before": {"id": 13, "uid": "6AEBB01A", "label": "Tarjeta principal", "active": false, "status": "inactive", "employee_id": 12, "employee_name": "Lorena Villalobos", "employee_email": "lorena@smartq.io", "employee_department": "Socia Gerente"}, "source": "mobile-tech"}	2026-03-27 19:27:23.856289-03
610	43	tecnico	tecnico	127.0.0.1	node	machine.command_queue	machine	14	ESP32C3	Encoló el comando diagnostics_snapshot para ESP32C3	{"payload": {"limit": 20}, "command_id": 75, "command_type": "diagnostics_snapshot"}	2026-04-04 11:17:17.484393-03
612	43	tecnico	tecnico	127.0.0.1	node	machine.command_queue	machine	14	ESP32C3	Encoló el comando diagnostics_snapshot para ESP32C3	{"payload": {"limit": 24}, "command_id": 77, "command_type": "diagnostics_snapshot"}	2026-04-04 11:40:31.996942-03
355	1	admin	admin	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	nfc_card.update	nfc_card	13	6AEBB01A	Actualizó el TAG 6AEBB01A	{"after": {"id": 13, "uid": "6AEBB01A", "label": "Tarjeta", "active": true, "status": "active", "employee_id": 12, "employee_name": "Lorena Villalobos"}, "before": {"id": 13, "uid": "6AEBB01A", "label": "TAG tecnico", "active": true, "status": "active", "employee_id": 12, "employee_name": "Lorena Villalobos"}, "source": "panel"}	2026-03-28 11:32:23.91405-03
740	1	admin	admin	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	machine.command_queue	machine	14	ESP32C3	Encoló el comando diagnostics_snapshot para ESP32C3	{"payload": {"limit": 20}, "command_id": 101, "command_type": "diagnostics_snapshot"}	2026-04-04 14:47:48.117184-03
741	1	admin	admin	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	machine.command_queue	machine	14	ESP32C3	Encoló el comando diagnostics_snapshot para ESP32C3	{"payload": {"limit": 20}, "command_id": 102, "command_type": "diagnostics_snapshot"}	2026-04-04 14:49:10.200602-03
650	1	admin	admin	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	machine.command_queue	machine	14	ESP32C3	Encoló el comando diagnostics_snapshot para ESP32C3	{"payload": {}, "command_id": 87, "command_type": "diagnostics_snapshot"}	2026-04-04 12:56:14.150156-03
644	43	tecnico	tecnico	127.0.0.1	node	machine.command_queue	machine	14	ESP32C3	Encoló el comando config_update para ESP32C3	{"payload": {"price_cents": 1200, "pricing_profile": "rubino_half_credit", "mdb_country_code": 50, "mdb_misc_options": 0, "mdb_scale_factor": 100, "mdb_feature_level": 1, "mdb_decimal_places": 2, "mdb_max_response_time": 6}, "command_id": 83, "command_type": "config_update"}	2026-04-04 12:15:43.545274-03
645	43	tecnico	tecnico	127.0.0.1	node	machine.update_technical_config	machine	14	ESP32C3	Actualizó la configuración técnica de ESP32C3	{"after": {"price_cents": 1200, "pricing_profile": "rubino_half_credit", "mdb_country_code": 50, "mdb_misc_options": 0, "mdb_scale_factor": 100, "mdb_feature_level": 1, "mdb_decimal_places": 2, "mdb_max_response_time": 6}, "before": {"price_cents": 1200, "pricing_profile": "rubino_half_credit", "mdb_country_code": 50, "mdb_misc_options": 0, "mdb_scale_factor": 100, "mdb_feature_level": 1, "mdb_decimal_places": 2, "mdb_max_response_time": 5}, "config_sync": "queued"}	2026-04-04 12:15:43.575352-03
646	43	tecnico	tecnico	127.0.0.1	node	machine.command_queue	machine	14	ESP32C3	Encoló el comando diagnostics_snapshot para ESP32C3	{"payload": {"limit": 8}, "command_id": 84, "command_type": "diagnostics_snapshot"}	2026-04-04 12:16:25.062127-03
647	43	tecnico	tecnico	127.0.0.1	node	machine.command_queue	machine	14	ESP32C3	Encoló el comando config_update para ESP32C3	{"payload": {"price_cents": 1200, "pricing_profile": "rubino_half_credit", "mdb_country_code": 50, "mdb_misc_options": 0, "mdb_scale_factor": 100, "mdb_feature_level": 1, "mdb_decimal_places": 2, "mdb_max_response_time": 5}, "command_id": 85, "command_type": "config_update"}	2026-04-04 12:16:56.427767-03
648	43	tecnico	tecnico	127.0.0.1	node	machine.update_technical_config	machine	14	ESP32C3	Actualizó la configuración técnica de ESP32C3	{"after": {"price_cents": 1200, "pricing_profile": "rubino_half_credit", "mdb_country_code": 50, "mdb_misc_options": 0, "mdb_scale_factor": 100, "mdb_feature_level": 1, "mdb_decimal_places": 2, "mdb_max_response_time": 5}, "before": {"price_cents": 1200, "pricing_profile": "rubino_half_credit", "mdb_country_code": 50, "mdb_misc_options": 0, "mdb_scale_factor": 100, "mdb_feature_level": 1, "mdb_decimal_places": 2, "mdb_max_response_time": 6}, "config_sync": "queued"}	2026-04-04 12:16:56.429112-03
649	43	tecnico	tecnico	127.0.0.1	node	machine.command_queue	machine	14	ESP32C3	Encoló el comando diagnostics_snapshot para ESP32C3	{"payload": {"limit": 6}, "command_id": 86, "command_type": "diagnostics_snapshot"}	2026-04-04 12:17:29.076038-03
\.


--
-- Data for Name: employees; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.employees (id, name, department, email, daily_limit, active, created_at, dni, legajo, phone, photo_url, daily_limit_mode, warning_enabled, access_level_id) FROM stdin;
12	Lorena Villalobos	Socia Gerente	lorena@smartq.io	8	t	2026-03-23 19:23:50.846527-03	30867888	GER001	2235854433	\N	warn_only	t	\N
2	Carlos López	IT	carlos@empresa.com	4	f	2026-03-22 20:24:34.634676-03	\N	\N	\N	\N	enforce	t	\N
11	Mateo Scaramuzzino	Gerencia	mateo@smartq.io	10	t	2026-03-23 12:15:36.368874-03	53000999	Leg001	2235550099	\N	enforce	t	\N
1	Ana García	Marketing	ana@empresa.com	4	f	2026-03-22 20:24:34.634676-03	\N	\N	\N	\N	enforce	t	\N
4	Juan Martínez	Finanzas	juan@empresa.com	4	f	2026-03-22 20:24:34.634676-03	\N	\N	\N	\N	enforce	t	\N
5	Laura Sánchez	Ventas	laura@empresa.com	4	f	2026-03-22 20:24:34.634676-03	\N	\N	\N	\N	enforce	t	\N
8	Luis Fernández	Logística	diego@empresa.com	6	f	2026-03-22 20:24:34.634676-03	\N	\N	\N	\N	enforce	t	\N
3	María Pérez	RRHH	maria@empresa.com	4	f	2026-03-22 20:24:34.634676-03	\N	\N	\N	\N	enforce	t	\N
6	Pedro Rodríguez	IT	pedro@empresa.com	4	f	2026-03-22 20:24:34.634676-03	\N	\N	\N	\N	enforce	t	\N
7	Sofía Díaz	Marketing	sofia@empresa.com	4	f	2026-03-22 20:24:34.634676-03	\N	\N	\N	\N	enforce	t	\N
18	AUDIT TEMP 20260324232131	QA	\N	5	f	2026-03-24 20:21:31.672243-03	\N	\N	123456	\N	warn_only	f	\N
19	AUDIT TEMP 20260324232201	QA	\N	5	f	2026-03-24 20:22:01.444002-03	\N	\N	123456	\N	warn_only	f	\N
\.


--
-- Data for Name: firmware_releases; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.firmware_releases (id, version, filename, storage_path, content_type, size_bytes, md5, notes, created_by_user_id, created_by_username, created_at) FROM stdin;
4	3.1.1	coffeecontrol-esp32c3-3.1.1.bin	1775601443949_3.1.1_coffeecontrol-esp32c3-3.1.1.bin	application/octet-stream	1007200	b0d78da7d3231b82ce57d4ba94c745d7	OTA validation release 3.1.1	1	admin	2026-04-07 19:37:23.956058-03
\.


--
-- Data for Name: machine_commands; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.machine_commands (id, machine_id, command_type, payload, status, queued_at, delivered_at, completed_at, result) FROM stdin;
77	14	diagnostics_snapshot	{"limit": 24}	completed	2026-04-04 11:40:31.982253-03	2026-04-04 11:40:41.616516-03	2026-04-04 11:40:41.656464-03	{"mdb": {"raw": [1, 127, 255, 0, 0, 144, 0, 0], "last_len": 6, "max_price": 32767, "min_price": 0, "vmc_level": 2, "last_subcmd": 1, "seen_config": true, "seen_prices": true, "display_info": 0, "display_rows": 0, "last_seen_ms": 1472, "display_columns": 0}, "events": {"count": 42, "events": [{"ms": 300259, "arg1": 200, "arg2": 1200, "code": 22, "name": "BACKEND_REGISTER_OK"}, {"ms": 360122, "arg1": 200, "arg2": 0, "code": 20, "name": "BACKEND_HEALTH_OK"}, {"ms": 360359, "arg1": 200, "arg2": 1200, "code": 22, "name": "BACKEND_REGISTER_OK"}, {"ms": 420126, "arg1": 200, "arg2": 0, "code": 20, "name": "BACKEND_HEALTH_OK"}, {"ms": 420205, "arg1": 200, "arg2": 1200, "code": 22, "name": "BACKEND_REGISTER_OK"}, {"ms": 480180, "arg1": 200, "arg2": 0, "code": 20, "name": "BACKEND_HEALTH_OK"}, {"ms": 480304, "arg1": 200, "arg2": 1200, "code": 22, "name": "BACKEND_REGISTER_OK"}, {"ms": 540146, "arg1": 200, "arg2": 0, "code": 20, "name": "BACKEND_HEALTH_OK"}, {"ms": 540238, "arg1": 200, "arg2": 1200, "code": 22, "name": "BACKEND_REGISTER_OK"}, {"ms": 600199, "arg1": 2, "arg2": 1775358000, "code": 25, "name": "BACKEND_CARDS_OK"}, {"ms": 600224, "arg1": 200, "arg2": 0, "code": 20, "name": "BACKEND_HEALTH_OK"}, {"ms": 600320, "arg1": 200, "arg2": 1200, "code": 22, "name": "BACKEND_REGISTER_OK"}, {"ms": 660251, "arg1": 200, "arg2": 0, "code": 20, "name": "BACKEND_HEALTH_OK"}, {"ms": 660698, "arg1": 200, "arg2": 1200, "code": 22, "name": "BACKEND_REGISTER_OK"}, {"ms": 720263, "arg1": 200, "arg2": 0, "code": 20, "name": "BACKEND_HEALTH_OK"}, {"ms": 720508, "arg1": 200, "arg2": 1200, "code": 22, "name": "BACKEND_REGISTER_OK"}, {"ms": 747353, "arg1": 0, "arg2": 27371, "code": 30, "name": "NFC_READ"}, {"ms": 747645, "arg1": 200, "arg2": 0, "code": 31, "name": "NFC_APPROVED_ONLINE"}, {"ms": 747739, "arg1": 3, "arg2": 600, "code": 51, "name": "MDB_BEGIN_SESSION"}, {"ms": 749111, "arg1": 7, "arg2": 600, "code": 52, "name": "MDB_VEND_REQUEST"}, {"ms": 749356, "arg1": 7, "arg2": 600, "code": 53, "name": "MDB_VEND_SUCCESS"}, {"ms": 749569, "arg1": 7, "arg2": 600, "code": 55, "name": "MDB_VEND_END"}, {"ms": 780300, "arg1": 200, "arg2": 0, "code": 20, "name": "BACKEND_HEALTH_OK"}, {"ms": 780512, "arg1": 200, "arg2": 1200, "code": 22, "name": "BACKEND_REGISTER_OK"}], "capacity": 64}, "message": "Diagnostico generado desde la maquina", "price_cents": 1200, "backend_ready": true, "queue_pending": 0, "captured_at_ms": 781032, "wifi_connected": true, "pricing_profile": "rubino_half_credit"}
1	14	reboot	{}	completed	2026-03-24 13:03:43.854484-03	2026-03-24 13:03:51.9707-03	2026-03-24 13:13:05.142203-03	{"message": "ack manual de prueba"}
34	14	wifi_scan	{}	completed	2026-03-27 18:53:13.86877-03	2026-03-27 18:53:23.967914-03	2026-03-27 18:53:26.044249-03	{"count": 1, "message": "1 red visible detectada.", "networks": [{"rssi": -70, "ssid": "Tiziana", "secure": true}]}
75	14	diagnostics_snapshot	{"limit": 20}	completed	2026-04-04 11:17:17.480194-03	2026-04-04 11:17:27.762123-03	2026-04-04 11:17:27.826211-03	{"mdb": {"raw": [1, 127, 255, 0, 0, 144, 0, 0], "last_len": 6, "max_price": 32767, "min_price": 0, "vmc_level": 2, "last_subcmd": 1, "seen_config": true, "seen_prices": true, "display_info": 0, "display_rows": 0, "last_seen_ms": 177757, "display_columns": 0}, "events": {"count": 22, "events": [{"ms": 1350, "arg1": 2, "arg2": 0, "code": 57, "name": "MDB_SETUP_CONFIG"}, {"ms": 1391, "arg1": 0, "arg2": 32767, "code": 58, "name": "MDB_SETUP_PRICES"}, {"ms": 4572, "arg1": -62, "arg2": 1560389824, "code": 10, "name": "WIFI_CONNECT_OK"}, {"ms": 7984, "arg1": 200, "arg2": 0, "code": 20, "name": "BACKEND_HEALTH_OK"}, {"ms": 8081, "arg1": 200, "arg2": 0, "code": 20, "name": "BACKEND_HEALTH_OK"}, {"ms": 8827, "arg1": 200, "arg2": 1200, "code": 22, "name": "BACKEND_REGISTER_OK"}, {"ms": 9451, "arg1": 2, "arg2": 1775358000, "code": 25, "name": "BACKEND_CARDS_OK"}, {"ms": 61024, "arg1": 200, "arg2": 0, "code": 20, "name": "BACKEND_HEALTH_OK"}, {"ms": 61622, "arg1": 200, "arg2": 1200, "code": 22, "name": "BACKEND_REGISTER_OK"}, {"ms": 120165, "arg1": 200, "arg2": 0, "code": 20, "name": "BACKEND_HEALTH_OK"}, {"ms": 120450, "arg1": 200, "arg2": 1200, "code": 22, "name": "BACKEND_REGISTER_OK"}, {"ms": 175079, "arg1": 0, "arg2": 27371, "code": 30, "name": "NFC_READ"}, {"ms": 175468, "arg1": 200, "arg2": 0, "code": 31, "name": "NFC_APPROVED_ONLINE"}, {"ms": 175562, "arg1": 3, "arg2": 600, "code": 51, "name": "MDB_BEGIN_SESSION"}, {"ms": 177387, "arg1": 7, "arg2": 600, "code": 52, "name": "MDB_VEND_REQUEST"}, {"ms": 177658, "arg1": 0, "arg2": 0, "code": 50, "name": "MDB_RESET"}, {"ms": 177716, "arg1": 2, "arg2": 0, "code": 57, "name": "MDB_SETUP_CONFIG"}, {"ms": 177757, "arg1": 0, "arg2": 32767, "code": 58, "name": "MDB_SETUP_PRICES"}, {"ms": 180104, "arg1": 200, "arg2": 0, "code": 20, "name": "BACKEND_HEALTH_OK"}, {"ms": 180241, "arg1": 200, "arg2": 1200, "code": 22, "name": "BACKEND_REGISTER_OK"}], "capacity": 64}, "message": "Diagnostico generado desde la maquina", "price_cents": 1200, "backend_ready": true, "queue_pending": 0, "captured_at_ms": 211817, "wifi_connected": true, "pricing_profile": "rubino_half_credit"}
35	14	wifi_scan	{}	completed	2026-03-27 20:32:26.512076-03	2026-03-27 20:32:41.301279-03	2026-03-27 20:32:43.494958-03	{"count": 1, "message": "1 red visible detectada.", "networks": [{"rssi": -70, "ssid": "Tiziana", "secure": true}]}
36	14	wifi_scan	{}	completed	2026-03-27 21:44:48.898717-03	2026-03-27 21:45:00.193999-03	2026-03-27 21:45:04.630343-03	{"count": 3, "message": "3 redes visibles detectadas.", "networks": [{"rssi": -68, "ssid": "Tiziana", "secure": true}, {"rssi": -75, "ssid": "alejandro", "secure": true}, {"rssi": -77, "ssid": "DIRECT-AP[TV][LG]47LA6200-SA", "secure": true}]}
76	14	diagnostics_snapshot	{"limit": 24}	completed	2026-04-04 11:24:26.094694-03	2026-04-04 11:24:32.680384-03	2026-04-04 11:24:32.759271-03	{"mdb": {"raw": [1, 127, 255, 0, 0, 144, 0, 0], "last_len": 6, "max_price": 32767, "min_price": 0, "vmc_level": 2, "last_subcmd": 1, "seen_config": true, "seen_prices": true, "display_info": 0, "display_rows": 0, "last_seen_ms": 1553, "display_columns": 0}, "events": {"count": 20, "events": [{"ms": 283, "arg1": 0, "arg2": 0, "code": 1, "name": "BOOT"}, {"ms": 1464, "arg1": 0, "arg2": 0, "code": 50, "name": "MDB_RESET"}, {"ms": 1512, "arg1": 2, "arg2": 0, "code": 57, "name": "MDB_SETUP_CONFIG"}, {"ms": 1553, "arg1": 0, "arg2": 32767, "code": 58, "name": "MDB_SETUP_PRICES"}, {"ms": 6681, "arg1": -62, "arg2": 1560389824, "code": 10, "name": "WIFI_CONNECT_OK"}, {"ms": 8982, "arg1": 200, "arg2": 0, "code": 20, "name": "BACKEND_HEALTH_OK"}, {"ms": 9067, "arg1": 200, "arg2": 0, "code": 20, "name": "BACKEND_HEALTH_OK"}, {"ms": 9318, "arg1": 200, "arg2": 1200, "code": 22, "name": "BACKEND_REGISTER_OK"}, {"ms": 9779, "arg1": 2, "arg2": 1775358000, "code": 25, "name": "BACKEND_CARDS_OK"}, {"ms": 60058, "arg1": 200, "arg2": 0, "code": 20, "name": "BACKEND_HEALTH_OK"}, {"ms": 60263, "arg1": 200, "arg2": 1200, "code": 22, "name": "BACKEND_REGISTER_OK"}, {"ms": 85126, "arg1": 0, "arg2": 27371, "code": 30, "name": "NFC_READ"}, {"ms": 85571, "arg1": 200, "arg2": 0, "code": 31, "name": "NFC_APPROVED_ONLINE"}, {"ms": 85715, "arg1": 3, "arg2": 600, "code": 51, "name": "MDB_BEGIN_SESSION"}, {"ms": 87385, "arg1": 7, "arg2": 600, "code": 52, "name": "MDB_VEND_REQUEST"}, {"ms": 87578, "arg1": 7, "arg2": 600, "code": 53, "name": "MDB_VEND_SUCCESS"}, {"ms": 87860, "arg1": 7, "arg2": 600, "code": 53, "name": "MDB_VEND_SUCCESS"}, {"ms": 88048, "arg1": 7, "arg2": 600, "code": 55, "name": "MDB_VEND_END"}, {"ms": 120113, "arg1": 200, "arg2": 0, "code": 20, "name": "BACKEND_HEALTH_OK"}, {"ms": 120864, "arg1": 200, "arg2": 1200, "code": 22, "name": "BACKEND_REGISTER_OK"}], "capacity": 64}, "message": "Diagnostico generado desde la maquina", "price_cents": 1200, "backend_ready": true, "queue_pending": 0, "captured_at_ms": 120950, "wifi_connected": true, "pricing_profile": "rubino_half_credit"}
74	14	diagnostics_snapshot	{"limit": 20}	completed	2026-04-04 11:14:43.778125-03	2026-04-04 11:14:58.455232-03	2026-04-04 11:14:58.552643-03	{"mdb": {"raw": [1, 127, 255, 0, 0, 144, 0, 0], "last_len": 6, "max_price": 32767, "min_price": 0, "vmc_level": 2, "last_subcmd": 1, "seen_config": true, "seen_prices": true, "display_info": 0, "display_rows": 0, "last_seen_ms": 1391, "display_columns": 0}, "events": {"count": 11, "events": [{"ms": 283, "arg1": 0, "arg2": 0, "code": 1, "name": "BOOT"}, {"ms": 1291, "arg1": 0, "arg2": 0, "code": 50, "name": "MDB_RESET"}, {"ms": 1350, "arg1": 2, "arg2": 0, "code": 57, "name": "MDB_SETUP_CONFIG"}, {"ms": 1391, "arg1": 0, "arg2": 32767, "code": 58, "name": "MDB_SETUP_PRICES"}, {"ms": 4572, "arg1": -62, "arg2": 1560389824, "code": 10, "name": "WIFI_CONNECT_OK"}, {"ms": 7984, "arg1": 200, "arg2": 0, "code": 20, "name": "BACKEND_HEALTH_OK"}, {"ms": 8081, "arg1": 200, "arg2": 0, "code": 20, "name": "BACKEND_HEALTH_OK"}, {"ms": 8827, "arg1": 200, "arg2": 1200, "code": 22, "name": "BACKEND_REGISTER_OK"}, {"ms": 9451, "arg1": 2, "arg2": 1775358000, "code": 25, "name": "BACKEND_CARDS_OK"}, {"ms": 61024, "arg1": 200, "arg2": 0, "code": 20, "name": "BACKEND_HEALTH_OK"}, {"ms": 61622, "arg1": 200, "arg2": 1200, "code": 22, "name": "BACKEND_REGISTER_OK"}], "capacity": 64}, "message": "Diagnostico generado desde la maquina", "price_cents": 1200, "backend_ready": true, "queue_pending": 0, "captured_at_ms": 61700, "wifi_connected": true, "pricing_profile": "rubino_half_credit"}
43	14	wifi_scan	{}	completed	2026-03-28 08:33:35.913375-03	2026-03-28 08:33:50.629514-03	2026-03-28 08:33:55.129591-03	{"count": 1, "message": "1 red visible detectada.", "networks": [{"rssi": -76, "ssid": "Tiziana", "secure": true}]}
44	14	reboot	{}	completed	2026-03-31 18:48:58.549698-03	2026-03-31 18:51:19.520171-03	2026-03-31 18:51:19.649671-03	{"message": "Reinicio remoto aceptado por la maquina"}
45	14	wifi_scan	{}	completed	2026-04-02 12:02:25.677072-03	2026-04-02 12:04:43.812059-03	2026-04-02 12:04:46.007222-03	{"count": 3, "message": "3 redes visibles detectadas.", "networks": [{"rssi": -64, "ssid": "alejandro", "secure": true}, {"rssi": -67, "ssid": "Tiziana", "secure": true}, {"rssi": -92, "ssid": "WIFICasa", "secure": true}]}
2	14	reboot	{}	completed	2026-03-24 13:13:49.783996-03	2026-03-24 13:21:53.817187-03	2026-03-24 13:31:02.174925-03	{"message": "Reinicio remoto aceptado por la maquina"}
3	14	wifi_update	{"url": "", "pass": "Mateo123", "ssid": "Tiziana"}	completed	2026-03-24 13:49:52.625378-03	2026-03-24 13:49:55.662751-03	2026-03-24 13:49:55.899981-03	{"message": "Configuracion WiFi guardada; reiniciando"}
4	14	wifi_scan	{}	completed	2026-03-24 14:21:20.343562-03	2026-03-24 14:21:35.272528-03	2026-03-24 14:21:37.359002-03	{"count": 1, "message": "1 red visible detectada.", "networks": [{"rssi": -80, "ssid": "Tiziana", "secure": true}]}
5	14	wifi_scan	{}	completed	2026-03-24 14:22:22.706546-03	2026-03-24 14:22:35.910142-03	2026-03-24 14:22:38.005447-03	{"count": 2, "message": "2 redes visibles detectadas.", "networks": [{"rssi": -73, "ssid": "alejandro", "secure": true}, {"rssi": -81, "ssid": "Tiziana", "secure": true}]}
6	14	wifi_scan	{}	completed	2026-03-24 19:17:58.865965-03	2026-03-24 19:18:04.995787-03	2026-03-24 19:18:06.921264-03	{"count": 2, "message": "2 redes visibles detectadas.", "networks": [{"rssi": -67, "ssid": "Tiziana", "secure": true}, {"rssi": -93, "ssid": "Braian", "secure": true}]}
101	14	diagnostics_snapshot	{"limit": 20}	completed	2026-04-04 14:47:48.089935-03	2026-04-04 14:47:49.689717-03	2026-04-04 14:47:49.848141-03	{"mdb": {"raw": [1, 127, 255, 0, 0, 144, 0, 0], "last_len": 6, "max_price": 32767, "min_price": 0, "vmc_level": 2, "last_subcmd": 1, "seen_config": true, "seen_prices": true, "display_info": 0, "display_rows": 0, "last_seen_ms": 1356, "display_columns": 0}, "events": {"count": 11, "events": [{"ms": 295, "arg1": 3, "arg2": 0, "code": 1, "name": "BOOT"}, {"ms": 1257, "arg1": 0, "arg2": 0, "code": 50, "name": "MDB_RESET"}, {"ms": 1315, "arg1": 2, "arg2": 0, "code": 57, "name": "MDB_SETUP_CONFIG"}, {"ms": 1356, "arg1": 0, "arg2": 32767, "code": 58, "name": "MDB_SETUP_PRICES"}, {"ms": 1579, "arg1": -68, "arg2": 1560389824, "code": 10, "name": "WIFI_CONNECT_OK"}, {"ms": 1638, "arg1": 200, "arg2": 0, "code": 20, "name": "BACKEND_HEALTH_OK"}, {"ms": 1684, "arg1": 200, "arg2": 0, "code": 20, "name": "BACKEND_HEALTH_OK"}, {"ms": 1800, "arg1": 200, "arg2": 1200, "code": 22, "name": "BACKEND_REGISTER_OK"}, {"ms": 2234, "arg1": 2, "arg2": 1775358000, "code": 25, "name": "BACKEND_CARDS_OK"}, {"ms": 60030, "arg1": 200, "arg2": 0, "code": 20, "name": "BACKEND_HEALTH_OK"}, {"ms": 60138, "arg1": 200, "arg2": 1200, "code": 22, "name": "BACKEND_REGISTER_OK"}], "capacity": 64}, "message": "Diagnostico generado desde la maquina", "price_cents": 1200, "backend_ready": true, "queue_pending": 0, "captured_at_ms": 60198, "wifi_connected": true, "pricing_profile": "rubino_half_credit", "mdb_country_code": 50, "mdb_misc_options": 0, "mdb_scale_factor": 100, "mdb_feature_level": 1, "mdb_decimal_places": 2, "mdb_max_response_time": 5}
139	14	firmware_update	{"md5": "b0d78da7d3231b82ce57d4ba94c745d7", "version": "3.1.1", "release_id": 4, "size_bytes": 1007200, "download_path": "/api/machine-firmware/releases/4/download"}	completed	2026-04-07 19:37:24.016716-03	2026-04-07 19:37:37.211407-03	2026-04-07 19:37:46.801182-03	{"message": "Firmware 3.1.1 aplicado; reiniciando", "version": "3.1.1", "release_id": 4}
102	14	diagnostics_snapshot	{"limit": 20}	completed	2026-04-04 14:49:10.194702-03	2026-04-04 14:49:19.756857-03	2026-04-04 14:49:19.817312-03	{"mdb": {"raw": [1, 127, 255, 0, 0, 144, 0, 0], "last_len": 6, "max_price": 32767, "min_price": 0, "vmc_level": 2, "last_subcmd": 1, "seen_config": true, "seen_prices": true, "display_info": 0, "display_rows": 0, "last_seen_ms": 1356, "display_columns": 0}, "events": {"count": 13, "events": [{"ms": 295, "arg1": 3, "arg2": 0, "code": 1, "name": "BOOT"}, {"ms": 1257, "arg1": 0, "arg2": 0, "code": 50, "name": "MDB_RESET"}, {"ms": 1315, "arg1": 2, "arg2": 0, "code": 57, "name": "MDB_SETUP_CONFIG"}, {"ms": 1356, "arg1": 0, "arg2": 32767, "code": 58, "name": "MDB_SETUP_PRICES"}, {"ms": 1579, "arg1": -68, "arg2": 1560389824, "code": 10, "name": "WIFI_CONNECT_OK"}, {"ms": 1638, "arg1": 200, "arg2": 0, "code": 20, "name": "BACKEND_HEALTH_OK"}, {"ms": 1684, "arg1": 200, "arg2": 0, "code": 20, "name": "BACKEND_HEALTH_OK"}, {"ms": 1800, "arg1": 200, "arg2": 1200, "code": 22, "name": "BACKEND_REGISTER_OK"}, {"ms": 2234, "arg1": 2, "arg2": 1775358000, "code": 25, "name": "BACKEND_CARDS_OK"}, {"ms": 60030, "arg1": 200, "arg2": 0, "code": 20, "name": "BACKEND_HEALTH_OK"}, {"ms": 60138, "arg1": 200, "arg2": 1200, "code": 22, "name": "BACKEND_REGISTER_OK"}, {"ms": 120047, "arg1": 200, "arg2": 0, "code": 20, "name": "BACKEND_HEALTH_OK"}, {"ms": 120145, "arg1": 200, "arg2": 1200, "code": 22, "name": "BACKEND_REGISTER_OK"}], "capacity": 64}, "message": "Diagnostico generado desde la maquina", "price_cents": 1200, "backend_ready": true, "queue_pending": 0, "captured_at_ms": 150270, "wifi_connected": true, "pricing_profile": "rubino_half_credit", "mdb_country_code": 50, "mdb_misc_options": 0, "mdb_scale_factor": 100, "mdb_feature_level": 1, "mdb_decimal_places": 2, "mdb_max_response_time": 5}
86	14	diagnostics_snapshot	{"limit": 6}	completed	2026-04-04 12:17:29.073421-03	2026-04-04 12:17:36.955075-03	2026-04-04 12:17:37.067995-03	{"mdb": {"raw": [1, 127, 255, 0, 0, 144, 0, 0], "last_len": 6, "max_price": 32767, "min_price": 0, "vmc_level": 2, "last_subcmd": 1, "seen_config": true, "seen_prices": true, "display_info": 0, "display_rows": 0, "last_seen_ms": 1583, "display_columns": 0}, "events": {"count": 17, "events": [{"ms": 120109, "arg1": 200, "arg2": 0, "code": 20, "name": "BACKEND_HEALTH_OK"}, {"ms": 120599, "arg1": 200, "arg2": 1200, "code": 22, "name": "BACKEND_REGISTER_OK"}, {"ms": 121032, "arg1": 0, "arg2": 1200, "code": 60, "name": "REMOTE_CONFIG_APPLIED"}, {"ms": 180071, "arg1": 200, "arg2": 0, "code": 20, "name": "BACKEND_HEALTH_OK"}, {"ms": 180250, "arg1": 200, "arg2": 1200, "code": 22, "name": "BACKEND_REGISTER_OK"}, {"ms": 196369, "arg1": 1, "arg2": 1200, "code": 60, "name": "REMOTE_CONFIG_APPLIED"}], "capacity": 64}, "message": "Diagnostico generado desde la maquina", "price_cents": 1200, "backend_ready": true, "queue_pending": 0, "captured_at_ms": 225788, "wifi_connected": true, "pricing_profile": "rubino_half_credit", "mdb_country_code": 50, "mdb_misc_options": 0, "mdb_scale_factor": 100, "mdb_feature_level": 1, "mdb_decimal_places": 2, "mdb_max_response_time": 5}
83	14	config_update	{"price_cents": 1200, "pricing_profile": "rubino_half_credit", "mdb_country_code": 50, "mdb_misc_options": 0, "mdb_scale_factor": 100, "mdb_feature_level": 1, "mdb_decimal_places": 2, "mdb_max_response_time": 6}	completed	2026-04-04 12:15:43.527042-03	2026-04-04 12:15:51.858841-03	2026-04-04 12:15:52.086004-03	{"message": "Configuracion ya vigente"}
84	14	diagnostics_snapshot	{"limit": 8}	completed	2026-04-04 12:16:25.05896-03	2026-04-04 12:16:36.9091-03	2026-04-04 12:16:37.008273-03	{"mdb": {"raw": [1, 127, 255, 0, 0, 144, 0, 0], "last_len": 6, "max_price": 32767, "min_price": 0, "vmc_level": 2, "last_subcmd": 1, "seen_config": true, "seen_prices": true, "display_info": 0, "display_rows": 0, "last_seen_ms": 1583, "display_columns": 0}, "events": {"count": 14, "events": [{"ms": 5898, "arg1": 200, "arg2": 0, "code": 20, "name": "BACKEND_HEALTH_OK"}, {"ms": 6094, "arg1": 200, "arg2": 1200, "code": 22, "name": "BACKEND_REGISTER_OK"}, {"ms": 6420, "arg1": 2, "arg2": 1775358000, "code": 25, "name": "BACKEND_CARDS_OK"}, {"ms": 60047, "arg1": 200, "arg2": 0, "code": 20, "name": "BACKEND_HEALTH_OK"}, {"ms": 60172, "arg1": 200, "arg2": 1200, "code": 22, "name": "BACKEND_REGISTER_OK"}, {"ms": 120109, "arg1": 200, "arg2": 0, "code": 20, "name": "BACKEND_HEALTH_OK"}, {"ms": 120599, "arg1": 200, "arg2": 1200, "code": 22, "name": "BACKEND_REGISTER_OK"}, {"ms": 121032, "arg1": 0, "arg2": 1200, "code": 60, "name": "REMOTE_CONFIG_APPLIED"}], "capacity": 64}, "message": "Diagnostico generado desde la maquina", "price_cents": 1200, "backend_ready": true, "queue_pending": 0, "captured_at_ms": 165721, "wifi_connected": true, "pricing_profile": "rubino_half_credit", "mdb_country_code": 50, "mdb_misc_options": 0, "mdb_scale_factor": 100, "mdb_feature_level": 1, "mdb_decimal_places": 2, "mdb_max_response_time": 6}
85	14	config_update	{"price_cents": 1200, "pricing_profile": "rubino_half_credit", "mdb_country_code": 50, "mdb_misc_options": 0, "mdb_scale_factor": 100, "mdb_feature_level": 1, "mdb_decimal_places": 2, "mdb_max_response_time": 5}	completed	2026-04-04 12:16:56.426197-03	2026-04-04 12:17:06.93724-03	2026-04-04 12:17:07.151285-03	{"message": "Configuracion aplicada sin reinicio"}
87	14	diagnostics_snapshot	{}	completed	2026-04-04 12:56:14.144171-03	2026-04-04 12:56:24.147291-03	2026-04-04 12:56:24.237044-03	{"mdb": {"raw": [1, 127, 255, 0, 0, 144, 0, 0], "last_len": 6, "max_price": 32767, "min_price": 0, "vmc_level": 2, "last_subcmd": 1, "seen_config": true, "seen_prices": true, "display_info": 0, "display_rows": 0, "last_seen_ms": 1583, "display_columns": 0}, "events": {"count": 64, "events": [{"ms": 1980992, "arg1": 200, "arg2": 1200, "code": 22, "name": "BACKEND_REGISTER_OK"}, {"ms": 2040717, "arg1": 200, "arg2": 0, "code": 20, "name": "BACKEND_HEALTH_OK"}, {"ms": 2041083, "arg1": 200, "arg2": 1200, "code": 22, "name": "BACKEND_REGISTER_OK"}, {"ms": 2100725, "arg1": 200, "arg2": 0, "code": 20, "name": "BACKEND_HEALTH_OK"}, {"ms": 2100831, "arg1": 200, "arg2": 1200, "code": 22, "name": "BACKEND_REGISTER_OK"}, {"ms": 2160736, "arg1": 200, "arg2": 0, "code": 20, "name": "BACKEND_HEALTH_OK"}, {"ms": 2160836, "arg1": 200, "arg2": 1200, "code": 22, "name": "BACKEND_REGISTER_OK"}, {"ms": 2220761, "arg1": 200, "arg2": 0, "code": 20, "name": "BACKEND_HEALTH_OK"}, {"ms": 2220917, "arg1": 200, "arg2": 1200, "code": 22, "name": "BACKEND_REGISTER_OK"}, {"ms": 2280755, "arg1": 200, "arg2": 0, "code": 20, "name": "BACKEND_HEALTH_OK"}, {"ms": 2281118, "arg1": 200, "arg2": 1200, "code": 22, "name": "BACKEND_REGISTER_OK"}, {"ms": 2340812, "arg1": 200, "arg2": 0, "code": 20, "name": "BACKEND_HEALTH_OK"}, {"ms": 2341221, "arg1": 200, "arg2": 1200, "code": 22, "name": "BACKEND_REGISTER_OK"}, {"ms": 2400275, "arg1": 2, "arg2": 1775358000, "code": 25, "name": "BACKEND_CARDS_OK"}, {"ms": 2400805, "arg1": 200, "arg2": 0, "code": 20, "name": "BACKEND_HEALTH_OK"}, {"ms": 2401026, "arg1": 200, "arg2": 1200, "code": 22, "name": "BACKEND_REGISTER_OK"}, {"ms": 2460820, "arg1": 200, "arg2": 0, "code": 20, "name": "BACKEND_HEALTH_OK"}, {"ms": 2461045, "arg1": 200, "arg2": 1200, "code": 22, "name": "BACKEND_REGISTER_OK"}, {"ms": 2520840, "arg1": 200, "arg2": 0, "code": 20, "name": "BACKEND_HEALTH_OK"}, {"ms": 2520958, "arg1": 200, "arg2": 1200, "code": 22, "name": "BACKEND_REGISTER_OK"}], "capacity": 64}, "message": "Diagnostico generado desde la maquina", "price_cents": 1200, "backend_ready": true, "queue_pending": 0, "captured_at_ms": 2552994, "wifi_connected": true, "pricing_profile": "rubino_half_credit", "mdb_country_code": 50, "mdb_misc_options": 0, "mdb_scale_factor": 100, "mdb_feature_level": 1, "mdb_decimal_places": 2, "mdb_max_response_time": 5}
103	14	diagnostics_snapshot	{"limit": 20}	completed	2026-04-04 14:51:30.572766-03	2026-04-04 14:51:45.527669-03	2026-04-04 14:51:45.677607-03	{"mdb": {"raw": [1, 127, 255, 0, 0, 144, 0, 0], "last_len": 6, "max_price": 32767, "min_price": 0, "vmc_level": 2, "last_subcmd": 1, "seen_config": true, "seen_prices": true, "display_info": 0, "display_rows": 0, "last_seen_ms": 1403, "display_columns": 0}, "events": {"count": 9, "events": [{"ms": 284, "arg1": 0, "arg2": 0, "code": 1, "name": "BOOT"}, {"ms": 1315, "arg1": 0, "arg2": 0, "code": 50, "name": "MDB_RESET"}, {"ms": 1362, "arg1": 2, "arg2": 0, "code": 57, "name": "MDB_SETUP_CONFIG"}, {"ms": 1403, "arg1": 0, "arg2": 32767, "code": 58, "name": "MDB_SETUP_PRICES"}, {"ms": 1676, "arg1": -65, "arg2": 1560389824, "code": 10, "name": "WIFI_CONNECT_OK"}, {"ms": 2935, "arg1": 200, "arg2": 0, "code": 20, "name": "BACKEND_HEALTH_OK"}, {"ms": 3386, "arg1": 200, "arg2": 0, "code": 20, "name": "BACKEND_HEALTH_OK"}, {"ms": 3789, "arg1": 200, "arg2": 1200, "code": 22, "name": "BACKEND_REGISTER_OK"}, {"ms": 4094, "arg1": 2, "arg2": 1775358000, "code": 25, "name": "BACKEND_CARDS_OK"}], "capacity": 64}, "message": "Diagnostico generado desde la maquina", "price_cents": 1200, "backend_ready": true, "config_source": "backend", "queue_pending": 0, "captured_at_ms": 45114, "config_version": 1, "wifi_connected": true, "pricing_profile": "rubino_half_credit", "mdb_country_code": 50, "mdb_misc_options": 0, "mdb_scale_factor": 100, "mdb_feature_level": 1, "mdb_decimal_places": 2, "mdb_max_response_time": 5}
104	14	diagnostics_snapshot	{"limit": 20}	completed	2026-04-04 14:53:41.496495-03	2026-04-04 14:53:53.315966-03	2026-04-04 14:53:53.415471-03	{"mdb": {"raw": [1, 127, 255, 0, 0, 144, 0, 0], "last_len": 6, "max_price": 32767, "min_price": 0, "vmc_level": 2, "last_subcmd": 1, "seen_config": true, "seen_prices": true, "display_info": 0, "display_rows": 0, "last_seen_ms": 1499, "display_columns": 0}, "events": {"count": 9, "events": [{"ms": 295, "arg1": 3, "arg2": 0, "code": 1, "name": "BOOT"}, {"ms": 1400, "arg1": 0, "arg2": 0, "code": 50, "name": "MDB_RESET"}, {"ms": 1458, "arg1": 2, "arg2": 0, "code": 57, "name": "MDB_SETUP_CONFIG"}, {"ms": 1499, "arg1": 0, "arg2": 32767, "code": 58, "name": "MDB_SETUP_PRICES"}, {"ms": 1580, "arg1": -69, "arg2": 1560389824, "code": 10, "name": "WIFI_CONNECT_OK"}, {"ms": 1672, "arg1": 200, "arg2": 0, "code": 20, "name": "BACKEND_HEALTH_OK"}, {"ms": 1734, "arg1": 200, "arg2": 0, "code": 20, "name": "BACKEND_HEALTH_OK"}, {"ms": 1953, "arg1": 200, "arg2": 1200, "code": 22, "name": "BACKEND_REGISTER_OK"}, {"ms": 2342, "arg1": 2, "arg2": 1775358000, "code": 25, "name": "BACKEND_CARDS_OK"}], "capacity": 64}, "message": "Diagnostico generado desde la maquina", "price_cents": 1200, "backend_ready": true, "config_source": "portal", "queue_pending": 0, "captured_at_ms": 45055, "config_version": 2, "wifi_connected": true, "pricing_profile": "rubino_half_credit", "mdb_country_code": 50, "mdb_misc_options": 0, "mdb_scale_factor": 100, "mdb_feature_level": 1, "mdb_decimal_places": 2, "mdb_max_response_time": 5}
105	14	diagnostics_snapshot	{"limit": 20}	completed	2026-04-04 15:08:40.006398-03	2026-04-04 15:08:43.380432-03	2026-04-04 15:08:43.536808-03	{"mdb": {"raw": [1, 127, 255, 0, 0, 144, 0, 0], "last_len": 6, "max_price": 32767, "min_price": 0, "vmc_level": 2, "last_subcmd": 1, "seen_config": true, "seen_prices": true, "display_info": 0, "display_rows": 0, "last_seen_ms": 1485, "display_columns": 0}, "events": {"count": 9, "events": [{"ms": 290, "arg1": 1, "arg2": 0, "code": 1, "name": "BOOT"}, {"ms": 1387, "arg1": 0, "arg2": 0, "code": 50, "name": "MDB_RESET"}, {"ms": 1444, "arg1": 2, "arg2": 0, "code": 57, "name": "MDB_SETUP_CONFIG"}, {"ms": 1485, "arg1": 0, "arg2": 32767, "code": 58, "name": "MDB_SETUP_PRICES"}, {"ms": 2179, "arg1": -70, "arg2": 1560389824, "code": 10, "name": "WIFI_CONNECT_OK"}, {"ms": 2410, "arg1": 200, "arg2": 0, "code": 20, "name": "BACKEND_HEALTH_OK"}, {"ms": 2438, "arg1": 200, "arg2": 0, "code": 20, "name": "BACKEND_HEALTH_OK"}, {"ms": 2539, "arg1": 200, "arg2": 1200, "code": 22, "name": "BACKEND_REGISTER_OK"}, {"ms": 2910, "arg1": 2, "arg2": 1775358000, "code": 25, "name": "BACKEND_CARDS_OK"}], "capacity": 64}, "message": "Diagnostico generado desde la maquina", "price_cents": 1200, "backend_ready": true, "config_source": "backend", "queue_pending": 0, "captured_at_ms": 30056, "config_version": 3, "wifi_connected": true, "pricing_profile": "rubino_half_credit", "mdb_country_code": 50, "mdb_misc_options": 0, "mdb_scale_factor": 100, "mdb_feature_level": 1, "mdb_decimal_places": 2, "mdb_max_response_time": 5}
111	14	diagnostics_snapshot	{"limit": 20}	completed	2026-04-04 16:19:32.704576-03	2026-04-04 16:19:35.090721-03	2026-04-04 16:19:35.168202-03	{"mdb": {"raw": [1, 127, 255, 0, 0, 144, 0, 0], "last_len": 6, "max_price": 32767, "min_price": 0, "time_date": {"day": 0, "iso": "", "hour": 0, "year": 0, "month": 0, "valid": false, "minute": 0, "second": 0, "day_of_week": 0, "week_number": 0}, "vmc_level": 2, "last_subcmd": 1, "seen_config": true, "seen_prices": true, "display_info": 0, "display_rows": 0, "last_seen_ms": 15760, "expansion_raw": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], "seen_time_date": false, "display_columns": 0, "seen_request_id": false, "last_expansion_len": 0, "last_expansion_subcmd": 0, "last_expansion_seen_ms": 0}, "events": {"count": 13, "events": [{"ms": 285, "arg1": 0, "arg2": 0, "code": 1, "name": "BOOT"}, {"ms": 1673, "arg1": -68, "arg2": 1560389824, "code": 10, "name": "WIFI_CONNECT_OK"}, {"ms": 1874, "arg1": 200, "arg2": 0, "code": 20, "name": "BACKEND_HEALTH_OK"}, {"ms": 1933, "arg1": 200, "arg2": 0, "code": 20, "name": "BACKEND_HEALTH_OK"}, {"ms": 2090, "arg1": 200, "arg2": 1200, "code": 22, "name": "BACKEND_REGISTER_OK"}, {"ms": 2324, "arg1": 2, "arg2": 1775358000, "code": 25, "name": "BACKEND_CARDS_OK"}, {"ms": 15671, "arg1": 0, "arg2": 0, "code": 50, "name": "MDB_RESET"}, {"ms": 15719, "arg1": 2, "arg2": 0, "code": 57, "name": "MDB_SETUP_CONFIG"}, {"ms": 15760, "arg1": 0, "arg2": 32767, "code": 58, "name": "MDB_SETUP_PRICES"}, {"ms": 60042, "arg1": 200, "arg2": 0, "code": 20, "name": "BACKEND_HEALTH_OK"}, {"ms": 60226, "arg1": 200, "arg2": 1200, "code": 22, "name": "BACKEND_REGISTER_OK"}, {"ms": 120061, "arg1": 200, "arg2": 0, "code": 20, "name": "BACKEND_HEALTH_OK"}, {"ms": 120240, "arg1": 200, "arg2": 1200, "code": 22, "name": "BACKEND_REGISTER_OK"}], "capacity": 64}, "message": "Diagnostico generado desde la maquina", "price_cents": 1200, "clock_source": "ntp", "backend_ready": true, "config_source": "backend", "queue_pending": 0, "captured_at_ms": 150371, "config_version": 3, "wifi_connected": true, "pricing_profile": "rubino_half_credit", "mdb_country_code": 50, "mdb_misc_options": 0, "mdb_scale_factor": 100, "mdb_feature_level": 1, "mdb_decimal_places": 2, "mdb_max_response_time": 5}
112	14	diagnostics_snapshot	{"limit": 20}	completed	2026-04-04 16:22:45.367951-03	2026-04-04 16:22:50.246066-03	2026-04-04 16:22:50.343164-03	{"mdb": {"raw": [1, 127, 255, 0, 0, 144, 0, 0], "last_len": 6, "max_price": 32767, "min_price": 0, "time_date": {"day": 0, "iso": "", "hour": 0, "year": 0, "month": 0, "valid": false, "minute": 0, "second": 0, "day_of_week": 0, "week_number": 0}, "vmc_level": 2, "last_subcmd": 1, "seen_config": true, "seen_prices": true, "display_info": 0, "display_rows": 0, "last_seen_ms": 270666, "expansion_raw": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], "seen_time_date": false, "display_columns": 0, "seen_request_id": false, "last_expansion_len": 0, "last_expansion_subcmd": 0, "last_expansion_seen_ms": 0}, "events": {"count": 22, "events": [{"ms": 1874, "arg1": 200, "arg2": 0, "code": 20, "name": "BACKEND_HEALTH_OK"}, {"ms": 1933, "arg1": 200, "arg2": 0, "code": 20, "name": "BACKEND_HEALTH_OK"}, {"ms": 2090, "arg1": 200, "arg2": 1200, "code": 22, "name": "BACKEND_REGISTER_OK"}, {"ms": 2324, "arg1": 2, "arg2": 1775358000, "code": 25, "name": "BACKEND_CARDS_OK"}, {"ms": 15671, "arg1": 0, "arg2": 0, "code": 50, "name": "MDB_RESET"}, {"ms": 15719, "arg1": 2, "arg2": 0, "code": 57, "name": "MDB_SETUP_CONFIG"}, {"ms": 15760, "arg1": 0, "arg2": 32767, "code": 58, "name": "MDB_SETUP_PRICES"}, {"ms": 60042, "arg1": 200, "arg2": 0, "code": 20, "name": "BACKEND_HEALTH_OK"}, {"ms": 60226, "arg1": 200, "arg2": 1200, "code": 22, "name": "BACKEND_REGISTER_OK"}, {"ms": 120061, "arg1": 200, "arg2": 0, "code": 20, "name": "BACKEND_HEALTH_OK"}, {"ms": 120240, "arg1": 200, "arg2": 1200, "code": 22, "name": "BACKEND_REGISTER_OK"}, {"ms": 180089, "arg1": 200, "arg2": 0, "code": 20, "name": "BACKEND_HEALTH_OK"}, {"ms": 180243, "arg1": 200, "arg2": 1200, "code": 22, "name": "BACKEND_REGISTER_OK"}, {"ms": 240097, "arg1": 200, "arg2": 0, "code": 20, "name": "BACKEND_HEALTH_OK"}, {"ms": 240252, "arg1": 200, "arg2": 1200, "code": 22, "name": "BACKEND_REGISTER_OK"}, {"ms": 270566, "arg1": 0, "arg2": 0, "code": 50, "name": "MDB_RESET"}, {"ms": 270625, "arg1": 2, "arg2": 0, "code": 57, "name": "MDB_SETUP_CONFIG"}, {"ms": 270666, "arg1": 0, "arg2": 32767, "code": 58, "name": "MDB_SETUP_PRICES"}, {"ms": 300100, "arg1": 200, "arg2": 0, "code": 20, "name": "BACKEND_HEALTH_OK"}, {"ms": 300255, "arg1": 200, "arg2": 1200, "code": 22, "name": "BACKEND_REGISTER_OK"}], "capacity": 64}, "message": "Diagnostico generado desde la maquina", "price_cents": 1200, "clock_source": "ntp", "backend_ready": true, "config_source": "backend", "queue_pending": 0, "captured_at_ms": 345529, "config_version": 3, "wifi_connected": true, "pricing_profile": "rubino_half_credit", "mdb_country_code": 50, "mdb_misc_options": 0, "mdb_scale_factor": 100, "mdb_feature_level": 1, "mdb_decimal_places": 2, "mdb_max_response_time": 5}
113	14	diagnostics_snapshot	{"limit": 20}	completed	2026-04-04 17:12:36.697967-03	2026-04-04 17:12:41.221375-03	2026-04-04 17:12:41.276952-03	{"mdb": {"raw": [1, 127, 255, 0, 0, 144, 0, 0], "gateway": {"raw": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], "last_cmd": 0, "last_len": 0, "time_date": {"day": 0, "iso": "", "hour": 0, "year": 0, "month": 0, "valid": false, "minute": 0, "second": 0}, "seen_setup": false, "seen_report": false, "last_seen_ms": 0, "seen_control": false, "control_state": 0, "gateway_enabled": false, "last_control_ms": 0, "enabled_features": 0, "vmc_scale_factor": 0, "vmc_feature_level": 0, "vmc_decimal_places": 0, "seen_feature_enable": false, "seen_identification": false, "gateway_feature_level": 0, "seen_time_date_request": false, "app_max_response_seconds": 0, "last_time_date_response_ms": 0}, "last_len": 6, "max_price": 32767, "min_price": 0, "time_date": {"day": 0, "iso": "", "hour": 0, "year": 0, "month": 0, "valid": false, "minute": 0, "second": 0, "day_of_week": 0, "week_number": 0}, "vmc_level": 2, "last_subcmd": 1, "seen_config": true, "seen_prices": true, "display_info": 0, "display_rows": 0, "last_seen_ms": 1484, "expansion_raw": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], "seen_time_date": false, "display_columns": 0, "seen_request_id": false, "last_expansion_len": 0, "last_expansion_subcmd": 0, "last_expansion_seen_ms": 0, "time_date_probe_pending": false, "time_date_probe_requested_at_ms": 0}, "events": {"count": 9, "events": [{"ms": 285, "arg1": 3, "arg2": 0, "code": 1, "name": "BOOT"}, {"ms": 1386, "arg1": 0, "arg2": 0, "code": 50, "name": "MDB_RESET"}, {"ms": 1443, "arg1": 2, "arg2": 0, "code": 57, "name": "MDB_SETUP_CONFIG"}, {"ms": 1484, "arg1": 0, "arg2": 32767, "code": 58, "name": "MDB_SETUP_PRICES"}, {"ms": 1568, "arg1": -68, "arg2": 1560389824, "code": 10, "name": "WIFI_CONNECT_OK"}, {"ms": 2313, "arg1": 200, "arg2": 0, "code": 20, "name": "BACKEND_HEALTH_OK"}, {"ms": 2629, "arg1": 200, "arg2": 0, "code": 20, "name": "BACKEND_HEALTH_OK"}, {"ms": 3423, "arg1": 200, "arg2": 1200, "code": 22, "name": "BACKEND_REGISTER_OK"}, {"ms": 4538, "arg1": 2, "arg2": 1775358000, "code": 25, "name": "BACKEND_CARDS_OK"}], "capacity": 64}, "gateway": {"raw": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], "last_cmd": 0, "last_len": 0, "time_date": {"day": 0, "iso": "", "hour": 0, "year": 0, "month": 0, "valid": false, "minute": 0, "second": 0}, "seen_setup": false, "seen_report": false, "last_seen_ms": 0, "seen_control": false, "control_state": 0, "gateway_enabled": false, "last_control_ms": 0, "enabled_features": 0, "vmc_scale_factor": 0, "vmc_feature_level": 0, "vmc_decimal_places": 0, "seen_feature_enable": false, "seen_identification": false, "gateway_feature_level": 0, "seen_time_date_request": false, "app_max_response_seconds": 0, "last_time_date_response_ms": 0}, "message": "Diagnostico generado desde la maquina", "price_cents": 1200, "clock_source": "ntp", "backend_ready": true, "config_source": "backend", "queue_pending": 0, "captured_at_ms": 15059, "config_version": 5, "wifi_connected": true, "pricing_profile": "rubino_half_credit", "mdb_country_code": 50, "mdb_misc_options": 0, "mdb_scale_factor": 100, "mdb_feature_level": 1, "mdb_decimal_places": 2, "mdb_max_response_time": 5, "mdb_time_date_probe_pending": false, "mdb_time_date_probe_requested_at_ms": 0}
114	14	diagnostics_snapshot	{"limit": 20}	completed	2026-04-04 17:19:26.1703-03	2026-04-04 17:19:29.296861-03	2026-04-04 17:19:29.357122-03	{"mdb": {"raw": [1, 127, 255, 0, 0, 144, 0, 0], "gateway": {"raw": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], "last_cmd": 0, "last_len": 0, "time_date": {"day": 0, "iso": "", "hour": 0, "year": 0, "month": 0, "valid": false, "minute": 0, "second": 0}, "seen_setup": false, "seen_report": false, "last_seen_ms": 0, "seen_control": false, "control_state": 0, "gateway_enabled": false, "last_control_ms": 0, "enabled_features": 0, "vmc_scale_factor": 0, "vmc_feature_level": 0, "vmc_decimal_places": 0, "seen_feature_enable": false, "seen_identification": false, "gateway_feature_level": 0, "seen_time_date_request": false, "app_max_response_seconds": 0, "last_time_date_response_ms": 0}, "last_len": 6, "max_price": 32767, "min_price": 0, "time_date": {"day": 0, "iso": "", "hour": 0, "year": 0, "month": 0, "valid": false, "minute": 0, "second": 0, "day_of_week": 0, "week_number": 0}, "vmc_level": 2, "last_subcmd": 1, "seen_config": true, "seen_prices": true, "display_info": 0, "display_rows": 0, "last_seen_ms": 1484, "expansion_raw": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], "seen_time_date": false, "display_columns": 0, "seen_request_id": false, "last_expansion_len": 0, "last_expansion_subcmd": 0, "last_expansion_seen_ms": 0, "time_date_probe_pending": false, "time_date_probe_requested_at_ms": 0}, "events": {"count": 29, "events": [{"ms": 60083, "arg1": 200, "arg2": 0, "code": 20, "name": "BACKEND_HEALTH_OK"}, {"ms": 60258, "arg1": 200, "arg2": 1200, "code": 22, "name": "BACKEND_REGISTER_OK"}, {"ms": 120077, "arg1": 200, "arg2": 0, "code": 20, "name": "BACKEND_HEALTH_OK"}, {"ms": 120297, "arg1": 200, "arg2": 1200, "code": 22, "name": "BACKEND_REGISTER_OK"}, {"ms": 180088, "arg1": 200, "arg2": 0, "code": 20, "name": "BACKEND_HEALTH_OK"}, {"ms": 180279, "arg1": 200, "arg2": 1200, "code": 22, "name": "BACKEND_REGISTER_OK"}, {"ms": 240149, "arg1": 200, "arg2": 0, "code": 20, "name": "BACKEND_HEALTH_OK"}, {"ms": 240388, "arg1": 200, "arg2": 1200, "code": 22, "name": "BACKEND_REGISTER_OK"}, {"ms": 300119, "arg1": 200, "arg2": 0, "code": 20, "name": "BACKEND_HEALTH_OK"}, {"ms": 300290, "arg1": 200, "arg2": 1200, "code": 22, "name": "BACKEND_REGISTER_OK"}, {"ms": 360164, "arg1": 200, "arg2": 0, "code": 20, "name": "BACKEND_HEALTH_OK"}, {"ms": 360294, "arg1": 200, "arg2": 1200, "code": 22, "name": "BACKEND_REGISTER_OK"}, {"ms": 362254, "arg1": 0, "arg2": 27371, "code": 30, "name": "NFC_READ"}, {"ms": 362554, "arg1": 200, "arg2": 0, "code": 31, "name": "NFC_APPROVED_ONLINE"}, {"ms": 362568, "arg1": 3, "arg2": 600, "code": 51, "name": "MDB_BEGIN_SESSION"}, {"ms": 367259, "arg1": 7, "arg2": 600, "code": 52, "name": "MDB_VEND_REQUEST"}, {"ms": 367493, "arg1": 7, "arg2": 600, "code": 53, "name": "MDB_VEND_SUCCESS"}, {"ms": 367706, "arg1": 7, "arg2": 600, "code": 55, "name": "MDB_VEND_END"}, {"ms": 420157, "arg1": 200, "arg2": 0, "code": 20, "name": "BACKEND_HEALTH_OK"}, {"ms": 420296, "arg1": 200, "arg2": 1200, "code": 22, "name": "BACKEND_REGISTER_OK"}], "capacity": 64}, "gateway": {"raw": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], "last_cmd": 0, "last_len": 0, "time_date": {"day": 0, "iso": "", "hour": 0, "year": 0, "month": 0, "valid": false, "minute": 0, "second": 0}, "seen_setup": false, "seen_report": false, "last_seen_ms": 0, "seen_control": false, "control_state": 0, "gateway_enabled": false, "last_control_ms": 0, "enabled_features": 0, "vmc_scale_factor": 0, "vmc_feature_level": 0, "vmc_decimal_places": 0, "seen_feature_enable": false, "seen_identification": false, "gateway_feature_level": 0, "seen_time_date_request": false, "app_max_response_seconds": 0, "last_time_date_response_ms": 0}, "message": "Diagnostico generado desde la maquina", "price_cents": 1200, "clock_source": "ntp", "backend_ready": true, "config_source": "backend", "queue_pending": 0, "captured_at_ms": 423138, "config_version": 5, "wifi_connected": true, "pricing_profile": "rubino_half_credit", "mdb_country_code": 50, "mdb_misc_options": 0, "mdb_scale_factor": 100, "mdb_feature_level": 1, "mdb_decimal_places": 2, "mdb_max_response_time": 5, "mdb_time_date_probe_pending": false, "mdb_time_date_probe_requested_at_ms": 0}
120	14	diagnostics_snapshot	{"limit": 20}	completed	2026-04-04 17:33:25.768593-03	2026-04-04 17:33:29.990185-03	2026-04-04 17:33:30.098572-03	{"mdb": {"raw": [1, 127, 255, 0, 0, 144, 0, 0], "gateway": {"raw": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], "last_cmd": 0, "last_len": 0, "time_date": {"day": 0, "iso": "", "hour": 0, "year": 0, "month": 0, "valid": false, "minute": 0, "second": 0}, "seen_setup": false, "seen_report": false, "last_seen_ms": 0, "seen_control": false, "control_state": 0, "gateway_enabled": false, "last_control_ms": 0, "enabled_features": 0, "vmc_scale_factor": 0, "vmc_feature_level": 0, "vmc_decimal_places": 0, "seen_feature_enable": false, "seen_identification": false, "gateway_feature_level": 0, "seen_time_date_request": false, "app_max_response_seconds": 0, "last_time_date_response_ms": 0}, "last_len": 6, "max_price": 32767, "min_price": 0, "time_date": {"day": 0, "iso": "", "hour": 0, "year": 0, "month": 0, "valid": false, "minute": 0, "second": 0, "day_of_week": 0, "week_number": 0}, "vmc_level": 2, "last_subcmd": 1, "seen_config": true, "seen_prices": true, "display_info": 0, "display_rows": 0, "last_seen_ms": 1241261, "expansion_raw": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], "seen_time_date": false, "display_columns": 0, "seen_request_id": false, "last_expansion_len": 0, "last_expansion_subcmd": 0, "last_expansion_seen_ms": 0, "time_date_probe_pending": false, "time_date_probe_requested_at_ms": 0}, "events": {"count": 62, "events": [{"ms": 840305, "arg1": 200, "arg2": 0, "code": 20, "name": "BACKEND_HEALTH_OK"}, {"ms": 840459, "arg1": 200, "arg2": 1200, "code": 22, "name": "BACKEND_REGISTER_OK"}, {"ms": 900297, "arg1": 200, "arg2": 0, "code": 20, "name": "BACKEND_HEALTH_OK"}, {"ms": 900470, "arg1": 200, "arg2": 1200, "code": 22, "name": "BACKEND_REGISTER_OK"}, {"ms": 960330, "arg1": 200, "arg2": 0, "code": 20, "name": "BACKEND_HEALTH_OK"}, {"ms": 960534, "arg1": 200, "arg2": 1200, "code": 22, "name": "BACKEND_REGISTER_OK"}, {"ms": 1020342, "arg1": 200, "arg2": 0, "code": 20, "name": "BACKEND_HEALTH_OK"}, {"ms": 1020486, "arg1": 200, "arg2": 1200, "code": 22, "name": "BACKEND_REGISTER_OK"}, {"ms": 1080363, "arg1": 200, "arg2": 0, "code": 20, "name": "BACKEND_HEALTH_OK"}, {"ms": 1080516, "arg1": 200, "arg2": 1200, "code": 22, "name": "BACKEND_REGISTER_OK"}, {"ms": 1140365, "arg1": 200, "arg2": 0, "code": 20, "name": "BACKEND_HEALTH_OK"}, {"ms": 1140507, "arg1": 200, "arg2": 1200, "code": 22, "name": "BACKEND_REGISTER_OK"}, {"ms": 1200148, "arg1": 2, "arg2": 1775358000, "code": 25, "name": "BACKEND_CARDS_OK"}, {"ms": 1200399, "arg1": 200, "arg2": 0, "code": 20, "name": "BACKEND_HEALTH_OK"}, {"ms": 1200604, "arg1": 200, "arg2": 1200, "code": 22, "name": "BACKEND_REGISTER_OK"}, {"ms": 1241163, "arg1": 0, "arg2": 0, "code": 50, "name": "MDB_RESET"}, {"ms": 1241220, "arg1": 2, "arg2": 0, "code": 57, "name": "MDB_SETUP_CONFIG"}, {"ms": 1241261, "arg1": 0, "arg2": 32767, "code": 58, "name": "MDB_SETUP_PRICES"}, {"ms": 1260412, "arg1": 200, "arg2": 0, "code": 20, "name": "BACKEND_HEALTH_OK"}, {"ms": 1260525, "arg1": 200, "arg2": 1200, "code": 22, "name": "BACKEND_REGISTER_OK"}], "capacity": 64}, "gateway": {"raw": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], "last_cmd": 0, "last_len": 0, "time_date": {"day": 0, "iso": "", "hour": 0, "year": 0, "month": 0, "valid": false, "minute": 0, "second": 0}, "seen_setup": false, "seen_report": false, "last_seen_ms": 0, "seen_control": false, "control_state": 0, "gateway_enabled": false, "last_control_ms": 0, "enabled_features": 0, "vmc_scale_factor": 0, "vmc_feature_level": 0, "vmc_decimal_places": 0, "seen_feature_enable": false, "seen_identification": false, "gateway_feature_level": 0, "seen_time_date_request": false, "app_max_response_seconds": 0, "last_time_date_response_ms": 0}, "message": "Diagnostico generado desde la maquina", "price_cents": 1200, "clock_source": "ntp", "backend_ready": true, "config_source": "backend", "queue_pending": 0, "captured_at_ms": 1263841, "config_version": 5, "wifi_connected": true, "pricing_profile": "rubino_half_credit", "mdb_country_code": 50, "mdb_misc_options": 0, "mdb_scale_factor": 100, "mdb_feature_level": 1, "mdb_decimal_places": 2, "mdb_max_response_time": 5, "mdb_time_date_probe_pending": false, "mdb_time_date_probe_requested_at_ms": 0}
140	14	diagnostics_snapshot	{"limit": 20}	completed	2026-04-07 21:50:29.172847-03	2026-04-07 21:54:38.303039-03	2026-04-07 21:54:38.53486-03	{"mdb": {"raw": [0, 0, 0, 0, 0, 0, 0, 0], "gateway": {"raw": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], "last_cmd": 0, "last_len": 0, "time_date": {"day": 0, "iso": "", "hour": 0, "year": 0, "month": 0, "valid": false, "minute": 0, "second": 0}, "seen_setup": false, "seen_report": false, "last_seen_ms": 0, "seen_control": false, "control_state": 0, "gateway_enabled": false, "last_control_ms": 0, "enabled_features": 0, "vmc_scale_factor": 0, "vmc_feature_level": 0, "vmc_decimal_places": 0, "seen_feature_enable": false, "seen_identification": false, "gateway_feature_level": 0, "seen_time_date_request": false, "app_max_response_seconds": 0, "last_time_date_response_ms": 0}, "last_len": 0, "max_price": 0, "min_price": 0, "time_date": {"day": 0, "iso": "", "hour": 0, "year": 0, "month": 0, "valid": false, "minute": 0, "second": 0, "day_of_week": 0, "week_number": 0}, "vmc_level": 0, "last_subcmd": 0, "seen_config": false, "seen_prices": false, "display_info": 0, "display_rows": 0, "last_seen_ms": 0, "expansion_raw": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], "seen_time_date": false, "display_columns": 0, "seen_request_id": false, "last_expansion_len": 0, "last_expansion_subcmd": 0, "last_expansion_seen_ms": 0, "time_date_probe_pending": false, "time_date_probe_requested_at_ms": 0}, "events": {"count": 64, "events": [{"ms": 12178, "arg1": 0, "arg2": 0, "code": 50, "name": "MDB_RESET"}, {"ms": 12311, "arg1": 0, "arg2": 0, "code": 50, "name": "MDB_RESET"}, {"ms": 12445, "arg1": 0, "arg2": 0, "code": 50, "name": "MDB_RESET"}, {"ms": 12578, "arg1": 0, "arg2": 0, "code": 50, "name": "MDB_RESET"}, {"ms": 12712, "arg1": 0, "arg2": 0, "code": 50, "name": "MDB_RESET"}, {"ms": 12845, "arg1": 0, "arg2": 0, "code": 50, "name": "MDB_RESET"}, {"ms": 12979, "arg1": 0, "arg2": 0, "code": 50, "name": "MDB_RESET"}, {"ms": 13113, "arg1": 0, "arg2": 0, "code": 50, "name": "MDB_RESET"}, {"ms": 13246, "arg1": 0, "arg2": 0, "code": 50, "name": "MDB_RESET"}, {"ms": 13339, "arg1": 0, "arg2": 0, "code": 50, "name": "MDB_RESET"}, {"ms": 13483, "arg1": 0, "arg2": 0, "code": 50, "name": "MDB_RESET"}, {"ms": 13616, "arg1": 0, "arg2": 0, "code": 50, "name": "MDB_RESET"}, {"ms": 13801, "arg1": 0, "arg2": 0, "code": 50, "name": "MDB_RESET"}, {"ms": 13976, "arg1": 0, "arg2": 0, "code": 50, "name": "MDB_RESET"}, {"ms": 14150, "arg1": 0, "arg2": 0, "code": 50, "name": "MDB_RESET"}, {"ms": 14325, "arg1": 0, "arg2": 0, "code": 50, "name": "MDB_RESET"}, {"ms": 14500, "arg1": 0, "arg2": 0, "code": 50, "name": "MDB_RESET"}, {"ms": 14674, "arg1": 0, "arg2": 0, "code": 50, "name": "MDB_RESET"}, {"ms": 14849, "arg1": 0, "arg2": 0, "code": 50, "name": "MDB_RESET"}, {"ms": 15024, "arg1": 0, "arg2": 0, "code": 50, "name": "MDB_RESET"}], "capacity": 64}, "gateway": {"raw": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], "last_cmd": 0, "last_len": 0, "time_date": {"day": 0, "iso": "", "hour": 0, "year": 0, "month": 0, "valid": false, "minute": 0, "second": 0}, "seen_setup": false, "seen_report": false, "last_seen_ms": 0, "seen_control": false, "control_state": 0, "gateway_enabled": false, "last_control_ms": 0, "enabled_features": 0, "vmc_scale_factor": 0, "vmc_feature_level": 0, "vmc_decimal_places": 0, "seen_feature_enable": false, "seen_identification": false, "gateway_feature_level": 0, "seen_time_date_request": false, "app_max_response_seconds": 0, "last_time_date_response_ms": 0}, "message": "Diagnostico generado desde la maquina", "price_cents": 1200, "clock_source": "ntp", "backend_ready": true, "config_source": "backend", "queue_pending": 0, "captured_at_ms": 15063, "config_version": 7, "wifi_connected": true, "pricing_profile": "rubino_half_credit", "firmware_version": "3.1.0", "mdb_country_code": 50, "mdb_misc_options": 0, "mdb_scale_factor": 100, "mdb_feature_level": 1, "mdb_decimal_places": 2, "mdb_max_response_time": 5, "mdb_time_date_probe_pending": false, "mdb_time_date_probe_requested_at_ms": 0}
\.


--
-- Data for Name: machine_stock_items; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.machine_stock_items (id, machine_id, item_id, product_name, slot_label, capacity_units, current_units, min_units, active, created_at, updated_at) FROM stdin;
3	13	0	Cafe	\N	400	500	40	t	2026-03-25 15:52:46.599813-03	2026-03-27 17:15:58.910586-03
\.


--
-- Data for Name: machines; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.machines (id, name, location, secret, active, created_at, blocked, blocked_reason, last_seen, mac, wifi_ssid, backend_url, wifi_rssi, wifi_ip, backend_ok, backend_error, price_cents, pricing_profile, mdb_feature_level, mdb_country_code, mdb_scale_factor, mdb_decimal_places, mdb_max_response_time, mdb_misc_options, technical_config_version, technical_config_source, technical_config_updated_at, last_reported_technical_config, last_reported_technical_config_at, current_firmware_version, desired_firmware_release_id, desired_firmware_version, firmware_update_status, firmware_update_message, firmware_update_started_at, firmware_update_completed_at) FROM stdin;
14	ESP32C3	Piso 1	10003BAF883C	t	2026-03-23 19:10:45.469377-03	f	\N	2026-04-07 22:17:09.159032-03	10003BAF883C	Tiziana	http://192.168.1.76:3000	-74	192.168.1.93	t	\N	1200	rubino_half_credit	1	50	100	2	5	0	7	backend	2026-04-07 21:06:48.711883-03	{"price_cents": 1200, "config_source": "backend", "config_version": 7, "pricing_profile": "rubino_half_credit", "mdb_country_code": 50, "mdb_misc_options": 0, "mdb_scale_factor": 100, "config_updated_at": "2026-04-08T00:06:48.711Z", "mdb_feature_level": 1, "mdb_decimal_places": 2, "mdb_max_response_time": 5}	2026-04-07 22:16:23.771697-03	3.1.0	4	3.1.1	success	Firmware 3.1.1 activo	2026-04-07 19:37:37.213568-03	2026-04-07 21:39:56.579155-03
4	Máquina D	Tercer piso	cc-secret-4	f	2026-03-22 20:24:34.632133-03	t	no la tengo mas	\N	\N	\N	\N	\N	\N	\N	\N	1200	rubino_half_credit	1	50	100	2	5	0	1	backend	2026-04-04 13:43:27.296769-03	\N	\N	\N	\N	\N	idle	\N	\N	\N
3	Máquina C	Segundo piso	cc-secret-3	f	2026-03-22 20:24:34.632133-03	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	1200	rubino_half_credit	1	50	100	2	5	0	1	backend	2026-04-04 13:43:27.296769-03	\N	\N	\N	\N	\N	idle	\N	\N	\N
1	Máquina A	Planta baja	cc-secret-1	f	2026-03-22 20:24:34.632133-03	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	1200	rubino_half_credit	1	50	100	2	5	0	1	backend	2026-04-04 13:43:27.296769-03	\N	\N	\N	\N	\N	idle	\N	\N	\N
2	Máquina B	Primer piso	cc-secret-2	f	2026-03-22 20:24:34.632133-03	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	1200	rubino_half_credit	1	50	100	2	5	0	1	backend	2026-04-04 13:43:27.296769-03	\N	\N	\N	\N	\N	idle	\N	\N	\N
13	TEST	Casa	A020A61793EE	t	2026-03-23 11:56:15.302433-03	f	\N	2026-03-23 13:09:43.534388-03	A020A61793EE	\N	\N	\N	\N	\N	\N	1200	rubino_half_credit	1	50	100	2	5	0	1	backend	2026-04-04 13:43:27.296769-03	\N	\N	\N	\N	\N	idle	\N	\N	\N
\.


--
-- Data for Name: mobile_sessions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.mobile_sessions (id, admin_user_id, device_name, platform, user_agent, refresh_token_hash, last_used_at, expires_at, revoked_at, created_at) FROM stdin;
5	43	Pixel QA	android	node	52e193f48e03474ef6125e6d07294c67c30eeb990468179e3ab4ada49e2fef24	2026-03-27 13:18:30.001619-03	2026-05-11 13:18:30.001619-03	\N	2026-03-27 13:18:30.001619-03
6	43	Pixel QA	android	node	a97f4be93ea51a4c8dbda8443676441dd2ce17203e3d8f008b9b387aeec659b3	2026-03-27 14:10:02.78241-03	2026-05-11 14:10:02.78241-03	\N	2026-03-27 14:10:02.78241-03
7	43	codex-check	android	Mozilla/5.0 (Windows NT 10.0; Microsoft Windows 10.0.26200; es-AR) PowerShell/7.5.5	e7d57da3ca1cb1b5896877d32352a4f5743861ee2f4ecdedf3b221a8c49e29b8	2026-03-27 14:27:42.175963-03	2026-05-11 14:27:42.175963-03	\N	2026-03-27 14:27:42.175963-03
8	43	codex-check	android	Mozilla/5.0 (Windows NT 10.0; Microsoft Windows 10.0.26200; es-AR) PowerShell/7.5.5	ff3f74eba6b2916e35314a0b058fc1ac98a2985a322e3b8b0979c6a34393b497	2026-03-27 14:27:57.802907-03	2026-05-11 14:27:57.802907-03	\N	2026-03-27 14:27:57.802907-03
9	43	codex-check	android	Mozilla/5.0 (Windows NT 10.0; Microsoft Windows 10.0.26200; es-AR) PowerShell/7.5.5	2cc096d349fa928e53eb27eb24bf1757ad14ea343d27ff4d2505c2a723d05559	2026-03-27 14:27:57.938753-03	2026-05-11 14:27:57.938753-03	\N	2026-03-27 14:27:57.938753-03
10	43	codex-check	android	Mozilla/5.0 (Windows NT 10.0; Microsoft Windows 10.0.26200; es-AR) PowerShell/7.5.5	815ad6f02fcdc0117d92c2e680d5fd1780f40d962bdfdf786bb30d315dbca2e0	2026-03-27 14:27:58.015254-03	2026-05-11 14:27:58.015254-03	\N	2026-03-27 14:27:58.015254-03
11	43	codex-check	android	Mozilla/5.0 (Windows NT 10.0; Microsoft Windows 10.0.26200; es-AR) PowerShell/7.5.5	3523eafad4032f9f626885147617f6a67dab39b52ea20194f3579ff563f49329	2026-03-27 14:27:58.11775-03	2026-05-11 14:27:58.11775-03	\N	2026-03-27 14:27:58.11775-03
12	43	codex-check	android	Mozilla/5.0 (Windows NT 10.0; Microsoft Windows 10.0.26200; es-AR) PowerShell/7.5.5	eae3344056cec81355007e89b1ff8cc83443d625c4dd7a3011cdaae5647cec0d	2026-03-27 14:28:12.045501-03	2026-05-11 14:28:12.045501-03	\N	2026-03-27 14:28:12.045501-03
13	43	codex-check	android	Mozilla/5.0 (Windows NT 10.0; Microsoft Windows 10.0.26200; es-AR) PowerShell/7.5.5	b7acbf6ee238b3f604c8c12f107f5f4e1f60c99fd75cccf8a4563ef3cca855d0	2026-03-27 14:34:57.207781-03	2026-05-11 14:34:57.207781-03	\N	2026-03-27 14:34:57.207781-03
14	43	motorola edge 30 pro	android	okhttp/5.3.0	186314bc4e191db045cb1164f5a25c785ffee8c0803d0807c9bf5d6a48896a33	2026-03-27 16:19:40.517587-03	2026-05-11 16:19:40.517587-03	\N	2026-03-27 16:19:40.517587-03
15	43	codex-check	android	Mozilla/5.0 (Windows NT 10.0; Microsoft Windows 10.0.26200; es-AR) PowerShell/7.5.5	4132905d9a98169408ecf1c056456d40154f130b1ea08b1ad1fdac3284fe654d	2026-03-27 16:26:46.600046-03	2026-05-11 16:26:46.600046-03	\N	2026-03-27 16:26:46.600046-03
16	1	codex-check	android	Mozilla/5.0 (Windows NT 10.0; Microsoft Windows 10.0.26200; es-AR) PowerShell/7.5.5	51c79194b00345558aae726a1da011eb6634fceb8a9c033cb9161637861f24fd	2026-03-27 16:27:03.317354-03	2026-05-11 16:27:03.317354-03	\N	2026-03-27 16:27:03.317354-03
17	1	codex-check	android	Mozilla/5.0 (Windows NT 10.0; Microsoft Windows 10.0.26200; es-AR) PowerShell/7.5.5	27a6c69e197913c1aebdd228e5ac2bfa75274ac6c98445bc68b5f83d6062a7d5	2026-03-27 16:27:03.4998-03	2026-05-11 16:27:03.4998-03	\N	2026-03-27 16:27:03.4998-03
18	43	Codex QA	android	Mozilla/5.0 (Windows NT 10.0; Microsoft Windows 10.0.26200; es-AR) PowerShell/7.5.5	7cbb872713ccc525551531bdbc1fb1cc3be4117dd6846bbab3fcea9e5a264f73	2026-03-27 16:38:13.496146-03	2026-05-11 16:38:13.496146-03	\N	2026-03-27 16:38:13.496146-03
19	1	Codex QA	android	Mozilla/5.0 (Windows NT 10.0; Microsoft Windows 10.0.26200; es-AR) PowerShell/7.5.5	09603ca1475126799a47e21899f43b5b273c77336a009acbee725aa8d1a06e2e	2026-03-27 16:38:31.202635-03	2026-05-11 16:38:31.202635-03	\N	2026-03-27 16:38:31.202635-03
20	43	Codex QA	android	Mozilla/5.0 (Windows NT 10.0; Microsoft Windows 10.0.26200; es-AR) PowerShell/7.5.5	560a52ac64608a877cd903627980a8f36fb8df73da05212aebb26a3c9abffa6f	2026-03-27 16:38:31.351665-03	2026-05-11 16:38:31.351665-03	\N	2026-03-27 16:38:31.351665-03
21	43	Codex QA	android	Mozilla/5.0 (Windows NT 10.0; Microsoft Windows 10.0.26200; es-AR) PowerShell/7.5.5	35f290f7cbadbae671ca9794a68cb5caa9cfde102eed868b11112515a68d06cf	2026-03-27 16:38:40.476379-03	2026-05-11 16:38:40.476379-03	\N	2026-03-27 16:38:40.476379-03
35	43	motorola edge 30 pro	android	okhttp/5.3.0	f63f90c2d4319611f444691c646001572daf590d02fda5bd99df4c22ac8ae698	2026-04-03 16:08:09.606843-03	2026-05-18 16:07:58.547002-03	2026-04-03 16:08:09.606843-03	2026-03-28 08:34:09.790669-03
24	43	motorola edge 30 pro	android	okhttp/5.3.0	da2532cbb1f3f7af3015ad50b565205244ac50231cb76785ebcf61f240bf5348	2026-03-27 18:28:40.017229-03	2026-05-11 18:27:50.885161-03	2026-03-27 18:28:40.017229-03	2026-03-27 18:27:50.885161-03
25	43	motorola edge 30 pro	android	okhttp/5.3.0	6eeb4a927472da8ae153fa2b702dde601e3e77cffb388c661989fac16776b23a	2026-03-27 18:47:20.628298-03	2026-05-11 18:28:50.679268-03	2026-03-27 18:47:20.628298-03	2026-03-27 18:28:50.679268-03
26	43	motorola edge 30 pro	android	okhttp/5.3.0	e286fcb288a22fb24d8f5a72bd3ba65aaf54775e39c1a1a18d8be8d0d5989603	2026-03-27 18:50:22.571654-03	2026-05-11 18:48:35.59711-03	2026-03-27 18:50:22.571654-03	2026-03-27 18:48:35.59711-03
27	43	motorola edge 30 pro	android	okhttp/5.3.0	05788a943d4395c8117f7755bc05bfaa713fb210b48ce65a0ac4dd3eea674116	2026-03-27 20:33:07.864031-03	2026-05-11 18:50:42.50604-03	2026-03-27 20:33:07.864031-03	2026-03-27 18:50:42.50604-03
32	43	motorola edge 30 pro	android	okhttp/5.3.0	8e22bdb0e3c2f7b537527fd5c18c859c245707aea24876ff884a35096612829b	2026-03-28 08:33:49.046766-03	2026-05-12 08:33:42.925469-03	2026-03-28 08:33:49.046766-03	2026-03-27 22:24:25.839297-03
\.


--
-- Data for Name: nfc_cards; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.nfc_cards (id, uid, employee_id, label, active, created_at, status) FROM stdin;
12	0A30FC80	11	Llavero	t	2026-03-23 12:30:02.331101-03	active
13	6AEBB01A	12	Tarjeta	t	2026-03-23 12:30:53.002654-03	active
5	E5F6A7B8	5	Tarjeta principal	f	2026-03-22 20:24:34.637826-03	inactive
3	C3D4E5F6	3	Tarjeta principal	f	2026-03-22 20:24:34.637826-03	inactive
4	D4E5F6A7	4	Tarjeta principal	f	2026-03-22 20:24:34.637826-03	inactive
7	A7B8C9D0	7	Tarjeta principal	f	2026-03-22 20:24:34.637826-03	inactive
6	F6A7B8C9	6	Tarjeta principal	f	2026-03-22 20:24:34.637826-03	inactive
8	B8C9D0E1	8	Tarjeta principal	f	2026-03-22 20:24:34.637826-03	inactive
1	A1B2C3D4	1	Tarjeta principal	f	2026-03-22 20:24:34.637826-03	inactive
2	B2C3D4E5	2	Tarjeta principal	f	2026-03-22 20:24:34.637826-03	inactive
17	AUD24232131	18	Tarjeta auditoria	f	2026-03-24 20:21:31.754412-03	inactive
18	AUD24232201	19	Tarjeta auditoria	f	2026-03-24 20:22:01.474898-03	inactive
\.


--
-- Data for Name: notification_settings; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.notification_settings (id, enabled, recipient_emails, notify_employee_daily_blocked, notify_machine_offline, notify_machine_backend_down, created_at, updated_at, notify_employee_limit_warning, employee_limit_warning_lead, notify_stock_low) FROM stdin;
1	t	mscaramuzzino@ieasrl.com.ar	f	f	f	2026-03-24 16:30:15.551-03	2026-04-07 22:19:10.856637-03	f	1	f
\.


--
-- Data for Name: pending_machines; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.pending_machines (id, mac, first_seen, last_ping, approved) FROM stdin;
2	A020A61793EE	2026-03-23 11:47:43.527819-03	2026-03-23 11:55:43.208658-03	t
3	10003BAF883C	2026-03-23 19:09:47.524047-03	2026-03-23 19:09:47.524047-03	t
\.


--
-- Data for Name: schema_migrations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.schema_migrations (version, filename, applied_at) FROM stdin;
2	migration_v2.sql	2026-03-25 14:35:17.817531-03
3	migration_v3.sql	2026-03-25 14:35:17.819481-03
4	migration_v4.sql	2026-03-25 14:35:17.820096-03
5	migration_v5.sql	2026-03-25 14:35:17.820775-03
6	migration_v6.sql	2026-03-25 14:35:17.8214-03
7	migration_v7.sql	2026-03-25 14:35:17.822063-03
8	migration_v8.sql	2026-03-25 14:35:17.822966-03
9	migration_v9.sql	2026-03-25 14:35:17.823655-03
10	migration_v10.sql	2026-03-25 14:35:17.824198-03
11	migration_v11.sql	2026-03-25 14:35:17.824679-03
12	migration_v12.sql	2026-03-25 14:35:17.825122-03
13	migration_v13.sql	2026-03-25 14:35:17.825552-03
14	migration_v14.sql	2026-03-25 14:35:17.82599-03
15	migration_v15.sql	2026-03-25 14:35:17.826595-03
16	migration_v16.sql	2026-03-25 14:35:17.827114-03
17	migration_v17.sql	2026-03-25 14:35:17.827533-03
18	migration_v18.sql	2026-03-25 15:40:12.692468-03
19	migration_v19.sql	2026-03-25 16:00:37.073397-03
20	migration_v20.sql	2026-03-25 16:44:52.094439-03
21	migration_v21.sql	2026-03-26 12:33:21.957878-03
22	migration_v22.sql	2026-03-26 18:03:29.264785-03
23	migration_v23.sql	2026-03-26 18:22:03.112665-03
24	migration_v24.sql	2026-03-27 13:16:26.945764-03
25	migration_v25.sql	2026-04-03 12:32:06.371908-03
26	migration_v26.sql	2026-04-04 12:04:13.730947-03
27	migration_v27.sql	2026-04-04 13:43:27.376505-03
28	migration_v28.sql	2026-04-04 15:14:37.927185-03
29	migration_v29.sql	2026-04-07 19:02:46.926482-03
\.


--
-- Data for Name: stock_movements; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.stock_movements (id, machine_id, stock_item_id, item_id, movement_type, quantity_delta, previous_units, current_units, tap_id, actor_user_id, note, created_at) FROM stdin;
242	14	\N	7	unconfigured_sale	-1	\N	\N	335	\N	Venta confirmada para una selección sin stock configurado	2026-04-07 19:38:45.029094-03
243	14	\N	7	unconfigured_sale	-1	\N	\N	342	\N	Venta confirmada para una selección sin stock configurado	2026-04-07 22:15:43.838257-03
3	13	3	0	adjustment	400	0	400	\N	1	Cofiguracion Inicial 25/03/2026	2026-03-25 15:52:46.599813-03
182	14	\N	7	unconfigured_sale	-1	\N	\N	289	\N	Venta confirmada para una selección sin stock configurado	2026-04-04 12:29:20.913161-03
204	14	\N	7	unconfigured_sale	-1	\N	\N	305	\N	Venta confirmada para una selección sin stock configurado	2026-04-04 14:41:19.814422-03
212	14	\N	7	unconfigured_sale	-1	\N	\N	311	\N	Venta confirmada para una selección sin stock configurado	2026-04-04 15:50:42.432139-03
213	14	\N	7	unconfigured_sale	-1	\N	\N	312	\N	Venta confirmada para una selección sin stock configurado	2026-04-04 17:18:33.826177-03
88	13	3	0	restock	100	400	500	\N	43	Reposición manual	2026-03-27 17:15:58.910586-03
173	14	\N	7	unconfigured_sale	-1	\N	\N	282	\N	Venta confirmada para una selección sin stock configurado	2026-04-04 11:23:59.557995-03
174	14	\N	7	unconfigured_sale	-1	\N	\N	283	\N	Venta confirmada para una selección sin stock configurado	2026-04-04 11:40:10.028404-03
\.


--
-- Data for Name: system_settings; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.system_settings (id, business_timezone, created_at, updated_at) FROM stdin;
1	America/Argentina/Buenos_Aires	2026-03-24 19:41:34.185383-03	2026-03-24 20:22:01.404036-03
\.


--
-- Data for Name: taps; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.taps (id, employee_id, machine_id, nfc_uid, approved, deny_reason, item_id, amount_cents, confirmed, tapped_at, over_limit) FROM stdin;
11	\N	13	0A30FC80	f	card_unknown	\N	\N	\N	2026-03-23 12:11:56.051329-03	f
12	\N	13	0A30FC80	f	card_unknown	\N	\N	\N	2026-03-23 12:12:08.581896-03	f
13	\N	13	0A30FC80	f	card_unknown	\N	\N	\N	2026-03-23 12:13:30.277072-03	f
14	\N	13	0A30FC80	f	card_unknown	\N	\N	\N	2026-03-23 12:14:20.078127-03	f
15	\N	13	0A30FC80	f	card_unknown	\N	\N	\N	2026-03-23 12:15:52.544201-03	f
16	\N	13	0A30FC80	f	card_unknown	\N	\N	\N	2026-03-23 12:16:07.092784-03	f
17	\N	13	0A30FC80	f	card_unknown	\N	\N	\N	2026-03-23 12:16:25.364993-03	f
18	\N	13	0A30FC80	f	card_unknown	\N	\N	\N	2026-03-23 12:17:30.440537-03	f
19	\N	13	0A30FC80	f	card_unknown	\N	\N	\N	2026-03-23 12:17:30.726669-03	f
20	11	13	0A30FC80	t	\N	\N	\N	\N	2026-03-23 12:30:18.647848-03	f
21	\N	13	6AEBB01A	f	card_unknown	\N	\N	\N	2026-03-23 12:30:30.743096-03	f
22	5	13	6AEBB01A	t	\N	\N	\N	\N	2026-03-23 12:30:59.73921-03	f
23	11	13	0A30FC80	t	\N	\N	\N	\N	2026-03-23 12:31:05.027296-03	f
24	5	13	6AEBB01A	t	\N	\N	\N	\N	2026-03-23 12:31:08.000924-03	f
25	5	13	6AEBB01A	t	\N	\N	\N	\N	2026-03-23 12:33:24.109139-03	f
26	5	13	6AEBB01A	t	\N	\N	\N	\N	2026-03-23 12:33:26.614769-03	f
27	11	13	0A30FC80	t	\N	\N	\N	\N	2026-03-23 12:33:33.917088-03	f
28	5	13	6AEBB01A	f	limit_reached	\N	\N	\N	2026-03-23 12:34:02.921022-03	f
29	5	13	6AEBB01A	f	limit_reached	\N	\N	\N	2026-03-23 12:34:08.042846-03	f
30	5	13	6AEBB01A	f	limit_reached	\N	\N	\N	2026-03-23 12:34:10.651896-03	f
31	5	13	6AEBB01A	f	limit_reached	\N	\N	\N	2026-03-23 12:34:13.928548-03	f
32	5	13	6AEBB01A	f	limit_reached	\N	\N	\N	2026-03-23 12:34:33.334702-03	f
33	5	13	6AEBB01A	f	limit_reached	\N	\N	\N	2026-03-23 12:34:35.781322-03	f
34	5	13	6AEBB01A	f	limit_reached	\N	\N	\N	2026-03-23 12:35:02.834747-03	f
35	5	13	6AEBB01A	f	limit_reached	\N	\N	\N	2026-03-23 12:36:42.037836-03	f
36	\N	13	0856A014	f	card_unknown	\N	\N	\N	2026-03-23 12:42:15.060067-03	f
37	\N	13	084997F1	f	card_unknown	\N	\N	\N	2026-03-23 12:42:35.917617-03	f
38	\N	13	08666DAB	f	card_unknown	\N	\N	\N	2026-03-23 12:43:22.858174-03	f
39	\N	13	08FFB8B6	f	card_unknown	\N	\N	\N	2026-03-23 12:43:25.289307-03	f
40	\N	13	080D3FA0	f	card_unknown	\N	\N	\N	2026-03-23 12:43:27.793686-03	f
41	\N	13	08B206B5	f	card_unknown	\N	\N	\N	2026-03-23 12:43:30.600449-03	f
42	\N	13	08C9DE88	f	card_unknown	\N	\N	\N	2026-03-23 12:59:12.008797-03	f
43	\N	13	083C2685	f	card_unknown	\N	\N	\N	2026-03-23 12:59:15.760999-03	f
44	\N	13	08D94B9F	f	card_unknown	\N	\N	\N	2026-03-23 12:59:18.788993-03	f
45	11	13	0A30FC80	t	\N	\N	\N	\N	2026-03-23 13:08:48.857637-03	f
46	\N	13	0844105B	f	card_unknown	\N	\N	\N	2026-03-23 13:08:57.022932-03	f
47	\N	13	0881F699	f	card_unknown	\N	\N	\N	2026-03-23 13:09:00.276909-03	f
48	\N	13	6AEBB01A	f	card_unknown	\N	\N	\N	2026-03-23 13:09:43.593778-03	f
49	11	14	0A30FC80	f	\N	\N	\N	f	2026-03-23 19:11:03.564118-03	f
50	5	14	6AEBB01A	f	inactive	\N	\N	\N	2026-03-23 19:11:31.265393-03	f
51	11	14	0A30FC80	f	\N	\N	\N	f	2026-03-23 19:12:25.437335-03	f
52	5	14	6AEBB01A	f	inactive	\N	\N	\N	2026-03-23 19:13:07.035661-03	f
53	11	14	0A30FC80	f	\N	\N	\N	f	2026-03-23 20:58:17.039435-03	f
54	\N	14	0A30FC80	f	card_unknown	\N	\N	\N	2026-03-23 22:06:41.125296-03	f
280	12	14	6AEBB01A	f	\N	\N	\N	f	2026-04-03 17:13:39.366683-03	f
283	12	14	6AEBB01A	t	\N	7	1200	t	2026-04-04 11:40:08.226703-03	f
143	12	14	6AEBB01A	f	\N	\N	\N	f	2026-03-28 11:33:55.329806-03	f
119	12	14	6AEBB01A	f	card_inactive	\N	\N	\N	2026-03-27 18:57:55.262008-03	f
120	\N	14	75506CEA	f	card_unknown	\N	\N	\N	2026-03-27 20:25:13.846055-03	f
121	\N	14	75506CEA	f	card_unknown	\N	\N	\N	2026-03-27 20:25:16.915212-03	f
122	\N	14	75506CEA	f	card_unknown	\N	\N	\N	2026-03-27 20:25:35.36026-03	f
123	\N	14	75506CEA	f	card_unknown	\N	\N	\N	2026-03-27 20:25:38.94976-03	f
312	12	14	6AEBB01A	t	\N	7	1200	t	2026-04-04 17:18:28.710806-03	f
144	11	14	0A30FC80	f	\N	\N	\N	f	2026-03-28 11:34:11.005251-03	f
134	11	14	0A30FC80	f	card_inactive	\N	\N	\N	2026-03-27 22:32:03.434012-03	f
140	12	14	6AEBB01A	f	\N	\N	\N	f	2026-03-28 11:08:33.667884-03	f
141	12	14	6AEBB01A	f	\N	\N	\N	f	2026-03-28 11:09:29.964611-03	f
142	11	14	0A30FC80	f	\N	\N	\N	f	2026-03-28 11:32:44.759656-03	f
145	12	14	6AEBB01A	f	\N	\N	\N	f	2026-03-28 11:34:29.630428-03	f
146	11	14	0A30FC80	f	\N	\N	\N	f	2026-03-28 11:34:57.400234-03	f
147	12	14	6AEBB01A	f	\N	\N	\N	f	2026-03-28 11:41:19.155689-03	f
148	12	14	6AEBB01A	f	\N	\N	\N	f	2026-03-28 11:42:56.042295-03	f
149	12	14	6AEBB01A	f	\N	\N	\N	f	2026-03-28 11:43:35.738944-03	f
150	12	14	6AEBB01A	f	\N	\N	\N	f	2026-03-28 11:44:29.283878-03	f
151	12	14	6AEBB01A	f	\N	\N	\N	f	2026-03-28 11:46:02.69901-03	f
152	12	14	6AEBB01A	f	\N	\N	\N	f	2026-03-28 11:49:57.170825-03	f
153	12	14	6AEBB01A	f	\N	\N	\N	f	2026-03-28 11:50:18.974614-03	f
154	12	14	6AEBB01A	f	\N	\N	\N	f	2026-03-28 11:55:46.802054-03	f
155	12	14	6AEBB01A	f	\N	\N	\N	f	2026-03-28 11:56:32.053618-03	f
156	12	14	6AEBB01A	f	\N	\N	\N	f	2026-03-28 12:02:28.196121-03	f
157	12	14	6AEBB01A	f	\N	\N	\N	f	2026-03-28 12:06:50.062839-03	f
158	12	14	6AEBB01A	f	\N	\N	\N	f	2026-03-28 12:07:07.574499-03	f
159	12	14	6AEBB01A	f	\N	\N	\N	f	2026-03-28 12:08:04.90477-03	f
160	12	14	6AEBB01A	f	\N	\N	\N	f	2026-03-28 12:08:34.277164-03	f
161	12	14	6AEBB01A	f	\N	\N	\N	f	2026-03-28 12:09:35.414638-03	f
162	12	14	6AEBB01A	f	\N	\N	\N	f	2026-03-28 12:10:10.940547-03	f
163	12	14	6AEBB01A	f	\N	\N	\N	f	2026-03-28 12:10:48.312291-03	f
164	12	14	6AEBB01A	f	\N	\N	\N	f	2026-03-28 12:11:22.105596-03	f
165	12	14	6AEBB01A	f	\N	\N	\N	f	2026-03-28 12:11:41.869739-03	f
166	12	14	6AEBB01A	f	\N	\N	\N	f	2026-03-28 12:16:51.104287-03	f
167	12	14	6AEBB01A	f	\N	\N	\N	f	2026-03-28 12:17:45.080466-03	f
168	12	14	6AEBB01A	f	\N	\N	\N	f	2026-03-28 12:18:05.162181-03	f
169	12	14	6AEBB01A	f	\N	\N	\N	f	2026-03-31 19:42:48.232449-03	f
170	12	14	6AEBB01A	f	\N	\N	\N	f	2026-03-31 20:18:17.594361-03	f
171	12	14	6AEBB01A	f	\N	\N	\N	f	2026-03-31 20:19:21.878961-03	f
172	12	14	6AEBB01A	f	\N	\N	\N	f	2026-03-31 20:19:42.899202-03	f
173	12	14	6AEBB01A	f	\N	\N	\N	f	2026-03-31 21:53:06.264753-03	f
174	12	14	6AEBB01A	f	\N	\N	\N	f	2026-03-31 21:53:22.633475-03	f
175	12	14	6AEBB01A	f	\N	\N	\N	f	2026-04-01 20:29:53-03	f
176	12	14	6AEBB01A	f	\N	\N	\N	f	2026-04-02 12:38:01.404418-03	f
180	12	14	6AEBB01A	f	\N	\N	\N	f	2026-04-02 15:29:16.679687-03	f
181	12	14	6AEBB01A	f	\N	\N	\N	f	2026-04-02 15:29:21.39092-03	f
182	12	14	6AEBB01A	f	\N	\N	\N	f	2026-04-02 15:29:30.110906-03	f
184	12	14	6AEBB01A	f	\N	\N	\N	f	2026-04-02 15:29:45.977068-03	f
281	12	14	6AEBB01A	f	\N	\N	\N	f	2026-04-04 11:16:51.434559-03	f
289	12	14	6AEBB01A	t	\N	7	1200	t	2026-04-04 12:29:17.76846-03	f
305	12	14	6AEBB01A	t	\N	7	1200	t	2026-04-04 14:40:15.201613-03	f
333	12	14	6AEBB01A	t	\N	7	1200	t	2026-04-07 18:27:29-03	f
335	12	14	6AEBB01A	t	\N	7	1200	t	2026-04-07 19:38:33.805475-03	f
338	12	14	6AEBB01A	f	\N	\N	\N	f	2026-04-07 21:38:08.693817-03	f
341	12	14	6AEBB01A	f	\N	\N	\N	f	2026-04-07 21:49:30.874142-03	f
177	12	14	6AEBB01A	f	\N	\N	\N	f	2026-04-02 15:27:28.972892-03	f
178	12	14	6AEBB01A	f	\N	\N	\N	f	2026-04-02 15:29:01.453559-03	f
179	12	14	6AEBB01A	f	\N	\N	\N	f	2026-04-02 15:29:05.633389-03	f
183	12	14	6AEBB01A	f	\N	\N	\N	f	2026-04-02 15:29:41.560686-03	f
185	12	14	6AEBB01A	f	\N	\N	\N	f	2026-04-02 15:29:49.445662-03	t
186	12	14	6AEBB01A	f	\N	\N	\N	f	2026-04-02 15:43:54.999741-03	f
187	12	14	6AEBB01A	f	\N	\N	\N	f	2026-04-02 15:44:14.738701-03	f
188	12	14	6AEBB01A	f	\N	\N	\N	f	2026-04-02 15:45:06.982898-03	f
189	12	14	6AEBB01A	f	\N	\N	\N	f	2026-04-02 19:02:31.84516-03	f
190	12	14	6AEBB01A	f	\N	\N	\N	f	2026-04-02 19:39:39.36225-03	f
191	12	14	6AEBB01A	f	\N	\N	\N	f	2026-04-02 19:54:34.436784-03	f
192	12	14	6AEBB01A	f	\N	\N	\N	f	2026-04-02 19:54:42.536024-03	f
193	12	14	6AEBB01A	f	\N	\N	\N	f	2026-04-02 20:01:53.850284-03	f
194	12	14	6AEBB01A	f	\N	\N	\N	f	2026-04-02 20:22:09.975325-03	f
195	12	14	6AEBB01A	f	\N	\N	\N	f	2026-04-02 20:22:13.010647-03	f
196	12	14	6AEBB01A	f	\N	\N	\N	f	2026-04-02 20:24:17.629152-03	f
197	12	14	6AEBB01A	f	\N	\N	\N	f	2026-04-02 20:26:57.255892-03	f
198	12	14	6AEBB01A	f	\N	\N	\N	f	2026-04-02 20:34:59.080978-03	f
199	12	14	6AEBB01A	f	\N	\N	\N	f	2026-04-02 20:47:56.398532-03	f
200	12	14	6AEBB01A	f	\N	\N	\N	f	2026-04-02 21:01:53.978025-03	f
201	12	14	6AEBB01A	f	\N	\N	\N	f	2026-04-02 21:02:44.882405-03	f
202	12	14	6AEBB01A	f	\N	\N	\N	f	2026-04-02 21:06:43.022985-03	f
203	12	14	6AEBB01A	f	\N	\N	\N	f	2026-04-02 21:45:30.214612-03	f
204	12	14	6AEBB01A	f	\N	\N	\N	f	2026-04-02 21:54:28.984294-03	f
205	12	14	6AEBB01A	f	\N	\N	\N	f	2026-04-02 22:00:02.768426-03	f
206	12	14	6AEBB01A	f	\N	\N	\N	f	2026-04-02 22:01:47.306338-03	f
207	12	14	6AEBB01A	f	\N	\N	\N	f	2026-04-02 22:03:00.016815-03	f
208	12	14	6AEBB01A	f	\N	\N	\N	f	2026-04-02 22:07:49.043547-03	f
209	12	14	6AEBB01A	f	\N	\N	\N	f	2026-04-02 22:24:23.130929-03	f
210	12	14	6AEBB01A	f	\N	\N	\N	f	2026-04-02 22:25:42.218369-03	f
211	12	14	6AEBB01A	f	\N	\N	\N	f	2026-04-02 22:26:32.575056-03	f
212	12	14	6AEBB01A	f	\N	\N	\N	f	2026-04-02 22:27:19.581805-03	f
213	12	14	6AEBB01A	f	\N	\N	\N	f	2026-04-02 22:29:26.467631-03	f
214	12	14	6AEBB01A	f	\N	\N	\N	f	2026-04-02 22:31:21.552133-03	f
215	12	14	6AEBB01A	f	\N	\N	\N	f	2026-04-02 22:36:07.062135-03	f
216	12	14	6AEBB01A	f	\N	\N	\N	f	2026-04-02 22:37:12.789493-03	f
217	12	14	6AEBB01A	f	\N	\N	\N	f	2026-04-02 22:38:12.63429-03	f
218	12	14	6AEBB01A	f	\N	\N	\N	f	2026-04-02 22:53:35.895757-03	f
219	12	14	6AEBB01A	f	\N	\N	\N	f	2026-04-02 22:58:54.513382-03	f
220	12	14	6AEBB01A	f	\N	\N	\N	f	2026-04-02 23:00:11.197868-03	f
221	12	14	6AEBB01A	f	\N	\N	\N	f	2026-04-02 23:04:28.523438-03	f
222	12	14	6AEBB01A	f	\N	\N	\N	f	2026-04-02 23:05:18.522832-03	f
223	12	14	6AEBB01A	f	\N	\N	\N	f	2026-04-02 23:11:07.579871-03	f
224	12	14	6AEBB01A	f	\N	\N	\N	f	2026-04-02 23:16:14.066129-03	f
225	12	14	6AEBB01A	f	\N	\N	\N	f	2026-04-02 23:19:18.282496-03	f
226	12	14	6AEBB01A	f	\N	\N	\N	f	2026-04-02 23:20:20.770155-03	f
227	12	14	6AEBB01A	f	\N	\N	\N	f	2026-04-02 23:22:16.781683-03	f
228	12	14	6AEBB01A	f	\N	\N	\N	f	2026-04-02 23:32:43.873502-03	f
272	12	14	6AEBB01A	f	\N	\N	\N	f	2026-04-03 15:48:25.803307-03	f
273	12	14	6AEBB01A	f	\N	\N	\N	f	2026-04-03 15:48:51.638741-03	f
274	12	14	6AEBB01A	f	\N	\N	\N	f	2026-04-03 15:49:20.060177-03	f
282	12	14	6AEBB01A	t	\N	7	600	t	2026-04-04 11:23:57.279189-03	f
311	12	14	6AEBB01A	t	\N	7	1200	t	2026-04-04 15:50:40.588826-03	f
334	12	14	6AEBB01A	f	\N	\N	\N	f	2026-04-07 19:38:23.998467-03	f
336	12	14	6AEBB01A	f	\N	\N	\N	f	2026-04-07 21:37:37.626989-03	f
337	12	14	6AEBB01A	f	\N	\N	\N	f	2026-04-07 21:37:55.019215-03	f
339	12	14	6AEBB01A	f	\N	\N	\N	f	2026-04-07 21:38:23.468649-03	f
229	12	14	6AEBB01A	f	\N	\N	\N	f	2026-04-02 23:40:01.848095-03	f
340	12	14	6AEBB01A	f	\N	\N	\N	f	2026-04-07 21:49:08.308752-03	f
342	12	14	6AEBB01A	t	\N	7	1200	t	2026-04-07 22:15:37.493129-03	f
265	12	14	6AEBB01A	f	\N	\N	\N	f	2026-04-03 15:12:39.26071-03	f
271	12	14	6AEBB01A	f	\N	\N	\N	f	2026-04-03 15:42:51.113378-03	f
\.


--
-- Name: access_levels_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.access_levels_id_seq', 87, true);


--
-- Name: admin_users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.admin_users_id_seq', 184, true);


--
-- Name: audit_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.audit_logs_id_seq', 951, true);


--
-- Name: employees_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.employees_id_seq', 289, true);


--
-- Name: firmware_releases_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.firmware_releases_id_seq', 5, true);


--
-- Name: machine_commands_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.machine_commands_id_seq', 146, true);


--
-- Name: machine_stock_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.machine_stock_items_id_seq', 173, true);


--
-- Name: machines_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.machines_id_seq', 79, true);


--
-- Name: mobile_sessions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.mobile_sessions_id_seq', 73, true);


--
-- Name: nfc_cards_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.nfc_cards_id_seq', 186, true);


--
-- Name: pending_machines_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.pending_machines_id_seq', 57, true);


--
-- Name: stock_movements_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.stock_movements_id_seq', 250, true);


--
-- Name: taps_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.taps_id_seq', 347, true);


--
-- Name: access_levels access_levels_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.access_levels
    ADD CONSTRAINT access_levels_code_key UNIQUE (code);


--
-- Name: access_levels access_levels_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.access_levels
    ADD CONSTRAINT access_levels_name_key UNIQUE (name);


--
-- Name: access_levels access_levels_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.access_levels
    ADD CONSTRAINT access_levels_pkey PRIMARY KEY (id);


--
-- Name: admin_user_departments admin_user_departments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_user_departments
    ADD CONSTRAINT admin_user_departments_pkey PRIMARY KEY (admin_user_id, department);


--
-- Name: admin_users admin_users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_users
    ADD CONSTRAINT admin_users_pkey PRIMARY KEY (id);


--
-- Name: admin_users admin_users_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_users
    ADD CONSTRAINT admin_users_username_key UNIQUE (username);


--
-- Name: alert_events alert_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alert_events
    ADD CONSTRAINT alert_events_pkey PRIMARY KEY (alert_key);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: employees employees_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_email_key UNIQUE (email);


--
-- Name: employees employees_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_pkey PRIMARY KEY (id);


--
-- Name: firmware_releases firmware_releases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.firmware_releases
    ADD CONSTRAINT firmware_releases_pkey PRIMARY KEY (id);


--
-- Name: firmware_releases firmware_releases_storage_path_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.firmware_releases
    ADD CONSTRAINT firmware_releases_storage_path_key UNIQUE (storage_path);


--
-- Name: firmware_releases firmware_releases_version_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.firmware_releases
    ADD CONSTRAINT firmware_releases_version_key UNIQUE (version);


--
-- Name: machine_commands machine_commands_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.machine_commands
    ADD CONSTRAINT machine_commands_pkey PRIMARY KEY (id);


--
-- Name: machine_stock_items machine_stock_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.machine_stock_items
    ADD CONSTRAINT machine_stock_items_pkey PRIMARY KEY (id);


--
-- Name: machines machines_mac_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.machines
    ADD CONSTRAINT machines_mac_key UNIQUE (mac);


--
-- Name: machines machines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.machines
    ADD CONSTRAINT machines_pkey PRIMARY KEY (id);


--
-- Name: mobile_sessions mobile_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mobile_sessions
    ADD CONSTRAINT mobile_sessions_pkey PRIMARY KEY (id);


--
-- Name: mobile_sessions mobile_sessions_refresh_token_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mobile_sessions
    ADD CONSTRAINT mobile_sessions_refresh_token_hash_key UNIQUE (refresh_token_hash);


--
-- Name: nfc_cards nfc_cards_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nfc_cards
    ADD CONSTRAINT nfc_cards_pkey PRIMARY KEY (id);


--
-- Name: nfc_cards nfc_cards_uid_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nfc_cards
    ADD CONSTRAINT nfc_cards_uid_key UNIQUE (uid);


--
-- Name: notification_settings notification_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_settings
    ADD CONSTRAINT notification_settings_pkey PRIMARY KEY (id);


--
-- Name: pending_machines pending_machines_mac_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pending_machines
    ADD CONSTRAINT pending_machines_mac_key UNIQUE (mac);


--
-- Name: pending_machines pending_machines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pending_machines
    ADD CONSTRAINT pending_machines_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: stock_movements stock_movements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_pkey PRIMARY KEY (id);


--
-- Name: system_settings system_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_settings
    ADD CONSTRAINT system_settings_pkey PRIMARY KEY (id);


--
-- Name: taps taps_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.taps
    ADD CONSTRAINT taps_pkey PRIMARY KEY (id);


--
-- Name: idx_admin_user_departments_department; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_user_departments_department ON public.admin_user_departments USING btree (department);


--
-- Name: idx_alert_events_employee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_alert_events_employee ON public.alert_events USING btree (employee_id, status);


--
-- Name: idx_alert_events_machine; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_alert_events_machine ON public.alert_events USING btree (machine_id, status);


--
-- Name: idx_alert_events_status_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_alert_events_status_type ON public.alert_events USING btree (status, alert_type);


--
-- Name: idx_audit_logs_actor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_actor ON public.audit_logs USING btree (actor_user_id, created_at DESC);


--
-- Name: idx_audit_logs_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_created_at ON public.audit_logs USING btree (created_at DESC);


--
-- Name: idx_audit_logs_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_entity ON public.audit_logs USING btree (entity_type, entity_id, created_at DESC);


--
-- Name: idx_employees_access_level_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employees_access_level_id ON public.employees USING btree (access_level_id);


--
-- Name: idx_machine_commands_machine_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_machine_commands_machine_status ON public.machine_commands USING btree (machine_id, status, queued_at);


--
-- Name: idx_machine_commands_queued; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_machine_commands_queued ON public.machine_commands USING btree (queued_at) WHERE ((status)::text = 'queued'::text);


--
-- Name: idx_machine_stock_items_machine_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_machine_stock_items_machine_active ON public.machine_stock_items USING btree (machine_id, active, item_id);


--
-- Name: idx_machine_stock_items_machine_item; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_machine_stock_items_machine_item ON public.machine_stock_items USING btree (machine_id, item_id);


--
-- Name: idx_machines_mac; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_machines_mac ON public.machines USING btree (mac);


--
-- Name: idx_mobile_sessions_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mobile_sessions_user ON public.mobile_sessions USING btree (admin_user_id, revoked_at, expires_at DESC);


--
-- Name: idx_nfc_uid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_nfc_uid ON public.nfc_cards USING btree (uid);


--
-- Name: idx_stock_movements_machine_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_movements_machine_created ON public.stock_movements USING btree (machine_id, created_at DESC, id DESC);


--
-- Name: idx_stock_movements_stock_item_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_movements_stock_item_created ON public.stock_movements USING btree (stock_item_id, created_at DESC, id DESC);


--
-- Name: idx_taps_employee_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_taps_employee_date ON public.taps USING btree (employee_id, tapped_at);


--
-- Name: idx_taps_machine; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_taps_machine ON public.taps USING btree (machine_id, tapped_at);


--
-- Name: idx_taps_over_limit; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_taps_over_limit ON public.taps USING btree (employee_id, tapped_at) WHERE (over_limit = true);


--
-- Name: daily_consumption _RETURN; Type: RULE; Schema: public; Owner: -
--

CREATE OR REPLACE VIEW public.daily_consumption AS
 WITH cfg AS (
         SELECT COALESCE(( SELECT system_settings.business_timezone
                   FROM public.system_settings
                  WHERE (system_settings.id = 1)), 'America/Argentina/Buenos_Aires'::character varying) AS business_timezone
        ), bounds AS (
         SELECT cfg.business_timezone,
            ((((CURRENT_TIMESTAMP AT TIME ZONE cfg.business_timezone))::date)::timestamp without time zone AT TIME ZONE cfg.business_timezone) AS day_start,
            ((((CURRENT_TIMESTAMP AT TIME ZONE cfg.business_timezone))::date + '1 day'::interval) AT TIME ZONE cfg.business_timezone) AS day_end
           FROM cfg
        )
 SELECT e.id AS employee_id,
    e.name AS employee_name,
    e.department,
    e.access_level_id,
    al.name AS access_level_name,
    COALESCE(al.daily_limit, e.daily_limit) AS daily_limit,
    COALESCE(al.daily_limit_mode, e.daily_limit_mode) AS daily_limit_mode,
    COALESCE(al.warning_enabled, e.warning_enabled) AS warning_enabled,
    count(t.id) FILTER (WHERE (t.approved = true)) AS taps_today,
    count(t.id) FILTER (WHERE ((t.approved = true) AND (t.over_limit = true))) AS taps_over_limit,
    COALESCE(sum(t.amount_cents) FILTER (WHERE (t.approved = true)), (0)::bigint) AS spent_today_cents
   FROM (((public.employees e
     LEFT JOIN public.access_levels al ON ((al.id = e.access_level_id)))
     CROSS JOIN bounds b)
     LEFT JOIN public.taps t ON (((t.employee_id = e.id) AND (t.tapped_at >= b.day_start) AND (t.tapped_at < b.day_end))))
  WHERE (e.active = true)
  GROUP BY e.id, al.id;


--
-- Name: monthly_summary _RETURN; Type: RULE; Schema: public; Owner: -
--

CREATE OR REPLACE VIEW public.monthly_summary AS
 WITH cfg AS (
         SELECT COALESCE(( SELECT system_settings.business_timezone
                   FROM public.system_settings
                  WHERE (system_settings.id = 1)), 'America/Argentina/Buenos_Aires'::character varying) AS business_timezone
        )
 SELECT e.id AS employee_id,
    e.name AS employee_name,
    e.department,
    e.access_level_id,
    al.name AS access_level_name,
    date_trunc('month'::text, (t.tapped_at AT TIME ZONE cfg.business_timezone)) AS month,
    count(t.id) FILTER (WHERE (t.approved = true)) AS taps_total,
    COALESCE(sum(t.amount_cents) FILTER (WHERE (t.approved = true)), (0)::bigint) AS spent_cents
   FROM (((public.employees e
     LEFT JOIN public.access_levels al ON ((al.id = e.access_level_id)))
     CROSS JOIN cfg)
     LEFT JOIN public.taps t ON (((t.employee_id = e.id) AND (t.approved = true))))
  WHERE (e.active = true)
  GROUP BY e.id, al.id, (date_trunc('month'::text, (t.tapped_at AT TIME ZONE cfg.business_timezone)));


--
-- Name: admin_user_departments admin_user_departments_admin_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_user_departments
    ADD CONSTRAINT admin_user_departments_admin_user_id_fkey FOREIGN KEY (admin_user_id) REFERENCES public.admin_users(id) ON DELETE CASCADE;


--
-- Name: alert_events alert_events_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alert_events
    ADD CONSTRAINT alert_events_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE SET NULL;


--
-- Name: alert_events alert_events_machine_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alert_events
    ADD CONSTRAINT alert_events_machine_id_fkey FOREIGN KEY (machine_id) REFERENCES public.machines(id) ON DELETE SET NULL;


--
-- Name: audit_logs audit_logs_actor_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES public.admin_users(id) ON DELETE SET NULL;


--
-- Name: employees employees_access_level_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_access_level_id_fkey FOREIGN KEY (access_level_id) REFERENCES public.access_levels(id) ON DELETE SET NULL;


--
-- Name: firmware_releases firmware_releases_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.firmware_releases
    ADD CONSTRAINT firmware_releases_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES public.admin_users(id) ON DELETE SET NULL;


--
-- Name: machine_commands machine_commands_machine_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.machine_commands
    ADD CONSTRAINT machine_commands_machine_id_fkey FOREIGN KEY (machine_id) REFERENCES public.machines(id) ON DELETE CASCADE;


--
-- Name: machine_stock_items machine_stock_items_machine_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.machine_stock_items
    ADD CONSTRAINT machine_stock_items_machine_id_fkey FOREIGN KEY (machine_id) REFERENCES public.machines(id) ON DELETE CASCADE;


--
-- Name: machines machines_desired_firmware_release_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.machines
    ADD CONSTRAINT machines_desired_firmware_release_id_fkey FOREIGN KEY (desired_firmware_release_id) REFERENCES public.firmware_releases(id) ON DELETE SET NULL;


--
-- Name: mobile_sessions mobile_sessions_admin_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mobile_sessions
    ADD CONSTRAINT mobile_sessions_admin_user_id_fkey FOREIGN KEY (admin_user_id) REFERENCES public.admin_users(id) ON DELETE CASCADE;


--
-- Name: nfc_cards nfc_cards_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nfc_cards
    ADD CONSTRAINT nfc_cards_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: stock_movements stock_movements_actor_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES public.admin_users(id) ON DELETE SET NULL;


--
-- Name: stock_movements stock_movements_machine_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_machine_id_fkey FOREIGN KEY (machine_id) REFERENCES public.machines(id) ON DELETE CASCADE;


--
-- Name: stock_movements stock_movements_stock_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_stock_item_id_fkey FOREIGN KEY (stock_item_id) REFERENCES public.machine_stock_items(id) ON DELETE SET NULL;


--
-- Name: stock_movements stock_movements_tap_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_tap_id_fkey FOREIGN KEY (tap_id) REFERENCES public.taps(id) ON DELETE SET NULL;


--
-- Name: taps taps_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.taps
    ADD CONSTRAINT taps_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id);


--
-- Name: taps taps_machine_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.taps
    ADD CONSTRAINT taps_machine_id_fkey FOREIGN KEY (machine_id) REFERENCES public.machines(id);


--
-- PostgreSQL database dump complete
--

\unrestrict t0w2XKzZmnQutpqiFnJC3h0zNssBCMUcudtRTdcQT9AGAmte8Zxavom1AjPK1q4

