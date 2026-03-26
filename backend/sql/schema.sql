-- ══════════════════════════════════════════════════════
--  CoffeeControl — Schema PostgreSQL
-- ══════════════════════════════════════════════════════

-- Empleados
CREATE TABLE employees (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    department  VARCHAR(60),
    email       VARCHAR(120) UNIQUE,
    daily_limit INT NOT NULL DEFAULT 4,   -- cafés por día
    daily_limit_mode VARCHAR(16) NOT NULL DEFAULT 'enforce',
    warning_enabled BOOLEAN NOT NULL DEFAULT true,
    access_level_id INT,
    active      BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    CHECK (daily_limit_mode IN ('enforce', 'warn_only', 'off'))
);

CREATE TABLE access_levels (
    id               SERIAL PRIMARY KEY,
    code             VARCHAR(40) NOT NULL UNIQUE,
    name             VARCHAR(80) NOT NULL UNIQUE,
    description      VARCHAR(255),
    daily_limit      INT NOT NULL,
    daily_limit_mode VARCHAR(16) NOT NULL DEFAULT 'enforce',
    warning_enabled  BOOLEAN NOT NULL DEFAULT true,
    sort_order       INT NOT NULL DEFAULT 100,
    active           BOOLEAN NOT NULL DEFAULT true,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (daily_limit BETWEEN 1 AND 50),
    CHECK (daily_limit_mode IN ('enforce', 'warn_only', 'off')),
    CHECK (sort_order BETWEEN 0 AND 9999)
);

ALTER TABLE employees
    ADD CONSTRAINT employees_access_level_fk
    FOREIGN KEY (access_level_id)
    REFERENCES access_levels(id)
    ON DELETE SET NULL;

-- Tarjetas NFC (un empleado puede tener más de una)
CREATE TABLE nfc_cards (
    id          SERIAL PRIMARY KEY,
    uid         VARCHAR(20) UNIQUE NOT NULL,  -- UID hex del chip, ej: "A3F2C1D0"
    employee_id INT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    label       VARCHAR(60),                  -- "Tarjeta principal", "Llavero", etc.
    status      VARCHAR(16) NOT NULL DEFAULT 'active',
    active      BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    CHECK (status IN ('active', 'inactive', 'lost'))
);

-- Expendedoras
CREATE TABLE machines (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(60) NOT NULL,         -- "Máquina A — Piso 1"
    location    VARCHAR(100),
    secret      VARCHAR(64) NOT NULL,         -- X-Machine-Secret del firmware
    wifi_ssid   VARCHAR(64),
    backend_url VARCHAR(255),
    wifi_rssi   INT,
    wifi_ip     VARCHAR(45),
    backend_ok  BOOLEAN,
    backend_error VARCHAR(255),
    active      BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE alert_events (
    alert_key        VARCHAR(160) PRIMARY KEY,
    alert_type       VARCHAR(40) NOT NULL,
    status           VARCHAR(16) NOT NULL DEFAULT 'open',
    machine_id       INT REFERENCES machines(id) ON DELETE SET NULL,
    employee_id      INT REFERENCES employees(id) ON DELETE SET NULL,
    first_seen_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_notified_at TIMESTAMPTZ,
    resolved_at      TIMESTAMPTZ,
    payload          JSONB,
    CHECK (status IN ('open', 'resolved'))
);

CREATE TABLE notification_settings (
    id                                SMALLINT PRIMARY KEY DEFAULT 1,
    enabled                           BOOLEAN NOT NULL DEFAULT true,
    recipient_emails                  TEXT NOT NULL DEFAULT '',
    notify_employee_limit_warning     BOOLEAN NOT NULL DEFAULT false,
    notify_employee_daily_blocked     BOOLEAN NOT NULL DEFAULT true,
    notify_machine_offline            BOOLEAN NOT NULL DEFAULT true,
    notify_stock_low                  BOOLEAN NOT NULL DEFAULT false,
    notify_machine_backend_down       BOOLEAN NOT NULL DEFAULT true,
    employee_limit_warning_lead       SMALLINT NOT NULL DEFAULT 1,
    created_at                        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (employee_limit_warning_lead BETWEEN 1 AND 10),
    CHECK (id = 1)
);

CREATE TABLE system_settings (
    id                SMALLINT PRIMARY KEY DEFAULT 1,
    business_timezone VARCHAR(80) NOT NULL DEFAULT 'America/Argentina/Buenos_Aires',
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (id = 1)
);

CREATE TABLE admin_users (
    id            SERIAL PRIMARY KEY,
    username      VARCHAR(60) UNIQUE NOT NULL,
    password_hash VARCHAR(128) NOT NULL,
    role          VARCHAR(20) NOT NULL DEFAULT 'admin',
    is_protected  BOOLEAN NOT NULL DEFAULT false,
    department    VARCHAR(60),
    full_name     VARCHAR(100),
    email         VARCHAR(120),
    active        BOOLEAN NOT NULL DEFAULT true,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    CHECK (role IN ('admin', 'gerente', 'supervisor', 'tecnico', 'distribuidor'))
);

CREATE TABLE admin_user_departments (
    admin_user_id INT NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
    department    VARCHAR(60) NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (admin_user_id, department)
);

CREATE TABLE schema_migrations (
    version     INT PRIMARY KEY,
    filename    VARCHAR(120) NOT NULL,
    applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE audit_logs (
    id               BIGSERIAL PRIMARY KEY,
    actor_user_id    INT REFERENCES admin_users(id) ON DELETE SET NULL,
    actor_username   VARCHAR(60),
    actor_role       VARCHAR(20),
    actor_ip         VARCHAR(80),
    actor_user_agent VARCHAR(255),
    action           VARCHAR(80) NOT NULL,
    entity_type      VARCHAR(40) NOT NULL,
    entity_id        VARCHAR(80),
    entity_label     VARCHAR(160),
    summary          VARCHAR(255) NOT NULL,
    details          JSONB,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE machine_stock_items (
    id             SERIAL PRIMARY KEY,
    machine_id     INT NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
    item_id        INT NOT NULL,
    product_name   VARCHAR(120) NOT NULL,
    slot_label     VARCHAR(40),
    capacity_units INT NOT NULL DEFAULT 0,
    current_units  INT NOT NULL DEFAULT 0,
    min_units      INT NOT NULL DEFAULT 0,
    active         BOOLEAN NOT NULL DEFAULT true,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (item_id >= 0),
    CHECK (capacity_units >= 0),
    CHECK (min_units >= 0),
    UNIQUE (machine_id, item_id)
);

-- Registro de taps (cada vez que alguien acerca la tarjeta)
CREATE TABLE taps (
    id          BIGSERIAL PRIMARY KEY,
    employee_id INT NOT NULL REFERENCES employees(id),
    machine_id  INT NOT NULL REFERENCES machines(id),
    nfc_uid     VARCHAR(20) NOT NULL,
    approved    BOOLEAN NOT NULL,             -- true = dispensado, false = rechazado
    deny_reason VARCHAR(40),                  -- 'limit_reached' | 'card_unknown' | 'inactive'
    item_id     INT,                          -- ID del producto (viene del VEND REQUEST MDB)
    amount_cents INT,                         -- monto en centavos
    over_limit  BOOLEAN NOT NULL DEFAULT false,
    confirmed   BOOLEAN,                      -- NULL = pendiente, true = dispensado OK, false = falla mecánica
    tapped_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── Índices ──────────────────────────────────────────
CREATE TABLE stock_movements (
    id             BIGSERIAL PRIMARY KEY,
    machine_id     INT NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
    stock_item_id  INT REFERENCES machine_stock_items(id) ON DELETE SET NULL,
    item_id        INT NOT NULL,
    movement_type  VARCHAR(24) NOT NULL,
    quantity_delta INT NOT NULL,
    previous_units INT,
    current_units  INT,
    tap_id         BIGINT REFERENCES taps(id) ON DELETE SET NULL,
    actor_user_id  INT REFERENCES admin_users(id) ON DELETE SET NULL,
    note           VARCHAR(255),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (movement_type IN ('sale', 'restock', 'adjustment', 'unconfigured_sale'))
);

CREATE INDEX idx_taps_employee_date ON taps (employee_id, tapped_at);
CREATE INDEX idx_taps_machine       ON taps (machine_id, tapped_at);
CREATE INDEX idx_nfc_uid            ON nfc_cards (uid);
CREATE INDEX idx_employees_access_level_id ON employees (access_level_id);
CREATE INDEX idx_admin_user_departments_department ON admin_user_departments (department);
CREATE INDEX idx_machine_stock_items_machine_active ON machine_stock_items (machine_id, active, item_id);
CREATE INDEX idx_stock_movements_machine_created ON stock_movements (machine_id, created_at DESC, id DESC);
CREATE INDEX idx_stock_movements_stock_item_created ON stock_movements (stock_item_id, created_at DESC, id DESC);

-- ── Vista: consumo de hoy por empleado ───────────────
CREATE VIEW daily_consumption AS
WITH cfg AS (
    SELECT COALESCE((SELECT business_timezone FROM system_settings WHERE id = 1), 'America/Argentina/Buenos_Aires') AS business_timezone
),
bounds AS (
    SELECT
        business_timezone,
        (((CURRENT_TIMESTAMP AT TIME ZONE business_timezone)::date)::timestamp AT TIME ZONE business_timezone) AS day_start,
        ((((CURRENT_TIMESTAMP AT TIME ZONE business_timezone)::date + INTERVAL '1 day')::timestamp) AT TIME ZONE business_timezone) AS day_end
    FROM cfg
)
SELECT
    e.id          AS employee_id,
    e.name        AS employee_name,
    e.department,
    e.access_level_id,
    al.name       AS access_level_name,
    COALESCE(al.daily_limit, e.daily_limit) AS daily_limit,
    COALESCE(al.daily_limit_mode, e.daily_limit_mode) AS daily_limit_mode,
    COALESCE(al.warning_enabled, e.warning_enabled) AS warning_enabled,
    COUNT(t.id) FILTER (WHERE t.approved = true)  AS taps_today,
    COUNT(t.id) FILTER (WHERE t.approved = true AND t.over_limit = true) AS taps_over_limit,
    COALESCE(SUM(t.amount_cents) FILTER (WHERE t.approved = true), 0) AS spent_today_cents
FROM employees e
LEFT JOIN access_levels al ON al.id = e.access_level_id
CROSS JOIN bounds b
LEFT JOIN taps t
    ON t.employee_id = e.id
    AND t.tapped_at >= b.day_start
    AND t.tapped_at <  b.day_end
WHERE e.active = true
GROUP BY e.id, al.id;

-- ── Vista: resumen mensual ────────────────────────────
CREATE VIEW monthly_summary AS
WITH cfg AS (
    SELECT COALESCE((SELECT business_timezone FROM system_settings WHERE id = 1), 'America/Argentina/Buenos_Aires') AS business_timezone
)
SELECT
    e.id          AS employee_id,
    e.name        AS employee_name,
    e.department,
    e.access_level_id,
    al.name       AS access_level_name,
    DATE_TRUNC('month', t.tapped_at AT TIME ZONE cfg.business_timezone) AS month,
    COUNT(t.id) FILTER (WHERE t.approved = true)  AS taps_total,
    COALESCE(SUM(t.amount_cents) FILTER (WHERE t.approved = true), 0) AS spent_cents
FROM employees e
LEFT JOIN access_levels al ON al.id = e.access_level_id
CROSS JOIN cfg
LEFT JOIN taps t ON t.employee_id = e.id AND t.approved = true
WHERE e.active = true
GROUP BY e.id, al.id, DATE_TRUNC('month', t.tapped_at AT TIME ZONE cfg.business_timezone);

-- ── Datos de ejemplo ──────────────────────────────────
INSERT INTO machines (name, location, secret) VALUES
    ('Máquina A', 'Piso 1',    'cc-secret-1'),
    ('Máquina B', 'Piso 2',    'cc-secret-2'),
    ('Máquina C', 'Cafetería', 'cc-secret-3'),
    ('Máquina D', 'Reuniones', 'cc-secret-4');

INSERT INTO employees (name, department, email, daily_limit) VALUES
    ('Ana García',       'Marketing', 'ana@empresa.com',    4),
    ('Carlos López',     'IT',        'carlos@empresa.com', 4),
    ('María Pérez',      'RRHH',      'maria@empresa.com',  4),
    ('Juan Martínez',    'Finanzas',  'juan@empresa.com',   4),
    ('Laura Sánchez',    'Ventas',    'laura@empresa.com',  4),
    ('Pedro Rodríguez',  'Ops',       'pedro@empresa.com',  4),
    ('Sofía Torres',     'IT',        'sofia@empresa.com',  4),
    ('Diego Fernández',  'Dirección', 'diego@empresa.com',  6);

-- UIDs de ejemplo (en producción se graban al registrar la tarjeta)
INSERT INTO nfc_cards (uid, employee_id, label) VALUES
    ('A1B2C3D4', 1, 'Tarjeta principal'),
    ('B2C3D4E5', 2, 'Tarjeta principal'),
    ('C3D4E5F6', 3, 'Tarjeta principal'),
    ('D4E5F6A7', 4, 'Tarjeta principal'),
    ('E5F6A7B8', 5, 'Tarjeta principal'),
    ('F6A7B8C9', 6, 'Tarjeta principal'),
    ('A7B8C9D0', 7, 'Tarjeta principal'),
    ('B8C9D0E1', 8, 'Tarjeta principal');

INSERT INTO system_settings (id, business_timezone) VALUES
    (1, 'America/Argentina/Buenos_Aires')
ON CONFLICT (id) DO NOTHING;
