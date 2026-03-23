# ☕ CoffeeControl

Sistema de control de consumo de café para empresas con expendedoras automáticas.
Permite saber **quién consume, cuánto, en qué máquina** y aplicar límites o bloqueos por empleado o máquina.

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
        └── adminUsers.js   ← Usuarios del panel (solo gerente)

coffeecontrol-admin.html    ← Panel de administración completo
coffeecontrol.html          ← Dashboard operativo standalone
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

⚠ NO USAR: GPIO2 (strapping), GPIO8 (strapping+LED onboard),
           GPIO18/19 (USB D−/D+), GPIO12-17 (flash interno)
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
```

Configurar variables de entorno (crear `.env` en `backend/`):

```env
DATABASE_URL=postgresql://usuario:contraseña@127.0.0.1:5432/coffeecontrol
JWT_SECRET=cambia_esto_por_un_secreto_largo
REGISTRATION_SECRET=coffeecontrol-secret
PORT=3000
```

Iniciar el servidor:

```bash
node src/server.js
```

El backend escucha en `0.0.0.0:3000` (accesible desde la LAN).

### Usuario admin por defecto

```
Usuario: admin
Contraseña: coffeecontrol
```

> Cambiar la contraseña desde el panel en Configuración → Usuarios.

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
2. Conectarse al WiFi **`CoffeeControl-Setup`** (contraseña: `coffeecontrol`) desde el celular
3. El portal se abre automáticamente → ingresar SSID + contraseña + URL del backend
4. Guardar → el ESP reinicia y aparece como **pendiente** en el panel admin
5. Aprobar desde el panel (asignar nombre y ubicación)

**Reset de configuración:** mantener presionado el botón BOOT (GPIO9) durante 5 segundos al encender.

---

## Panel de administración

Abrir `http://<ip-servidor>:3000` en el navegador.

### Funcionalidades

| Sección | Descripción |
|---|---|
| **Dashboard** | Métricas del día, consumo mensual, % sobre límite, máquinas online/offline, alertas |
| **Máquinas** | Lista con estado online (punto verde/gris), bloquear/desbloquear, aprobar nuevas |
| **Empleados** | CRUD completo, asignar tarjetas NFC, establecer límite diario, historial de consumo |
| **Reportes** | Rankings por máquina y por empleado, consumo mensual |
| **Feed en vivo** | Stream de taps en tiempo real via WebSocket, con filtros por estado/máquina/empleado |
| **Tarjetas desconocidas** | UIDs sin empleado asignado — botón Asignar directamente desde el panel |
| **Usuarios** | Gestión de usuarios del panel con roles gerente/supervisor |

### Indicador online/offline de máquinas

Cada máquina muestra un punto **verde** (activa en los últimos 3 minutos) o **gris** (offline). El firmware hace heartbeat cada 60 segundos actualizando `last_seen` en la base de datos.

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
POST /api/employees             { name, department, email, dni, legajo, phone, daily_limit }
PATCH /api/employees/:id
DELETE /api/employees/:id       ← desactiva empleado + sus tarjetas NFC (transacción)
POST  /api/employees/:id/cards  { uid, label }

GET  /api/reports/machines
GET  /api/reports/employees/:id/machines

GET  /api/admin-users           (solo gerente)
POST /api/admin-users
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

---

## Roles de usuario

| Rol | Acceso |
|---|---|
| `gerente` / `admin` | Todo, incluyendo gestión de usuarios del panel |
| `supervisor` | Dashboard, Reportes, Feed en vivo — sin configuración |

---

## Próximas funcionalidades

- [ ] Notificaciones por email/WhatsApp al bloquear empleado o superar límite
- [ ] Exportar reportes a Excel/PDF
- [ ] OTA (Over The Air) — actualización de firmware desde el panel
- [ ] Multi-tenant para modo SaaS (campo `tenant_id`, schema por empresa)
- [ ] Mapa de máquinas con estado en tiempo real
- [ ] PWA / app móvil para el gerente
- [ ] Seguridad payload MDB: XOR + timestamp contra replay attacks

---

## Licencia

Proyecto privado — uso interno. No redistribuir sin autorización.
