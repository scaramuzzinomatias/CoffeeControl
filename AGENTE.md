# AGENTE.md — CoffeeControl
> Archivo de continuidad del proyecto. Leer antes de cualquier sesión nueva.
> Última actualización: 23/03/2026 — fix autoregistro de máquinas (Opción B: REGISTRATION_SECRET).

---

## Qué es este proyecto

Sistema de control de consumo de café para empresas con expendedoras automáticas. Una empresa tiene 4 expendedoras y gasta $4 millones/mes. El gerente necesita saber quién consume, cuánto, en qué máquina, y poder poner límites o bloquear empleados/máquinas.

---

## Decisiones de arquitectura tomadas

### Hardware por máquina
- **Microcontrolador:** ESP8266 (NodeMCU o Wemos D1 Mini) — ~$3 USD
- **Lector NFC:** RC522 (13.56 MHz, protocolo SPI) — ~$4 USD
- **Adaptador de nivel:** MAX3232 (convierte 3.3V ESP ↔ 5V bus MDB) — ~$2 USD
- **Total hardware por máquina:** ~$9 USD

### Por qué ESP8266 y no Raspberry Pi
- RPi es overkill, cara (~$80), corre Linux (SD corruptible si se va la luz)
- ESP8266 arranca en segundos, sin SO, consume poco, WiFi integrado
- Se descartó Arduino solo porque no tiene WiFi nativo

### Protocolo MDB (Multi-Drop Bus)
- Las expendedoras usan MDB estándar ISO — el ESP se registra como **Cashless Peripheral** (tipo 0x10)
- MDB usa 9 bits por trama (8 datos + 1 bit de modo dirección/dato)
- El ESP8266 NO soporta 9 bits por hardware en su UART
- **Solución adoptada:** bit-banging por software en `MDB9bit.h` — a 9600 baud cada bit dura 104µs, tiempo suficiente para GPIO manual con `delayMicroseconds()`
- Se usa `noInterrupts()`/`interrupts()` alrededor de cada byte transmitido para evitar que el WiFi interrumpa el timing
- El sampleo de bits recibidos se hace en el **centro** del bit (espera 1.5 × bitDuration) igual que el firmware VMflow de referencia

### Referencia externa analizada
Se subió código de **VMflow.xyz** (ESP32-S3 + MDB + BLE + MQTT). Decisión: no usar como base, seguir con ESP8266 + HTTP REST. Lo que se tomó: confirmación del bit-banging como técnica válida, y la idea del payload XOR con timestamp para evitar replay attacks (pendiente implementar).

### Autenticación de máquinas
- **Descartado:** `MACHINE_ID` + `MACHINE_SECRET` hardcodeados (requería tocar el código por máquina)
- **Adoptado:** MAC address del ESP8266 como identificador único
  - La MAC se lee con `WiFi.macAddress()`, es única de fábrica, no se puede cambiar
  - Se envía en el header `X-Machine-Mac` en cada request
  - El backend autentica buscando esa MAC en la tabla `machines`

### Configuración WiFi y URL del servidor
- **Portal cautivo:** el ESP levanta un AP `CoffeeControl-Setup`, el cliente/técnico se conecta con el celular, un portal web recibe SSID + password + URL del servidor
- Los tres valores se guardan en **EEPROM** y persisten entre reinicios
- **Botón de reset físico:** pin D0 con pulsador a GND, mantener 5 segundos al encender borra EEPROM y vuelve al portal
- **Modo deployment** se elige en tiempo de compilación con `#define DEPLOYMENT_MODE`:
  - `"local"` → el portal muestra el campo URL del servidor (técnico lo configura en cada instalación)
  - `"saas"` → el portal oculta el campo URL, usa siempre `BACKEND_URL` hardcodeada (todos los ESP apuntan al mismo servidor en la nube)

### Autoregistro de máquinas
- Al arrancar, el ESP hace `POST /api/machines/register` con su MAC
- Backend responde: `200` (ya aprobada), `202` (pendiente)
- El admin ve una notificación en el panel y aprueba con nombre + ubicación
- El panel muestra badge rojo con cantidad de máquinas pendientes
- Se actualiza en tiempo real por WebSocket

---

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Firmware | C++ Arduino (ESP8266) |
| Protocolo expendedora | MDB cashless peripheral |
| NFC | RC522 vía SPI |
| WiFi config | Portal cautivo (ESP8266WebServer) |
| Backend | Node.js + Express |
| Base de datos | PostgreSQL |
| Tiempo real | WebSockets (librería `ws`) |
| Autenticación panel | JWT (jsonwebtoken + bcryptjs) |
| Frontend | HTML + CSS + JS vanilla + Chart.js |

---

## Estructura de archivos del proyecto

```
CoffeeControl/
├── CoffeeControl.ino       ← Firmware v1 (con secret hardcodeado, obsoleto)
├── CoffeeControl_v2.ino    ← Firmware v2 ACTIVO (MAC auth + portal + autoregistro)
├── MDB9bit.h               ← Librería bit-banging MDB 9 bits (reutilizable)
└── README.md               ← Diagrama de conexión y setup Arduino IDE

backend/
├── package.json            ← Dependencias Node.js
├── .env.example            ← Template de variables de entorno
├── sql/
│   ├── schema.sql          ← Schema inicial (tablas base)
│   ├── migration_v2.sql    ← Agrega roles, DNI/legajo, tabla admin_users, vistas
│   └── migration_v3.sql    ← Agrega MAC en machines, tabla pending_machines
└── src/
    ├── server.js           ← Entry point Express + HTTP + WebSocket
    ├── ws.js               ← WebSocket server + broadcast()
    ├── db/
    │   └── pool.js         ← Pool de conexiones PostgreSQL
    ├── middleware/
    │   ├── authJwt.js      ← Verifica JWT para rutas del panel
    │   └── machineAuth.js  ← Verifica MAC para rutas del ESP8266
    └── routes/
        ├── auth.js         ← POST /api/auth/login + change-password
        ├── tap.js          ← POST /api/tap (core) + /confirm + /cancel
        ├── machines.js     ← CRUD + /register + /pending + /approve + block/unblock
        ├── employees.js    ← CRUD + tarjetas NFC + límites
        ├── dashboard.js    ← GET today + monthly + feed
        ├── reports.js      ← Rankings por máquina y por empleado
        └── adminUsers.js   ← CRUD usuarios del panel (solo gerente)

coffeecontrol.html          ← Dashboard operativo (conectado al backend real)
coffeecontrol-admin.html    ← Panel de administración completo
```

---

## Base de datos — tablas principales

```sql
employees       id, name, department, email, dni, legajo, phone, daily_limit, active
nfc_cards       id, uid (hex), employee_id, label, active
machines        id, name, location, mac, secret, active, blocked, blocked_reason, last_seen
pending_machines id, mac, first_seen, last_ping, approved
taps            id, employee_id, machine_id, nfc_uid, approved, deny_reason, item_id, amount_cents, confirmed, tapped_at
admin_users     id, username, password_hash, role, full_name, department, active

-- Vistas calculadas:
daily_consumption        -- taps de hoy por empleado con status (ok/warning/blocked)
monthly_summary          -- resumen mensual por empleado
machine_status           -- estado de máquinas con estadísticas
employee_machine_consumption  -- dónde consumió cada empleado (mes actual)
```

---

## API REST — endpoints

### Públicos (sin auth)
```
POST /api/auth/login              { username, password } → { token, role }
```

### Máquinas — autenticación por MAC (header X-Machine-Mac)
```
POST /api/tap                     { nfc_uid } → 200 (OK) | 403 (límite) | 401 (mac no registrada)
POST /api/tap/confirm             { nfc_uid, item_id, amount }
POST /api/tap/cancel              { nfc_uid }
POST /api/machines/register       { mac } → 200 (aprobada) | 202 (pendiente)   ← header X-Registration-Secret requerido
```

### Panel admin — autenticación JWT (header Authorization: Bearer token)
```
GET  /api/dashboard/today         → resumen del día + alertas
GET  /api/dashboard/monthly       → resumen del mes
GET  /api/dashboard/feed          → últimos 50 taps del día

GET  /api/machines                → lista con estado y estadísticas
GET  /api/machines/pending        → máquinas sin aprobar
POST /api/machines/pending/:id/approve  { name, location }
POST /api/machines/pending/:id/reject
POST /api/machines/:id/block      { reason }
POST /api/machines/:id/unblock

GET  /api/employees               → lista con tarjetas NFC
GET  /api/employees/:id           → detalle + consumo por máquina + historial
POST /api/employees               { name, department, email, dni, legajo, phone, daily_limit }
PATCH /api/employees/:id          (mismos campos, todos opcionales)
PATCH /api/employees/:id/limit    { daily_limit }
POST /api/employees/:id/cards     { uid, label }
DELETE /api/employees/:id/cards/:cardId
DELETE /api/employees/:id             (soft delete — pone active=false)

GET  /api/machines                → lista con estado y estadísticas
DELETE /api/machines/:id          (soft delete — pone active=false)

GET  /api/reports/machines        → ranking de máquinas por consumo
GET  /api/reports/machines/:id/employees   → top empleados de una máquina
GET  /api/reports/employees/:id/machines   → en qué máquinas consumió un empleado

GET  /api/admin-users             → lista usuarios del panel (solo gerente)
POST /api/admin-users             { username, password, role, full_name, department }
PATCH /api/admin-users/:id
DELETE /api/admin-users/:id
```

### WebSocket — ws://host/ws
Eventos que emite el servidor al dashboard:
```
tap_approved        { employee, employee_id, tapsToday, daily_limit, machine, tap_id }
tap_denied          { employee, employee_id, tapsToday, daily_limit, machine }
vend_confirmed      { machine, item_id, amount }
vend_cancelled      { machine }
machine_blocked     { machine_id, machine, reason }
machine_unblocked   { machine_id }
machine_pending     { mac, message }
machine_approved    { mac, machine }
```

---

## Roles de usuario del panel

| Rol | Acceso |
|---|---|
| `gerente` / `admin` | Todo — incluyendo crear/editar usuarios |
| `supervisor` | Dashboard, Reportes, Feed en vivo — sin configuración ni gestión |

---

## Pines del hardware

```
ESP8266 (NodeMCU / Wemos D1 Mini)

RC522 (SPI):                    MDB (via MAX3232):
  SDA/SS  → D4 (GPIO2)           TX → D2 (GPIO4) → MAX3232 T1IN → bus MDB
  SCK     → D5 (GPIO14)          RX → D1 (GPIO5) ← MAX3232 R1OUT ← bus MDB
  MOSI    → D7 (GPIO13)
  MISO    → D6 (GPIO12)         Reset físico:
  RST     → D3 (GPIO0)           Pulsador entre D0 (GPIO16) y GND
  VCC     → 3.3V (¡no 5V!)
  GND     → GND

LED de estado → LED_BUILTIN (activo LOW en NodeMCU)
```

---

## Procedimientos operativos

### Alta de máquina (para el cliente/técnico)
1. Enchufar el ESP8266
2. Conectarse al WiFi `CoffeeControl-Setup` desde el celular (pass: `coffeecontrol`)
3. Se abre el portal automáticamente (captive portal)
4. Ingresar SSID + password del WiFi de la empresa
5. En modo `local`: también ingresar la URL del servidor (ej: `http://192.168.1.50:3000`)
6. En modo `saas`: solo WiFi, la URL viene en el firmware
7. Guardar — el ESP reinicia y aparece como "pendiente" en el panel admin
8. El admin le pone nombre y ubicación y aprueba → máquina operativa

### Reset de configuración
- Mantener presionado el botón (D0) durante 5 segundos al encender
- El LED parpadea contando → al llegar borra EEPROM y abre el portal

### Alta de empleado con tarjeta NFC
**Obtener el UID de la tarjeta:**
- Opción A: app "NFC Tools" en el celular (Android/iOS) → acercar tarjeta → copiar UID
- Opción B: el empleado acerca la tarjeta a cualquier máquina → el backend loguea el UID desconocido → copiarlo del log del servidor
- Opción C (futuro): sección "UIDs desconocidos" en el panel para aprobar con un clic

**Cargar en el sistema:**
1. Panel admin → Empleados → crear empleado (nombre, DNI, legajo, área, límite diario)
2. En el empleado creado → botón "+ NFC" → pegar el UID → guardar
3. La tarjeta queda activa inmediatamente

---

## Estado actual del desarrollo

### Completado ✓
- Firmware ESP8266 con MDB 9 bits por software, NFC RC522, portal WiFi, autoregistro por MAC
- Backend Node.js completo con todos los endpoints
- Base de datos PostgreSQL con schema, vistas y migraciones
- Panel de administración HTML completo:
  - Login con JWT
  - Dashboard con métricas, ranking, alertas y gráfico en tiempo real
  - Gestión de máquinas (CRUD, bloqueo, aprobación de pendientes, **eliminar**)
  - Gestión de empleados (CRUD completo con DNI/legajo + tarjetas NFC, **eliminar**)
  - Reportes por máquina y por empleado
  - Feed en vivo por WebSocket
  - Gestión de usuarios del panel con roles (gerente/supervisor)
- Dashboard operativo standalone (coffeecontrol.html) con WebSocket
- **Setup en Windows completado y documentado** (PostgreSQL 15, Node.js 22)

### Pendiente / próximos pasos sugeridos
- [ ] **Sección "UIDs desconocidos"** en el panel para registrar tarjetas con un clic (cuando la tarjeta es rechazada por `card_unknown`, que aparezca en el panel para asignarla a un empleado)
- [ ] **Notificaciones por email/WhatsApp** cuando un empleado es bloqueado o supera el límite
- [ ] **Exportar reportes** a Excel/PDF
- [ ] **Multi-tenant** para modo SaaS (campo `tenant_id` en todas las tablas, schema separado por empresa)
- [ ] **OTA (Over The Air)** actualización de firmware desde el panel
- [ ] **Mapa de máquinas** con estado en tiempo real (verde/amarillo/rojo)
- [ ] **Historial de cambios** (auditoría: quién cambió qué límite y cuándo)
- [ ] **App móvil** para el gerente (o PWA del panel existente)
- [ ] **Seguridad del payload MDB**: implementar XOR + timestamp como VMflow para evitar replay attacks

---

## Credenciales por defecto

| Sistema | Usuario | Contraseña |
|---|---|---|
| Panel admin | `admin` | `coffeecontrol` |
| Portal WiFi del ESP | — | sin contraseña (red abierta) |
| PostgreSQL | configurar en `.env` | — |

---

## Comandos para arrancar

```bash
# Backend
cd backend
cp .env.example .env          # editar DATABASE_URL
npm install
createdb coffeecontrol
psql $DATABASE_URL -f sql/schema.sql
psql $DATABASE_URL -f sql/migration_v2.sql
psql $DATABASE_URL -f sql/migration_v3.sql
npm run dev                   # nodemon, puerto 3000

# Panel
# Abrir coffeecontrol-admin.html en el navegador
# Ingresar URL del backend en el login

# Firmware
# Arduino IDE → abrir CoffeeControl_v2.ino
# Instalar librerías: MFRC522 (by GithubCommunity)
# Board: NodeMCU 1.0 (ESP-12E Module)
# Editar DEPLOYMENT_MODE y BACKEND_URL si es modo local
# Compilar y flashear
```

---

## Cambios en sesión 23/03/2026

### Fix: Autoregistro de máquinas — Opción B (REGISTRATION_SECRET)

**Problema raíz:** `POST /api/machines/register` estaba protegido por `authJwt`, pero el ESP no tiene JWT (es una máquina nueva sin aprobar). El request llegaba al backend (se loguea) pero el middleware devolvía 401 antes del handler — nunca se insertaba en `pending_machines`.

**Solución implementada (Opción B — secret compartido):**

1. **`backend/.env`** — agregada variable `REGISTRATION_SECRET=coffeecontrol-registro-2024`

2. **`backend/.env.example`** — documentada la variable con instrucciones

3. **`backend/src/server.js`** — middleware inline para `/api/machines`:
   - Si es `POST /register`: verifica header `X-Registration-Secret` contra `process.env.REGISTRATION_SECRET`. Si no coincide → 401.
   - Cualquier otra ruta: pasa por `authJwt` normalmente.

4. **`backend/src/routes/machines.js`** — agregado `console.error('[REG] Error:', err.message)` en el catch de `/register` para que los errores de DB aparezcan en logs.

5. **`CoffeeControl/CoffeeControl_v2.ino`** y **`CoffeeControl_v2_build/CoffeeControl_v2_build.ino`**:
   - Agregado `#define REGISTRATION_SECRET "coffeecontrol-registro-2024"`
   - `registerMachine()` agrega el header `X-Registration-Secret` en el POST

**Verificado:** `POST /api/machines/register` con header correcto → `202 {status:"pending"}` + fila en `pending_machines`.

**Nota de escala:** A futuro, evolucionar a pre-cargar MACs autorizadas en la BD antes de cada deployment (el backend verifica que la MAC está en el inventario, eliminando el single secret compartido).

---

## Bugs corregidos en sesión 22/03/2026

1. **`<script src>` con código inline** — El primer tag `<script>` en `coffeecontrol-admin.html` tenía el `src` de Chart.js y también código JS adentro. El navegador ignora el contenido inline cuando hay `src`, lo que dejaba `checkPending`, `loadUsers` y otras funciones sin definir. Fix: cerrar el tag correctamente con `</script>` y abrir uno nuevo.

2. **Contraseña admin incorrecta en BD** — Los hashes bcrypt en `admin_users` no correspondían a `coffeecontrol2024`. Fix: regenerar el hash con Node.js y actualizar via pool (no via psql para evitar problemas de escape de `$`).

3. **Encoding de datos en BD** — El schema.sql se ejecutó 3 veces desde PowerShell (cp1252), generando nombres como `Mßquina A` en lugar de `Máquina A`. Fix: script Node para actualizar con strings UTF-8 correctos. Además se agregó `client_encoding: 'UTF8'` en `pool.js`.

4. **Máquinas duplicadas** — El schema se ejecutó 3 veces → 12 máquinas en lugar de 4. Fix: `DELETE FROM machines WHERE id > 4`.

5. **No existían endpoints DELETE** para máquinas ni empleados. Fix: agregados como soft delete (`active=false`).

---

## Notas técnicas importantes

1. **MDB es half-duplex** — ESP transmite y recibe por el mismo bus. El MAX3232 maneja el nivel de voltaje.

2. **El timing de MDB es crítico** — el VMC hace POLL cada ~100ms. El ESP tiene que responder en menos de 5ms. El `noInterrupts()` en la transmisión es obligatorio.

3. **Fail-closed** — si el backend no responde o hay error de red, el ESP deniega el tap. Nunca aprueba por default.

4. **VEND SUCCESS vs VEND FAILURE** — el backend no cuenta el consumo hasta recibir el `POST /api/tap/confirm`. Si la máquina falla mecánicamente, se llama `/cancel` y no se descuenta.

5. **El campo `secret` en la tabla machines** quedó como legacy desde v1. En v2 la autenticación es por MAC. El campo se mantiene para compatibilidad pero no se usa en `machineAuth.js`.

6. **JWT expira en 8 horas** — el panel redirige al login automáticamente cuando el token vence (intercepta el 401).

7. **El portal cautivo funciona en Android** directamente. En iOS a veces requiere abrir `http://192.168.4.1` manualmente en Safari si el portal no aparece solo.
