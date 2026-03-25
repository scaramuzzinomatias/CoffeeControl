ALTER TABLE notification_settings
    DROP COLUMN IF EXISTS employee_limit_warning_subject,
    DROP COLUMN IF EXISTS employee_limit_warning_body,
    DROP COLUMN IF EXISTS employee_daily_blocked_subject,
    DROP COLUMN IF EXISTS employee_daily_blocked_body;
