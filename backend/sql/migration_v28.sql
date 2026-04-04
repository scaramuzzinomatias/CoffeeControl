ALTER TABLE machines
    ADD COLUMN IF NOT EXISTS last_reported_technical_config JSONB,
    ADD COLUMN IF NOT EXISTS last_reported_technical_config_at TIMESTAMPTZ;
