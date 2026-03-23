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
    active      BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Tarjetas NFC (un empleado puede tener más de una)
CREATE TABLE nfc_cards (
    id          SERIAL PRIMARY KEY,
    uid         VARCHAR(20) UNIQUE NOT NULL,  -- UID hex del chip, ej: "A3F2C1D0"
    employee_id INT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    label       VARCHAR(60),                  -- "Tarjeta principal", "Llavero", etc.
    active      BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Expendedoras
CREATE TABLE machines (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(60) NOT NULL,         -- "Máquina A — Piso 1"
    location    VARCHAR(100),
    secret      VARCHAR(64) NOT NULL,         -- X-Machine-Secret del firmware
    active      BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ DEFAULT NOW()
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
    confirmed   BOOLEAN,                      -- NULL = pendiente, true = dispensado OK, false = falla mecánica
    tapped_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── Índices ──────────────────────────────────────────
CREATE INDEX idx_taps_employee_date ON taps (employee_id, tapped_at);
CREATE INDEX idx_taps_machine       ON taps (machine_id, tapped_at);
CREATE INDEX idx_nfc_uid            ON nfc_cards (uid);

-- ── Vista: consumo de hoy por empleado ───────────────
CREATE VIEW daily_consumption AS
SELECT
    e.id          AS employee_id,
    e.name        AS employee_name,
    e.department,
    e.daily_limit,
    COUNT(t.id) FILTER (WHERE t.approved = true)  AS taps_today,
    COALESCE(SUM(t.amount_cents) FILTER (WHERE t.approved = true), 0) AS spent_today_cents
FROM employees e
LEFT JOIN taps t
    ON t.employee_id = e.id
    AND t.tapped_at >= CURRENT_DATE
    AND t.tapped_at <  CURRENT_DATE + INTERVAL '1 day'
WHERE e.active = true
GROUP BY e.id, e.name, e.department, e.daily_limit;

-- ── Vista: resumen mensual ────────────────────────────
CREATE VIEW monthly_summary AS
SELECT
    e.id          AS employee_id,
    e.name        AS employee_name,
    e.department,
    DATE_TRUNC('month', t.tapped_at) AS month,
    COUNT(t.id) FILTER (WHERE t.approved = true)  AS taps_total,
    COALESCE(SUM(t.amount_cents) FILTER (WHERE t.approved = true), 0) AS spent_cents
FROM employees e
LEFT JOIN taps t ON t.employee_id = e.id AND t.approved = true
WHERE e.active = true
GROUP BY e.id, e.name, e.department, DATE_TRUNC('month', t.tapped_at);

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
