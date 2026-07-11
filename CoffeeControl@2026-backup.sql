--
-- PostgreSQL database dump
--

\restrict uG45S3rFgq4RbvoIku53OzCbS9ehXKPrk5vOahkELPN63GIGicMN0E0AuQo3Qnq

-- Dumped from database version 18.3 (Debian 18.3-1.pgdg12+1)
-- Dumped by pg_dump version 18.4

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

-- *not* creating schema, since initdb creates it


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
    is_protected boolean DEFAULT false NOT NULL,
    department character varying(60),
    full_name character varying(100),
    email character varying(120),
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
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
    daily_limit_mode character varying(16) DEFAULT 'enforce'::character varying NOT NULL,
    warning_enabled boolean DEFAULT true NOT NULL,
    access_level_id integer,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    dni character varying(20),
    legajo character varying(20),
    phone character varying(20),
    photo_url character varying(200),
    CONSTRAINT employees_daily_limit_mode_check CHECK (((daily_limit_mode)::text = ANY ((ARRAY['enforce'::character varying, 'warn_only'::character varying, 'off'::character varying])::text[])))
);


--
-- Name: machines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.machines (
    id integer NOT NULL,
    name character varying(60) NOT NULL,
    location character varying(100),
    secret character varying(64) NOT NULL,
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
    wifi_ssid character varying(64),
    backend_url character varying(255),
    wifi_rssi integer,
    wifi_ip character varying(45),
    backend_ok boolean,
    backend_error character varying(255),
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    blocked boolean DEFAULT false NOT NULL,
    blocked_reason character varying(120),
    last_seen timestamp with time zone,
    mac character varying(20),
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
    over_limit boolean DEFAULT false NOT NULL,
    confirmed boolean,
    tapped_at timestamp with time zone DEFAULT now()
);


--
-- Name: employee_machine_consumption; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.employee_machine_consumption AS
 SELECT e.id AS employee_id,
    e.name AS employee_name,
    e.department,
    e.legajo,
    m.id AS machine_id,
    m.name AS machine_name,
    m.location,
    count(t.id) AS taps_count,
    COALESCE(sum(t.amount_cents), (0)::bigint) AS spent_cents
   FROM ((public.employees e
     JOIN public.taps t ON (((t.employee_id = e.id) AND (t.approved = true) AND (t.tapped_at >= date_trunc('month'::text, now())))))
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
    CONSTRAINT machine_commands_status_check CHECK (((status)::text = ANY ((ARRAY['queued'::character varying, 'delivered'::character varying, 'completed'::character varying, 'failed'::character varying])::text[])))
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
    status character varying(16) DEFAULT 'active'::character varying NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
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
    notify_employee_limit_warning boolean DEFAULT false NOT NULL,
    notify_employee_daily_blocked boolean DEFAULT true NOT NULL,
    notify_machine_offline boolean DEFAULT true NOT NULL,
    notify_stock_low boolean DEFAULT false NOT NULL,
    notify_machine_backend_down boolean DEFAULT true NOT NULL,
    employee_limit_warning_lead smallint DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT notification_settings_employee_limit_warning_lead_check CHECK (((employee_limit_warning_lead >= 1) AND (employee_limit_warning_lead <= 10))),
    CONSTRAINT notification_settings_id_check CHECK ((id = 1))
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
\.


--
-- Data for Name: admin_users; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.admin_users (id, username, password_hash, role, is_protected, department, full_name, email, active, created_at) FROM stdin;
2	supervisor1	$2a$10$meCz6uJjpI8rS/7fR/KaFeYsf21.ZIRpIme80r7z300bk10X/T6Am	supervisor	f	IT	Supervisor IT	\N	t	2026-04-28 18:32:28.035462+00
1	admin	$2a$10$V.a1qNi2zNRRT2pIKSqkMe5ao6C9C4gK7JZzHP14NP8WKaCyNjtay	admin	t	\N	\N	\N	t	2026-04-28 18:32:28.035462+00
\.


--
-- Data for Name: alert_events; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.alert_events (alert_key, alert_type, status, machine_id, employee_id, first_seen_at, last_seen_at, last_notified_at, resolved_at, payload) FROM stdin;
machine-offline-5	machine_offline	open	5	\N	2026-04-29 03:29:22.676535+00	2026-05-22 14:24:27.848512+00	2026-05-01 15:10:19.304179+00	\N	{"wifi_ip": "192.168.1.85", "location": "Percam", "last_seen": "2026-05-06T22:25:18.738Z", "wifi_ssid": "Tiziana", "backend_url": "https://coffeecontrol.onrender.com", "machine_name": "PERCAM"}
\.


--
-- Data for Name: audit_logs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.audit_logs (id, actor_user_id, actor_username, actor_role, actor_ip, actor_user_agent, action, entity_type, entity_id, entity_label, summary, details, created_at) FROM stdin;
1	1	admin	admin	181.116.40.238	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	machine.create	machine	5	PERCAM	Creó la máquina PERCAM	{"mac": "10003BAF883C", "location": "Percam", "price_cents": 1200}	2026-04-29 00:25:01.592697+00
2	1	admin	admin	181.116.40.238	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	employee.create	employee	9	Tecnico	Creó el empleado Tecnico	{"email": null, "department": "Percam", "daily_limit": 4, "access_level_id": null, "warning_enabled": true, "daily_limit_mode": "warn_only", "access_level_name": null}	2026-04-29 02:28:37.168609+00
3	1	admin	admin	181.116.40.238	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	nfc_card.create	nfc_card	9	6AEBB01A	Asoció el TAG 6AEBB01A a Tecnico	{"after": {"id": 9, "uid": "6AEBB01A", "label": "Tarjeta principal", "active": true, "status": "active", "employee_id": 9, "employee_name": "Tecnico"}, "before": null, "source": "panel"}	2026-04-29 02:28:52.30621+00
4	1	admin	admin	181.116.40.238	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	machine.command_queue	machine	5	PERCAM	Encoló el comando diagnostics_snapshot para PERCAM	{"payload": {"limit": 20}, "command_id": 1, "command_type": "diagnostics_snapshot"}	2026-04-29 02:33:41.167678+00
5	1	admin	admin	181.116.40.238	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	nfc_card.create	nfc_card	10	0A30FC80	Asoció el TAG 0A30FC80 a Tecnico	{"after": {"id": 10, "uid": "0A30FC80", "label": "Llavero", "active": true, "status": "active", "employee_id": 9, "employee_name": "Tecnico"}, "before": null, "source": "panel"}	2026-04-29 03:20:53.418431+00
6	1	admin	admin	181.116.40.238	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	machine.command_queue	machine	5	PERCAM	Encoló el comando diagnostics_snapshot para PERCAM	{"payload": {"limit": 20}, "command_id": 2, "command_type": "diagnostics_snapshot"}	2026-04-29 03:55:05.807655+00
7	1	admin	admin	181.116.40.238	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	machine.command_queue	machine	5	PERCAM	Encoló el comando wifi_update para PERCAM	{"payload": {"url": "https://coffeecontrol.onrender.com", "pass": "[REDACTED]", "ssid": "Tiziana", "preserve_password": false}, "command_id": 3, "command_type": "wifi_update"}	2026-05-04 00:13:38.117981+00
8	1	admin	admin	201.179.202.181	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	machine.command_queue	machine	5	PERCAM	Encoló el comando diagnostics_snapshot para PERCAM	{"payload": {"limit": 20}, "command_id": 4, "command_type": "diagnostics_snapshot"}	2026-05-06 11:55:48.355378+00
\.


--
-- Data for Name: employees; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.employees (id, name, department, email, daily_limit, daily_limit_mode, warning_enabled, access_level_id, active, created_at, dni, legajo, phone, photo_url) FROM stdin;
1	Ana García	Marketing	ana@empresa.com	4	enforce	t	\N	t	2026-04-28 18:31:02.621961+00	\N	\N	\N	\N
2	Carlos López	IT	carlos@empresa.com	4	enforce	t	\N	t	2026-04-28 18:31:02.621961+00	\N	\N	\N	\N
3	María Pérez	RRHH	maria@empresa.com	4	enforce	t	\N	t	2026-04-28 18:31:02.621961+00	\N	\N	\N	\N
4	Juan Martínez	Finanzas	juan@empresa.com	4	enforce	t	\N	t	2026-04-28 18:31:02.621961+00	\N	\N	\N	\N
5	Laura Sánchez	Ventas	laura@empresa.com	4	enforce	t	\N	t	2026-04-28 18:31:02.621961+00	\N	\N	\N	\N
6	Pedro Rodríguez	Ops	pedro@empresa.com	4	enforce	t	\N	t	2026-04-28 18:31:02.621961+00	\N	\N	\N	\N
7	Sofía Torres	IT	sofia@empresa.com	4	enforce	t	\N	t	2026-04-28 18:31:02.621961+00	\N	\N	\N	\N
8	Diego Fernández	Dirección	diego@empresa.com	6	enforce	t	\N	t	2026-04-28 18:31:02.621961+00	\N	\N	\N	\N
9	Tecnico	Percam	\N	4	warn_only	t	\N	t	2026-04-29 02:28:37.165441+00	53000999	Leg001	2235550099	\N
\.


--
-- Data for Name: firmware_releases; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.firmware_releases (id, version, filename, storage_path, content_type, size_bytes, md5, notes, created_by_user_id, created_by_username, created_at) FROM stdin;
\.


--
-- Data for Name: machine_commands; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.machine_commands (id, machine_id, command_type, payload, status, queued_at, delivered_at, completed_at, result) FROM stdin;
1	5	diagnostics_snapshot	{"limit": 20}	completed	2026-04-29 02:33:41.164551+00	2026-04-29 02:33:52.798598+00	2026-04-29 02:33:55.367893+00	{"mdb": {"raw": [1, 127, 255, 0, 0, 144, 0, 0], "gateway": {"raw": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], "last_cmd": 0, "last_len": 0, "time_date": {"day": 0, "iso": "", "hour": 0, "year": 0, "month": 0, "valid": false, "minute": 0, "second": 0}, "seen_setup": false, "seen_report": false, "last_seen_ms": 0, "seen_control": false, "control_state": 0, "gateway_enabled": false, "last_control_ms": 0, "enabled_features": 0, "vmc_scale_factor": 0, "vmc_feature_level": 0, "vmc_decimal_places": 0, "seen_feature_enable": false, "seen_identification": false, "gateway_feature_level": 0, "seen_time_date_request": false, "app_max_response_seconds": 0, "last_time_date_response_ms": 0}, "last_len": 6, "max_price": 32767, "min_price": 0, "time_date": {"day": 0, "iso": "", "hour": 0, "year": 0, "month": 0, "valid": false, "minute": 0, "second": 0, "day_of_week": 0, "week_number": 0}, "vmc_level": 2, "last_subcmd": 1, "seen_config": true, "seen_prices": true, "display_info": 0, "display_rows": 0, "last_seen_ms": 1489, "expansion_raw": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], "seen_time_date": false, "display_columns": 0, "seen_request_id": false, "last_expansion_len": 0, "last_expansion_subcmd": 0, "last_expansion_seen_ms": 0, "time_date_probe_pending": false, "time_date_probe_requested_at_ms": 0}, "events": {"count": 9, "events": [{"ms": 320, "arg1": 6, "arg2": 0, "code": 1, "name": "BOOT"}, {"ms": 1391, "arg1": 0, "arg2": 0, "code": 50, "name": "MDB_RESET"}, {"ms": 1448, "arg1": 2, "arg2": 0, "code": 57, "name": "MDB_SETUP_CONFIG"}, {"ms": 1489, "arg1": 0, "arg2": 32767, "code": 58, "name": "MDB_SETUP_PRICES"}, {"ms": 5733, "arg1": -67, "arg2": 1426172096, "code": 10, "name": "WIFI_CONNECT_OK"}, {"ms": 10333, "arg1": 200, "arg2": 0, "code": 20, "name": "BACKEND_HEALTH_OK"}, {"ms": 12379, "arg1": 200, "arg2": 0, "code": 20, "name": "BACKEND_HEALTH_OK"}, {"ms": 14005, "arg1": 200, "arg2": 1200, "code": 22, "name": "BACKEND_REGISTER_OK"}, {"ms": 16608, "arg1": -2, "arg2": 2, "code": 26, "name": "BACKEND_CARDS_FAIL"}], "capacity": 64}, "gateway": {"raw": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], "last_cmd": 0, "last_len": 0, "time_date": {"day": 0, "iso": "", "hour": 0, "year": 0, "month": 0, "valid": false, "minute": 0, "second": 0}, "seen_setup": false, "seen_report": false, "last_seen_ms": 0, "seen_control": false, "control_state": 0, "gateway_enabled": false, "last_control_ms": 0, "enabled_features": 0, "vmc_scale_factor": 0, "vmc_feature_level": 0, "vmc_decimal_places": 0, "seen_feature_enable": false, "seen_identification": false, "gateway_feature_level": 0, "seen_time_date_request": false, "app_max_response_seconds": 0, "last_time_date_response_ms": 0}, "message": "Diagnostico generado desde la maquina", "price_cents": 1200, "clock_source": "ntp", "backend_ready": true, "config_source": "backend", "queue_pending": 0, "captured_at_ms": 21175, "config_version": 13, "wifi_connected": true, "pricing_profile": "rubino_half_credit", "firmware_version": "3.1.0", "mdb_country_code": 50, "mdb_misc_options": 0, "mdb_scale_factor": 100, "mdb_feature_level": 1, "mdb_decimal_places": 2, "mdb_max_response_time": 5, "mdb_time_date_probe_pending": false, "mdb_time_date_probe_requested_at_ms": 0}
2	5	diagnostics_snapshot	{"limit": 20}	completed	2026-04-29 03:55:05.80339+00	2026-04-29 03:55:07.687046+00	2026-04-29 03:55:18.222543+00	{"mdb": {"raw": [1, 127, 255, 0, 0, 144, 0, 0], "gateway": {"raw": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], "last_cmd": 0, "last_len": 0, "time_date": {"day": 0, "iso": "", "hour": 0, "year": 0, "month": 0, "valid": false, "minute": 0, "second": 0}, "seen_setup": false, "seen_report": false, "last_seen_ms": 0, "seen_control": false, "control_state": 0, "gateway_enabled": false, "last_control_ms": 0, "enabled_features": 0, "vmc_scale_factor": 0, "vmc_feature_level": 0, "vmc_decimal_places": 0, "seen_feature_enable": false, "seen_identification": false, "gateway_feature_level": 0, "seen_time_date_request": false, "app_max_response_seconds": 0, "last_time_date_response_ms": 0}, "last_len": 6, "max_price": 32767, "min_price": 0, "time_date": {"day": 0, "iso": "", "hour": 0, "year": 0, "month": 0, "valid": false, "minute": 0, "second": 0, "day_of_week": 0, "week_number": 0}, "vmc_level": 2, "last_subcmd": 1, "seen_config": true, "seen_prices": true, "display_info": 0, "display_rows": 0, "last_seen_ms": 15832, "expansion_raw": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], "seen_time_date": false, "display_columns": 0, "seen_request_id": false, "last_expansion_len": 0, "last_expansion_subcmd": 0, "last_expansion_seen_ms": 0, "time_date_probe_pending": false, "time_date_probe_requested_at_ms": 0}, "events": {"count": 13, "events": [{"ms": 316, "arg1": 1, "arg2": 0, "code": 1, "name": "BOOT"}, {"ms": 1700, "arg1": -66, "arg2": 1426172096, "code": 10, "name": "WIFI_CONNECT_OK"}, {"ms": 7423, "arg1": 200, "arg2": 0, "code": 20, "name": "BACKEND_HEALTH_OK"}, {"ms": 15529, "arg1": -2, "arg2": 0, "code": 21, "name": "BACKEND_HEALTH_FAIL"}, {"ms": 15733, "arg1": 0, "arg2": 0, "code": 50, "name": "MDB_RESET"}, {"ms": 15790, "arg1": 2, "arg2": 0, "code": 57, "name": "MDB_SETUP_CONFIG"}, {"ms": 15832, "arg1": 0, "arg2": 32767, "code": 58, "name": "MDB_SETUP_PRICES"}, {"ms": 16758, "arg1": 200, "arg2": 1200, "code": 22, "name": "BACKEND_REGISTER_OK"}, {"ms": 19888, "arg1": -2, "arg2": 2, "code": 26, "name": "BACKEND_CARDS_FAIL"}, {"ms": 67122, "arg1": -2, "arg2": 0, "code": 21, "name": "BACKEND_HEALTH_FAIL"}, {"ms": 75707, "arg1": 200, "arg2": 1200, "code": 22, "name": "BACKEND_REGISTER_OK"}, {"ms": 126308, "arg1": 200, "arg2": 0, "code": 20, "name": "BACKEND_HEALTH_OK"}, {"ms": 135082, "arg1": 200, "arg2": 1200, "code": 22, "name": "BACKEND_REGISTER_OK"}], "capacity": 64}, "gateway": {"raw": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], "last_cmd": 0, "last_len": 0, "time_date": {"day": 0, "iso": "", "hour": 0, "year": 0, "month": 0, "valid": false, "minute": 0, "second": 0}, "seen_setup": false, "seen_report": false, "last_seen_ms": 0, "seen_control": false, "control_state": 0, "gateway_enabled": false, "last_control_ms": 0, "enabled_features": 0, "vmc_scale_factor": 0, "vmc_feature_level": 0, "vmc_decimal_places": 0, "seen_feature_enable": false, "seen_identification": false, "gateway_feature_level": 0, "seen_time_date_request": false, "app_max_response_seconds": 0, "last_time_date_response_ms": 0}, "message": "Diagnostico generado desde la maquina", "price_cents": 1200, "clock_source": "ntp", "backend_ready": true, "config_source": "backend", "queue_pending": 0, "captured_at_ms": 145650, "config_version": 15, "wifi_connected": true, "pricing_profile": "rubino_half_credit", "firmware_version": "3.1.0", "mdb_country_code": 50, "mdb_misc_options": 0, "mdb_scale_factor": 100, "mdb_feature_level": 1, "mdb_decimal_places": 2, "mdb_max_response_time": 5, "mdb_time_date_probe_pending": false, "mdb_time_date_probe_requested_at_ms": 0}
3	5	wifi_update	{"url": "https://coffeecontrol.onrender.com", "pass": "Mateo123", "ssid": "Tiziana", "preserve_password": false}	completed	2026-05-04 00:13:38.11302+00	2026-05-04 00:13:38.94616+00	2026-05-04 00:13:40.252368+00	{"message": "Configuracion WiFi guardada; reiniciando"}
4	5	diagnostics_snapshot	{"limit": 20}	completed	2026-05-06 11:55:48.352003+00	2026-05-06 11:55:49.885008+00	2026-05-06 11:55:50.982183+00	{"mdb": {"raw": [1, 127, 255, 0, 0, 144, 0, 0], "gateway": {"raw": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], "last_cmd": 0, "last_len": 0, "time_date": {"day": 0, "iso": "", "hour": 0, "year": 0, "month": 0, "valid": false, "minute": 0, "second": 0}, "seen_setup": false, "seen_report": false, "last_seen_ms": 0, "seen_control": false, "control_state": 0, "gateway_enabled": false, "last_control_ms": 0, "enabled_features": 0, "vmc_scale_factor": 0, "vmc_feature_level": 0, "vmc_decimal_places": 0, "seen_feature_enable": false, "seen_identification": false, "gateway_feature_level": 0, "seen_time_date_request": false, "app_max_response_seconds": 0, "last_time_date_response_ms": 0}, "last_len": 6, "max_price": 32767, "min_price": 0, "time_date": {"day": 0, "iso": "", "hour": 0, "year": 0, "month": 0, "valid": false, "minute": 0, "second": 0, "day_of_week": 0, "week_number": 0}, "vmc_level": 2, "last_subcmd": 1, "seen_config": true, "seen_prices": true, "display_info": 0, "display_rows": 0, "last_seen_ms": 1555, "expansion_raw": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], "seen_time_date": false, "display_columns": 0, "seen_request_id": false, "last_expansion_len": 0, "last_expansion_subcmd": 0, "last_expansion_seen_ms": 0, "time_date_probe_pending": false, "time_date_probe_requested_at_ms": 0}, "events": {"count": 64, "events": [{"ms": 35564448, "arg1": 200, "arg2": 1200, "code": 22, "name": "BACKEND_REGISTER_OK"}, {"ms": 35624444, "arg1": 200, "arg2": 1200, "code": 22, "name": "BACKEND_REGISTER_OK"}, {"ms": 35684491, "arg1": 200, "arg2": 1200, "code": 22, "name": "BACKEND_REGISTER_OK"}, {"ms": 35744503, "arg1": 200, "arg2": 1200, "code": 22, "name": "BACKEND_REGISTER_OK"}, {"ms": 35804520, "arg1": 200, "arg2": 1200, "code": 22, "name": "BACKEND_REGISTER_OK"}, {"ms": 35864562, "arg1": 200, "arg2": 1200, "code": 22, "name": "BACKEND_REGISTER_OK"}, {"ms": 35924589, "arg1": 200, "arg2": 1200, "code": 22, "name": "BACKEND_REGISTER_OK"}, {"ms": 35984586, "arg1": 200, "arg2": 1200, "code": 22, "name": "BACKEND_REGISTER_OK"}, {"ms": 36007063, "arg1": -2, "arg2": 2, "code": 26, "name": "BACKEND_CARDS_FAIL"}, {"ms": 36044636, "arg1": 200, "arg2": 1200, "code": 22, "name": "BACKEND_REGISTER_OK"}, {"ms": 36104715, "arg1": 200, "arg2": 1200, "code": 22, "name": "BACKEND_REGISTER_OK"}, {"ms": 36164701, "arg1": 200, "arg2": 1200, "code": 22, "name": "BACKEND_REGISTER_OK"}, {"ms": 36224715, "arg1": 200, "arg2": 1200, "code": 22, "name": "BACKEND_REGISTER_OK"}, {"ms": 36284782, "arg1": 200, "arg2": 1200, "code": 22, "name": "BACKEND_REGISTER_OK"}, {"ms": 36344785, "arg1": 200, "arg2": 1200, "code": 22, "name": "BACKEND_REGISTER_OK"}, {"ms": 36404836, "arg1": 200, "arg2": 1200, "code": 22, "name": "BACKEND_REGISTER_OK"}, {"ms": 36464892, "arg1": 200, "arg2": 1200, "code": 22, "name": "BACKEND_REGISTER_OK"}, {"ms": 36524914, "arg1": 200, "arg2": 1200, "code": 22, "name": "BACKEND_REGISTER_OK"}, {"ms": 36584921, "arg1": 200, "arg2": 1200, "code": 22, "name": "BACKEND_REGISTER_OK"}, {"ms": 36607513, "arg1": -2, "arg2": 2, "code": 26, "name": "BACKEND_CARDS_FAIL"}], "capacity": 64}, "gateway": {"raw": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], "last_cmd": 0, "last_len": 0, "time_date": {"day": 0, "iso": "", "hour": 0, "year": 0, "month": 0, "valid": false, "minute": 0, "second": 0}, "seen_setup": false, "seen_report": false, "last_seen_ms": 0, "seen_control": false, "control_state": 0, "gateway_enabled": false, "last_control_ms": 0, "enabled_features": 0, "vmc_scale_factor": 0, "vmc_feature_level": 0, "vmc_decimal_places": 0, "seen_feature_enable": false, "seen_identification": false, "gateway_feature_level": 0, "seen_time_date_request": false, "app_max_response_seconds": 0, "last_time_date_response_ms": 0}, "message": "Diagnostico generado desde la maquina", "price_cents": 1200, "clock_source": "ntp", "backend_ready": true, "config_source": "portal", "queue_pending": 0, "captured_at_ms": 36636372, "config_version": 33, "wifi_connected": true, "pricing_profile": "rubino_half_credit", "firmware_version": "3.1.21", "mdb_country_code": 50, "mdb_misc_options": 0, "mdb_scale_factor": 100, "mdb_feature_level": 1, "mdb_decimal_places": 2, "mdb_max_response_time": 5, "mdb_time_date_probe_pending": false, "mdb_time_date_probe_requested_at_ms": 0}
\.


--
-- Data for Name: machine_stock_items; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.machine_stock_items (id, machine_id, item_id, product_name, slot_label, capacity_units, current_units, min_units, active, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: machines; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.machines (id, name, location, secret, price_cents, pricing_profile, mdb_feature_level, mdb_country_code, mdb_scale_factor, mdb_decimal_places, mdb_max_response_time, mdb_misc_options, technical_config_version, technical_config_source, technical_config_updated_at, last_reported_technical_config, last_reported_technical_config_at, current_firmware_version, desired_firmware_release_id, desired_firmware_version, firmware_update_status, firmware_update_message, firmware_update_started_at, firmware_update_completed_at, wifi_ssid, backend_url, wifi_rssi, wifi_ip, backend_ok, backend_error, active, created_at, blocked, blocked_reason, last_seen, mac) FROM stdin;
1	Máquina A	Piso 1	cc-secret-1	1200	rubino_half_credit	1	50	100	2	5	0	1	backend	2026-04-28 18:31:02.621961+00	\N	\N	\N	\N	\N	idle	\N	\N	\N	\N	\N	\N	\N	\N	\N	t	2026-04-28 18:31:02.621961+00	f	\N	\N	\N
2	Máquina B	Piso 2	cc-secret-2	1200	rubino_half_credit	1	50	100	2	5	0	1	backend	2026-04-28 18:31:02.621961+00	\N	\N	\N	\N	\N	idle	\N	\N	\N	\N	\N	\N	\N	\N	\N	t	2026-04-28 18:31:02.621961+00	f	\N	\N	\N
3	Máquina C	Cafetería	cc-secret-3	1200	rubino_half_credit	1	50	100	2	5	0	1	backend	2026-04-28 18:31:02.621961+00	\N	\N	\N	\N	\N	idle	\N	\N	\N	\N	\N	\N	\N	\N	\N	t	2026-04-28 18:31:02.621961+00	f	\N	\N	\N
4	Máquina D	Reuniones	cc-secret-4	1200	rubino_half_credit	1	50	100	2	5	0	1	backend	2026-04-28 18:31:02.621961+00	\N	\N	\N	\N	\N	idle	\N	\N	\N	\N	\N	\N	\N	\N	\N	t	2026-04-28 18:31:02.621961+00	f	\N	\N	\N
5	PERCAM	Percam	10003BAF883C	1200	rubino_half_credit	1	50	100	2	5	0	34	backend	2026-05-06 01:45:40.633898+00	{"price_cents": 1200, "config_source": "portal", "config_version": 33, "pricing_profile": "rubino_half_credit", "mdb_country_code": 50, "mdb_misc_options": 0, "mdb_scale_factor": 100, "config_updated_at": "2026-05-06T01:45:40.633Z", "mdb_feature_level": 1, "mdb_decimal_places": 2, "mdb_max_response_time": 5}	2026-05-06 22:24:22.344546+00	3.1.21	\N	\N	idle	\N	\N	\N	Tiziana	https://coffeecontrol.onrender.com	-77	192.168.1.85	t	\N	t	2026-04-29 00:25:01.587939+00	f	\N	2026-05-06 22:25:18.738135+00	10003BAF883C
\.


--
-- Data for Name: mobile_sessions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.mobile_sessions (id, admin_user_id, device_name, platform, user_agent, refresh_token_hash, last_used_at, expires_at, revoked_at, created_at) FROM stdin;
1	1	motorola edge 30 pro	android	okhttp/5.3.0	d33289c299c54b29043864182aa3679e7044c667eb843f90fd85b832084247e7	2026-05-22 13:54:13.564093+00	2026-07-06 13:54:13.564093+00	\N	2026-05-22 13:54:13.564093+00
\.


--
-- Data for Name: nfc_cards; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.nfc_cards (id, uid, employee_id, label, status, active, created_at) FROM stdin;
1	A1B2C3D4	1	Tarjeta principal	active	t	2026-04-28 18:31:02.621961+00
2	B2C3D4E5	2	Tarjeta principal	active	t	2026-04-28 18:31:02.621961+00
3	C3D4E5F6	3	Tarjeta principal	active	t	2026-04-28 18:31:02.621961+00
4	D4E5F6A7	4	Tarjeta principal	active	t	2026-04-28 18:31:02.621961+00
5	E5F6A7B8	5	Tarjeta principal	active	t	2026-04-28 18:31:02.621961+00
6	F6A7B8C9	6	Tarjeta principal	active	t	2026-04-28 18:31:02.621961+00
7	A7B8C9D0	7	Tarjeta principal	active	t	2026-04-28 18:31:02.621961+00
8	B8C9D0E1	8	Tarjeta principal	active	t	2026-04-28 18:31:02.621961+00
9	6AEBB01A	9	Tarjeta principal	active	t	2026-04-29 02:28:52.303257+00
10	0A30FC80	9	Llavero	active	t	2026-04-29 03:20:53.415321+00
\.


--
-- Data for Name: notification_settings; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.notification_settings (id, enabled, recipient_emails, notify_employee_limit_warning, notify_employee_daily_blocked, notify_machine_offline, notify_stock_low, notify_machine_backend_down, employee_limit_warning_lead, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: pending_machines; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.pending_machines (id, mac, first_seen, last_ping, approved) FROM stdin;
\.


--
-- Data for Name: schema_migrations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.schema_migrations (version, filename, applied_at) FROM stdin;
4	migration_v4.sql	2026-04-28 18:32:28.021669+00
6	migration_v6.sql	2026-04-28 18:32:28.02314+00
7	migration_v7.sql	2026-04-28 18:32:28.024163+00
8	migration_v8.sql	2026-04-28 18:32:28.025013+00
9	migration_v9.sql	2026-04-28 18:32:28.025912+00
10	migration_v10.sql	2026-04-28 18:32:28.026875+00
11	migration_v11.sql	2026-04-28 18:32:28.027881+00
14	migration_v14.sql	2026-04-28 18:32:28.02879+00
15	migration_v15.sql	2026-04-28 18:32:28.029733+00
16	migration_v16.sql	2026-04-28 18:32:28.030589+00
17	migration_v17.sql	2026-04-28 18:32:28.031548+00
18	migration_v18.sql	2026-04-28 18:32:28.032429+00
19	migration_v19.sql	2026-04-28 18:32:28.033246+00
21	migration_v21.sql	2026-04-28 18:32:28.034041+00
2	migration_v2.sql	2026-04-28 18:32:28.118113+00
3	migration_v3.sql	2026-04-28 18:32:28.225529+00
5	migration_v5.sql	2026-04-28 18:32:28.245741+00
12	migration_v12.sql	2026-04-28 18:32:28.253537+00
13	migration_v13.sql	2026-04-28 18:32:28.308732+00
20	migration_v20.sql	2026-04-28 18:32:28.312062+00
22	migration_v22.sql	2026-04-28 18:32:28.314834+00
23	migration_v23.sql	2026-04-28 18:32:28.317049+00
24	migration_v24.sql	2026-04-28 18:32:28.320544+00
25	migration_v25.sql	2026-04-28 18:32:28.328538+00
26	migration_v26.sql	2026-04-28 18:32:28.411846+00
27	migration_v27.sql	2026-04-28 18:32:28.418014+00
28	migration_v28.sql	2026-04-28 18:32:28.420322+00
29	migration_v29.sql	2026-04-28 18:32:28.507921+00
30	migration_v30.sql	2026-04-28 18:32:28.514164+00
\.


--
-- Data for Name: stock_movements; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.stock_movements (id, machine_id, stock_item_id, item_id, movement_type, quantity_delta, previous_units, current_units, tap_id, actor_user_id, note, created_at) FROM stdin;
1	5	\N	7	unconfigured_sale	-1	\N	\N	13	\N	Venta confirmada para una selección sin stock configurado	2026-04-29 03:55:57.9037+00
2	5	\N	7	unconfigured_sale	-1	\N	\N	14	\N	Venta confirmada para una selección sin stock configurado	2026-04-29 04:01:28.890537+00
\.


--
-- Data for Name: system_settings; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.system_settings (id, business_timezone, created_at, updated_at) FROM stdin;
1	America/Argentina/Buenos_Aires	2026-04-28 18:31:02.621961+00	2026-04-28 18:31:02.621961+00
\.


--
-- Data for Name: taps; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.taps (id, employee_id, machine_id, nfc_uid, approved, deny_reason, item_id, amount_cents, over_limit, confirmed, tapped_at) FROM stdin;
6	\N	5	6AEBB01A	f	card_unknown	\N	\N	f	\N	2026-04-29 02:27:23.056536+00
7	9	5	6AEBB01A	f	\N	\N	\N	f	f	2026-04-29 02:29:02.060554+00
8	9	5	6AEBB01A	f	\N	\N	\N	f	f	2026-04-29 02:42:53.137885+00
9	\N	5	0A30FC80	f	card_unknown	\N	\N	f	\N	2026-04-29 03:03:19.225539+00
10	\N	5	0A30FC80	f	card_unknown	\N	\N	f	\N	2026-04-29 03:03:54.027894+00
11	9	5	6AEBB01A	f	\N	\N	\N	f	f	2026-04-29 03:05:59.069982+00
12	9	5	6AEBB01A	f	\N	\N	\N	f	f	2026-04-29 03:17:48.907345+00
13	9	5	6AEBB01A	t	\N	7	1200	f	t	2026-04-29 03:55:50.711401+00
14	9	5	6AEBB01A	t	\N	7	1200	f	t	2026-04-29 04:01:23.004534+00
15	9	5	6AEBB01A	f	\N	\N	\N	f	f	2026-05-04 00:18:51.525892+00
\.


--
-- Name: access_levels_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.access_levels_id_seq', 1, false);


--
-- Name: admin_users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.admin_users_id_seq', 2, true);


--
-- Name: audit_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.audit_logs_id_seq', 8, true);


--
-- Name: employees_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.employees_id_seq', 9, true);


--
-- Name: firmware_releases_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.firmware_releases_id_seq', 1, false);


--
-- Name: machine_commands_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.machine_commands_id_seq', 4, true);


--
-- Name: machine_stock_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.machine_stock_items_id_seq', 1, false);


--
-- Name: machines_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.machines_id_seq', 5, true);


--
-- Name: mobile_sessions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.mobile_sessions_id_seq', 1, true);


--
-- Name: nfc_cards_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.nfc_cards_id_seq', 10, true);


--
-- Name: pending_machines_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.pending_machines_id_seq', 1, false);


--
-- Name: stock_movements_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.stock_movements_id_seq', 2, true);


--
-- Name: taps_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.taps_id_seq', 15, true);


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
-- Name: machine_stock_items machine_stock_items_machine_id_item_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.machine_stock_items
    ADD CONSTRAINT machine_stock_items_machine_id_item_id_key UNIQUE (machine_id, item_id);


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
-- Name: idx_employees_access_level_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employees_access_level_id ON public.employees USING btree (access_level_id);


--
-- Name: idx_machine_commands_machine_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_machine_commands_machine_active ON public.machine_commands USING btree (machine_id, status, delivered_at, queued_at) WHERE ((status)::text = ANY ((ARRAY['queued'::character varying, 'delivered'::character varying])::text[]));


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
-- Name: employees employees_access_level_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_access_level_fk FOREIGN KEY (access_level_id) REFERENCES public.access_levels(id) ON DELETE SET NULL;


--
-- Name: firmware_releases firmware_releases_created_by_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.firmware_releases
    ADD CONSTRAINT firmware_releases_created_by_fk FOREIGN KEY (created_by_user_id) REFERENCES public.admin_users(id) ON DELETE SET NULL;


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
-- Name: machines machines_desired_firmware_release_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.machines
    ADD CONSTRAINT machines_desired_firmware_release_fk FOREIGN KEY (desired_firmware_release_id) REFERENCES public.firmware_releases(id) ON DELETE SET NULL;


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

\unrestrict uG45S3rFgq4RbvoIku53OzCbS9ehXKPrk5vOahkELPN63GIGicMN0E0AuQo3Qnq

