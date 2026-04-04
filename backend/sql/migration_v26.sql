-- ══════════════════════════════════════════════════════
--  CoffeeControl — Migración v26 — Configuración técnica remota de máquina
--  Ejecutar: psql $DATABASE_URL -f migration_v26.sql
-- ══════════════════════════════════════════════════════

ALTER TABLE machines
ADD COLUMN IF NOT EXISTS pricing_profile VARCHAR(40) NOT NULL DEFAULT 'rubino_half_credit',
ADD COLUMN IF NOT EXISTS mdb_feature_level SMALLINT NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS mdb_country_code INT NOT NULL DEFAULT 50,
ADD COLUMN IF NOT EXISTS mdb_scale_factor SMALLINT NOT NULL DEFAULT 100,
ADD COLUMN IF NOT EXISTS mdb_decimal_places SMALLINT NOT NULL DEFAULT 2,
ADD COLUMN IF NOT EXISTS mdb_max_response_time SMALLINT NOT NULL DEFAULT 5,
ADD COLUMN IF NOT EXISTS mdb_misc_options SMALLINT NOT NULL DEFAULT 0;

UPDATE machines
SET pricing_profile = 'rubino_half_credit'
WHERE pricing_profile IS NULL
   OR pricing_profile NOT IN ('rubino_half_credit', 'identity');

UPDATE machines
SET mdb_feature_level = 1
WHERE mdb_feature_level IS NULL OR mdb_feature_level < 0 OR mdb_feature_level > 255;

UPDATE machines
SET mdb_country_code = 50
WHERE mdb_country_code IS NULL OR mdb_country_code < 0 OR mdb_country_code > 65535;

UPDATE machines
SET mdb_scale_factor = 100
WHERE mdb_scale_factor IS NULL OR mdb_scale_factor < 0 OR mdb_scale_factor > 255;

UPDATE machines
SET mdb_decimal_places = 2
WHERE mdb_decimal_places IS NULL OR mdb_decimal_places < 0 OR mdb_decimal_places > 255;

UPDATE machines
SET mdb_max_response_time = 5
WHERE mdb_max_response_time IS NULL OR mdb_max_response_time < 0 OR mdb_max_response_time > 255;

UPDATE machines
SET mdb_misc_options = 0
WHERE mdb_misc_options IS NULL OR mdb_misc_options < 0 OR mdb_misc_options > 255;

ALTER TABLE machines
DROP CONSTRAINT IF EXISTS machines_pricing_profile_check,
DROP CONSTRAINT IF EXISTS machines_mdb_feature_level_check,
DROP CONSTRAINT IF EXISTS machines_mdb_country_code_check,
DROP CONSTRAINT IF EXISTS machines_mdb_scale_factor_check,
DROP CONSTRAINT IF EXISTS machines_mdb_decimal_places_check,
DROP CONSTRAINT IF EXISTS machines_mdb_max_response_time_check,
DROP CONSTRAINT IF EXISTS machines_mdb_misc_options_check;

ALTER TABLE machines
ADD CONSTRAINT machines_pricing_profile_check
CHECK (pricing_profile IN ('rubino_half_credit', 'identity')),
ADD CONSTRAINT machines_mdb_feature_level_check
CHECK (mdb_feature_level BETWEEN 0 AND 255),
ADD CONSTRAINT machines_mdb_country_code_check
CHECK (mdb_country_code BETWEEN 0 AND 65535),
ADD CONSTRAINT machines_mdb_scale_factor_check
CHECK (mdb_scale_factor BETWEEN 0 AND 255),
ADD CONSTRAINT machines_mdb_decimal_places_check
CHECK (mdb_decimal_places BETWEEN 0 AND 255),
ADD CONSTRAINT machines_mdb_max_response_time_check
CHECK (mdb_max_response_time BETWEEN 0 AND 255),
ADD CONSTRAINT machines_mdb_misc_options_check
CHECK (mdb_misc_options BETWEEN 0 AND 255);
