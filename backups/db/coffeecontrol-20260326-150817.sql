--
-- PostgreSQL database dump
--

\restrict tWaYuTykHI3e04a1qa9VP8KA0WFcN5EefWimegJreJBrhlD7zP3NqSx3gTzkdQ2

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
ALTER TABLE IF EXISTS ONLY public.machine_stock_items DROP CONSTRAINT IF EXISTS machine_stock_items_machine_id_fkey;
ALTER TABLE IF EXISTS ONLY public.machine_commands DROP CONSTRAINT IF EXISTS machine_commands_machine_id_fkey;
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
ALTER TABLE IF EXISTS ONLY public.machines DROP CONSTRAINT IF EXISTS machines_pkey;
ALTER TABLE IF EXISTS ONLY public.machines DROP CONSTRAINT IF EXISTS machines_mac_key;
ALTER TABLE IF EXISTS ONLY public.machine_stock_items DROP CONSTRAINT IF EXISTS machine_stock_items_pkey;
ALTER TABLE IF EXISTS ONLY public.machine_commands DROP CONSTRAINT IF EXISTS machine_commands_pkey;
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
ALTER TABLE IF EXISTS public.machines ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.machine_stock_items ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.machine_commands ALTER COLUMN id DROP DEFAULT;
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
DROP SEQUENCE IF EXISTS public.machines_id_seq;
DROP SEQUENCE IF EXISTS public.machine_stock_items_id_seq;
DROP TABLE IF EXISTS public.machine_stock_items;
DROP VIEW IF EXISTS public.machine_status;
DROP SEQUENCE IF EXISTS public.machine_commands_id_seq;
DROP TABLE IF EXISTS public.machine_commands;
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
    CONSTRAINT admin_users_role_check CHECK (((role)::text = ANY ((ARRAY['admin'::character varying, 'gerente'::character varying, 'supervisor'::character varying, 'tecnico'::character varying])::text[])))
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
    backend_error character varying(255)
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
    m.backend_error
   FROM ((public.machines m
     CROSS JOIN bounds b)
     LEFT JOIN public.taps t ON ((t.machine_id = m.id)))
  GROUP BY m.id, m.name, m.location, m.active, m.blocked, m.blocked_reason, m.last_seen, m.wifi_ssid, m.backend_url, m.wifi_rssi, m.wifi_ip, m.backend_ok, m.backend_error;


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

COPY public.admin_users (id, username, password_hash, role, active, created_at, department, full_name, email) FROM stdin;
1	admin	$2a$10$V.a1qNi2zNRRT2pIKSqkMe5ao6C9C4gK7JZzHP14NP8WKaCyNjtay	admin	t	2026-03-22 20:24:34.815203-03	\N	\N	\N
32	tmp.tecnico.verificacion	$2a$10$gw60frO49rzRH9L0f2mp1uhvfZ5NnXZ71H/4N8W6BrrCmi51mFlge	tecnico	f	2026-03-25 16:49:19.133388-03	\N	Tecnico Temporal	tmp.tecnico.verificacion@example.com
39	tmp.tecnico.smoke	$2a$10$k9nUhKFsP2aAgz28P2iPx.3HKpCxfxxJwoApNbNlowl61Y6ki.LVm	tecnico	f	2026-03-26 11:53:36.681096-03	\N	Tecnico Smoke	tmp.tecnico.smoke@example.com
7	audit_sup_232201	$2a$10$rOCFyXHTpKDoTl0Cvhng8.rEV//bTpJS5MoEztLQtK3oVNZwqi3sC	supervisor	f	2026-03-24 20:22:01.649494-03	QA	Supervisor Auditoria	\N
8	audit_sup_232227	$2a$10$AFm1Uwr8G1PGWY.0yr7sh.oGHhQ9MRSBQI26s1rOT/bmC9Umweu2C	supervisor	f	2026-03-24 20:22:27.38721-03	QA	Supervisor Auditoria	\N
2	supervisor1	$2a$10$meCz6uJjpI8rS/7fR/KaFeYsf21.ZIRpIme80r7z300bk10X/T6Am	supervisor	f	2026-03-22 20:24:34.834147-03	IT	Supervisor IT	\N
\.


--
-- Data for Name: alert_events; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.alert_events (alert_key, alert_type, status, machine_id, employee_id, first_seen_at, last_seen_at, last_notified_at, resolved_at, payload) FROM stdin;
employee-limit-warning-13-2026-03-24	employee_limit_warning	open	\N	\N	2026-03-24 17:19:43.28029-03	2026-03-24 17:19:43.28029-03	2026-03-24 17:19:46.502441-03	\N	{"uid": "TEST1234", "department": "IT", "taps_today": 4, "daily_limit": 5, "machine_name": "Prueba Codex", "business_date": "2026-03-24", "employee_name": "Codex Warning 1774383583151"}
stock-low-20-7	stock_low	resolved	\N	\N	2026-03-25 16:03:57.484618-03	2026-03-25 16:03:57.56034-03	\N	2026-03-25 16:03:57.56034-03	{"status": "low", "item_id": 35341, "location": "QA lab", "min_units": 3, "slot_label": "C3", "machine_name": "itest_1774465435803_machine", "product_name": "itest_1774465435803_low_stock", "status_label": "Bajo", "current_units": 2, "stock_item_id": 7, "capacity_units": 8}
stock-low-22-14	stock_low	resolved	\N	\N	2026-03-25 16:45:04.340294-03	2026-03-25 16:45:04.397772-03	\N	2026-03-25 16:45:04.397772-03	{"status": "low", "item_id": 33630, "location": "QA lab", "min_units": 3, "slot_label": "C3", "machine_name": "itest_1774467902622_machine", "product_name": "itest_1774467902622_low_stock", "status_label": "Bajo", "current_units": 2, "stock_item_id": 14, "capacity_units": 8}
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
machine-offline-14	machine_offline	open	14	\N	2026-03-24 15:43:35.709542-03	2026-03-26 15:07:32.645189-03	2026-03-24 17:44:16.644157-03	\N	{"wifi_ip": "192.168.1.93", "location": "Piso 1", "last_seen": "2026-03-25T01:34:09.397Z", "wifi_ssid": "Tiziana", "backend_url": "http://192.168.1.76:3000", "machine_name": "ESP32C3"}
machine-offline-13	machine_offline	open	13	\N	2026-03-24 15:43:35.703119-03	2026-03-26 15:07:32.709639-03	2026-03-24 16:15:12.880649-03	\N	{"wifi_ip": null, "location": "Casa", "last_seen": "2026-03-23T16:09:43.534Z", "wifi_ssid": null, "backend_url": null, "machine_name": "TEST"}
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
31	1	admin	admin	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	stock_item.create	stock_item	3	TEST · selección 0	Configuró stock para TEST · selección 0	{"after": {"id": 3, "active": true, "status": "ok", "item_id": 0, "fill_pct": 100, "min_units": 40, "created_at": "2026-03-25T18:52:46.599Z", "machine_id": 13, "slot_label": null, "updated_at": "2026-03-25T18:52:46.599Z", "product_name": "Cafe", "status_badge": "bs", "status_label": "OK", "current_units": 400, "capacity_units": 400}, "machine_id": 13, "machine_name": "TEST"}	2026-03-25 15:52:46.610767-03
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
\.


--
-- Data for Name: employees; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.employees (id, name, department, email, daily_limit, active, created_at, dni, legajo, phone, photo_url, daily_limit_mode, warning_enabled, access_level_id) FROM stdin;
2	Carlos López	IT	carlos@empresa.com	4	f	2026-03-22 20:24:34.634676-03	\N	\N	\N	\N	enforce	t	\N
11	Mateo Scaramuzzino	Gerencia	mateo@smartq.io	10	t	2026-03-23 12:15:36.368874-03	53000999	Leg001	2235550099	\N	enforce	t	\N
1	Ana García	Marketing	ana@empresa.com	4	f	2026-03-22 20:24:34.634676-03	\N	\N	\N	\N	enforce	t	\N
4	Juan Martínez	Finanzas	juan@empresa.com	4	f	2026-03-22 20:24:34.634676-03	\N	\N	\N	\N	enforce	t	\N
5	Laura Sánchez	Ventas	laura@empresa.com	4	f	2026-03-22 20:24:34.634676-03	\N	\N	\N	\N	enforce	t	\N
8	Luis Fernández	Logística	diego@empresa.com	6	f	2026-03-22 20:24:34.634676-03	\N	\N	\N	\N	enforce	t	\N
3	María Pérez	RRHH	maria@empresa.com	4	f	2026-03-22 20:24:34.634676-03	\N	\N	\N	\N	enforce	t	\N
6	Pedro Rodríguez	IT	pedro@empresa.com	4	f	2026-03-22 20:24:34.634676-03	\N	\N	\N	\N	enforce	t	\N
7	Sofía Díaz	Marketing	sofia@empresa.com	4	f	2026-03-22 20:24:34.634676-03	\N	\N	\N	\N	enforce	t	\N
12	Lorena Villalobos	Socia Gerente	lorena@smartq.io	8	t	2026-03-23 19:23:50.846527-03	30867888	GER001	2235854433	\N	enforce	t	\N
18	AUDIT TEMP 20260324232131	QA	\N	5	f	2026-03-24 20:21:31.672243-03	\N	\N	123456	\N	warn_only	f	\N
19	AUDIT TEMP 20260324232201	QA	\N	5	f	2026-03-24 20:22:01.444002-03	\N	\N	123456	\N	warn_only	f	\N
\.


--
-- Data for Name: machine_commands; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.machine_commands (id, machine_id, command_type, payload, status, queued_at, delivered_at, completed_at, result) FROM stdin;
1	14	reboot	{}	completed	2026-03-24 13:03:43.854484-03	2026-03-24 13:03:51.9707-03	2026-03-24 13:13:05.142203-03	{"message": "ack manual de prueba"}
2	14	reboot	{}	completed	2026-03-24 13:13:49.783996-03	2026-03-24 13:21:53.817187-03	2026-03-24 13:31:02.174925-03	{"message": "Reinicio remoto aceptado por la maquina"}
3	14	wifi_update	{"url": "", "pass": "Mateo123", "ssid": "Tiziana"}	completed	2026-03-24 13:49:52.625378-03	2026-03-24 13:49:55.662751-03	2026-03-24 13:49:55.899981-03	{"message": "Configuracion WiFi guardada; reiniciando"}
4	14	wifi_scan	{}	completed	2026-03-24 14:21:20.343562-03	2026-03-24 14:21:35.272528-03	2026-03-24 14:21:37.359002-03	{"count": 1, "message": "1 red visible detectada.", "networks": [{"rssi": -80, "ssid": "Tiziana", "secure": true}]}
5	14	wifi_scan	{}	completed	2026-03-24 14:22:22.706546-03	2026-03-24 14:22:35.910142-03	2026-03-24 14:22:38.005447-03	{"count": 2, "message": "2 redes visibles detectadas.", "networks": [{"rssi": -73, "ssid": "alejandro", "secure": true}, {"rssi": -81, "ssid": "Tiziana", "secure": true}]}
6	14	wifi_scan	{}	completed	2026-03-24 19:17:58.865965-03	2026-03-24 19:18:04.995787-03	2026-03-24 19:18:06.921264-03	{"count": 2, "message": "2 redes visibles detectadas.", "networks": [{"rssi": -67, "ssid": "Tiziana", "secure": true}, {"rssi": -93, "ssid": "Braian", "secure": true}]}
\.


--
-- Data for Name: machine_stock_items; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.machine_stock_items (id, machine_id, item_id, product_name, slot_label, capacity_units, current_units, min_units, active, created_at, updated_at) FROM stdin;
3	13	0	Cafe	\N	400	400	40	t	2026-03-25 15:52:46.599813-03	2026-03-25 15:52:46.599813-03
\.


--
-- Data for Name: machines; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.machines (id, name, location, secret, active, created_at, blocked, blocked_reason, last_seen, mac, wifi_ssid, backend_url, wifi_rssi, wifi_ip, backend_ok, backend_error) FROM stdin;
14	ESP32C3	Piso 1	10003BAF883C	t	2026-03-23 19:10:45.469377-03	f	\N	2026-03-24 22:34:09.397142-03	10003BAF883C	Tiziana	http://192.168.1.76:3000	-68	192.168.1.93	t	\N
4	Máquina D	Tercer piso	cc-secret-4	f	2026-03-22 20:24:34.632133-03	t	no la tengo mas	\N	\N	\N	\N	\N	\N	\N	\N
3	Máquina C	Segundo piso	cc-secret-3	f	2026-03-22 20:24:34.632133-03	f	\N	\N	\N	\N	\N	\N	\N	\N	\N
1	Máquina A	Planta baja	cc-secret-1	f	2026-03-22 20:24:34.632133-03	f	\N	\N	\N	\N	\N	\N	\N	\N	\N
2	Máquina B	Primer piso	cc-secret-2	f	2026-03-22 20:24:34.632133-03	f	\N	\N	\N	\N	\N	\N	\N	\N	\N
13	TEST	Casa	A020A61793EE	t	2026-03-23 11:56:15.302433-03	f	\N	2026-03-23 13:09:43.534388-03	A020A61793EE	\N	\N	\N	\N	\N	\N
\.


--
-- Data for Name: nfc_cards; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.nfc_cards (id, uid, employee_id, label, active, created_at, status) FROM stdin;
5	E5F6A7B8	5	Tarjeta principal	f	2026-03-22 20:24:34.637826-03	inactive
12	0A30FC80	11	Llavero	f	2026-03-23 12:30:02.331101-03	inactive
3	C3D4E5F6	3	Tarjeta principal	f	2026-03-22 20:24:34.637826-03	inactive
4	D4E5F6A7	4	Tarjeta principal	f	2026-03-22 20:24:34.637826-03	inactive
7	A7B8C9D0	7	Tarjeta principal	f	2026-03-22 20:24:34.637826-03	inactive
6	F6A7B8C9	6	Tarjeta principal	f	2026-03-22 20:24:34.637826-03	inactive
8	B8C9D0E1	8	Tarjeta principal	f	2026-03-22 20:24:34.637826-03	inactive
1	A1B2C3D4	1	Tarjeta principal	f	2026-03-22 20:24:34.637826-03	inactive
2	B2C3D4E5	2	Tarjeta principal	f	2026-03-22 20:24:34.637826-03	inactive
13	6AEBB01A	12	Tarjeta principal	f	2026-03-23 12:30:53.002654-03	inactive
17	AUD24232131	18	Tarjeta auditoria	f	2026-03-24 20:21:31.754412-03	inactive
18	AUD24232201	19	Tarjeta auditoria	f	2026-03-24 20:22:01.474898-03	inactive
\.


--
-- Data for Name: notification_settings; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.notification_settings (id, enabled, recipient_emails, notify_employee_daily_blocked, notify_machine_offline, notify_machine_backend_down, created_at, updated_at, notify_employee_limit_warning, employee_limit_warning_lead, notify_stock_low) FROM stdin;
1	t	mscaramuzzino@ieasrl.com.ar	f	f	f	2026-03-24 16:30:15.551-03	2026-03-26 12:33:24.577601-03	f	1	f
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
\.


--
-- Data for Name: stock_movements; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.stock_movements (id, machine_id, stock_item_id, item_id, movement_type, quantity_delta, previous_units, current_units, tap_id, actor_user_id, note, created_at) FROM stdin;
3	13	3	0	adjustment	400	0	400	\N	1	Cofiguracion Inicial 25/03/2026	2026-03-25 15:52:46.599813-03
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
\.


--
-- Name: access_levels_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.access_levels_id_seq', 3, true);


--
-- Name: admin_users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.admin_users_id_seq', 42, true);


--
-- Name: audit_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.audit_logs_id_seq', 116, true);


--
-- Name: employees_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.employees_id_seq', 65, true);


--
-- Name: machine_commands_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.machine_commands_id_seq', 21, true);


--
-- Name: machine_stock_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.machine_stock_items_id_seq', 33, true);


--
-- Name: machines_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.machines_id_seq', 25, true);


--
-- Name: nfc_cards_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.nfc_cards_id_seq', 49, true);


--
-- Name: pending_machines_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.pending_machines_id_seq', 3, true);


--
-- Name: stock_movements_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.stock_movements_id_seq', 45, true);


--
-- Name: taps_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.taps_id_seq', 88, true);


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

\unrestrict tWaYuTykHI3e04a1qa9VP8KA0WFcN5EefWimegJreJBrhlD7zP3NqSx3gTzkdQ2

