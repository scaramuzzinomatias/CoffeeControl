# Changelog MDB — 2 de Abril 2026

## Resumen

Se logró **comunicación MDB bidireccional completa** entre el ESP32-C3 Super Mini
y la VMC Saeco Rubino 200 HS1. El sistema realiza el handshake MDB, acepta tarjetas
NFC, abre sesión de crédito, recibe VEND REQUEST y despacha café exitosamente.

---

## Cambios en `CoffeeControl_v3/lib/MDB9bit/MDB9bit.h`

### TX por UART hardware (reemplazo de bit-banging)
- **Antes**: TX usaba `digitalWrite()` bit-banging que era demasiado lento e
  impreciso para el timing de 9600 baud.
- **Ahora**: TX usa **UART1 hardware** en GPIO20 con `uart_write_bytes()`.
- Se habilitó `UART_SIGNAL_TXD_INV` para compensar la inversión del BC548 NPN
  en el circuito TX (common-emitter invierte la señal).
- RX **sin inversión** (`UART_SIGNAL_RXD_INV` NO se usa).

### Truco de paridad para 9no bit MDB
- MDB necesita 9 bits: 8 datos + 1 bit MODE (0=data, 1=address).
- UART 8E1 tiene 8 datos + 1 bit paridad → alineación perfecta.
- `_sendByte(byte, bit9)` calcula si paridad EVEN u ODD produce el valor deseado
  del 9no bit, cambia `uart_set_parity()` dinámicamente antes de cada byte.

### Detección de frames RX
- Usa `rx_tout` (receive timeout) del hardware UART para detectar fin de frame.
- Ring buffer circular de 64 frames para comunicación entre tarea RX y handler MDB.

---

## Cambios en `CoffeeControl_v3/src/main.cpp`

### Corrección crítica: ACK con 9no bit = 1
- **Bug**: ACK (0x00) se enviaba con `sendData()` (mode=0).
- **Fix**: Cambiado a `sendAddress()` (mode=1) como requiere el protocolo MDB.
- **Impacto**: Sin este fix el VMC se quedaba en loop de RESET. Con el fix,
  el VMC avanza inmediatamente a POLL → SETUP → READER ENABLE.

### Corrección: Checksum con 9no bit = 1
- `mdbSendByte()`: checksum ahora usa `sendAddress()` (mode=1).
- `mdbSendData()`: último byte (checksum) usa `sendAddress()` (mode=1).
- Todos los bytes de datos usan `sendData()` (mode=0).

### Corrección: ACK faltante en VEND_REQUEST
- **Bug**: `cmdVend() → VEND_REQUEST` no enviaba ACK al VMC.
- **Fix**: Se agregó `mdbSendACK()` al final del case VEND_REQUEST.
- **Impacto**: Sin ACK el VMC repetía VEND_REQUEST infinitamente. Con el fix,
  el VMC acepta y avanza a POLL donde recibe VEND_APPROVED.

### Configuración de escala MDB
- SETUP CONFIG: Feature Level 1, Country Code Argentina (032),
  **Scale=100, Decimal Places=2**.
- Funds en BEGIN SESSION: **0x0258 (600)** → VMC muestra $1200 crédito.
- La Saeco Rubino usa factor ×2 entre valor MDB y display.

### Estado inicial MDB corregido
- **Antes**: `mdbState = ENABLED` (valor falso, no reflejaba handshake real).
- **Ahora**: `mdbState = INACTIVE` (estado correcto al boot).

### Limpieza
- Eliminado loopback test del `setup()` (ya no necesario).
- `DEBUG_MDB_LOG` = 1 (activado para diagnóstico, desactivar en producción).
- Agregado log de datos VMC SETUP para diagnosticar escala/precios.
- Agregado log de BEGIN SESSION con valor de funds.

---

## Circuito MDB (confirmado funcional)

```
TX: GPIO20 → 1KΩ → Base BC548 → Emitter=GND, Collector=MDB Pin 4 (VMC Receive)
RX: MDB Pin 5 (VMC Transmit) → 10KΩ → Base BC548 → Emitter=VMC GND,
    Collector → 10KΩ pullup a 3.3V → GPIO21
```

- Ambos BC548 en configuración common-emitter (inversión de señal).
- TX compensa inversión con `UART_SIGNAL_TXD_INV`.
- RX no necesita inversión adicional.

## Flujo MDB verificado

```
VMC → RESET (0x10)           → ESP ACK (mode=1)           ~1.4ms
VMC → POLL  (0x12)           → ESP JUST_RESET (0x00+chk)
VMC → SETUP CONFIG (0x11)    → ESP Config Response (7 bytes)
VMC → SETUP PRICES (0x11)    → ESP ACK
VMC → READER ENABLE (0x14)   → ESP ACK → mdbState=ENABLED
VMC → POLL  (0x12)           → ESP ACK (estado estable)
--- Tap NFC ---
VMC → POLL  (0x12)           → ESP BEGIN SESSION (0x03 + funds)
VMC → VEND_REQUEST (0x13)    → ESP ACK
VMC → POLL  (0x12)           → ESP VEND_APPROVED (0x05 + amount)
VMC → despacha café
VMC → VEND_SUCCESS           → ESP ACK → notifica backend
VMC → RESET                  → reinicia ciclo
```

## VMC Saeco Rubino 200 HS1 — Datos MDB

- Feature Level: 2
- Max Price: 0x7FFF (32767)
- Min Price: 0x0000
- Escala display: valor MDB × 2 = precio en pantalla
- Precio café: 600 MDB units = $1200 display
- Conector Molex 6-pin: Pin1=+24V, Pin2=GND, Pin3=NC, Pin4=RX, Pin5=TX, Pin6=GND
