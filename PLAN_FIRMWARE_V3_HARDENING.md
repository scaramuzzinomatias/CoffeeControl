# Plan Firmware v3 Hardening

Documento de continuidad para el endurecimiento del firmware en:

- `C:\PROYECTOS\CoffeControl\CoffeeControl_proyecto\CoffeeControl_v3`

Estado de referencia actual:

- restore point: tag `firmware-baseline-2026-04-03`
- commit base: `7af6afa` (`feat(mdb): comunicacion MDB bidireccional completa con Saeco Rubino`)

Objetivo:

- mejorar robustez, mantenibilidad y capacidad de diagnostico
- sin romper el comportamiento MDB actual que hoy ya funciona
- sin tocar timing/protocolo fino en la primera etapa

## Decisiones ya tomadas

### 1. Timing MDB

No se toca en el bloque inicial.

Que si se considera "ruido" y eventualmente se reducira:

- `Serial.printf()` y logs detallados dentro del camino MDB caliente
- construccion de strings innecesarias mientras se responde al VMC
- cualquier trabajo no esencial para contestar `RESET`, `POLL`, `VEND`, `READER`

Que NO implica esta decision:

- no cambiar ahora `timeouts`, ni la secuencia de comandos MDB, ni el state machine fino
- no hacer tuning de compatibilidad "a ciegas"

La regla es:

- primero ordenar el firmware
- despues, solo con maquina real delante, ajustar timing si hace falta

Estado actual de esta decision:

- ya se limpio el "ruido" del camino MDB caliente en `main.cpp`
- no se tocaron `timeouts` ni la secuencia MDB
- los logs MDB quedaron separados en tres niveles:
  - `DEBUG_MDB_EVENTS`
  - `DEBUG_MDB_TRACE`
  - `DEBUG_MDB_TIMING`
- por defecto quedaron desactivados para no meter carga extra mientras se responde al VMC

### 2. Precio

El usuario debe ver y editar siempre un valor humano, por ejemplo:

- `1200`

La conversion interna a unidades MDB la hace el firmware.

Esto es importante porque hoy la compatibilidad real de la maquina puede requerir un mapping interno distinto, por ejemplo:

- usuario: `1200`
- valor interno MDB: `600`

Ese detalle tecnico no debe quedar expuesto al operador.

### 3. SETUP MDB

El firmware hoy recibe el frame de `SETUP`, lo loguea y solo usa:

- `d[0]` para distinguir `SETUP_CONFIG`

El resto del frame hoy no se interpreta como fuente de verdad para dinero o configuracion.

Archivo actual:

- [main.cpp](/C:/PROYECTOS/CoffeControl/CoffeeControl_proyecto/CoffeeControl_v3/src/main.cpp)

Punto actual relevante:

- `cmdSetup(...)` imprime los bytes recibidos del VMC
- responde con un `SETUP_CONFIG` estatico
- no parsea todavia `MAX/MIN PRICE` como entrada de negociacion real

Decision:

- en la primera etapa no se cambia la secuencia MDB
- si se va a capturar y estructurar mejor la informacion de `SETUP`
- esa informacion se usara como "hint" o validacion, no como reemplazo del precio humano configurado

## Plan tecnico

### Etapa 0. Resguardo

Ya realizada.

- tag: `firmware-baseline-2026-04-03`
- objetivo: poder volver al firmware funcional actual

### Etapa 1. Configuracion y precio bien modelados

Objetivo:

- dejar el precio editable desde portal
- preparar el precio para ser editable desde backend
- mantener el mapping MDB actual sin romper la maquina

Archivos nuevos propuestos:

- `CoffeeControl_v3/src/device_config.h`
- `CoffeeControl_v3/src/device_config.cpp`
- `CoffeeControl_v3/src/pricing.h`
- `CoffeeControl_v3/src/pricing.cpp`

Modelo propuesto:

- `price_cents`
- `mdb_profile`
- `scale_factor`
- `decimal_places`
- `country_code`
- `feature_level`

Regla funcional:

- el usuario pone `1200`
- el firmware convierte internamente segun `mdb_profile`

Ejemplo conceptual:

- `machine profile = rubino_half_units`
- `1200 -> 600` para la maquina

Beneficios:

- precio claro para usuario/tecnico
- conversion centralizada
- menos riesgo al cambiar precio
- base lista para sync con backend

Precondicion ya cumplida antes de esta etapa:

- se removio la verbosidad MDB en ruta caliente para bajar variabilidad sin alterar el comportamiento actual

Estado actual:

- implementado `PricingConfig` en:
  - `CoffeeControl_v3/src/pricing.h`
  - `CoffeeControl_v3/src/pricing.cpp`
- implementado `DeviceConfig` en:
  - `CoffeeControl_v3/src/device_config.h`
  - `CoffeeControl_v3/src/device_config.cpp`
- el portal ya guarda `price`
- el usuario sigue viendo un valor humano, por ejemplo `1200`
- el firmware convierte internamente la sesion MDB inicial segun el perfil actual
- `registerMachine()` ya reporta `price_cents` y `pricing_profile` al backend como preparacion para sync futura
- backend ya persiste `machines.price_cents` y responde la configuracion efectiva en `POST /api/machines/register`
- el panel admin ya permite crear/aprobar/editar maquinas con `price_cents`
- el backend ya encola `config_update` cuando cambia el precio y la maquina esta online
- el firmware ya acepta `config_update` para aplicar el nuevo precio sin recompilar
- el runtime MDB principal ya fue consolidado en `MdbRuntimeState`
- ya se migraron a esa estructura:
  - NFC
  - `cmdReset`
  - `cmdPoll`
  - `cmdVend`
  - `cmdReader`
  - timeout de sesion en `loop()`

Pendiente dentro de esta etapa:

- terminar de desacoplar el precio del resto de globals runtime
- capturar mejor los frames `SETUP` del VMC como hint de compatibilidad, sin convertirlos en fuente de verdad
- resolver el ownership final del estado MDB entre la tarea MDB y el `loop()` sin cambiar primero el comportamiento visible

### Etapa 2. Event log compacto

Objetivo:

- mejorar soporte y diagnostico sin castigar RAM

Archivos nuevos propuestos:

- `CoffeeControl_v3/src/event_log.h`
- `CoffeeControl_v3/src/event_log.cpp`

Formato propuesto:

- ring buffer fijo
- sin strings grandes
- eventos compactos:
  - timestamp
  - code
  - arg1
  - arg2

Tamano objetivo:

- 64 eventos maximo
- alrededor de 1KB o menos

Eventos sugeridos:

- boot
- wifi up/down
- backend 200/401/403/500
- nfc read
- queue full
- mdb reset
- vend request
- vend success
- timeout session

Estado actual:

- implementado en:
  - `CoffeeControl_v3/src/event_log.h`
  - `CoffeeControl_v3/src/event_log.cpp`
- capacidad fija: `64` entradas
- costo real aproximado en RAM: `768 bytes` de buffer + overhead minimo
- endpoint de soporte disponible cuando el portal esta activo:
  - `GET /diag/events`
  - `GET /diag/events?limit=20`
- la UI del portal ya expone `Ver eventos` sin escribir la ruta manualmente
- eventos ya conectados a:
  - boot
  - WiFi connect / reconnect
  - salud backend
  - register
  - download cards
  - queue enqueue/full/flush
  - NFC read / approve / deny
  - RESET / BEGIN SESSION / VEND_REQUEST / VEND_SUCCESS / VEND_FAILURE / VEND_END
  - timeout de sesion
  - `config_update` remoto

### Etapa 3. Cola offline robusta

Objetivo:

- menos desgaste de flash
- mejor recuperacion ante corte de energia

Archivos nuevos propuestos:

- `CoffeeControl_v3/src/offline_queue.h`
- `CoffeeControl_v3/src/offline_queue.cpp`

Cambio propuesto:

- pasar de JSON completo reescrito a journal append-only
- compactar solo despues de flush

Beneficios:

- mas robustez
- menos escrituras completas
- mejor manejo de saturacion

Estado actual:

- implementado en:
  - `CoffeeControl_v3/src/offline_queue.h`
  - `CoffeeControl_v3/src/offline_queue.cpp`
- nuevo journal append-only:
  - `/queue.log`
- compatibilidad/migracion:
  - si existe la cola vieja `queue.json`, el firmware la carga una vez, la migra al journal y elimina el archivo legacy
- estrategia actual:
  - `enqueueEvent()` agrega una entrada binaria al final del journal
  - `flushQueue()` compacta solo el remanente despues de un envio exitoso
- beneficio practico:
  - se evita reescribir el archivo completo por cada evento offline

### Etapa 4. Portal desacoplado

Objetivo:

- sacar la UI del `main.cpp`

Estructura propuesta:

- `CoffeeControl_v3/data/portal/index.html`
- `CoffeeControl_v3/data/portal/app.js`
- `CoffeeControl_v3/data/portal/styles.css`

El firmware quedaria sirviendo assets desde LittleFS y mantendria solo:

- endpoints
- lectura/escritura de config
- control del AP/portal

Estado actual:

- realizado
- assets creados en:
  - `CoffeeControl_v3/data/portal/index.html`
  - `CoffeeControl_v3/data/portal/styles.css`
  - `CoffeeControl_v3/data/portal/app.js`
- root `/` sirve esos archivos desde `LittleFS`
- si faltan assets, el firmware responde con un portal de emergencia minimo para guardar WiFi, backend y precio
- validado con:
  - `platformio run -e esp32c3`
  - `platformio run -e esp32c3 -t buildfs`

### Etapa 5. Precio editable tambien desde backend

Objetivo:

- permitir que el servidor cambie el precio de la maquina sin recompilar

Direccion propuesta:

- backend guarda `price_cents`
- firmware sincroniza `DeviceConfig`
- se resuelve conflicto por numero de version de config

Regla:

- backend y portal editan el mismo concepto humano: `price_cents`
- solo el firmware conoce la conversion interna MDB

### Captura de `SETUP` MDB como hint

Objetivo:

- observar qué negocia realmente el VMC sin tocar todavía la respuesta MDB

Estado actual:

- realizado
- snapshot compacto agregado en RAM con:
  - `vmc_level`
  - `display_columns`
  - `display_rows`
  - `display_info`
  - `max_price`
  - `min_price`
  - `raw`
- endpoint nuevo:
  - `GET /diag/mdb`
- snapshot remoto disponible via comando `diagnostics_snapshot` para soporte desde backend/panel
- la UI del portal ya expone `Ver setup MDB`
- eventos nuevos de soporte:
  - `EVT_MDB_SETUP_CONFIG`
  - `EVT_MDB_SETUP_PRICES`

Regla:

- por ahora se usa solo para diagnóstico
- no cambia todavía el flujo MDB ni el cálculo efectivo del precio

### Etapa 6. Watchdog

Objetivo:

- recuperacion automatica ante cuelgues

Implementacion propuesta:

- usar `esp_task_wdt`
- registrar:
  - tarea principal
  - tarea MDB
- loguear `reset reason` en boot

Restriccion:

- implementarlo despues de ordenar un poco el estado interno
- no activarlo antes de validar que no haya falsos positivos

Estado actual:

- implementado en `main.cpp`
- timeout conservador: `20s`
- tareas cubiertas:
  - `loopTask`
  - tarea MDB
- `feed` agregado en operaciones largas del loop:
  - reconexion WiFi
  - `checkBackend()`
  - `registerMachine()`
  - `flushQueue()`
  - `downloadCards()`
  - `pollRemoteCommands()`
- al boot ahora tambien se informa `esp_reset_reason()` para diagnostico de campo

## Que no se hara en el primer bloque

- no tocar timing MDB
- no cambiar la secuencia completa de protocolo
- no hacer tuning fino sin maquina real delante
- no agregar features nuevas de producto

## Siguiente bloque recomendado

Primero continuar con:

1. portal desacoplado
2. captura mas rica del `SETUP` MDB como hint de compatibilidad

Y dejar para despues:

3. afinacion de secuencia/timing solo con maquina real delante

## Estado para retomar

Cuando se retome:

- partir desde el tag `firmware-baseline-2026-04-03` si hace falta volver
- revisar este documento antes de tocar `main.cpp`
- no tocar timing MDB en la primera etapa
