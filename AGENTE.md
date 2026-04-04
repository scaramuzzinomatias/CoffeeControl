# AGENTE.md — CoffeeControl
> Archivo de continuidad del proyecto. Leer antes de cualquier sesión nueva.
> Última actualización: 04/04/2026 — el firmware ya quedó validado en una Rubino real con venta completa y precio humano correcto (`1200` backend vs `600` interno MDB cuando aplica el perfil `rubino_half_credit`). Además ya quedó implementada la configuración técnica remota integral por máquina: backend, tests y panel admin con visibilidad restringida a `admin`, `tecnico` y `distribuidor`. La resolución de conflictos backend/portal ya quedó versionada con `config_version`, `config_source` y `config_updated_at`: el portal local puede seguir usándose para recovery, pero backend conserva el rol de fuente de verdad y devuelve una configuración autoritativa explícita cuando detecta desvíos. El portal sigue desacoplado en `LittleFS`, el `event log` compacto sigue disponible por `GET /diag/events`, el snapshot de `SETUP` MDB sigue en `GET /diag/mdb`, la cola offline ya usa journal append-only y el watchdog conservador de `20s` sigue activo sobre `loopTask` + tarea MDB. El timing MDB continúa fuera del bloque inicial. La app gerente web queda como prototipo; la dirección de producto sigue siendo una futura app gerente nativa.
>
> **Punto de restauración general:** `git checkout a25148b -- .` restaura el estado previo a los fixes de edge cases.
>
> **Punto de restauración firmware:** tag `firmware-baseline-2026-04-03` sobre commit `7af6afa`.

---

## Qué es este proyecto

Sistema de control de consumo de café para empresas con expendedoras automáticas. Una empresa tiene 4 expendedoras y gasta $4 millones/mes. El gerente necesita saber quién consume, cuánto, en qué máquina, y poder poner límites o bloquear empleados/máquinas.

---

## Decisiones de arquitectura tomadas

### Plan activo del firmware v3
- Ver [PLAN_FIRMWARE_V3_HARDENING.md](/C:/PROYECTOS/CoffeControl/CoffeeControl_proyecto/PLAN_FIRMWARE_V3_HARDENING.md)
- Regla actual: no tocar timing MDB en la primera etapa
- Regla actual: el usuario edita precio humano; el firmware convierte a unidades MDB
- Estado actual: `event_log.*` ya agregado con ring buffer fijo de 64 eventos
- Estado actual: `offline_queue.*` ya agregado con journal append-only y compactación post-flush
- Estado actual: watchdog ya agregado con reset reason visible al boot
- Estado actual: portal con botones `Ver eventos` / `Ver setup MDB` y snapshot remoto `diagnostics_snapshot` disponible desde panel/backend para usuarios técnicos
- Estado actual: el panel técnico ya muestra `Compatibilidad asistida` en `Máquinas > Diag` y permite precargar sugerencias en `Config técnica` con `Sugerir según último SETUP MDB`, sin autoaplicar nada
- Estado actual: Rubino validada en campo con `VEND_REQUEST` / `VEND_SUCCESS` / `VEND_END` completos y persistencia humana correcta en backend
- Estado actual: configuración técnica avanzada de máquina disponible solo para `admin`, `tecnico` y `distribuidor`
- Estado actual: backend/portal ya resuelven conflictos de configuración por `config_version` + `config_source`, visible en `Diag` y `Config técnica`
- Estado actual: `Config técnica` ya muestra la última config reportada por el ESP, el drift respecto de backend y el último cambio técnico auditado desde panel
- Estado actual: ownership conservador del runtime MDB ya resuelto; `handleNFC()` encola inicio de sesión, el timeout de `SESSION_IDLE` corre en la tarea MDB y la carga de config ya no pisa el runtime operativo
- Estado actual: `GET /diag/mdb` ya expone también `EXPANSION` y fecha/hora MDB si la máquina envía `WRITE TIME/DATE FILE`; eso se ve tanto en portal como en `Máquinas > Diag`
- Estado actual: firmware con experimento controlado de `Communications Gateway` MDB (`0x18`) para evaluar si la Rubino usa identificación, feature enable y `TIME/DATE REQUEST`; no reemplaza el cashless `0x10`, lo acompaña. Resultado real en esta Rubino: no lo interroga, así que el reloj operativo queda en `NTP` y el gateway se considera evaluado pero no adoptado como camino principal

### Hardware por máquina (v2 — target de producción)
- **Microcontrolador:** ESP32-C3 Super Mini — ~$2-3 USD
- **Lector NFC:** RC522 (13.56 MHz, protocolo SPI) — ~$4 USD
- **Adaptador de nivel:** MAX3232 (convierte 3.3V ESP ↔ 5V bus MDB) — ~$2 USD
- **RTC:** DS3231 (I2C, batería de respaldo) — ~$1-2 USD ← **posible gracias a pines I2C libres**
- **Total hardware por máquina:** ~$10-11 USD

### Hardware por máquina (v1 — prototipo actual)
- **Microcontrolador:** ESP8266 (NodeMCU o Wemos D1 Mini) — ~$3 USD
- **Lector NFC:** RC522 — ~$4 USD
- **Adaptador de nivel:** MAX3232 — ~$2 USD
- **Sin RTC** — pines I2C (D1/D2) ocupados por MDB, no hay pines libres para DS3231
- **Total:** ~$9 USD

### Por qué ESP8266 y no Raspberry Pi
- RPi es overkill, cara (~$80), corre Linux (SD corruptible si se va la luz)
- ESP8266 arranca en segundos, sin SO, consume poco, WiFi integrado
- Se descartó Arduino solo porque no tiene WiFi nativo

### Por qué migrar de ESP8266 a ESP32-C3 Super Mini
| Factor | ESP8266 | ESP32-C3 Super Mini |
|---|---|---|
| Heap libre | ~30KB | ~380KB |
| Pines I2C | Ocupados por MDB | GPIO8/GPIO10 libres |
| UART hardware | 1 (debug) | 2, pero MDB sigue por bit-banging |
| MDB 9-bit | Bit-banging (SoftwareSerial) | Bit-banging `MDB9bit.h` con `IRAM_ATTR` |
| RTC DS3231 | ❌ Sin pines | ✅ I2C libre |
| Max tarjetas cache | 200 (seguro) | 2000+ |
| Max cola offline | 100 (seguro) | 1000+ |
| Precio | ~$3 | ~$2-3 |
| Tamaño | NodeMCU grande / D1 Mini chico | Super Mini ≈ D1 Mini |

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
- **Portal cautivo:** el ESP levanta un AP `CoffeeControl-Setup`, el cliente/técnico se conecta con el celular y el portal recibe SSID + password + URL del servidor + precio humano
- La configuración se guarda en **Preferences/NVS** y persiste entre reinicios
- La UI del portal ya no vive embebida en `main.cpp`; ahora se sirve desde `CoffeeControl_v3/data/portal/` cargado en `LittleFS`
- Si el filesystem no está cargado, el firmware expone un portal de emergencia mínimo para no bloquear la instalación
- **Botón BOOT (GPIO9):** mantener 5 segundos con el firmware ya iniciado abre el portal sin borrar la configuración guardada
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
| Firmware | C++ Arduino / PlatformIO (ESP32-C3 Super Mini — target; ESP8266 — prototipo) |
| Protocolo expendedora | MDB cashless peripheral |
| NFC | RC522 vía SPI |
| WiFi config | Portal cautivo (ESP8266WebServer) |
| Backend | Node.js + Express |
| Base de datos | PostgreSQL |
| Tiempo real | WebSockets (librería `ws`) |
| Autenticación panel | JWT (jsonwebtoken + bcryptjs) |
| Frontend | HTML + CSS + JS vanilla + Chart.js |

---

## Documentación operativa de salida a piloto

- `CHECKLIST_PILOTO.md`
- `PROTOCOLO_PRUEBAS.md`
- `GUIA_SOPORTE.md`
- `MODELO_OPERATIVO_CLIENTES.md`
- `ARQUITECTURA_APP_TECNICO_ANDROID.md`
- `ARQUITECTURA_APP_GERENTE_MOVIL.md`

Usarlos como referencia principal para instalación, validación online/offline y soporte en campo.

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

coffeecontrol.html          ← Monitor operativo liviano (solo lectura, misma sesión JWT)
coffeecontrol-admin.html    ← Panel de administración completo
coffeecontrol-tecnico.html  ← PWA técnica móvil (prototipo / herramienta secundaria)
coffeecontrol-tecnico-android/ ← Base Android nativa para técnico (NFC + biometría)
```

---

## Base de datos — tablas principales

```sql
employees       id, name, department, email, dni, legajo, phone, daily_limit, active
nfc_cards       id, uid (hex), employee_id, label, active
machines        id, name, location, mac, secret, active, blocked, blocked_reason, last_seen
pending_machines id, mac, first_seen, last_ping, approved
taps            id, employee_id (NULLABLE), machine_id, nfc_uid, approved, deny_reason,
                   item_id, amount_cents, confirmed, tapped_at
                -- employee_id es NULL cuando deny_reason = 'card_unknown'
admin_users     id, username, password_hash, role, full_name, department, active
admin_user_departments  admin_user_id, department   -- permite múltiples áreas por supervisor

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
GET  /api/dashboard/today              → resumen del día + alertas
GET  /api/dashboard/monthly            → resumen del mes
GET  /api/dashboard/feed               → últimos 50 taps del día (incluye nfc_uid)
GET  /api/dashboard/unknown-uids       → UIDs con taps card_unknown sin nfc_cards activa
GET  /api/dashboard/uid-history/:uid   → últimos 50 taps de un UID específico

GET  /api/machines                     → lista con estado y estadísticas
GET  /api/machines/pending             → máquinas sin aprobar
POST /api/machines/pending/:id/approve { name, location }
POST /api/machines/pending/:id/reject
POST /api/machines/:id/block           { reason }
POST /api/machines/:id/unblock
DELETE /api/machines/:id               (soft delete — pone active=false)

GET  /api/employees                    → lista con tarjetas NFC
GET  /api/employees/:id                → detalle + consumo por máquina + historial
POST /api/employees                    { name, department, email, dni, legajo, phone, daily_limit }
PATCH /api/employees/:id               (mismos campos, todos opcionales)
PATCH /api/employees/:id/limit         { daily_limit }
POST  /api/employees/:id/cards         { uid, label }   ← upsert: ON CONFLICT actualiza
PATCH /api/employees/:id/cards/:cardId { active?, label?, employee_id? }  ← toggle/renombrar/reasignar
DELETE /api/employees/:id/cards/:cardId
DELETE /api/employees/:id              (soft delete — pone active=false)

GET  /api/reports/machines             → ranking de máquinas por consumo
GET  /api/reports/machines/:id/employees  → top empleados de una máquina
GET  /api/reports/employees/:id/machines  → en qué máquinas consumió un empleado

GET  /api/admin-users                  → lista usuarios del panel (solo gerente)
POST /api/admin-users                  { username, password, role, full_name, email, department_scopes[] }
PATCH /api/admin-users/:id
DELETE /api/admin-users/:id
```

### WebSocket — ws://host/ws
Eventos que emite el servidor al dashboard:
```
tap_approved        { event, uid, employee, employee_id, tapsToday, daily_limit, machine, machine_id, tap_id }
tap_denied          { event, uid, employee, employee_id, tapsToday, daily_limit, machine, machine_id }
card_unknown        { event, uid, machine, machine_id }   ← uid incluido desde v2
vend_confirmed      { event, machine, item_id, amount }
vend_cancelled      { event, machine }
machine_blocked     { event, machine_id, machine, reason }
machine_unblocked   { event, machine_id }
machine_pending     { event, mac, message }
machine_approved    { event, mac, machine }
```

---

## Roles de usuario del panel

| Rol | Acceso |
|---|---|
| `admin` | Todo. Si la cuenta está protegida, solo soporte local puede modificarla |
| `gerente` | Todo a nivel funcional del cliente — incluyendo crear/editar usuarios |
| `supervisor` | Dashboard, Reportes y Feed en vivo — acotado a una o varias áreas asignadas, sin configuración ni gestión |
| `tecnico` | Máquinas, stock y comandos remotos — sin acceso a dashboard, reportes, feed, empleados ni configuración global |
| `distribuidor` | Máquinas, stock, comandos remotos y onboarding/configuración de máquinas — sin acceso a dashboard, reportes, feed, empleados ni configuración global |

Notas:
- La cuenta `admin` del sistema puede marcarse como **protegida** (`is_protected=true`).
- Una cuenta protegida no puede editarse, desactivarse ni cambiar su contraseña desde el panel; solo desde soporte local con `backend/scripts/support-user.js`.

---

## Pines del hardware

### ESP8266 — prototipo (pines actuales)
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
NOTA: D1/D2 (I2C estándar) ocupados por MDB → sin RTC DS3231 posible
```

### ESP32-C3 Super Mini — target de producción
```
ESP32-C3 Super Mini

RC522 (SPI hardware):           MDB (bit-banging, IRAM_ATTR):
  SS    → GPIO4                  TX → GPIO20 → MAX3232 T1IN → bus MDB
  SCK   → GPIO0                  RX → GPIO21 ← MAX3232 R1OUT ← bus MDB
  MOSI  → GPIO1
  MISO  → GPIO3                DS3231 RTC (I2C):
  RST   → GPIO7                  SDA → GPIO5
  VCC   → 3.3V (¡no 5V!)        SCL → GPIO6
  GND   → GND

LED externo   → GPIO10
LED onboard   → GPIO8 (solo post-boot)
Portal/BOOT   → GPIO9 (pull-up interno, LOW = presionado)

No usar para perifericos externos:
- GPIO2 (strapping)
- GPIO18/19 (USB D-/D+)
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
- `taps.employee_id` es **nullable** (para taps con `card_unknown`)
- Panel de administración HTML completo (`coffeecontrol-admin.html`):
  - Login con JWT, roles `gerente` / `supervisor` / `tecnico` / `distribuidor`
  - Dashboard con métricas, ranking, alertas y gráfico en tiempo real
  - **Gestión de máquinas** con filtros client-side: búsqueda, estado (activa/inactiva/bloqueada), actividad (tap hoy / sin actividad)
  - **Control remoto de máquinas**: reinicio, cambio de WiFi, escaneo remoto de redes visibles y detalle de estado de red (SSID, IP, RSSI, backend y último error)
  - **Alertas por email** para advertencia preventiva de límite, empleado bloqueado, máquina offline y stock bajo/sin stock por selección configurada (si SMTP está configurado), con pantalla `Notificaciones` para destinatarios, eventos, umbral (`faltan N cafés`) y prueba manual; las plantillas quedan en configuración interna del backend
  - **Pantalla `Sistema`** para definir la `business_timezone` global con identificadores IANA reales
  - **Política diaria configurable por empleado**: `enforce`, `warn_only` y `off`, con advertencia opcional por email al empleado y a supervisores activos de la misma área
  - **Jerarquías / niveles de acceso**: pantalla `Jerarquías`, tabla `access_levels`, asignación opcional por empleado (`access_level_id`) y fallback automático a política manual si no hay nivel asignado
    - la política efectiva se usa en `POST /api/tap`, `POST /api/tap/queue`, `GET /api/tap/cards`, dashboard y reportes
  - **Timezone unificada** entre backend y firmware: dashboard/reportes usan `business_timezone`, `/api/tap/cards` entrega `date + next_reset_at`, y el ESP32-C3 resetea contadores offline con esa referencia
  - **Estados explícitos para TAGs NFC**: `active`, `lost`, `inactive`, con acciones `Marcar perdido`, `Dar de baja`, `Reactivar` y `Reasignar`
- **Pantalla `Auditoría`** para revisar altas, ediciones, bajas, bloqueos, comandos remotos y cambios de configuración con actor, fecha y detalle técnico saneado
- **Scope real por supervisor** con múltiples áreas: `admin_user_departments` filtra dashboard, feed, reportes, WebSocket y lecturas de empleados
  - **Stock V1 manual/estimado por máquina**: botón `Stock` en `Máquinas`, configuración por `item_id`, reposición, ajuste, baja/reactivación, historial de movimientos y alertas automáticas de stock bajo/sin stock
  - `POST /api/tap/result` descuenta automáticamente 1 unidad cuando la venta queda confirmada; si la selección no está configurada, registra `unconfigured_sale` sin romper el expendio
  - **Gestión de empleados** con filtros client-side: búsqueda (nombre/legajo/DNI/email), área (auto-generada), tarjetas NFC (con/sin activa)
  - Detalle de empleado: tarjetas NFC con acciones **Marcar perdido**, **Dar de baja**, **Reactivar**, **Renombrar**, **Reasignar**
  - **Reportes avanzados** con rango `desde / hasta`, resumen operativo, evolución diaria, cortes por máquina/empleado/área, detalle modal y exportación Excel/PDF
    - detalle exportable por empleado y por área, orientado a reuniones de gestión
    - filtro global por área y búsqueda rápida de empleado (nombre / legajo / email / DNI) para empresas grandes
    - sección de **stock** solo para `gerente/admin`, con estado actual por máquina, movimientos del rango y exportación Excel/PDF dedicada
  - **Feed en vivo** con WebSocket, UID NFC visible, y 4 filtros client-side (estado, máquina, empleado, motivo rechazo) + botón "Limpiar vista"
  - **WebSocket del panel protegido con JWT** en el handshake de `/ws`
  - **Tarjetas desconocidas**: sección dedicada con badge en el nav, carga desde DB + WS en tiempo real, acciones **Asignar**, **Ver intentos** (historial modal), **Descartar** (persiste en `localStorage` con clave `cc_discarded_uids`; reaparece si el ESP tapea de nuevo)
  - Gestión de usuarios del panel con roles (`gerente`, `supervisor`, `tecnico`, `distribuidor`) y soporte para cuentas protegidas
  - **Perfil técnico operativo**: acceso a `Máquinas`, stock y comandos remotos, sin analítica ni configuración global; el detalle de máquina evita exponer consumo nominal de empleados
  - **Perfil distribuidor operativo**: onboarding/configuración de máquinas pendientes, más acceso técnico a máquinas, stock y comandos remotos, sin acceso a analítica ni gestión de empleados/usuarios
  - **App técnico PWA** (`coffeecontrol-tecnico.html`): login móvil propio, máquinas, detalle técnico, WiFi remoto, reinicio, stock y onboarding para trabajo de campo
    - backend móvil fase 1 listo para Android nativo: `mobile_sessions`, `mobile-auth` con refresh/logout y `mobile-tech` para búsqueda/asignación/reasignación de TAGs
    - app Android nativa en `coffeecontrol-tecnico-android/`: biometría + NFC + máquinas + stock + TAGs ya validados en teléfono real; `WiFi remoto` y `Pendientes` integrados y compilando, pendientes de validación en vivo según disponibilidad de equipos
  - **App gerente móvil** (`coffeecontrol-gerente.html`): PWA ejecutiva para `admin` / `gerente` / `supervisor`, con selector de empresa antes del login, sesión local por backend, tabs `Inicio`, `Máquinas`, `Reportes`, `Alertas` y hoja de sesión separada
    - se apoya en `dashboard`, `reports`, `machines` y la nueva ruta read-only `GET /api/alerts/active`
    - `app-gerente-mockup.html` y `ARQUITECTURA_APP_GERENTE_MOVIL.md` quedan como referencia de diseño y evolución
    - decisión actual: usar esta PWA como referencia/prototipo y avanzar después a una versión nativa
  - `backend/test/integration.test.js` cubre login, scope multi-área, `403` fuera de alcance, estados `card_lost` / `card_inactive`, comandos remotos, permisos/auditoría de `Notificaciones`, jerarquías de acceso, política efectiva en `tap` / `tap/cards`, filtros de reportes por jerarquía, configuración de stock, alerta de stock bajo, reportes de stock, descuento automático en `vend_confirmed`, alertas activas con scope por rol, permisos de los roles `tecnico` / `distribuidor`, cuentas protegidas y capa móvil (`mobile-auth` + `mobile-tech`)
- Monitor operativo liviano (`coffeecontrol.html`) con WebSocket y sin configuración administrativa
- Repositorio git inicializado; checkpoint `a25148b` representa este estado

### Alta de empleado con tarjeta NFC — flujo actual
1. Empleado acerca tarjeta a cualquier máquina → aparece en sección **Tarjetas desconocidas** del panel
2. Admin hace clic en **Asignar** → selecciona empleado → guarda (llama `POST /api/employees/:id/cards`)
3. La tarjeta queda activa inmediatamente; el UID desaparece de la lista de desconocidos

### Pendiente / próximos pasos sugeridos
- [ ] **Migración ESP32-C3 Super Mini + PlatformIO** (ver sección "Migración ESP8266 → ESP32-C3")
- [ ] **Modo offline con fallback local** (ver sección "Arquitectura offline")
- [x] **Notificaciones por email** cuando un empleado queda bloqueado por límite diario, cuando queda cerca del límite y cuando una máquina queda offline
- [x] **Formulario de notificaciones** en el panel para destinatarios, eventos y envío de prueba
- [x] **Timezone unificada configurable** con `business_timezone` global y pantalla `Sistema`
- [x] **Flujo de TAG perdido / dado de baja / reactivación / reasignación**
- [x] **Auditoría administrativa** en backend + pantalla de panel con filtros por entidad/acción
- [x] **Reportes avanzados** con rango de fechas, gráficos y detalle exportable por empleado/área
- [x] **Exportar reportes** a Excel/PDF
- [x] **Control de stock V1** manual/estimado por máquina y selección, con descuento automático en `vend_confirmed`
- [x] **Reportes específicos de stock** solo para `gerente/admin`, con movimientos del rango
- [x] **Filtros avanzados en reportes** para empresas grandes (búsqueda rápida por empleado y filtro por área)
- [x] **Scripts DB y soporte** sin depender de `psql` para la lógica principal (`db:init`, `db:migrate:all`, `db:backup`, `db:purge`, `db:drop`, `db:restore`, `db:rebuild`, `support:doctor`, creación/reset de usuarios del panel) y launcher Windows `mantenimiento-coffeecontrol.bat/.ps1`
- [x] **Tests de integración mínimos** con `node:test` (`npm run test:integration`)
- [x] **Jerarquías de acceso** reutilizables con política efectiva online/offline, ABM en panel y filtro en reportes
- [ ] **Refinar reportes de alto volumen** con recortes adicionales, paginado y filtros más específicos
- [x] **Perfil técnico** para operar máquinas y stock sin permisos gerenciales completos
- [ ] **Multi-tenant** para modo SaaS (campo `tenant_id` en todas las tablas, schema separado por empresa)
- [ ] **OTA (Over The Air)** actualización de firmware desde el panel
- [ ] **Mapa de máquinas** con estado en tiempo real (verde/amarillo/rojo)
- [~] **App gerente móvil**: PWA V1 implementada como prototipo; siguiente paso recomendado, versión nativa
- [ ] **Seguridad del payload MDB**: implementar XOR + timestamp como VMflow para evitar replay attacks

---

## Migración ESP8266 → ESP32-C3 Super Mini

> Decisión tomada el 23/03/2026. ESP8266 se mantiene como plataforma de prototipo; ESP32-C3 Super Mini es el target de producción.

### Toolchain: Arduino IDE → PlatformIO
- `platformio.ini` como lockfile de dependencias (reproducible, versionado en git)
- Multi-target: mismo `src/` compila para esp8266 y esp32c3 con environments separados
- Build desde consola + compatible con CI/CD
- El código C++ no cambia al cambiar de IDE

### Qué cambia en el firmware

| Componente | ESP8266 (actual) | ESP32-C3 (target) |
|---|---|---|
| MDB 9-bit | `MDB9bit.h` bit-banging SoftwareSerial | `MDB9bit.h` bit-banging con `IRAM_ATTR` |
| Filesystem | `#include <FS.h>` SPIFFS | `#include <LittleFS.h>` (mejor wear leveling) |
| RTC | No disponible | DS3231 via I2C + librería RTClib (Adafruit) |
| Hora offline | NTP único | DS3231 primario + NTP fallback |
| WiFi/HTTP | `ESP8266WiFi.h` + `ESP8266HTTPClient.h` | `WiFi.h` + `HTTPClient.h` (misma API) |
| JSON | ArduinoJson 6 | ArduinoJson 6 (sin cambios) |
| Pines | Aliases `D0`-`D8` | Numérico `GPIO0`-`GPIO10` |

### Qué NO cambia (compatibilidad ~85%)
- Lógica completa: `postTap()`, `notifyVendResult()`, `handleNFC()`, `handleMDB()`, `reconcileTaps()`
- Protocolo MDB (mismos comandos, mismas respuestas, mismo timing)
- Todos los endpoints del backend
- Portal cautivo, configuración NVS/EEPROM, autoregistro por MAC
- Variables globales, edge case fixes (sessionTimeout, vendUsed, etc.)

### Pasos concretos de migración
1. Crear `CoffeeControl_v3/` con `platformio.ini` (environments: `esp8266` + `esp32c3`)
2. Copiar lógica de `CoffeeControl_v2.ino` a `src/main.cpp`
3. Mantener `MDB9bit.h` en ESP32-C3 con bit-banging e `IRAM_ATTR` porque el C3 no expone 9-bit por UART hardware
4. Cambiar includes WiFi/HTTP con `#ifdef ESP32` / `#elif defined(ESP8266)`
5. Cambiar `SPIFFS` → `LittleFS`
6. Redefinir pines con el nuevo mapa GPIO
7. Agregar inicialización DS3231 (`#include <RTClib.h>`)

---

## Arquitectura offline — fallback local con estado replicado

> Diseñada el 23/03/2026. Pendiente de implementación. Aplica a ESP32-C3 y también a ESP8266 (con límites).

### Concepto
**El backend es la fuente de verdad. El ESP replica localmente el estado necesario para aplicar las mismas políticas.**
Si el backend no responde (pero WiFi/internet sí), el ESP opera con el último estado conocido y encola los eventos para sincronizar al reconectar.

### Archivos en LittleFS/SPIFFS

**`/cards.json`** — estado replicado de tarjetas autorizadas:
```json
{
  "date": "2026-03-23",
  "updated_at": 1711152000,
  "cards": [
    { "uid": "0A30FC80", "daily_limit": 3, "used_today": 1 }
  ]
}
```
- `used_today` = consumo global del empleado en el día (suma de todas las máquinas)
- Se descarga al boot, al reconectar WiFi, y cada vez que el backend responde
- En RAM: array estático `CardCache cardCache[MAX_CARDS]` — writes a SPIFFS solo en momentos clave (primera caída del backend, reconexión, cada 5 min si hay cambios)

**`/queue.json`** — eventos pendientes de sincronizar:
```json
[{ "uid": "0A30FC80", "ts": 1711152000, "item_id": 3, "amount": 150, "ok": true }]
```

### Flujo normal (backend disponible)
```
NFC tap → POST /api/tap → backend decide → ESP obedece
VEND_SUCCESS → POST /api/tap/result → backend actualiza used_today en DB
ESP descarga cards.json actualizado → RAM refleja estado real
```

### Flujo offline (backend caído, WiFi/internet activo)
```
NFC tap → POST /api/tap falla (timeout 4s)
  ├── UID no en cards.json → LED rojo — tarjeta desconocida
  ├── mode=enforce y used_today >= daily_limit → LED rojo — límite alcanzado
  └── OK → dispensa, incrementa used_today en RAM, encola en queue.json (`warn_only` y `off` siguen permitiendo consumo)

VEND_SUCCESS → POST /api/tap/result falla → encola en queue.json

Backend vuelve →
  1. ESP vacía queue.json (POST /api/tap/queue en lotes de 50)
  2. Backend procesa en orden cronológico:
       - Si used_today global > daily_limit → confirmed=true, over_limit=true ⚠️
  3. ESP descarga cards.json con used_today real desde DB
```

### Limitación multi-máquina documentada
Cada ESP conoce el `used_today` del backend al momento de la última sincronización. Si múltiples ESPs están offline simultáneamente y el mismo empleado tapa en varios, puede superar el límite global. Al reconectar, el backend marca los excesos con `over_limit=true` para auditoría visible en el panel.

### Reset de `used_today` a medianoche
- **ESP32-C3 con DS3231:** comparar `cards.json.date` con fecha del RTC → si cambió → `used_today=0` en RAM + sobrescribir `cards.json`
- **ESP8266 con NTP:** igual pero usando `configTime()` + `localtime()` — funciona mientras WiFi esté activo (el backend puede estar caído sin afectar NTP)
- **Si WiFi también cae:** suspender modo offline hasta reconectar (escenario tan extremo que no justifica complejidad adicional)

### Límites de capacidad
| | ESP8266 | ESP32-C3 |
|---|---|---|
| `MAX_CARDS` seguro | 200 (~2.2KB RAM) | 2000+ |
| `MAX_QUEUE` seguro | 100 (~1.8KB RAM) | 1000+ |
| Cuello de botella | JsonDocument necesita bloque contiguo ~15KB | No aplica |

### Cambios necesarios para implementar

**DB (nueva migración):**
```sql
ALTER TABLE taps ADD COLUMN over_limit BOOLEAN DEFAULT false;
```

**Backend — 2 endpoints nuevos:**
- `GET /api/tap/cards` → `[{ uid, daily_limit, used_today }]` (autenticado con `X-Machine-Mac`)
- `POST /api/tap/queue` → procesa bulk `[{ uid, ts, item_id, amount, ok }]`, evalúa `over_limit`

**Firmware — funciones nuevas:**
- `downloadCards()` — GET `/api/tap/cards` → escribe `/cards.json` + carga en RAM
- `localAuth(uid)` — busca en `cardCache[]`, verifica `used_today < daily_limit`
- `incrementLocalUsed(uid)` — incrementa `used_today` en RAM únicamente
- `saveCardsIfDirty()` — escribe RAM → `/cards.json` solo si hay cambios pendientes
- `enqueueEvent(uid, ts, item_id, amount, ok)` — agrega a `/queue.json`
- `flushQueue()` — POST `/api/tap/queue` en lotes ≤50, borra `/queue.json` si éxito
- `checkMidnightReset()` — llamada en `loop()` cada minuto, resetea `used_today` si cambió el día

**Panel admin:**
- Badge/icono `over_limit` en historial de taps (color naranja, tooltip "exceso registrado en modo offline")

---

## Edge cases MDB/NFC — análisis y estado de fixes

> Auditados el 23/03/2026. Punto de restauración antes de los fixes: commit `a25148b`.

| # | Caso | Estado antes del fix | Riesgo |
|---|------|----------------------|--------|
| 5 | MDB falla completamente (cable cortado, máquina apagada) | ❌ | Tap `approved=true` en DB pero máquina nunca dispensa. Límite consumido sin café. |
| 2 | 2 cafés con 1 autorización (segunda `VEND_REQUEST` en misma sesión) | ❌ | `cmdVend VEND_REQUEST` aprueba automáticamente sin llamar a `postTap()`. Bypass total. |
| 1 | NFC OK pero no consumió — `VEND_END` o `READER_DISABLE` sin cancelar | ❌ | Límite consumido, `notifyVendResult` no se llama en esos paths. |
| 6 | Segundo tap mientras sesión MDB activa (`VEND_PENDING` / `SESSION_IDLE`) | ⚠️ | Sobreescribe `sessionUID` y `mdbState`, corrompe la máquina de estados MDB. |
| 4 | Reinicio ESP mid-session (tap approved, no llegó a `VEND_SUCCESS/FAILURE`) | ⚠️ | Tap queda `approved=true, confirmed=null`. Sin reconciliación post-reboot. |
| 3 | Corte de internet | ✅ | `postTap()` verifica WiFi; si no hay conexión no abre sesión. Reconexión cada 30s. |

### Descripción técnica de cada bug

**Bug 5 — MDB falla total:**
```c
// loop() en CoffeeControl_v2.ino:
handleMDB();  // Si MDB nunca responde, nunca llega a ENABLED
handleNFC();  // Pero NFC igual llama postTap() → aprueba → SESSION_IDLE eterno
              // pendingSession=true para siempre, sin timeout
```
Fix requerido: timeout en `SESSION_IDLE` (~10-15s). Si no llega `BEGIN_SESSION` del VMC, cancelar tap.

**Bug 2 — doble dispensado en una sesión:**
```c
case VEND_REQUEST:
    vendApproved=true; vendAmount=sessionAmount; mdbState=VEND_PENDING;
    // ← no verifica si ya hubo un VEND_SUCCESS en esta sesión
    // ← no llama postTap() para una segunda unidad
```
Fix requerido: flag `vendCount` por sesión; si ya hubo un `VEND_SUCCESS` en esta sesión, denegar siguiente `VEND_REQUEST` o requerir nueva autenticación NFC.

**Bug 1 — `VEND_END` / `READER_DISABLE` sin cancelar:**
```c
case VEND_END:
    mdbSendByte(MDB_END_SESSION);
    mdbState=ENABLED; sessionUID="";  // ← no llama notifyVendResult(false)

if(d[0]==READER_DISABLE){
    mdbState=DISABLED; sessionUID=""; // ← ídem
}
```
Fix requerido: llamar `notifyVendResult(sessionUID, ..., false)` antes de borrar `sessionUID` si éste no está vacío y no hubo `VEND_SUCCESS` todavía.

**Bug 6 — tap durante sesión activa:**
Si el usuario tapa 2.5s después (cooldown vencido) mientras el ESP está en `VEND_PENDING`, `handleNFC()` sobreescribe `sessionUID` y `mdbState=SESSION_IDLE`, dejando el `VEND_PENDING` huérfano.
Fix requerido: en `handleNFC()`, si `mdbState == VEND_PENDING || mdbState == SESSION_IDLE`, ignorar el tap con LED de indicación.

**Bug 4 — reinicio mid-session:**
No hay persistencia en EEPROM del `sessionUID` activo. Al reiniciar, queda un `tap approved, confirmed=null` en DB que nunca se resuelve.
Fix sugerido (liviano): al boot, marcar los taps `approved=true, confirmed IS NULL` con más de 2 minutos como `confirmed=false, approved=false` via endpoint `POST /api/tap/reconcile` (el ESP lo llama al arrancar).

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

4. **VEND SUCCESS vs VEND FAILURE** — `POST /api/tap/confirm` actualiza `confirmed=true`. `POST /api/tap/cancel` revierte `approved=false` para no contar en el límite diario.

5. **El campo `secret` en la tabla machines** quedó como legacy desde v1. En v2 la autenticación es por MAC. El campo se mantiene para compatibilidad pero no se usa en `machineAuth.js`.

6. **JWT expira en 8 horas** — el panel redirige al login automáticamente cuando el token vence (intercepta el 401).

7. **El portal cautivo funciona en Android** directamente. En iOS a veces requiere abrir `http://192.168.4.1` manualmente en Safari si el portal no aparece solo.

8. **`localStorage` key `cc_discarded_uids`** — array JSON con UIDs descartados de la lista de tarjetas desconocidas. Se elimina un UID del set si el ESP tapea de nuevo (`handleUnknownCard` llama `removeDiscarded(uid)` antes de todo).

9. **`taps.employee_id` es nullable** — `ALTER TABLE taps ALTER COLUMN employee_id DROP NOT NULL` aplicado en producción el 23/03/2026. Taps `card_unknown` tienen `employee_id=null`.

---

## Historial de cambios

### Sesión 23/03/2026 — parte 2 (filtros + auditoría edge cases)

**Filtros empleados (client-side, sin requests extra):**
- Array `allEmployees` almacena datos al cargar; `applyEmployeeFilters()` re-pinta el `<tbody>`
- 3 filtros: búsqueda libre (nombre/legajo/DNI/email), área (auto-generada con `Set` de valores únicos), tarjetas NFC (con activa / sin activa)
- Estilo idéntico al Feed en vivo: label arriba + barra `border-bottom` dentro del `.card`

**Filtros máquinas (client-side, sin requests extra):**
- Array `allMachines` almacena datos al cargar; `applyMachineFilters()` re-pinta el `<tbody>`
- 3 filtros: búsqueda libre (nombre/ubicación), estado (activa/inactiva/bloqueada), actividad (tap hoy / sin actividad este mes)

**Auditoría de edge cases MDB/NFC:**
- 6 escenarios analizados, 3 bugs críticos (❌), 2 advertencias (⚠️), 1 OK (✅)
- Ver sección "Edge cases MDB/NFC" para descripción técnica y fixes requeridos
- Punto de restauración git: `git init` + `git add -A` + commit `a25148b` en `CoffeeControl_proyecto/`

### Sesión 23/03/2026 — parte 1 (tarjetas desconocidas + feed + card actions)

**Nuevos endpoints:**
- `GET /api/dashboard/unknown-uids` — UIDs con taps `card_unknown` + sin entrada activa en `nfc_cards`
- `GET /api/dashboard/uid-history/:uid` — últimos 50 taps de un UID
- `PATCH /api/employees/:id/cards/:cardId` — toggle `active`, renombrar `label`, reasignar a otro empleado (sin filtrar por `employee_id` en WHERE)
- `POST /api/employees/:id/cards` usa `ON CONFLICT (uid) DO UPDATE` (upsert)

**Tarjetas desconocidas — sección completa en el panel:**
- Badge en nav (número de UIDs sin asignar), se actualiza por WS en tiempo real
- Acciones por UID: **Asignar** (modal selector empleado), **Ver intentos** (modal historial últimos 20 taps), **Descartar** (persiste en `localStorage`)
- Descartados se recuperan automáticamente si el ESP vuelve a tapear ese UID
- `loadUnknownBadge()` llamado en `showApp()` para pre-popular badge al login

**Feed en vivo:**
- `GET /api/dashboard/feed` usa `LEFT JOIN employees` para soportar taps sin empleado
- Campo `nfc_uid` incluido en cada fila del feed
- `broadcast()` incluye `uid` en todos los eventos WS
- 4 filtros client-side: Estado, Máquina (auto-poblado desde datos), Empleado (texto), Motivo rechazo
- Botón "Limpiar vista" vacía `liveItems[]`; "Limpiar filtros" resetea selectores

**DB:** `ALTER TABLE taps ALTER COLUMN employee_id DROP NOT NULL`

### Sesión 23/03/2026 — parte 0 (fix autoregistro)

**Problema:** `POST /api/machines/register` protegido por `authJwt`; el ESP no tiene JWT.

**Solución (REGISTRATION_SECRET compartido):**
- `backend/.env` + `.env.example`: `REGISTRATION_SECRET=coffeecontrol-registro-2024`
- `server.js`: middleware inline — `POST /register` verifica `X-Registration-Secret`; resto usa `authJwt`
- `CoffeeControl_v2.ino`: `#define REGISTRATION_SECRET` + header en `registerMachine()`

### Sesión 22/03/2026 — bugs iniciales

1. `<script src>` con código inline — tag duplicado; corregido con cierre explícito
2. Hash bcrypt incorrecto para password `coffeecontrol` — regenerado con Node.js
3. Encoding cp1252 en schema.sql — nombres en DB corruptos; fix Node + `client_encoding: 'UTF8'` en `pool.js`
4. Schema ejecutado 3 veces → duplicados — limpieza manual con `DELETE WHERE id > 4`
5. Faltaban endpoints `DELETE` para máquinas y empleados — agregados como soft delete
