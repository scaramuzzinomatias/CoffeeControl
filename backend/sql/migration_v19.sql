ALTER TABLE notification_settings
    ADD COLUMN IF NOT EXISTS notify_stock_low BOOLEAN NOT NULL DEFAULT false;
