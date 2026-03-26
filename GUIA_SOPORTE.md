# Guía Rápida de Soporte

Esta guía está pensada para soporte técnico y operativo sobre la instalación actual de CoffeeControl.

## 1. Ubicación de trabajo

Trabajar siempre desde:

```powershell
C:\PROYECTOS\CoffeControl\CoffeeControl_proyecto
```

Backend:

```powershell
cd C:\PROYECTOS\CoffeControl\CoffeeControl_proyecto\backend
```

## 2. Herramienta de mantenimiento recomendada

Uso normal en Windows:

```powershell
cd C:\PROYECTOS\CoffeControl\CoffeeControl_proyecto
.\mantenimiento-coffeecontrol.bat
```

Acciones disponibles:

- `doctor`
- `backup`
- `purge`
- `restore`
- `restore recreando base`
- `rebuild`

## 3. Qué usar en cada caso

### `doctor`

Usar cuando:

- el panel no entra
- hay duda sobre `.env`
- hay duda sobre DB
- hay duda sobre SMTP
- hay que revisar salud general

### `backup`

Usar:

- antes de cualquier cambio delicado
- antes de `purge`
- antes de `restore`
- antes de `rebuild`

### `purge`

Usar cuando querés limpiar datos operativos del piloto sin destruir estructura.

Conserva:

- usuarios
- empleados
- TAGs
- máquinas
- jerarquías
- configuración
- stock configurado

Borra:

- taps
- auditoría
- alertas
- comandos remotos
- pendientes
- movimientos operativos equivalentes

### `restore`

Usar cuando querés volver a un backup conocido.

### `rebuild`

Usar solo en laboratorio o reinstalación completa.

Destruye y recrea la base.

## 4. Comandos útiles

```powershell
cd C:\PROYECTOS\CoffeControl\CoffeeControl_proyecto\backend

npm run support:doctor
npm run db:backup
npm run db:migrate:all
npm run test:integration
```

Con parámetros:

```powershell
node scripts/db-purge.js --dry-run
node scripts/db-purge.js --yes

node scripts/db-restore.js --input C:\Backups\coffeecontrol.sql --yes
node scripts/db-restore.js --input C:\Backups\coffeecontrol.dump --format custom --recreate --confirm coffeecontrol --yes

node scripts/db-rebuild.js --dry-run
node scripts/db-rebuild.js --confirm coffeecontrol
```

## 5. Usuarios del panel

### Roles

- `admin`: acceso total; si está protegido, solo soporte local puede cambiarlo
- `gerente`: gestión funcional completa del cliente
- `supervisor`: analítica y seguimiento solo en sus áreas
- `tecnico`: máquinas, stock y comandos remotos
- `distribuidor`: onboarding y soporte técnico de máquinas

### Crear o actualizar un usuario

```powershell
cd C:\PROYECTOS\CoffeControl\CoffeeControl_proyecto\backend
node scripts/support-user.js --username tecnico1 --password claveSegura2026 --role tecnico --full-name "Técnico 1" --activate
```

### Crear supervisor multi-área

```powershell
node scripts/support-user.js --username supervisor.ventas --password claveSegura2026 --role supervisor --full-name "Supervisor Ventas" --departments "Ventas,RRHH" --activate
```

### Crear distribuidor

```powershell
npm run support:create-distributor -- --username dist.norte --password claveSegura2026 --full-name "Distribuidor Norte"
```

## 6. Cuenta protegida `admin`

La cuenta `admin` protegida:

- no se edita desde el panel
- no se desactiva desde el panel
- no cambia contraseña desde el panel

### Reset local de contraseña

```powershell
cd C:\PROYECTOS\CoffeControl\CoffeeControl_proyecto\backend
node scripts/support-user.js --username admin --password NuevaClaveSegura2026 --role admin --protected --activate
```

## 7. Problemas típicos y respuesta sugerida

### No puedo entrar al panel

Revisar en este orden:

1. `support:doctor`
2. `http://127.0.0.1:3000/health`
3. usuario correcto
4. contraseña correcta
5. rol correcto
6. si es `admin`, recordar que es cuenta protegida

### Un técnico o distribuidor ve “WS no aplica”

Es correcto.

Ese indicador muestra el estado del feed en vivo por WebSocket, no la salud general del backend.

### La máquina aparece offline

Revisar:

1. energía
2. WiFi
3. URL backend
4. `SSID`, `IP`, `RSSI` y `backend_ok` en `Máquinas`
5. reinicio remoto si la máquina sigue alcanzable

### No conecta al WiFi del cliente

Usar:

- portal `CoffeeControl-Setup`
- `Escanear redes`
- `Probar conexión`

### Hay que reconfigurar WiFi sin borrar nada

Con la placa encendida:

- mantener `BOOT` ~5 segundos
- abrir el portal
- editar configuración manualmente

## 8. Portal del ESP32-C3

Funciones actuales del portal:

- mostrar contraseña
- escanear redes
- seleccionar SSID detectado
- probar conexión
- editar URL backend

## 9. Offline

Capacidad actual aproximada:

- tarjetas cacheadas: `1500`
- cola offline: `1000` eventos

Si la cola se llena:

- eventos nuevos pueden descartarse
- el caso debe tratarse como incidente operativo

## 10. Qué revisar antes de tocar datos

Siempre:

1. hacer `backup`
2. confirmar objetivo
3. usar `--dry-run` si existe
4. recién después ejecutar la acción destructiva

## 11. Qué no hacer sin aprobación clara

- `purge` en una instalación productiva sin backup previo
- `restore` sobre una base equivocada
- `rebuild` fuera de laboratorio o recuperación controlada
- desproteger la cuenta `admin` sin razón concreta

## 12. Referencias relacionadas

- [CHECKLIST_PILOTO.md](/C:/PROYECTOS/CoffeControl/CoffeeControl_proyecto/CHECKLIST_PILOTO.md)
- [PROTOCOLO_PRUEBAS.md](/C:/PROYECTOS/CoffeControl/CoffeeControl_proyecto/PROTOCOLO_PRUEBAS.md)
- [README.md](/C:/PROYECTOS/CoffeControl/CoffeeControl_proyecto/README.md)
- [AGENTE.md](/C:/PROYECTOS/CoffeControl/CoffeeControl_proyecto/AGENTE.md)
