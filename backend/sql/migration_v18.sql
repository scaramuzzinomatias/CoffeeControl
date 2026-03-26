-- ══════════════════════════════════════════════════════
--  v18 - Control de stock manual/estimado por máquina
-- ══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS machine_stock_items (
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
    CHECK (min_units >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_machine_stock_items_machine_item
    ON machine_stock_items(machine_id, item_id);

CREATE INDEX IF NOT EXISTS idx_machine_stock_items_machine_active
    ON machine_stock_items(machine_id, active, item_id);

CREATE TABLE IF NOT EXISTS stock_movements (
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

CREATE INDEX IF NOT EXISTS idx_stock_movements_machine_created
    ON stock_movements(machine_id, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_stock_movements_stock_item_created
    ON stock_movements(stock_item_id, created_at DESC, id DESC);
