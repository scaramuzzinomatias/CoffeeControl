ALTER TABLE machines
    ADD COLUMN IF NOT EXISTS technical_config_version INT NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS technical_config_source VARCHAR(20) NOT NULL DEFAULT 'backend',
    ADD COLUMN IF NOT EXISTS technical_config_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE machines
SET technical_config_version = 1
WHERE technical_config_version IS NULL OR technical_config_version < 1;

UPDATE machines
SET technical_config_source = 'backend'
WHERE technical_config_source IS NULL
   OR technical_config_source NOT IN ('backend', 'portal', 'factory', 'unknown');

UPDATE machines
SET technical_config_updated_at = COALESCE(technical_config_updated_at, NOW())
WHERE technical_config_updated_at IS NULL;

ALTER TABLE machines
    DROP CONSTRAINT IF EXISTS machines_technical_config_version_check;

ALTER TABLE machines
    ADD CONSTRAINT machines_technical_config_version_check
    CHECK (technical_config_version >= 1);

ALTER TABLE machines
    DROP CONSTRAINT IF EXISTS machines_technical_config_source_check;

ALTER TABLE machines
    ADD CONSTRAINT machines_technical_config_source_check
    CHECK (technical_config_source IN ('backend', 'portal', 'factory', 'unknown'));
