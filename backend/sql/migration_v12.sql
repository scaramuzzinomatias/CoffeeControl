ALTER TABLE notification_settings
    ADD COLUMN IF NOT EXISTS employee_daily_blocked_subject TEXT NOT NULL DEFAULT '[CoffeeControl] Empleado bloqueado por límite diario: {{employee_name}}',
    ADD COLUMN IF NOT EXISTS employee_daily_blocked_body TEXT NOT NULL DEFAULT 'El empleado {{employee_name}} alcanzó su límite diario de {{daily_limit}} cafés.
Intento rechazado en la máquina: {{machine_name}}.
Consumo registrado hoy: {{taps_today}}/{{daily_limit}}.
UID NFC: {{uid}}.
Fecha operativa: {{business_date}}.';
