ALTER TABLE admin_users
    ADD COLUMN IF NOT EXISTS is_protected BOOLEAN NOT NULL DEFAULT false;

UPDATE admin_users
SET is_protected = true
WHERE username = 'admin';
