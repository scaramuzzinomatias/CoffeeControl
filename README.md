# ☕ CoffeeControl

Sistema de control de consumo de café para empresas con expendedoras automáticas.
Permite saber **quién consume, cuánto, en qué máquina** y aplicar límites, jerarquías de acceso o bloqueos por empleado o máquina.

---

## Problema que resuelve

Una empresa con 4 expendedoras gasta $4 millones/mes en café sin saber qué empleados consumen más ni poder limitarlo. CoffeeControl instala un módulo ESP32-C3 en cada máquina que autentica a cada empleado via tarjeta NFC antes de dejar dispensar.

---

## Arquitectura

```
┌─────────────────────────────────────────────────────────────────┐
│  Expendedora (bus MDB)                                          │
│    ↕ MAX3232 (3.3V ↔ 5V)                                       │
│  ESP32-C3 Super Mini  ←SPI→  RC522 (NFC 13.56 MHz)             │
│    ↕ WiFi                                                       │
│  Backend Node.js / Express  ←→  PostgreSQL                      │
│    ↕ WebSocket                                                  │
│  Panel Admin (HTML / JS vanilla / Chart.js)                     │
└─────────────────────────────────────────────────────────────────┘
```

| Capa | Tecnología |
|---|---|
| Firmware | C++ Arduino / PlatformIO — ESP32-C3 Super Mini |
| Protocolo expendedora | MDB Cashless Peripheral (9-bit, bit-banging) |
| Lector NFC | RC522 via SPI |
| Config WiFi | Portal cautivo (captive portal en AP `CoffeeControl-Setup`) |
| Backend | Node.js + Express |
| Base de datos | PostgreSQL |
| Tiempo real | WebSockets (`ws`) |
| Auth panel | JWT (jsonwebtoken + bcryptjs) |
| Frontend | HTML + CSS + JS vanilla + Chart.js |

---

## Estructura del repositorio

```
CoffeeControl/
├── CoffeeControl_v2.ino    ← Firmware v2 (ESP8266, prototipo)
├── CoffeeControl_v3/       ← Firmware v3 ACTIVO (ESP32-C3, producción)
│   ├── platformio.ini
│   └── src/main.cpp
├── MDB9bit.h               ← Librería bit-banging MDB 9 bits (portable)
└── README.md

backend/
├── package.json
├── sql/
│   ├── schema.sql          ← Schema inicial
│   ├── migration_v2.sql    ← Roles, DNI/legajo, admin_users, vistas
│   └── migration_v3.sql    ← MAC en machines, tabla pending_machines
└── src/
    ├── server.js           ← Entry point Express + HTTP/WS
    ├── ws.js               ← WebSocket server + broadcast()
    ├── db/pool.js          ← Pool de conexiones PostgreSQL
    ├── middleware/
    │   ├── authJwt.js      ← JWT para rutas del panel
    │   └── machineAuth.js  ← Auth por MAC para rutas del ESP
    └── routes/
        ├── auth.js         ← Login + cambio de contraseña
        ├── tap.js          ← Core: NFC tap + confirm + cancel
        ├── machines.js     ← CRUD + register + pending + approve + block
        ├── employees.js    ← CRUD + tarjetas NFC + límites
        ├── dashboard.js    ← Métricas diarias, mensuales, feed
        ├── reports.js      ← Rankings por máquina y por empleado
        └── adminUsers.js   ← Usuarios del panel (solo gerente/admin)

coffeecontrol-admin.html    ← Panel de administración completo
coffeecontrol.html          ← Monitor operativo liviano (solo lectura, sesión compartida)
```

---

## Hardware por máquina

### ESP32-C3 Super Mini — target de producción (~$10-11 USD/unidad)

| Componente | Precio aprox. |
|---|---|
| ESP32-C3 Super Mini | ~$2-3 USD |
| RC522 (lector NFC) | ~$4 USD |
| MAX3232 (adaptador MDB 3.3V↔5V) | ~$2 USD |
| DS3231 (RTC, respaldo offline) | ~$1-2 USD |

### Pinout definitivo ESP32-C3 Super Mini

```
RC522 (SPI):              MDB (bit-banging, IRAM_ATTR):
  SS    → GPIO4             TX → GPIO20 → MAX3232 T1IN → bus MDB
  SCK   → GPIO0             RX → GPIO21 ← MAX3232 R1OUT ← bus MDB
  MOSI  → GPIO1
  MISO  → GPIO3            DS3231 RTC (I2C):
  RST   → GPIO7              SDA → GPIO5
  VCC   → 3.3V               SCL → GPIO6

LED externo  → GPIO10     Botón BOOT/Reset → GPIO9 (integrado)

⚠ NO USAR para periféricos externos: GPIO2 (strapping), GPIO8 (strapping + LED onboard azul),
           GPIO18/19 (USB D−/D+), GPIO12-17 (flash interno)

Nota:
- La realimentación visual del botón BOOT usa el LED onboard azul en `GPIO8` y funciona con el firmware ya corriendo, sin depender del arranque.
```

> **Por qué bit-banging para MDB:** El ESP32-C3 soporta hasta 8 bits por UART en hardware; MDB requiere 9 bits por trama. Se usa `MDB9bit.h` portado con `IRAM_ATTR`.

---

## Instalación del backend

### Requisitos
- Node.js ≥ 18
- PostgreSQL ≥ 14

### Pasos

```bash
cd backend
npm install
```

Crear base de datos y aplicar schema:

```bash
createdb coffeecontrol
psql $DATABASE_URL -f sql/schema.sql
psql $DATABASE_URL -f sql/migration_v2.sql
psql $DATABASE_URL -f sql/migration_v3.sql
psql $DATABASE_URL -f sql/migration_v4.sql
psql $DATABASE_URL -f sql/migration_v5.sql
psql $DATABASE_URL -f sql/migration_v6.sql
psql $DATABASE_URL -f sql/migration_v7.sql
psql $DATABASE_URL -f sql/migration_v8.sql
psql $DATABASE_URL -f sql/migration_v9.sql
psql $DATABASE_URL -f sql/migration_v10.sql
psql $DATABASE_URL -f sql/migration_v11.sql
psql $DATABASE_URL -f sql/migration_v12.sql
psql $DATABASE_URL -f sql/migration_v13.sql
psql $DATABASE_URL -f sql/migration_v14.sql
psql $DATABASE_URL -f sql/migration_v15.sql
psql $DATABASE_URL -f sql/migration_v16.sql
psql $DATABASE_URL -f sql/migration_v17.sql
psql $DATABASE_URL -f sql/migration_v18.sql
psql $DATABASE_URL -f sql/migration_v19.sql
psql $DATABASE_URL -f sql/migration_v20.sql
```

Configurar variables de entorno (crear `.env` en `backend/`):

```env
DATABASE_URL=postgresql://usuario:contraseña@127.0.0.1:5432/coffeecontrol
JWT_SECRET=cambia_esto_por_un_secreto_largo
REGISTRATION_SECRET=coffeecontrol-registro-2024
PORT=3000
```

Iniciar el servidor:

```bash
node src/server.js
```

El backend escucha en `0.0.0.0:3000` (accesible desde la LAN).

### Usuarios seed por defecto

```
admin / coffeecontrol
supervisor1 / coffeecontrol2024   (solo lectura operativa)
```

> Cambiar estas contraseñas desde el panel en Configuración → Usuarios.

---

## Firmware — compilar y flashear

### Requisitos
- [PlatformIO](https://platformio.org/) (CLI o extensión VS Code)

### ESP32-C3 Super Mini

```bash
cd CoffeeControl/CoffeeControl_v3
pio run -e esp32c3 -t upload
```

Para flashear en modo manual: mantener **BOOT** → presionar **EN** → soltar **BOOT** → ejecutar el comando.

### Primera configuración de WiFi (captive portal)

1. Encender el ESP32-C3 (sin configuración previa)
2. Conectarse al WiFi **`CoffeeControl-Setup`** desde el celular (red abierta, sin contraseña)
3. El portal se abre automáticamente
4. Ingresar SSID manualmente o tocar **Escanear redes** para elegir una red visible
5. Si hace falta, usar **Mostrar contraseña** para validar la clave WiFi
6. En instalaciones `local`, ingresar la URL del backend
7. Opcional: tocar **Probar conexión** para validar WiFi + `/health` del backend antes de guardar
8. Guardar → el ESP reinicia y aparece como **pendiente** en el panel admin
9. Aprobar desde el panel (asignar nombre y ubicación)

**Acceso manual al portal con botón BOOT (GPIO9):**
- Mantener 5 segundos con el firmware ya iniciado y soltar → abre el AP `CoffeeControl-Setup`
- No borra SSID, contraseña ni URL guardadas; solo habilita el portal para editar y volver a guardar
- Feedback visual:
  - mientras mantenés BOOT, el LED onboard titila lento
  - al llegar a 5s, hace 3 destellos rápidos y queda listo para abrir el portal al soltar

---

## Panel de administración

Abrir `http://<ip-servidor>:3000` en el navegador.

### Funcionalidades

| Sección | Descripción |
|---|---|
| **Dashboard** | Métricas del día, consumo mensual, % sobre límite, máquinas online/offline, alertas |
| **Máquinas** | Lista con estado online, detalle de red (SSID/IP/RSSI/backend), reinicio remoto, cambio de WiFi, escaneo remoto de redes, stock por selección, bloquear/desbloquear y aprobar nuevas |
| **Stock** | Control manual/estimado por máquina y selección, con reposición, ajuste e historial de movimientos |
| **Empleados** | CRUD completo, asignar tarjetas NFC, definir política diaria manual o asociar una jerarquía reutilizable (`bloquear`, `solo advertir`, `sin límite`) e historial de consumo |
| **Jerarquías** | ABM de niveles de acceso reutilizables, con límite diario, modo, advertencia y orden |
| **TAGs NFC** | Vista global con estados `Activo`, `Perdido`, `De baja` y acciones de recuperación |
| **Reportes** | Rango de fechas, resumen operativo, cortes por máquina/empleado/área, filtros por área, jerarquía y búsqueda rápida de empleado, reportes específicos de stock, gráficos y exportación Excel/PDF |
| **Feed en vivo** | Stream de taps en tiempo real via WebSocket, con filtros por estado/máquina/empleado |
| **Tarjetas desconocidas** | UIDs sin empleado asignado — botón Asignar directamente desde el panel |
| **Usuarios** | Gestión de usuarios del panel con roles gerente, supervisor, técnico y distribuidor; los supervisores aceptan una o varias áreas asignadas |
| **Sistema** | Zona horaria operativa global (`business_timezone`) |
| **Alertas por email** | Máquina offline, empleado bloqueado y advertencia preventiva de límite (si SMTP está configurado) |
| **Auditoría** | Bitácora administrativa con actor, acción, objeto y detalle técnico saneado |

### Indicador online/offline de máquinas

Cada máquina muestra un punto **verde** (activa en los últimos 3 minutos) o **gris** (offline). El firmware hace heartbeat cada 60 segundos actualizando `last_seen` en la base de datos.

### Reportes avanzados

La pantalla `Reportes` ahora trabaja con rango `desde / hasta` y muestra:

- resumen del rango: aprobados, rechazados, total de eventos, importe expendido, máquinas con ventas y empleados con consumo
- evolución diaria del rango
- ranking por máquina con detalle de empleados del período
- ranking por empleado con detalle de máquinas del período
- resumen por departamento / área
- filtro global por área, jerarquía y búsqueda rápida por nombre / legajo / email / DNI para ubicar un empleado puntual
- sección de **stock** para `gerente/admin`, con estado actual por máquina, movimientos del rango y paquete exportable Excel/PDF
- exportación global a Excel (`.xlsx`) y PDF desde la cabecera de la pantalla
- detalle exportable por empleado y por área, pensado para reuniones de gestión

Los gráficos usan `Chart.js` y respetan la `business_timezone` configurada en `Sistema`.

Importante:

- el filtro por **área** recorta el resumen, los rankings y las exportaciones del rango
- la búsqueda rápida de **empleado** recorta la tabla y exportaciones de `Empleados`, sin deformar el resumen global del sector
- si el usuario es `supervisor`, el backend recorta dashboard, feed y reportes a sus áreas asignadas (`admin_user_departments`)
- si el usuario es `tecnico`, el panel aterriza en `Máquinas` y no puede acceder a dashboard, reportes, feed ni configuración global
- si el usuario es `distribuidor`, el panel aterriza en `Máquinas`, puede gestionar onboarding/configuración de máquinas y no accede a analítica, empleados ni configuración global
- el bloque de **stock** es global por máquina y en esta V1 no se recorta por área

### Estado de red por máquina

La vista **Máquinas** también muestra telemetría de red enviada por el ESP32-C3:

- SSID WiFi actual
- IP local actual
- RSSI aproximado
- URL backend configurada
- Estado del backend (`OK` o sin respuesta)
- Último error de conexión reportado por la máquina

Desde esa misma vista ahora también se puede:

- enviar **reinicio remoto**
- abrir modal de **cambio de WiFi**
- pedir **escaneo remoto de redes** visibles en el entorno real de esa máquina

### Control de stock por máquina

La vista **Máquinas** ahora tiene un botón **Stock** por equipo. Esta primera versión trabaja en modo **manual/estimado** y modela inventario por `machine + item_id`.

Cada selección puede guardar:

- nombre visible del producto
- slot / espiral opcional
- capacidad
- stock actual
- mínimo de alerta
- estado `OK`, `Bajo`, `Sin stock` o `Inactivo`

Operación disponible en esta V1:

- alta de selección
- edición de configuración
- reposición manual
- ajuste manual
- baja / reactivación de selección
- historial de movimientos (`sale`, `restock`, `adjustment`, `unconfigured_sale`)

Cuando una venta queda confirmada en `POST /api/tap/result`, el backend descuenta automáticamente `1` unidad de la selección correspondiente. Si esa selección todavía no está configurada, **la venta no se rompe**: solo se registra un movimiento `unconfigured_sale` para dejar trazabilidad.

En esta etapa el stock es **informativo / operativo**:

- no bloquea expendios por falta de stock
- no depende todavía de DEX/UCS
- ya dispara alertas de **stock bajo / sin stock** cuando una selección activa cae al mínimo configurado o queda vacía
- la alerta se resuelve sola al reponer o ajustar por encima del mínimo
- la activación del evento se controla desde `Panel admin > Notificaciones`
- `Panel admin > Reportes` suma una vista específica de stock para `gerente/admin`, con estado actual, movimientos del rango y exportación dedicada

### Zona horaria operativa

El sistema ahora maneja una `business_timezone` global configurable desde `Panel admin > Sistema`.

Esa zona horaria define:

- el día operativo para límites diarios y advertencias
- el mes operativo para reportes y rankings
- la fecha que descarga el ESP32-C3 para autenticación offline
- el `next_reset_at` que usa el firmware para resetear contadores sin depender de una medianoche local inferida

Valor por defecto:

- `America/Argentina/Buenos_Aires`

La configuración usa identificadores IANA reales, por ejemplo:

- `America/Santiago`
- `America/Lima`
- `America/Mexico_City`

### Notificaciones automáticas por email

El backend ya puede enviar emails automáticos para estos eventos:

- advertencia preventiva de límite diario al empleado y supervisores activos de su área
- empleado bloqueado por límite diario
- máquina offline por falta de heartbeat
- stock bajo / sin stock por selección configurada

El estado `backend sin respuesta` se mantiene como diagnóstico en la vista de máquinas, pero ya no genera email.

La operación diaria ahora se configura desde `Panel admin > Notificaciones`:

- activar o desactivar la capa de alertas
- definir destinatarios
- elegir qué eventos envían mail
- definir el umbral del aviso preventivo (`faltan N cafés`)
- lanzar una prueba manual de envío

Las credenciales SMTP siguen en `backend/.env`. Para activarlo hay que completar estas variables:

- `ALERT_EMAIL_TO`
- `ALERT_EMAIL_FROM`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER`
- `SMTP_PASS`

### Política diaria por empleado

Cada empleado ahora puede trabajar en uno de estos modos:

- `Bloquear al alcanzar el límite`: comportamiento clásico; al llegar al tope diario, no se aprueban más taps.
- `Solo advertir y registrar`: el consumo sigue permitido, pero queda marcado y puede disparar aviso preventivo.
- `Sin límite diario`: el límite queda solo como dato informativo.

Además, cada empleado puede activar o desactivar la advertencia por email cuando queda cerca del límite diario. Si esa advertencia está activa y el evento también está habilitado en `Notificaciones`, el sistema envía el aviso a:

- el email del propio empleado
- los usuarios `supervisor` activos con email cargado y alcance sobre esa misma área

El umbral de esa advertencia se configura globalmente desde `Notificaciones` como “faltan N cafés”. Las plantillas de email quedan fuera del panel y se ajustan desde [notificationTemplates.js](/C:/PROYECTOS/CoffeControl/CoffeeControl_proyecto/backend/src/config/notificationTemplates.js), para no exponer variables sensibles a usuarios funcionales.

En modo offline, el ESP32-C3 descarga y respeta esta misma política al autenticar tarjetas desde caché local.

### Jerarquías de acceso

La pantalla `Jerarquías` permite definir políticas reutilizables para distintos perfiles internos, por ejemplo `Standard`, `Supervisión`, `Gerencia` o `VIP`.

Cada jerarquía puede configurar:

- `daily_limit`
- `daily_limit_mode`
- `warning_enabled`
- descripción
- orden de visualización

En `Empleados`, cada persona puede seguir con política **manual** o quedar asociada a una **jerarquía**. Cuando un empleado tiene `access_level_id`, el backend usa esa política efectiva en:

- `POST /api/tap`
- `POST /api/tap/queue`
- `GET /api/tap/cards` para el caché offline del ESP32-C3
- dashboard y reportes

Si no hay jerarquía asignada, el sistema cae automáticamente a la configuración manual del empleado.

### Estados de TAG NFC

Los TAGs NFC ahora tienen un estado operativo explícito:

- `Activo`: autoriza consumo normalmente
- `Perdido`: se bloquea por seguridad, conserva historial y puede reactivarse o reasignarse
- `De baja`: queda desactivado, conserva historial y puede reactivarse más adelante

Desde el panel se puede:

- `Marcar perdido`
- `Dar de baja`
- `Reactivar`
- `Reasignar`

Si un TAG perdido o dado de baja se intenta usar, el backend lo rechaza con:

- `card_lost`
- `card_inactive`

---

## API REST — resumen de endpoints

### Autenticación
```
POST /api/auth/login          { username, password } → { token, role }
```

### Máquinas (auth por MAC — header X-Machine-Mac)
```
POST /api/tap                 { nfc_uid } → 200 | 403 | 401
POST /api/tap/confirm         { nfc_uid, item_id, amount }
POST /api/tap/cancel          { nfc_uid }
POST /api/machines/register   { mac } → 200 | 202 (pendiente)
```

### Panel admin (auth JWT — header Authorization: Bearer token)
```
GET  /api/dashboard/today
GET  /api/dashboard/monthly
GET  /api/dashboard/feed
GET  /api/dashboard/unknown-uids

GET  /api/machines              ← incluye campo online: bool
GET  /api/machines/pending
POST /api/machines/pending/:id/approve  { name, location }
POST /api/machines/:id/block    { reason }
POST /api/machines/:id/unblock

GET  /api/employees
POST /api/employees             { name, department, email, dni, legajo, phone, daily_limit, daily_limit_mode, warning_enabled }
PATCH /api/employees/:id
DELETE /api/employees/:id       ← desactiva empleado + sus tarjetas NFC (transacción)
POST  /api/employees/:id/cards  { uid, label }

GET  /api/reports/machines
GET  /api/reports/employees/:id/machines

GET  /api/admin-users           (solo gerente/admin)
POST /api/admin-users           { username, password, role, full_name, email, department_scopes[] }

GET  /api/notification-settings
PUT  /api/notification-settings
POST /api/notification-settings/test

GET  /api/system-settings
PUT  /api/system-settings       { business_timezone }
```

### Scripts DB y soporte

El backend ahora trae scripts Node para operar la base y usuarios sin depender de `psql`, pensados para Windows y para soporte rápido:

```bash
cd backend

npm run db:init
npm run db:migrate:all
npm run db:backup
npm run db:purge -- --dry-run
npm run db:drop -- --dry-run
npm run db:restore -- --input ..\\backups\\db\\coffeecontrol-YYYYMMDD-HHMMSS.sql --dry-run
npm run db:rebuild -- --dry-run
npm run support:doctor
npm run test:integration

node scripts/support-user.js --username admin --password nuevaClaveSegura --role admin
node scripts/support-user.js --username admin --password nuevaClaveSegura --role admin --protected --activate
node scripts/support-user.js --username supervisor.ventas --password coffeecontrol2024 --role supervisor --full-name "Supervisor Ventas" --email supervisor@empresa.com --departments "Ventas,RRHH"
node scripts/support-user.js --username dist.norte --password coffeecontrol2024 --role distribuidor --full-name "Distribuidor Norte"
```

Qué hace cada uno:

- `db:init`: aplica el estado actual de `sql/schema.sql` sobre una base vacía.
- `db:migrate:all`: ejecuta en orden todas las migraciones `migration_v2.sql ... migration_v23.sql`.
- `db:backup`: genera un backup lógico con `pg_dump` en `backups/db/` o en la ruta indicada por `--output`.
- `db:purge`: limpia datos operativos/transaccionales sin borrar usuarios, empleados, TAGs, máquinas, jerarquías, configuración ni stock configurado. También resetea `last_seen` y la telemetría dinámica de máquinas.
- `db:drop`: borra la base configurada en `DATABASE_URL`; exige confirmación explícita con `--confirm nombre_bd`.
- `db:restore`: restaura un backup `.sql` o `.dump`; acepta `--recreate` para reconstruir la base antes de restaurar.
- `db:rebuild`: reconstruye la base desde cero usando `schema.sql` y luego aplica las migraciones faltantes del repo.
- `support:doctor`: valida `.env`, conexión PostgreSQL, tablas clave, SMTP y `/health` del backend.
- `test:integration`: levanta un backend temporal en puerto alternativo y valida login, scopes multi-área, `403` fuera de alcance, estados de TAG NFC, comandos remotos, permisos sobre `Notificaciones`/`Auditoría`, jerarquías de acceso, política efectiva en `tap` / `tap/cards`, filtros de reportes por jerarquía, configuración de stock, alertas de stock, reportes de stock, el rol `tecnico`, el rol `distribuidor` y cuentas protegidas.
- `support:reset-admin`: wrapper para resetear o crear el usuario `admin` del panel.
- `support:user`: crea o actualiza cualquier usuario del panel (`admin`, `gerente`, `supervisor`, `tecnico`, `distribuidor`). Si el rol es `supervisor`, acepta múltiples áreas con `--departments`. También permite marcar o desmarcar cuentas protegidas con `--protected` / `--unprotect`.
- `support:create-supervisor`: wrapper cómodo de `support:user` para supervisores; igual requiere `--username`, `--password` y opcionalmente `--departments`.
- `support:create-technician`: wrapper cómodo de `support:user` para dar de alta un técnico operativo.
- `support:create-distributor`: wrapper cómodo de `support:user` para dar de alta un distribuidor operativo.

Detalle importante:

- las áreas de supervisor se guardan en `admin_user_departments`
- dejar `--departments` vacío para un supervisor equivale a acceso amplio
- la cuenta `admin` queda protegida por defecto: no puede editarse, desactivarse ni cambiar su contraseña desde el panel
- una cuenta protegida solo se administra desde soporte local con `node scripts/support-user.js ... --protected` o `--unprotect`
- estos scripts toman `DATABASE_URL` desde `backend/.env`
- `db:backup` intenta encontrar `pg_dump` automáticamente (PATH, `PG_BIN` o instalación típica de PostgreSQL en Windows)
- `db:restore` intenta encontrar `psql` o `pg_restore` automáticamente según el tipo de backup
- `db:purge` y `db:drop` aceptan `--dry-run` para revisar antes de ejecutar algo destructivo
- `db:restore` exige `--yes` para ejecutar, y si se usa `--recreate` también exige `--confirm nombre_bd`
- `db:rebuild` es destructivo y exige `--confirm nombre_bd`
- en PowerShell, para scripts con parámetros conviene usar `node scripts/...` directamente; `npm run` queda perfecto para tareas sin argumentos como `db:migrate:all` o `support:doctor`
- si `full-name` o `departments` llevan espacios, usá la variante directa con `node scripts/support-user.js ...`

Menú simple para Windows:

- En la raíz del repo hay dos launchers:
  - `mantenimiento-coffeecontrol.bat`
  - `mantenimiento-coffeecontrol.ps1`
- Ambos trabajan sobre `backend/.env` y ofrecen menú para:
  - `doctor`
  - `backup`
  - `purge`
  - `restore`
  - `restore recreando base`
  - `rebuild`
- El menú muestra la base objetivo, la carpeta de backups, los últimos backups y advertencias claras antes de acciones destructivas.
- Incluye `Ayuda rápida` para soporte.
- El `.bat` es el acceso más cómodo para soporte diario en Windows.

Ejemplos:

```powershell
.\mantenimiento-coffeecontrol.bat
.\mantenimiento-coffeecontrol.bat -Action doctor
.\mantenimiento-coffeecontrol.ps1 -Action backup
.\mantenimiento-coffeecontrol.ps1 -Action restore -InputPath C:\Backups\coffeecontrol.sql
.\mantenimiento-coffeecontrol.ps1 -Action restore -InputPath C:\Backups\coffeecontrol.sql -Recreate
```

Ejemplos rápidos:

```bash
npm run db:backup
node scripts/db-backup.js --output C:\Backups\coffeecontrol.sql

node scripts/db-purge.js --dry-run
node scripts/db-purge.js --yes

node scripts/db-drop.js --dry-run
node scripts/db-drop.js --confirm coffeecontrol

node scripts/db-restore.js --input C:\Backups\coffeecontrol.sql --yes
node scripts/db-restore.js --input C:\Backups\coffeecontrol.dump --format custom --recreate --confirm coffeecontrol --yes

node scripts/db-rebuild.js --dry-run
node scripts/db-rebuild.js --confirm coffeecontrol
```

### WebSocket — `ws://host/ws`

Eventos emitidos al dashboard:

| Evento | Descripción |
|---|---|
| `tap_approved` | Tap aprobado con datos del empleado |
| `tap_denied` | Tap rechazado (límite superado / bloqueado) |
| `card_unknown` | UID sin empleado asignado |
| `vend_confirmed` | Producto dispensado (item + monto) |
| `machine_pending` | Nueva máquina esperando aprobación |
| `machine_approved` | Máquina aprobada por el admin |
| `machine_blocked` | Máquina bloqueada |

Acceso:

- el handshake del WebSocket del panel ahora exige JWT válido
- `coffeecontrol-admin.html` conecta usando la sesión del login
- `coffeecontrol.html` quedó como monitor operativo liviano y solo lectura
- usa la misma sesión JWT del panel (`cc_token` en `localStorage`)
- si no hay sesión válida, muestra acceso guiado al panel admin en `/`
- solo `gerente/admin/supervisor` pueden abrirlo; `tecnico` y `distribuidor` quedan fuera de este monitor
- solo `gerente/admin/supervisor` pueden consumir el feed en vivo; los roles `tecnico` y `distribuidor` no se conectan al canal WS

---

## Roles de usuario

| Rol | Acceso |
|---|---|
| `admin` | Acceso total. Si la cuenta está marcada como protegida, solo puede administrarse desde soporte local |
| `gerente` | Todo a nivel funcional del cliente, incluyendo gestión de usuarios del panel |
| `supervisor` | Dashboard, Reportes y Feed en vivo, acotados a una o varias áreas asignadas — sin configuración |
| `tecnico` | Máquinas, stock y comandos remotos; sin acceso a empleados, analítica, feed ni configuración global |
| `distribuidor` | Máquinas, stock, comandos remotos y onboarding/configuración de máquinas; sin acceso a empleados, analítica, feed ni configuración global |

---

## Documentación operativa de piloto

- [CHECKLIST_PILOTO.md](/C:/PROYECTOS/CoffeControl/CoffeeControl_proyecto/CHECKLIST_PILOTO.md)
- [PROTOCOLO_PRUEBAS.md](/C:/PROYECTOS/CoffeControl/CoffeeControl_proyecto/PROTOCOLO_PRUEBAS.md)
- [GUIA_SOPORTE.md](/C:/PROYECTOS/CoffeControl/CoffeeControl_proyecto/GUIA_SOPORTE.md)

---

## Próximas funcionalidades

- [x] Notificaciones por email configurables desde el panel
- [x] Auditoría administrativa desde el panel
- [x] Exportar reportes a Excel/PDF
- [x] Control de stock V1 manual/estimado por máquina y selección
- [x] Reportes específicos de stock para `gerente/admin`
- [x] Perfil técnico para operar máquinas, stock y comandos remotos sin permisos gerenciales
- [x] Jerarquías de acceso reutilizables con política efectiva online/offline y filtro en reportes
- [x] Scripts DB y soporte (`db:migrate:all`, `support:doctor`, reseteo/alta de usuarios del panel)
- [x] Tests de integración mínimos (`npm run test:integration`)
- [ ] OTA (Over The Air) — actualización de firmware desde el panel
- [ ] Multi-tenant para modo SaaS (campo `tenant_id`, schema por empresa)
- [ ] Mapa de máquinas con estado en tiempo real
- [ ] PWA / app móvil para el gerente
- [ ] Seguridad payload MDB: XOR + timestamp contra replay attacks

---

## Licencia

Proyecto privado — uso interno. No redistribuir sin autorización.
