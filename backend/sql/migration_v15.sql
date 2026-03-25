-- ══════════════════════════════════════════════════════
--  CoffeeControl — Migración v15 — Estados explícitos para TAGs NFC
--  Ejecutar: psql $DATABASE_URL -f migration_v15.sql
-- ══════════════════════════════════════════════════════

ALTER TABLE nfc_cards
    ADD COLUMN IF NOT EXISTS status VARCHAR(16);

UPDATE nfc_cards
SET status = CASE
    WHEN active = true THEN 'active'
    ELSE 'inactive'
END
WHERE status IS NULL;

ALTER TABLE nfc_cards
    ALTER COLUMN status SET DEFAULT 'active',
    ALTER COLUMN status SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'nfc_cards_status_check'
    ) THEN
        ALTER TABLE nfc_cards
            ADD CONSTRAINT nfc_cards_status_check
            CHECK (status IN ('active', 'inactive', 'lost'));
    END IF;
END $$;

UPDATE nfc_cards
SET active = CASE WHEN status = 'active' THEN true ELSE false END
WHERE active IS DISTINCT FROM CASE WHEN status = 'active' THEN true ELSE false END;
