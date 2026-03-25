module.exports = {
    employeeLimitWarning: {
        subject: '[CoffeeControl] Advertencia de límite diario: {{employee_name}} ({{taps_today}}/{{daily_limit}})',
        body: [
            'El empleado {{employee_name}} {{relation_text}} su límite diario de {{daily_limit}} cafés.',
            'Consumo registrado hoy: {{taps_today}}/{{daily_limit}}.',
            'Faltan {{remaining_cups}} café(s) para llegar al tope configurado.',
            'La advertencia se dispara cuando faltan {{warning_lead}} café(s).',
            'Máquina: {{machine_name}}.',
            'Área: {{department}}.',
            'UID NFC: {{uid}}.',
            'Fecha operativa: {{business_date}}.'
        ].join('\n')
    },
    employeeDailyBlocked: {
        subject: '[CoffeeControl] Empleado bloqueado por límite diario: {{employee_name}}',
        body: [
            'El empleado {{employee_name}} alcanzó su límite diario de {{daily_limit}} cafés.',
            'Intento rechazado en la máquina: {{machine_name}}.',
            'Consumo registrado hoy: {{taps_today}}/{{daily_limit}}.',
            'UID NFC: {{uid}}.',
            'Fecha operativa: {{business_date}}.'
        ].join('\n')
    },
    machineOffline: {
        subject: '[CoffeeControl] Máquina offline: {{machine_name}}',
        body: [
            'La máquina {{machine_name}} quedó offline.',
            'Ubicación: {{location}}.',
            'Último contacto: {{last_seen}}.',
            'SSID: {{wifi_ssid}}.',
            'IP reportada: {{wifi_ip}}.',
            'Backend configurado: {{backend_url}}.'
        ].join('\n')
    }
};
