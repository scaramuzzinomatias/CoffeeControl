ALTER TABLE notification_settings
    ADD COLUMN IF NOT EXISTS employee_limit_warning_lead SMALLINT NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS employee_limit_warning_subject TEXT NOT NULL DEFAULT '[CoffeeControl] Advertencia de límite diario: {{employee_name}} ({{taps_today}}/{{daily_limit}})',
    ADD COLUMN IF NOT EXISTS employee_limit_warning_body TEXT NOT NULL DEFAULT 'El empleado {{employee_name}} {{relation_text}} su límite diario de {{daily_limit}} cafés.
Consumo registrado hoy: {{taps_today}}/{{daily_limit}}.
Faltan {{remaining_cups}} café(s) para llegar al tope configurado.
La advertencia se dispara cuando faltan {{warning_lead}} café(s).
Máquina: {{machine_name}}.
Área: {{department}}.
UID NFC: {{uid}}.
Fecha operativa: {{business_date}}.';

ALTER TABLE notification_settings
    DROP CONSTRAINT IF EXISTS notification_settings_employee_limit_warning_lead_check;

ALTER TABLE notification_settings
    ADD CONSTRAINT notification_settings_employee_limit_warning_lead_check
    CHECK (employee_limit_warning_lead BETWEEN 1 AND 10);
