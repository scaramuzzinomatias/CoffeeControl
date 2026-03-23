# CoffeeControl — Firmware ESP8266

## Diagrama de conexión

```
┌─────────────────────────────────────────────────────┐
│                    NodeMCU / Wemos D1                │
│                                                      │
│   3.3V ──────────────────────── VCC  ┐ RC522        │
│   GND  ──────────────────────── GND  │              │
│   D4 (GPIO2) ────────────────── SDA  │              │
│   D5 (GPIO14) ───────────────── SCK  │              │
│   D7 (GPIO13) ───────────────── MOSI │              │
│   D6 (GPIO12) ───────────────── MISO │              │
│   D3 (GPIO0)  ───────────────── RST  ┘              │
│                                                      │
│   D1 (GPIO5) ─── MAX3232 R1OUT ──┐                  │
│   D2 (GPIO4) ─── MAX3232 T1IN  ──┤── Bus MDB (5V)  │
│   5V ──────────── MAX3232 VCC    │   (expendedora)  │
│   GND ─────────── MAX3232 GND  ──┘                  │
└─────────────────────────────────────────────────────┘
```

## Librerías requeridas (Arduino IDE)

| Librería | Instalar desde |
|---|---|
| MFRC522 | Gestor de librerías → buscar "MFRC522 by GithubCommunity" |
| ESP8266WiFi | Incluida con el board ESP8266 |
| ESP8266HTTPClient | Incluida con el board ESP8266 |
| SoftwareSerial | Incluida con Arduino |

## Board settings (Arduino IDE)

- **Board**: NodeMCU 1.0 (ESP-12E Module) o Wemos D1 R2 & mini  
- **Upload Speed**: 115200  
- **CPU Frequency**: 80 MHz  
- **Flash Size**: 4MB (FS: 2MB, OTA: 1MB)

## Configuración antes de flashear

Editar las líneas al inicio del .ino:

```cpp
#define WIFI_SSID       "TuRedWiFi"
#define WIFI_PASSWORD   "TuPassword"
#define BACKEND_URL     "http://192.168.1.100:3000/api/tap"
#define MACHINE_ID      1        // Cambiar por 1, 2, 3 o 4
#define MACHINE_SECRET  "cc-secret-1"
```

## Flujo de operación

```
[Inicio] → connectWiFi → MDB RESET → MDB SETUP CONFIG
                                           ↓
                                     STATE_DISABLED
                                           ↓
                              VMC envía READER ENABLE
                                           ↓
                                      STATE_ENABLED
                                           ↓
                              Usuario acerca tarjeta NFC
                                           ↓
                               RC522 lee UID → POST /api/tap
                                      ↙           ↘
                                 200 OK           403 / error
                                    ↓                  ↓
                          STATE_SESSION_IDLE     (nada — máquina
                                    ↓             no dispensa)
                          POLL → BEGIN SESSION
                                    ↓
                          Usuario elige producto
                                    ↓
                          VEND REQUEST → VEND APPROVED
                                    ↓
                          Máquina dispensa físicamente
                                    ↓
                     VEND SUCCESS → POST /api/tap/confirm
                                    ↓
                             STATE_SESSION_IDLE
```

## Nota sobre protocolo MDB 9 bits

MDB usa 9600 baud con 9° bit de modo (address/data bit).
El ESP8266 no soporta 9 bits por hardware nativamente.

**Solución para producción robusta:**
Agregar un ATtiny85 ($1.50) como co-procesador MDB:
- ATtiny85 maneja el 9° bit y la comunicación con el bus
- Se comunica con el ESP8266 por I2C (2 cables)
- El ESP8266 solo hace WiFi + NFC + lógica HTTP

Para un MVP funcional, la implementación con SoftwareSerial
a 8N1 funciona en la mayoría de las expendedoras modernas porque
el VMC tolera la ausencia del 9° bit en el periférico esclavo.
