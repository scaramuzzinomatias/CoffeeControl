# Flujo MDB de la Saeco Rubino 200 en CoffeeControl

## Alcance

Este documento describe **cómo funciona la comunicación MDB de la Saeco Rubino 200 dentro de este proyecto**, no un resumen genérico del estándar.

Incluye:

- hardware y pinout actualmente validados
- dirección `cashless 0x10` realmente usada en producción
- secuencia de arranque y handshake observada en Rubino
- flujo completo de venta `NFC -> BEGIN SESSION -> VEND_REQUEST -> VEND_SUCCESS -> VEND_END`
- traducción entre precio humano y unidades MDB para Rubino
- paths de timeout, cancelación y rechazo
- diagnóstico disponible en firmware/panel
- estado del experimento `gateway 0x18`

## Estado actual del proyecto

Al momento de este documento, el proyecto ya quedó validado en una Rubino real con:

- comunicación MDB estable
- lectura NFC RC522 estable
- ventas reales completas
- OTA funcionando de forma confiable

El camino operativo real es:

- **Cashless MDB** en dirección `0x10`

El `Communications Gateway` en `0x18` fue implementado y evaluado, pero **esta Rubino no lo usa en la práctica**.

## Hardware validado actual

### ESP32-C3

Revisión de placa hoy validada en campo:

- `MDB TX = GPIO21`
- `MDB RX = GPIO20`
- `MDB_UART_TX_INVERT = 1`

### RC522

En esta revisión concreta de placa:

- `SCK = GPIO0`
- `MOSI = GPIO3`
- `MISO = GPIO1`
- `SS = GPIO4`
- `RST = GPIO7`

Importante: este mapeo RC522 no coincide con revisiones anteriores del firmware. El documento toma como referencia **la revisión hoy validada**.

## Modelo lógico MDB del firmware

El firmware maneja la sesión MDB con estos estados:

- `INACTIVE`
- `MDB_DISABLED`
- `ENABLED`
- `SESSION_IDLE`
- `VEND_PENDING`

La definición está en [main.cpp](/C:/PROYECTOS/CoffeControl/CoffeeControl_proyecto/CoffeeControl_v3/src/main.cpp#L179).

### Significado práctico

- `INACTIVE`: recién reseteado; todavía no se publicó `JUST_RESET`
- `MDB_DISABLED`: el lector existe, pero el VMC todavía no lo habilitó
- `ENABLED`: el lector está listo para abrir una sesión si se aprueba un tag
- `SESSION_IDLE`: ya existe una autorización NFC pendiente de exponer al VMC
- `VEND_PENDING`: el VMC ya pidió dispensado y el lector debe responder aprobar/denegar en el siguiente `POLL`

## Direcciones MDB usadas en este proyecto

### Cashless

- dirección base: `0x10`

Es la interfaz operativa real de la Rubino en este proyecto.

### Gateway

- dirección base: `0x18`

Está implementada en firmware para evaluación, pero no es parte del flujo operativo principal con esta Rubino.

Las definiciones están en [main.cpp](/C:/PROYECTOS/CoffeControl/CoffeeControl_proyecto/CoffeeControl_v3/src/main.cpp#L113) y [main.cpp](/C:/PROYECTOS/CoffeControl/CoffeeControl_proyecto/CoffeeControl_v3/src/main.cpp#L114).

## Perfil de precio Rubino

La Rubino validada en este proyecto usa el perfil:

- `rubino_half_credit`

Ese perfil hace dos cosas:

- el **precio humano** del proyecto se guarda como valor normal, por ejemplo `1200`
- el **crédito MDB de BEGIN SESSION** se envía a la mitad, por ejemplo `600`

Implementación actual:

- `pricingBeginSessionFunds()` devuelve `humanPrice / 2` para Rubino
- `pricingDefaultVendAmount()` conserva el valor humano
- `pricingMdbAmountToHuman()` vuelve a multiplicar por `2` cuando hace falta interpretar monto MDB como monto humano

Referencia:

- [pricing.cpp](/C:/PROYECTOS/CoffeControl/CoffeeControl_proyecto/CoffeeControl_v3/src/pricing.cpp#L47)

### Ejemplo real

Si backend/panel guardan:

- `price_cents = 1200`

entonces:

- `BEGIN SESSION` se publica con `funds = 600`
- la Rubino muestra crédito equivalente a `$1200`
- si la Rubino manda `VEND_REQUEST` por `600`, el backend sigue trabajando con el contexto humano del producto configurado

## Configuración MDB que responde el lector

Cuando la Rubino manda `SETUP CONFIG`, el lector responde con:

- `featureLevel`
- `countryCode`
- `scaleFactor`
- `decimalPlaces`
- `maxResponseTime`
- `miscOptions`

Valores por defecto actuales:

- `featureLevel = 0x01`
- `countryCode = 0x0032` (`032`, Argentina)
- `scaleFactor = 0x64`
- `decimalPlaces = 0x02`
- `maxResponseTime = 0x05`
- `miscOptions = 0x00`

Referencia:

- [pricing.cpp](/C:/PROYECTOS/CoffeControl/CoffeeControl_proyecto/CoffeeControl_v3/src/pricing.cpp#L8)
- [pricing.cpp](/C:/PROYECTOS/CoffeControl/CoffeeControl_proyecto/CoffeeControl_v3/src/pricing.cpp#L73)

## Handshake real de arranque con Rubino

La Rubino es el **master** MDB. El ESP actúa como **cashless peripheral**. El lector no interroga libremente a la máquina; responde a lo que el VMC manda.

### Secuencia esperada

1. `RESET`
2. `POLL`
3. `SETUP CONFIG`
4. `SETUP PRICES`
5. `READER ENABLE`
6. `POLL` estable hasta que exista una autorización NFC

### Cómo responde el firmware

#### 1. `RESET`

Handler: [cmdReset()](/C:/PROYECTOS/CoffeControl/CoffeeControl_proyecto/CoffeeControl_v3/src/main.cpp#L2821)

Acciones:

- limpia toda la sesión MDB
- vuelve a `INACTIVE`
- resetea snapshots de diagnóstico
- responde `ACK`
- deja `justReset = true`

Log típico:

```text
[MDB] RESET recibido → INACTIVE
```

#### 2. `POLL` luego del reset

Handler: [cmdPoll()](/C:/PROYECTOS/CoffeControl/CoffeeControl_proyecto/CoffeeControl_v3/src/main.cpp#L3040)

Si `phase == INACTIVE` y `justReset == true`:

- responde `MDB_JUST_RESET`
- pasa a `MDB_DISABLED`

#### 3. `SETUP CONFIG`

Handler: [cmdSetup()](/C:/PROYECTOS/CoffeControl/CoffeeControl_proyecto/CoffeeControl_v3/src/main.cpp#L3002)

Si el subcomando es `SETUP_CONFIG`:

- captura snapshot MDB de la máquina
- arma la respuesta de configuración del lector
- responde los `7` bytes de setup
- pasa a `MDB_DISABLED`

Log típico:

```text
[MDB] SETUP config → MDB_DISABLED
```

#### 4. `SETUP PRICES`

También entra por `cmdSetup()`.

En este proyecto:

- se captura para diagnóstico
- se responde `ACK`

De ahí salen, por ejemplo:

- `vmcLevel`
- `maxPrice`
- `minPrice`

Sobre esta Rubino se confirmó en campo:

- `Feature Level = 2`
- `Max Price = 32767`
- `Min Price = 0`

#### 5. `READER ENABLE`

Handler: [cmdReader()](/C:/PROYECTOS/CoffeControl/CoffeeControl_proyecto/CoffeeControl_v3/src/main.cpp#L3204)

Si el VMC manda `READER_ENABLE`:

- el lector pasa a `ENABLED`
- responde `ACK`

Log típico:

```text
[MDB] READER ENABLE → ENABLED
```

## Flujo completo de venta en este proyecto

## 1. Tag NFC

Handler: [handleNFC()](/C:/PROYECTOS/CoffeControl/CoffeeControl_proyecto/CoffeeControl_v3/src/main.cpp#L2701)

Cuando el RC522 detecta una tarjeta:

1. lee UID
2. si hay WiFi intenta autorización online con `postTap(uid)`
3. si no hay backend, cae a autorización offline por cache local
4. si se aprueba, encola `MDB_EVENT_START_SESSION`

Si el tag es rechazado:

- no se abre sesión MDB
- se dispara patrón de rechazo local

Si ya existe sesión MDB activa:

- el tap se ignora

Log típico:

```text
[NFC] TAP IGNORADO — sesion MDB activa
```

Esa protección evita dobles autorizaciones superpuestas.

## 2. Encolado de sesión

Funciones:

- [enqueueMdbStartSession()](/C:/PROYECTOS/CoffeControl/CoffeeControl_proyecto/CoffeeControl_v3/src/main.cpp#L998)
- [startMdbSessionFromEvent()](/C:/PROYECTOS/CoffeControl/CoffeeControl_proyecto/CoffeeControl_v3/src/main.cpp#L1010)

Cuando el tag queda aprobado:

- se guarda `sessionUID`
- se marca si la autorización fue offline
- `pendingSession = true`
- `phase = SESSION_IDLE`

Todavía no se habló con la Rubino en ese momento. Lo que se hace es **preparar** la sesión para publicarla en el próximo `POLL`.

## 3. `POLL` con sesión pendiente -> `BEGIN SESSION`

Handler: [cmdPoll()](/C:/PROYECTOS/CoffeControl/CoffeeControl_proyecto/CoffeeControl_v3/src/main.cpp#L3083)

Si `phase == SESSION_IDLE` y `pendingSession == true`:

- calcula `sessionFunds`
- arma:
  - `MDB_BEGIN_SESSION`
  - high byte de funds
  - low byte de funds
- responde ese frame al VMC

Log típico:

```text
[MDB] BEGIN SESSION → funds=0x0258
```

Para un precio humano de `1200`, `0x0258` equivale a `600`.

## 4. `VEND_REQUEST`

Handler: [cmdVend()](/C:/PROYECTOS/CoffeControl/CoffeeControl_proyecto/CoffeeControl_v3/src/main.cpp#L3127)

Cuando la Rubino pide una selección:

- lee el monto MDB pedido
- lee el `itemId`
- guarda ambos en runtime
- responde `ACK`
- prepara la decisión de venta para el siguiente `POLL`

Log típico:

```text
[MDB] VEND_REQUEST — item #7 $600 centavos
```

Nota importante:

- el texto del log refleja el valor recibido por MDB
- la lógica de negocio del proyecto mantiene la referencia humana del producto configurado

## 5. `POLL` -> aprobar o denegar

Si `phase == VEND_PENDING`:

- si `vendApproved == true`, responde `MDB_VEND_APPROVED + amount`
- si no, responde `MDB_VEND_DENIED`

Eso ocurre en [cmdPoll()](/C:/PROYECTOS/CoffeControl/CoffeeControl_proyecto/CoffeeControl_v3/src/main.cpp#L3100).

En el flujo normal validado:

- la aprobación sale en el `POLL` inmediatamente posterior al `VEND_REQUEST`

## 6. Dispensado físico

Después de recibir `VEND_APPROVED`, la Rubino decide y ejecuta el dispensado real.

Si el dispensado se concreta:

- la Rubino manda `VEND_SUCCESS`

Si no se concreta:

- la Rubino manda `VEND_FAILURE`

## 7. `VEND_SUCCESS`

Handler: [cmdVend()](/C:/PROYECTOS/CoffeControl/CoffeeControl_proyecto/CoffeeControl_v3/src/main.cpp#L3154)

Cuando llega:

- se evita doble consumo por éxito duplicado
- se notifica el resultado al backend con `ok = true`
- `vendUsed = true`
- se responde `ACK`
- el estado pasa a `SESSION_IDLE`

Log típico:

```text
[MDB] VEND_SUCCESS — venta confirmada
```

## 8. `VEND_FAILURE`

Handler: [cmdVend()](/C:/PROYECTOS/CoffeControl/CoffeeControl_proyecto/CoffeeControl_v3/src/main.cpp#L3168)

Cuando llega:

- se notifica backend con `ok = false`
- se responde `ACK`
- se limpian datos de sesión
- vuelve a `SESSION_IDLE`

Log típico:

```text
[MDB] VEND_FAILURE — venta fallida
```

## 9. `VEND_END`

Handler: [cmdVend()](/C:/PROYECTOS/CoffeControl/CoffeeControl_proyecto/CoffeeControl_v3/src/main.cpp#L3180)

`VEND_END` cierra formalmente la sesión en el lado VMC.

Si hubo una autorización pero nunca hubo dispensado:

- el firmware cancela el tap en backend

Después:

- responde `ACK`
- deja `endSessionPending = true`

En el siguiente `POLL`, el lector manda:

- `MDB_END_SESSION`

Eso cierra el ciclo y vuelve el lector a `ENABLED`.

## Secuencia completa resumida

```text
Rubino -> RESET                -> ESP ACK
Rubino -> POLL                 -> ESP JUST_RESET
Rubino -> SETUP CONFIG         -> ESP responde config lector
Rubino -> SETUP PRICES         -> ESP ACK
Rubino -> READER ENABLE        -> ESP ACK
Rubino -> POLL                 -> ESP ACK

Usuario -> acerca tag
ESP -> backend/cache           -> autorización OK
Rubino -> POLL                 -> ESP BEGIN_SESSION(funds)
Rubino -> VEND_REQUEST         -> ESP ACK
Rubino -> POLL                 -> ESP VEND_APPROVED(amount)
Rubino -> dispensa producto
Rubino -> VEND_SUCCESS         -> ESP ACK + notificación backend OK
Rubino -> VEND_END             -> ESP ACK
Rubino -> POLL                 -> ESP END_SESSION
Rubino -> POLL                 -> ESP ACK estable
```

## Reglas de protección implementadas

### Una autorización NFC = un solo dispensado

`vendUsed` evita aprobar un segundo `VEND_REQUEST` dentro de la misma sesión.

Referencia:

- [cmdVend()](/C:/PROYECTOS/CoffeControl/CoffeeControl_proyecto/CoffeeControl_v3/src/main.cpp#L3138)

### No aceptar taps con sesión activa

Si el lector está en:

- `SESSION_IDLE`
- `VEND_PENDING`

el nuevo tag se ignora.

Referencia:

- [handleNFC()](/C:/PROYECTOS/CoffeControl/CoffeeControl_proyecto/CoffeeControl_v3/src/main.cpp#L2705)

### Timeout de sesión

Si se aprobó un tag pero la sesión no progresa:

- `processMdbSessionTimeout()` cancela la autorización
- notifica backend con resultado negativo

Referencia:

- [main.cpp](/C:/PROYECTOS/CoffeControl/CoffeeControl_proyecto/CoffeeControl_v3/src/main.cpp#L1046)

### `READER_DISABLE` mid-session

Si la Rubino deshabilita el lector con una sesión sin dispensado:

- el tap también se cancela en backend

Referencia:

- [cmdReader()](/C:/PROYECTOS/CoffeControl/CoffeeControl_proyecto/CoffeeControl_v3/src/main.cpp#L3211)

## Fecha/hora MDB en el flujo cashless

El firmware soporta captura de `WRITE TIME/DATE FILE` y además una solicitud manual de `TIME/DATE REQUEST` para diagnóstico.

Qué se hace hoy:

- si la Rubino manda fecha/hora por cashless, se captura en snapshot MDB
- el portal expone `/diag/mdb`
- existe `/diag/mdb/request-time` para armar una solicitud manual en el próximo `POLL` estando `ENABLED`

Decisión operativa del proyecto:

- el reloj principal es `NTP`
- la hora MDB queda como diagnóstico/fallback

## Diagnóstico MDB disponible

### Portal local

- `GET /diag/events`
- `GET /diag/mdb`
- `POST /diag/mdb/request-time`

Referencias:

- [main.cpp](/C:/PROYECTOS/CoffeControl/CoffeeControl_proyecto/CoffeeControl_v3/src/main.cpp#L1917)
- [main.cpp](/C:/PROYECTOS/CoffeControl/CoffeeControl_proyecto/CoffeeControl_v3/src/main.cpp#L1925)
- [main.cpp](/C:/PROYECTOS/CoffeControl/CoffeeControl_proyecto/CoffeeControl_v3/src/main.cpp#L1931)

### Qué muestra `diag/mdb`

Entre otras cosas:

- si vio `SETUP CONFIG`
- si vio `SETUP PRICES`
- si vio `EXPANSION`
- si vio `TIME/DATE`
- `vmcLevel`
- `maxPrice`
- `minPrice`
- payload crudo de setup
- bloque `gateway`

## Communications Gateway `0x18`

## Qué implementa el firmware

El firmware expone un gateway MDB mínimo para evaluación:

- `RESET`
- `SETUP`
- `POLL`
- `REPORT`
- `CONTROL`
- `IDENTIFICATION`
- `FEATURE ENABLE`
- `TIME/DATE REQUEST`

Handlers:

- [cmdGatewayReset()](/C:/PROYECTOS/CoffeControl/CoffeeControl_proyecto/CoffeeControl_v3/src/main.cpp#L2841)
- [cmdGatewaySetup()](/C:/PROYECTOS/CoffeControl/CoffeeControl_proyecto/CoffeeControl_v3/src/main.cpp#L2852)
- [cmdGatewayPoll()](/C:/PROYECTOS/CoffeControl/CoffeeControl_proyecto/CoffeeControl_v3/src/main.cpp#L2871)
- [cmdGatewayReport()](/C:/PROYECTOS/CoffeControl/CoffeeControl_proyecto/CoffeeControl_v3/src/main.cpp#L2880)
- [cmdGatewayControl()](/C:/PROYECTOS/CoffeControl/CoffeeControl_proyecto/CoffeeControl_v3/src/main.cpp#L2885)
- [cmdGatewayExpansion()](/C:/PROYECTOS/CoffeControl/CoffeeControl_proyecto/CoffeeControl_v3/src/main.cpp#L2933)

## Qué feature publica hoy

Actualmente el gateway soporta, en lo práctico:

- `TIME/DATE`

El origen de esa fecha/hora es:

1. `NTP`
2. si no, fallback de hora MDB capturada

## Resultado real con la Rubino de este proyecto

En las pruebas reales sobre esta instalación:

- la Rubino **sí usa el cashless `0x10`**
- la Rubino **no interroga el gateway `0x18`**

En diagnóstico quedaron en `No`:

- `Setup visto`
- `Control visto`
- `Identificación vista`
- `Feature enable visto`
- `Time/Date request vista`

Conclusión práctica:

- el gateway fue evaluado
- no sirve hoy como camino operativo para esta Rubino
- no se usa para ventas
- no se usa para sincronizar reloj del VMC

## Conclusiones operativas

### Camino principal real

Para esta Rubino, el camino que realmente importa es:

- `Cashless 0x10`

### Flujo de venta ya validado

El flujo que hoy se da por bueno en producción es:

- tag NFC aprobado
- `BEGIN_SESSION`
- `VEND_REQUEST`
- `VEND_APPROVED`
- `VEND_SUCCESS`
- `VEND_END`
- `END_SESSION`
- persistencia correcta en backend

### Gateway

El gateway queda como:

- implementación disponible
- herramienta de evaluación/diagnóstico
- no adoptado como integración principal con esta máquina

### Precio

La Rubino usa un comportamiento particular de crédito:

- precio humano del proyecto: por ejemplo `1200`
- crédito MDB de sesión: `600`

Ese punto es central y no debe perderse al cambiar config técnica o al probar otra revisión de firmware.

## Referencias del proyecto

- [main.cpp](/C:/PROYECTOS/CoffeControl/CoffeeControl_proyecto/CoffeeControl_v3/src/main.cpp)
- [pricing.cpp](/C:/PROYECTOS/CoffeControl/CoffeeControl_proyecto/CoffeeControl_v3/src/pricing.cpp)
- [pricing.h](/C:/PROYECTOS/CoffeControl/CoffeeControl_proyecto/CoffeeControl_v3/src/pricing.h)
- [CHANGELOG_MDB_2026-04-02.md](/C:/PROYECTOS/CoffeControl/CoffeeControl_proyecto/CHANGELOG_MDB_2026-04-02.md)
- [AGENTE.md](/C:/PROYECTOS/CoffeControl/CoffeeControl_proyecto/AGENTE.md)
- [PLAN_FIRMWARE_V3_HARDENING.md](/C:/PROYECTOS/CoffeControl/CoffeeControl_proyecto/PLAN_FIRMWARE_V3_HARDENING.md)
