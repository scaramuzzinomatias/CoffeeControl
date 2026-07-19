#define DEBUG_MDB_EVENTS  0  // eventos de alto nivel en la ruta MDB
#define DEBUG_MDB_TRACE   0  // bytes TX/RX y dumps detallados
#define DEBUG_MDB_TIMING  0  // medicion fina de duracion por comando

#if DEBUG_MDB_EVENTS
#define MDB_LOG_EVENT(...) do { Serial.printf(__VA_ARGS__); } while (0)
#define MDB_LOG_EVENTLN(msg) do { Serial.println(msg); } while (0)
#else
#define MDB_LOG_EVENT(...) do {} while (0)
#define MDB_LOG_EVENTLN(msg) do {} while (0)
#endif

#if DEBUG_MDB_TRACE
#define MDB_LOG_TRACE(...) do { Serial.printf(__VA_ARGS__); } while (0)
#define MDB_LOG_TRACELN(msg) do { Serial.println(msg); } while (0)
#else
#define MDB_LOG_TRACE(...) do {} while (0)
#define MDB_LOG_TRACELN(msg) do {} while (0)
#endif

#if DEBUG_MDB_TIMING
#define MDB_LOG_TIMING(...) do { Serial.printf(__VA_ARGS__); } while (0)
#else
#define MDB_LOG_TIMING(...) do {} while (0)
#endif

/*
 * CoffeeControl — Firmware ESP32-C3 v3
 * ─────────────────────────────────────────────────────
 * Target:    ESP32-C3 Super Mini (4MB flash, 400KB heap)
 * Toolchain: PlatformIO
 * ─────────────────────────────────────────────────────
 * Novedades respecto a v2 (ESP8266):
 *   - Preferences.h en lugar de EEPROM (NVS, más robusto)
 *   - LittleFS para cards.json y queue.json (modo offline)
 *   - Autenticación local: cache de hasta ~1500 tarjetas en RAM
 *   - Cola offline: hasta 1000 eventos, flush automático al reconectar
 *   - Reloj operativo por NTP, con fallback diagnóstico desde MDB si la máquina entrega fecha/hora
 *   - MDB usando UART hardware 8E1 + paridad como bit MODE
 *   - RC522 en esta revisión con MOSI/MISO físicamente cruzados
 * ─────────────────────────────────────────────────────
 * Pines ESP32-C3 Super Mini — pinout de esta revision:
 *   GPIO0  = SPI SCK  (RC522)
 *   GPIO1  = SPI MISO (RC522)
 *   GPIO3  = SPI MOSI (RC522)   ← NO usar GPIO2: strapping pin
 *   GPIO4  = RC522 SS  (CS)
 *   GPIO7  = RC522 RST
 *   GPIO5/6 reservados si a futuro se necesita I²C, pero el diseño activo no usa RTC hardware
 *   GPIO10 = LED externo (activo HIGH)
 *   GPIO9  = BOOT button (pull-up interno, LOW = presionado, abre portal en runtime)
 *   GPIO20 = MDB RX (entrada del bus)
 *   GPIO21 = MDB TX (salida al bus)
 *
 * Pines que NO conectar nada:
 *   GPIO2  = strapping (debe estar HIGH al boot)
 *   GPIO8  = LED onboard azul + strapping (usar solo post-boot, debe estar HIGH al boot)
 *   GPIO18/19 = USB D-/D+ (programación)
 */

#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <Update.h>
#include <WebServer.h>
#include <DNSServer.h>
#include <Preferences.h>
#include <SPI.h>
// Baja el clock del RC522 para tolerar mejor cableado/pistas menos ideales.
#define MFRC522_SPICLOCK (1000000u)
#include <MFRC522.h>
#include <LittleFS.h>
#include <ArduinoJson.h>
#include <esp_system.h>
#include <esp_task_wdt.h>
#include <freertos/queue.h>
// En esta revisión, la etapa TX aislada hacia MDB requiere inversión final.
#define MDB_UART_TX_INVERT 1
#include "MDB9bit.h"
#include "pricing.h"
#include "device_config.h"
#include "event_log.h"
#include "offline_queue.h"

// ── Pines ─────────────────────────────────────────────
#define PIN_SPI_SCK    0
// Esta revision de placa quedo con MOSI/MISO fisicamente invertidos en el RC522.
#define PIN_SPI_MOSI   3
#define PIN_SPI_MISO   1
#define PIN_RC522_SS   4
#define PIN_RC522_RST  7
#define PIN_LED       10
#define PIN_LED_ONBOARD 8   // LED onboard azul del Super Mini (activo LOW, usar solo post-boot)
#define PIN_BOOT_BTN   9   // BOOT button: pull-up interno, LOW = presionado
#define PIN_MDB_TX    21   // TX = GPIO21 (salida al bus MDB)
#define PIN_MDB_RX    20   // RX = GPIO20 (entrada del bus MDB)

// ── Modo de deployment ────────────────────────────────
// Opción B — servidor local (URL configurable en el portal)
#define DEPLOYMENT_MODE       "local"
#define BACKEND_URL           "http://coffeecontrol.smartq.com.ar:3000"   // fallback si campo vacío
#define REGISTRATION_SECRET   "coffeecontrol-registro-2024"
#ifndef FIRMWARE_VERSION
#define FIRMWARE_VERSION      "3.1.21"
#endif

// ── Portal WiFi cautivo ───────────────────────────────
#define AP_SSID        "CoffeeControl-Setup"
#define AP_IP_STR      "192.168.4.1"
#define DNS_PORT       53
#define PORTAL_BUTTON_HOLD_MS  5000   // mantener 5s → abrir portal sin borrar config

// ── MDB constantes ────────────────────────────────────
#define MDB_ADDR_CASHLESS  0x10
#define MDB_ADDR_GATEWAY   0x18
#define MDB_CMD_RESET      0x00
#define MDB_CMD_SETUP      0x01
#define MDB_CMD_POLL       0x02
#define MDB_CMD_VEND       0x03
#define MDB_CMD_READER     0x04
#define MDB_CMD_EXPANSION  0x07
#define SETUP_CONFIG       0x00
#define SETUP_PRICES       0x01
#define EXPANSION_REQUEST_ID 0x00
#define EXPANSION_WRITE_TIME_DATE 0x03
#define MDB_TIME_DATE_REQUEST 0x11
#define MDB_GW_EXP_IDENTIFICATION 0x00
#define MDB_GW_EXP_FEATURE_ENABLE 0x01
#define MDB_GW_EXP_TIME_DATE_REQUEST 0x02
#define MDB_GW_CONTROL_DISABLE 0x00
#define MDB_GW_CONTROL_ENABLE  0x01
#define MDB_GW_CONTROL_TRANSMIT 0x02
#define MDB_GW_FEATURE_FTL        0x00000001UL
#define MDB_GW_FEATURE_VERBOSE    0x00000002UL
#define MDB_GW_FEATURE_TIME_DATE  0x00000004UL
#define VEND_REQUEST       0x00
#define VEND_CANCEL        0x01
#define VEND_SUCCESS       0x02
#define VEND_FAILURE       0x03
#define VEND_END           0x04
#define READER_DISABLE     0x00
#define READER_ENABLE      0x01
#define MDB_ACK            0x00
#define MDB_NAK            0xFF
#define MDB_JUST_RESET     0x00
#define MDB_BEGIN_SESSION  0x03
#define MDB_VEND_APPROVED  0x05
#define MDB_VEND_DENIED    0x06
#define MDB_END_SESSION    0x07
#define MDB_CANCELLED      0x08

// ── Timing ────────────────────────────────────────────
#define NFC_COOLDOWN_MS    2500
#define HTTP_TIMEOUT_MS    4000
#define OTA_HTTP_TIMEOUT_MS 20000
#define SESSION_TIMEOUT_MS 12000
#define MDB_ASYNC_QUEUE_LEN 4
#define MDB_ASYNC_UID_MAX 17
#define COMMAND_POLL_MS    5000
#define WATCHDOG_TIMEOUT_SEC 90

// ── Offline ───────────────────────────────────────────
#define MAX_CARDS          1500   // límite práctico (~100KB ArduinoJson doc)
#define MAX_QUEUE          1000
#define CARDS_PATH         "/cards.json"
#define QUEUE_PATH         "/queue.log"
#define QUEUE_LEGACY_PATH  "/queue.json"

// Resultados de localAuth()
#define LOCAL_AUTH_OK        0
#define LOCAL_AUTH_OVERLIMIT 1
#define LOCAL_AUTH_UNKNOWN   2

// Modos de límite diario cacheados offline
#define LIMIT_MODE_ENFORCE   0
#define LIMIT_MODE_WARN_ONLY 1
#define LIMIT_MODE_OFF       2

// ── Estado MDB ────────────────────────────────────────
enum MDBState { INACTIVE, MDB_DISABLED, ENABLED, SESSION_IDLE, VEND_PENDING };

// ── Estructuras offline (packed para ahorrar RAM) ─────
struct __attribute__((packed)) CardEntry {
    char    uid[9];    // "0A30FC80\0"
    uint8_t limit;     // daily_limit
    uint8_t mode;      // enforce / warn_only / off
    uint8_t used;      // used_today (en memoria)
};

struct __attribute__((packed)) MdbSetupSnapshot {
    uint8_t seenMask;       // bit0=config, bit1=prices
    uint8_t lastSubcmd;
    uint8_t lastLen;
    uint8_t vmcLevel;
    uint8_t displayColumns;
    uint8_t displayRows;
    uint8_t displayInfo;
    uint8_t reserved;
    uint16_t maxPrice;
    uint16_t minPrice;
    uint32_t lastSeenMs;
    uint8_t raw[8];
    uint8_t lastExpansionSubcmd;
    uint8_t lastExpansionLen;
    uint8_t lastExpansionReserved[2];
    uint32_t lastExpansionSeenMs;
    uint8_t expansionRaw[12];
    uint8_t timeDateYear;
    uint8_t timeDateMonth;
    uint8_t timeDateDay;
    uint8_t timeDateHour;
    uint8_t timeDateMinute;
    uint8_t timeDateSecond;
    uint8_t timeDateDayOfWeek;
    uint8_t timeDateWeekNumber;
};

struct __attribute__((packed)) MdbGatewaySnapshot {
    uint8_t seenMask;       // bit0=setup, bit1=control, bit2=identification, bit3=feature_enable, bit4=time_request, bit5=report
    uint8_t lastCmd;
    uint8_t lastLen;
    uint8_t vmcFeatureLevel;
    uint8_t vmcScaleFactor;
    uint8_t vmcDecimalPlaces;
    uint8_t gatewayFeatureLevel;
    uint8_t controlState;
    uint16_t appMaxResponseSeconds;
    uint32_t enabledFeatures;
    uint32_t lastSeenMs;
    uint32_t lastControlMs;
    uint32_t lastTimeDateResponseMs;
    uint8_t raw[12];
    uint8_t timeDateYear;
    uint8_t timeDateMonth;
    uint8_t timeDateDay;
    uint8_t timeDateHour;
    uint8_t timeDateMinute;
    uint8_t timeDateSecond;
};

struct MdbGatewayRuntimeState {
    bool justReset;
    bool enabled;
    uint8_t vmcFeatureLevel;
    uint8_t featureLevel;
    uint16_t appMaxResponseSeconds;
    uint32_t enabledFeatures;

    MdbGatewayRuntimeState()
        : justReset(true),
          enabled(false),
          vmcFeatureLevel(0),
          featureLevel(0),
          appMaxResponseSeconds(5),
          enabledFeatures(0) {}
};

enum MdbAsyncEventType : uint8_t {
    MDB_EVENT_START_SESSION = 1
};

struct __attribute__((packed)) MdbAsyncEvent {
    uint8_t type;
    uint8_t sessionIsOffline;
    uint16_t reserved;
    uint32_t requestedAtMs;
    char uid[MDB_ASYNC_UID_MAX];
};

struct MdbRuntimeState {
    volatile MDBState phase;
    bool justReset;
    bool pendingSession;
    bool vendApproved;
    bool vendDecisionSent;
    bool endSessionPending;
    uint16_t vendAmount;
    String sessionUID;
    uint16_t sessionItemId;
    uint16_t sessionAmount;
    bool vendUsed;
    bool sessionIsOffline;
    unsigned long sessionStartMs;

    MdbRuntimeState()
        : phase(INACTIVE),
          justReset(true),
          pendingSession(false),
          vendApproved(false),
          vendDecisionSent(false),
          endSessionPending(false),
          vendAmount(1200),
          sessionUID(""),
          sessionItemId(0),
          sessionAmount(1200),
          vendUsed(false),
          sessionIsOffline(false),
          sessionStartMs(0) {}
};

// ── Objetos globales ──────────────────────────────────
MFRC522     rfid(PIN_RC522_SS, PIN_RC522_RST);
MDB9bit     mdb(PIN_MDB_TX, PIN_MDB_RX);
WebServer   portalServer(80);
DNSServer   dnsServer;
Preferences prefs;
EventLog diagEventLog;
volatile bool watchdogReady = false;

// ── Estado MDB ────────────────────────────────────────
MdbRuntimeState mdbRuntime;
QueueHandle_t mdbAsyncQueue = nullptr;
unsigned long lastNFCRead    = 0;
PricingConfig pricingConfig = pricingDefaultConfig();
uint32_t technicalConfigVersion = 1;
String technicalConfigSource = "backend";
MdbSetupSnapshot mdbSetupSnapshot{};
MdbGatewaySnapshot mdbGatewaySnapshot{};
MdbGatewayRuntimeState mdbGatewayRuntime;

// ── WiFi / backend ────────────────────────────────────
String wifiSSID    = "Tiziana";
String wifiPass    = "Mateo123";
String backendBase = BACKEND_URL;
String macAddress  = "";
String backendLastError = "";
bool   portalMode    = false;
bool   wifiReady     = false;
bool   backendReady  = false;   // true si /health respondio OK
unsigned long lastCommandPollMs = 0;
bool remoteCommandPollRequested = false;
unsigned long statusLedSuppressUntilMs = 0;
bool   mdbMachineTimeValid = false;
uint32_t mdbMachineTimeEpoch = 0;
uint32_t mdbMachineTimeCapturedAtMs = 0;
volatile bool mdbTimeDateProbePending = false;
uint32_t mdbTimeDateProbeRequestedAtMs = 0;

// ── Offline: cache de tarjetas ────────────────────────
CardEntry cards[MAX_CARDS];
int       cardCount  = 0;
bool      cardsDirty = false;
char      savedDate[11] = "";   // "YYYY-MM-DD" para detectar cambio de día
uint32_t  nextResetTs = 0;      // Unix timestamp UTC del próximo reset de contadores

// ── Offline: cola de eventos ──────────────────────────
QueueEntry queueBuf[MAX_QUEUE];
int        queueLen = 0;

String jsonEscape(const String& value);
String buildMdbGatewayJson();

bool urlUsesTls(const String& url) {
    return url.startsWith("https://");
}

bool beginHttpRequest(HTTPClient& http,
                      WiFiClient& plainClient,
                      WiFiClientSecure& secureClient,
                      const String& url) {
    if (urlUsesTls(url)) {
        secureClient.setInsecure();
        return http.begin(secureClient, url);
    }
    return http.begin(plainClient, url);
}

void logDiagEvent(uint16_t code, int16_t arg1 = 0, uint32_t arg2 = 0) {
    diagEventLog.push(code, arg1, arg2, millis());
}

void resetMdbSetupSnapshot() {
    memset(&mdbSetupSnapshot, 0, sizeof(mdbSetupSnapshot));
}

void resetMdbGatewaySnapshot() {
    memset(&mdbGatewaySnapshot, 0, sizeof(mdbGatewaySnapshot));
}

uint8_t bcdToDec(uint8_t value) {
    return (uint8_t)(((value >> 4) & 0x0F) * 10 + (value & 0x0F));
}

bool mdbSnapshotHasTimeDate() {
    return (mdbSetupSnapshot.seenMask & 0x08) != 0;
}

time_t buildTimeUtc(int year, int month, int day, int hour, int minute, int second) {
    struct tm tmValue{};
    tmValue.tm_year = year - 1900;
    tmValue.tm_mon = month - 1;
    tmValue.tm_mday = day;
    tmValue.tm_hour = hour;
    tmValue.tm_min = minute;
    tmValue.tm_sec = second;
    tmValue.tm_isdst = 0;
    return mktime(&tmValue);
}

bool buildDateIsoFromEpoch(uint32_t ts, char* out, size_t outSize) {
    if (!out || outSize == 0) return false;
    time_t raw = (time_t)ts;
    struct tm timeinfo{};
    if (!gmtime_r(&raw, &timeinfo)) return false;
    snprintf(out, outSize, "%04d-%02d-%02d",
             1900 + timeinfo.tm_year,
             timeinfo.tm_mon + 1,
             timeinfo.tm_mday);
    return true;
}

bool getMdbMachineTimeTs(uint32_t* outTs) {
    if (!mdbMachineTimeValid || mdbMachineTimeEpoch == 0) return false;

    uint32_t elapsedSec = (uint32_t)((millis() - mdbMachineTimeCapturedAtMs) / 1000UL);
    if (outTs) {
        *outTs = mdbMachineTimeEpoch + elapsedSec;
    }
    return true;
}

void applyMdbMachineClockIfAvailable() {
    if (!mdbSnapshotHasTimeDate()) return;

    const uint8_t year = mdbSetupSnapshot.timeDateYear;
    const uint8_t month = mdbSetupSnapshot.timeDateMonth;
    const uint8_t day = mdbSetupSnapshot.timeDateDay;
    const uint8_t hour = mdbSetupSnapshot.timeDateHour;
    const uint8_t minute = mdbSetupSnapshot.timeDateMinute;
    const uint8_t second = mdbSetupSnapshot.timeDateSecond;

    if (month == 0 || month > 12 || day == 0 || day > 31 || hour > 23 || minute > 59 || second > 59) {
        return;
    }

    time_t machineTs = buildTimeUtc(2000 + year, month, day, hour, minute, second);
    if (machineTs <= 0) return;
    mdbMachineTimeEpoch = (uint32_t)machineTs;
    mdbMachineTimeCapturedAtMs = millis();
    mdbMachineTimeValid = true;

    char iso[24];
    snprintf(iso, sizeof(iso), "20%02u-%02u-%02u %02u:%02u:%02u",
             (unsigned)year,
             (unsigned)month,
             (unsigned)day,
             (unsigned)hour,
             (unsigned)minute,
             (unsigned)second);
    Serial.printf("[MDB] Hora de maquina capturada: %s\n", iso);
}

String buildMdbTimeDateIso() {
    if (!mdbSnapshotHasTimeDate()) return "";

    const uint8_t year = mdbSetupSnapshot.timeDateYear;
    const uint8_t month = mdbSetupSnapshot.timeDateMonth;
    const uint8_t day = mdbSetupSnapshot.timeDateDay;
    const uint8_t hour = mdbSetupSnapshot.timeDateHour;
    const uint8_t minute = mdbSetupSnapshot.timeDateMinute;
    const uint8_t second = mdbSetupSnapshot.timeDateSecond;

    if (month == 0 || month > 12 || day == 0 || day > 31 || hour > 23 || minute > 59 || second > 59) {
        return "";
    }

    char iso[24];
    snprintf(iso, sizeof(iso), "20%02u-%02u-%02u %02u:%02u:%02u",
             (unsigned)year,
             (unsigned)month,
             (unsigned)day,
             (unsigned)hour,
             (unsigned)minute,
             (unsigned)second);
    return String(iso);
}

bool getGatewayCurrentTime(struct tm* out, const char** sourceLabel = nullptr) {
    if (!out) return false;
    memset(out, 0, sizeof(*out));

    if (getLocalTime(out)) {
        if (sourceLabel) *sourceLabel = "ntp";
        return true;
    }

    uint32_t mdbTs = 0;
    if (getMdbMachineTimeTs(&mdbTs)) {
        time_t raw = (time_t)mdbTs;
        if (gmtime_r(&raw, out)) {
            if (sourceLabel) *sourceLabel = "mdb";
            return true;
        }
    }

    return false;
}

uint8_t gatewayFeatureLevelForVmc() {
    const uint8_t supportedLevel = 0x03;
    if (mdbGatewayRuntime.vmcFeatureLevel == 0) return supportedLevel;
    return (uint8_t)min((int)mdbGatewayRuntime.vmcFeatureLevel, (int)supportedLevel);
}

uint32_t gatewaySupportedFeatures() {
    return MDB_GW_FEATURE_TIME_DATE;
}

String buildGatewayTimeDateIso() {
    if ((mdbGatewaySnapshot.seenMask & 0x10) == 0) return "";

    char iso[24];
    snprintf(iso, sizeof(iso), "20%02u-%02u-%02u %02u:%02u:%02u",
             (unsigned)mdbGatewaySnapshot.timeDateYear,
             (unsigned)mdbGatewaySnapshot.timeDateMonth,
             (unsigned)mdbGatewaySnapshot.timeDateDay,
             (unsigned)mdbGatewaySnapshot.timeDateHour,
             (unsigned)mdbGatewaySnapshot.timeDateMinute,
             (unsigned)mdbGatewaySnapshot.timeDateSecond);
    return String(iso);
}

void captureMdbGatewayCommand(uint8_t cmd, uint8_t* d, uint8_t len) {
    mdbGatewaySnapshot.lastCmd = cmd;
    mdbGatewaySnapshot.lastLen = len;
    mdbGatewaySnapshot.lastSeenMs = millis();
    memset(mdbGatewaySnapshot.raw, 0, sizeof(mdbGatewaySnapshot.raw));
    if (d && len > 0) {
        memcpy(mdbGatewaySnapshot.raw, d, len > sizeof(mdbGatewaySnapshot.raw) ? sizeof(mdbGatewaySnapshot.raw) : len);
    }

    switch (cmd) {
        case MDB_CMD_SETUP:
            mdbGatewaySnapshot.seenMask |= 0x01;
            if (len >= 1) mdbGatewaySnapshot.vmcFeatureLevel = d[0];
            if (len >= 2) mdbGatewaySnapshot.vmcScaleFactor = d[1];
            if (len >= 3) mdbGatewaySnapshot.vmcDecimalPlaces = d[2];
            logDiagEvent(EVT_MDB_GATEWAY_SETUP,
                         len >= 1 ? d[0] : 0,
                         ((uint32_t)(len >= 2 ? d[1] : 0) << 8) | (uint32_t)(len >= 3 ? d[2] : 0));
            break;
        case MDB_CMD_VEND:
            mdbGatewaySnapshot.seenMask |= 0x20;
            logDiagEvent(EVT_MDB_GATEWAY_REPORT, len >= 1 ? d[0] : 0, len);
            break;
        case MDB_CMD_READER:
            mdbGatewaySnapshot.seenMask |= 0x02;
            mdbGatewaySnapshot.controlState = len >= 1 ? d[0] : mdbGatewaySnapshot.controlState;
            mdbGatewaySnapshot.lastControlMs = millis();
            logDiagEvent(EVT_MDB_GATEWAY_CONTROL, len >= 1 ? d[0] : 0, len);
            break;
        case MDB_CMD_EXPANSION:
            if (len >= 1 && d[0] == MDB_GW_EXP_IDENTIFICATION) {
                mdbGatewaySnapshot.seenMask |= 0x04;
                logDiagEvent(EVT_MDB_GATEWAY_IDENTIFICATION, len, 0);
            } else if (len >= 5 && d[0] == MDB_GW_EXP_FEATURE_ENABLE) {
                mdbGatewaySnapshot.seenMask |= 0x08;
                mdbGatewaySnapshot.enabledFeatures =
                    ((uint32_t)d[1] << 24) | ((uint32_t)d[2] << 16) | ((uint32_t)d[3] << 8) | (uint32_t)d[4];
                logDiagEvent(EVT_MDB_GATEWAY_FEATURE_ENABLE, len, mdbGatewaySnapshot.enabledFeatures);
            } else if (len >= 1 && d[0] == MDB_GW_EXP_TIME_DATE_REQUEST) {
                mdbGatewaySnapshot.seenMask |= 0x10;
                logDiagEvent(EVT_MDB_GATEWAY_TIME_DATE_REQUEST, len, 0);
            }
            break;
        default:
            break;
    }
}

void captureMdbSetup(uint8_t* d, uint8_t len) {
    if (!d || len == 0) return;

    mdbSetupSnapshot.lastSubcmd = d[0];
    mdbSetupSnapshot.lastLen = len;
    mdbSetupSnapshot.lastSeenMs = millis();
    memset(mdbSetupSnapshot.raw, 0, sizeof(mdbSetupSnapshot.raw));
    memcpy(mdbSetupSnapshot.raw, d, len > sizeof(mdbSetupSnapshot.raw) ? sizeof(mdbSetupSnapshot.raw) : len);

    if (d[0] == SETUP_CONFIG) {
        mdbSetupSnapshot.seenMask |= 0x01;
        if (len >= 5) {
            mdbSetupSnapshot.vmcLevel = d[1];
            mdbSetupSnapshot.displayColumns = d[2];
            mdbSetupSnapshot.displayRows = d[3];
            mdbSetupSnapshot.displayInfo = d[4];
        }
        logDiagEvent(
            EVT_MDB_SETUP_CONFIG,
            len >= 2 ? d[1] : 0,
            ((uint32_t)(len >= 3 ? d[2] : 0) << 16)
                | ((uint32_t)(len >= 4 ? d[3] : 0) << 8)
                | (uint32_t)(len >= 5 ? d[4] : 0)
        );
        return;
    }

    if (d[0] == SETUP_PRICES) {
        mdbSetupSnapshot.seenMask |= 0x02;
        if (len >= 5) {
            mdbSetupSnapshot.maxPrice = ((uint16_t)d[1] << 8) | d[2];
            mdbSetupSnapshot.minPrice = ((uint16_t)d[3] << 8) | d[4];
        }
        logDiagEvent(
            EVT_MDB_SETUP_PRICES,
            len >= 5 ? (int16_t)mdbSetupSnapshot.minPrice : 0,
            len >= 3 ? mdbSetupSnapshot.maxPrice : 0
        );
    }
}

void captureMdbExpansion(uint8_t* d, uint8_t len) {
    if (!d || len == 0) return;

    mdbSetupSnapshot.lastExpansionSubcmd = d[0];
    mdbSetupSnapshot.lastExpansionLen = len;
    mdbSetupSnapshot.lastExpansionSeenMs = millis();
    memset(mdbSetupSnapshot.expansionRaw, 0, sizeof(mdbSetupSnapshot.expansionRaw));
    memcpy(mdbSetupSnapshot.expansionRaw, d, len > sizeof(mdbSetupSnapshot.expansionRaw) ? sizeof(mdbSetupSnapshot.expansionRaw) : len);

    if (d[0] == EXPANSION_REQUEST_ID) {
        mdbSetupSnapshot.seenMask |= 0x04;
        logDiagEvent(EVT_MDB_EXPANSION_REQUEST_ID, len, 0);
        return;
    }

    if (d[0] == EXPANSION_WRITE_TIME_DATE && len >= 11) {
        mdbSetupSnapshot.seenMask |= 0x08;
        mdbSetupSnapshot.timeDateYear = bcdToDec(d[1]);
        mdbSetupSnapshot.timeDateMonth = bcdToDec(d[2]);
        mdbSetupSnapshot.timeDateDay = bcdToDec(d[3]);
        mdbSetupSnapshot.timeDateHour = bcdToDec(d[4]);
        mdbSetupSnapshot.timeDateMinute = bcdToDec(d[5]);
        mdbSetupSnapshot.timeDateSecond = bcdToDec(d[6]);
        mdbSetupSnapshot.timeDateDayOfWeek = bcdToDec(d[7]);
        mdbSetupSnapshot.timeDateWeekNumber = bcdToDec(d[8]);
        logDiagEvent(
            EVT_MDB_TIME_DATE_FILE,
            (int16_t)((mdbSetupSnapshot.timeDateHour << 8) | mdbSetupSnapshot.timeDateMinute),
            ((uint32_t)mdbSetupSnapshot.timeDateYear << 24)
                | ((uint32_t)mdbSetupSnapshot.timeDateMonth << 16)
                | ((uint32_t)mdbSetupSnapshot.timeDateDay << 8)
                | (uint32_t)mdbSetupSnapshot.timeDateSecond
        );
        applyMdbMachineClockIfAvailable();
    }
}

String buildMdbSetupJson() {
    String json = "{\"seen_config\":";
    json += (mdbSetupSnapshot.seenMask & 0x01) ? "true" : "false";
    json += ",\"seen_prices\":";
    json += (mdbSetupSnapshot.seenMask & 0x02) ? "true" : "false";
    json += ",\"seen_request_id\":";
    json += (mdbSetupSnapshot.seenMask & 0x04) ? "true" : "false";
    json += ",\"seen_time_date\":";
    json += (mdbSetupSnapshot.seenMask & 0x08) ? "true" : "false";
    json += ",\"last_subcmd\":";
    json += mdbSetupSnapshot.lastSubcmd;
    json += ",\"last_len\":";
    json += mdbSetupSnapshot.lastLen;
    json += ",\"vmc_level\":";
    json += mdbSetupSnapshot.vmcLevel;
    json += ",\"display_columns\":";
    json += mdbSetupSnapshot.displayColumns;
    json += ",\"display_rows\":";
    json += mdbSetupSnapshot.displayRows;
    json += ",\"display_info\":";
    json += mdbSetupSnapshot.displayInfo;
    json += ",\"max_price\":";
    json += mdbSetupSnapshot.maxPrice;
    json += ",\"min_price\":";
    json += mdbSetupSnapshot.minPrice;
    json += ",\"last_seen_ms\":";
    json += mdbSetupSnapshot.lastSeenMs;
    json += ",\"last_expansion_subcmd\":";
    json += mdbSetupSnapshot.lastExpansionSubcmd;
    json += ",\"last_expansion_len\":";
    json += mdbSetupSnapshot.lastExpansionLen;
    json += ",\"last_expansion_seen_ms\":";
    json += mdbSetupSnapshot.lastExpansionSeenMs;
    json += ",\"time_date\":{";
    json += "\"valid\":";
    json += mdbSnapshotHasTimeDate() ? "true" : "false";
    json += ",\"iso\":\"";
    json += jsonEscape(buildMdbTimeDateIso());
    json += "\",\"year\":";
    json += mdbSetupSnapshot.timeDateYear;
    json += ",\"month\":";
    json += mdbSetupSnapshot.timeDateMonth;
    json += ",\"day\":";
    json += mdbSetupSnapshot.timeDateDay;
    json += ",\"hour\":";
    json += mdbSetupSnapshot.timeDateHour;
    json += ",\"minute\":";
    json += mdbSetupSnapshot.timeDateMinute;
    json += ",\"second\":";
    json += mdbSetupSnapshot.timeDateSecond;
    json += ",\"day_of_week\":";
    json += mdbSetupSnapshot.timeDateDayOfWeek;
    json += ",\"week_number\":";
    json += mdbSetupSnapshot.timeDateWeekNumber;
    json += "}";
    json += ",\"time_date_probe_pending\":";
    json += mdbTimeDateProbePending ? "true" : "false";
    json += ",\"time_date_probe_requested_at_ms\":";
    json += mdbTimeDateProbeRequestedAtMs;
    json += ",\"raw\":[";
    for (uint8_t i = 0; i < sizeof(mdbSetupSnapshot.raw); i++) {
        if (i > 0) json += ",";
        json += mdbSetupSnapshot.raw[i];
    }
    json += "],\"expansion_raw\":[";
    for (uint8_t i = 0; i < sizeof(mdbSetupSnapshot.expansionRaw); i++) {
        if (i > 0) json += ",";
        json += mdbSetupSnapshot.expansionRaw[i];
    }
    json += "],\"gateway\":";
    json += buildMdbGatewayJson();
    json += "}";
    return json;
}

String buildMdbGatewayJson() {
    String json = "{\"seen_setup\":";
    json += (mdbGatewaySnapshot.seenMask & 0x01) ? "true" : "false";
    json += ",\"seen_control\":";
    json += (mdbGatewaySnapshot.seenMask & 0x02) ? "true" : "false";
    json += ",\"seen_identification\":";
    json += (mdbGatewaySnapshot.seenMask & 0x04) ? "true" : "false";
    json += ",\"seen_feature_enable\":";
    json += (mdbGatewaySnapshot.seenMask & 0x08) ? "true" : "false";
    json += ",\"seen_time_date_request\":";
    json += (mdbGatewaySnapshot.seenMask & 0x10) ? "true" : "false";
    json += ",\"seen_report\":";
    json += (mdbGatewaySnapshot.seenMask & 0x20) ? "true" : "false";
    json += ",\"last_cmd\":";
    json += mdbGatewaySnapshot.lastCmd;
    json += ",\"last_len\":";
    json += mdbGatewaySnapshot.lastLen;
    json += ",\"last_seen_ms\":";
    json += mdbGatewaySnapshot.lastSeenMs;
    json += ",\"vmc_feature_level\":";
    json += mdbGatewaySnapshot.vmcFeatureLevel;
    json += ",\"vmc_scale_factor\":";
    json += mdbGatewaySnapshot.vmcScaleFactor;
    json += ",\"vmc_decimal_places\":";
    json += mdbGatewaySnapshot.vmcDecimalPlaces;
    json += ",\"gateway_feature_level\":";
    json += mdbGatewaySnapshot.gatewayFeatureLevel;
    json += ",\"gateway_enabled\":";
    json += mdbGatewayRuntime.enabled ? "true" : "false";
    json += ",\"control_state\":";
    json += mdbGatewaySnapshot.controlState;
    json += ",\"app_max_response_seconds\":";
    json += mdbGatewaySnapshot.appMaxResponseSeconds;
    json += ",\"enabled_features\":";
    json += mdbGatewaySnapshot.enabledFeatures;
    json += ",\"time_date\":{";
    json += "\"valid\":";
    json += (mdbGatewaySnapshot.seenMask & 0x10) ? "true" : "false";
    json += ",\"iso\":\"";
    json += jsonEscape(buildGatewayTimeDateIso());
    json += "\",\"year\":";
    json += mdbGatewaySnapshot.timeDateYear;
    json += ",\"month\":";
    json += mdbGatewaySnapshot.timeDateMonth;
    json += ",\"day\":";
    json += mdbGatewaySnapshot.timeDateDay;
    json += ",\"hour\":";
    json += mdbGatewaySnapshot.timeDateHour;
    json += ",\"minute\":";
    json += mdbGatewaySnapshot.timeDateMinute;
    json += ",\"second\":";
    json += mdbGatewaySnapshot.timeDateSecond;
    json += "}";
    json += ",\"last_control_ms\":";
    json += mdbGatewaySnapshot.lastControlMs;
    json += ",\"last_time_date_response_ms\":";
    json += mdbGatewaySnapshot.lastTimeDateResponseMs;
    json += ",\"raw\":[";
    for (uint8_t i = 0; i < sizeof(mdbGatewaySnapshot.raw); i++) {
        if (i > 0) json += ",";
        json += mdbGatewaySnapshot.raw[i];
    }
    json += "]}";
    return json;
}

String buildDiagnosticsSnapshotJson(uint8_t eventLimit = 20) {
    if (eventLimit == 0) eventLimit = 20;
    if (eventLimit > 32) eventLimit = 32;

    String json = "{\"message\":\"Diagnostico generado desde la maquina\",";
    json += "\"captured_at_ms\":";
    json += millis();
    json += ",\"wifi_connected\":";
    json += (WiFi.status() == WL_CONNECTED) ? "true" : "false";
    json += ",\"backend_ready\":";
    json += backendReady ? "true" : "false";
    json += ",\"queue_pending\":";
    json += queueLen;
    json += ",\"mdb_time_date_probe_pending\":";
    json += mdbTimeDateProbePending ? "true" : "false";
    json += ",\"mdb_time_date_probe_requested_at_ms\":";
    json += mdbTimeDateProbeRequestedAtMs;
    json += ",\"clock_source\":\"";
    struct tm timeinfo;
    if (getLocalTime(&timeinfo)) json += "ntp";
    else if (mdbMachineTimeValid) json += "mdb";
    else json += "uptime";
    json += "\"";
    json += ",\"firmware_version\":\"";
    json += jsonEscape(FIRMWARE_VERSION);
    json += "\"";
    json += ",\"price_cents\":";
    json += pricingSanitizeHumanPrice(pricingConfig.priceCents);
    json += ",\"pricing_profile\":\"";
    json += pricingProfileCode(pricingConfig.profile);
    json += "\",\"config_version\":";
    json += technicalConfigVersion;
    json += ",\"config_source\":\"";
    json += jsonEscape(technicalConfigSource);
    json += "\",\"mdb_feature_level\":";
    json += pricingConfig.featureLevel;
    json += ",\"mdb_country_code\":";
    json += pricingConfig.countryCode;
    json += ",\"mdb_scale_factor\":";
    json += pricingConfig.scaleFactor;
    json += ",\"mdb_decimal_places\":";
    json += pricingConfig.decimalPlaces;
    json += ",\"mdb_max_response_time\":";
    json += pricingConfig.maxResponseTime;
    json += ",\"mdb_misc_options\":";
    json += pricingConfig.miscOptions;
    json += ",\"events\":";
    json += eventLogBuildJson(diagEventLog, eventLimit);
    json += ",\"mdb\":";
    json += buildMdbSetupJson();
    json += ",\"gateway\":";
    json += buildMdbGatewayJson();
    json += "}";
    return json;
}

const char* resetReasonLabel(esp_reset_reason_t reason) {
    switch (reason) {
        case ESP_RST_POWERON: return "POWERON";
        case ESP_RST_EXT: return "EXT";
        case ESP_RST_SW: return "SW";
        case ESP_RST_PANIC: return "PANIC";
        case ESP_RST_INT_WDT: return "INT_WDT";
        case ESP_RST_TASK_WDT: return "TASK_WDT";
        case ESP_RST_WDT: return "WDT";
        case ESP_RST_DEEPSLEEP: return "DEEPSLEEP";
        case ESP_RST_BROWNOUT: return "BROWNOUT";
        case ESP_RST_SDIO: return "SDIO";
        case ESP_RST_UNKNOWN:
        default: return "UNKNOWN";
    }
}

void feedWatchdog() {
    if (!watchdogReady) return;
    esp_task_wdt_reset();
}

void initWatchdog() {
    esp_err_t initErr = esp_task_wdt_init(WATCHDOG_TIMEOUT_SEC, true);
    if (initErr != ESP_OK) {
        Serial.printf("[WDT] Init fallo: %d\n", (int)initErr);
        return;
    }
    esp_err_t addErr = esp_task_wdt_add(NULL);
    if (addErr != ESP_OK && addErr != ESP_ERR_INVALID_ARG) {
        Serial.printf("[WDT] No se pudo registrar loopTask: %d\n", (int)addErr);
        return;
    }
    watchdogReady = true;
    Serial.printf("[WDT] Activo — timeout=%ds\n", WATCHDOG_TIMEOUT_SEC);
}


// ══════════════════════════════════════════════════════
//  HELPERS LED (activo HIGH)
// ══════════════════════════════════════════════════════
bool statusLedState = false;

void ledWrite(bool on) {
    statusLedState = on;
    digitalWrite(PIN_LED, on ? HIGH : LOW);
}

void ledDelayWithWatchdog(unsigned long ms) {
    unsigned long startedAt = millis();
    while ((millis() - startedAt) < ms) {
        feedWatchdog();
        delay(10);
    }
}

void ledPulse(unsigned long onMs, unsigned long offMs = 0) {
    ledWrite(true);
    ledDelayWithWatchdog(onMs);
    ledWrite(false);
    if (offMs > 0) {
        ledDelayWithWatchdog(offMs);
    }
}

void suppressStatusLed(unsigned long ms) {
    unsigned long until = millis() + ms;
    if ((long)(until - statusLedSuppressUntilMs) > 0) {
        statusLedSuppressUntilMs = until;
    }
}

void ledBlink(int n, int ms) {
    for (int i = 0; i < n; i++) {
        ledPulse(ms, ms);
    }
}
void ledToggle() { ledWrite(!statusLedState); }

void ledTagApprovedPattern() {
    ledPulse(850, 0);
    suppressStatusLed(1500);
}

void ledTagRejectedPattern() {
    for (int i = 0; i < 4; ++i) {
        ledPulse(120, (i < 3) ? 120 : 0);
    }
    suppressStatusLed(1500);
}

void updateStatusLed() {
    bool ready = !portalMode && wifiReady && backendReady && (WiFi.status() == WL_CONNECTED);
    if (!ready || (long)(statusLedSuppressUntilMs - millis()) > 0) {
        ledWrite(false);
        return;
    }

    // "Late" corto cada 1 segundo para indicar que el equipo sigue vivo.
    ledWrite((millis() % 1000UL) < 60UL);
}

void bootFeedbackPinsInit() {
    pinMode(PIN_LED_ONBOARD, OUTPUT);
    digitalWrite(PIN_LED_ONBOARD, HIGH);
}

void bootFeedbackOff() { digitalWrite(PIN_LED_ONBOARD, HIGH); }
void bootFeedbackOn()  { digitalWrite(PIN_LED_ONBOARD, LOW);  }

void bootFeedbackBlink(int n, int onMs, int offMs) {
    for (int i = 0; i < n; i++) {
        bootFeedbackOn(); delay(onMs);
        bootFeedbackOff(); delay(offMs);
    }
}

String normalizeBackendUrl(String url) {
    url.trim();
    if (url.startsWith("Http://") || url.startsWith("HTTP://")) {
        return "http://" + url.substring(7);
    }
    if (url.startsWith("Https://") || url.startsWith("HTTPS://")) {
        return "https://" + url.substring(8);
    }
    return url;
}

bool hasHttpScheme(const String& url) {
    return url.startsWith("http://") || url.startsWith("https://")
        || url.startsWith("Http://") || url.startsWith("HTTP://")
        || url.startsWith("Https://") || url.startsWith("HTTPS://");
}

void handleMDB();

void startPortal();
void saveConfig(const String& ssid, const String& pass, const String& url, const PricingConfig& pricing, uint32_t configVersion, const String& configSource);
void notifyVendResult(const String& uid, uint16_t itemId, uint16_t amount, bool ok);
uint16_t currentConfiguredHumanPrice();

bool parseUnsignedLongStrict(const String& raw, uint32_t& out) {
    String value = raw;
    value.trim();
    if (value.length() == 0) return false;

    uint32_t parsed = 0;
    for (size_t i = 0; i < value.length(); i++) {
        char c = value[i];
        if (c < '0' || c > '9') return false;

        uint32_t digit = (uint32_t)(c - '0');
        if (parsed > (UINT32_MAX - digit) / 10) return false;
        parsed = (parsed * 10) + digit;
    }

    out = parsed;
    return true;
}

uint16_t currentConfiguredHumanPrice() {
    return pricingDefaultVendAmount(pricingConfig);
}

uint16_t currentConfiguredSessionFunds() {
    return pricingBeginSessionFunds(pricingConfig);
}

bool enqueueMdbStartSession(const String& uid, bool isOffline) {
    if (mdbAsyncQueue == nullptr) return false;

    MdbAsyncEvent event{};
    event.type = MDB_EVENT_START_SESSION;
    event.sessionIsOffline = isOffline ? 1 : 0;
    event.requestedAtMs = millis();
    snprintf(event.uid, sizeof(event.uid), "%s", uid.c_str());

    return xQueueSend(mdbAsyncQueue, &event, 0) == pdPASS;
}

void startMdbSessionFromEvent(const MdbAsyncEvent& event) {
    if (mdbRuntime.pendingSession || mdbRuntime.phase == SESSION_IDLE || mdbRuntime.phase == VEND_PENDING) {
        MDB_LOG_EVENT("[MDB] Evento NFC descartado por sesion activa: %s\n", event.uid);
        return;
    }

    mdbRuntime.sessionUID = event.uid;
    mdbRuntime.sessionIsOffline = event.sessionIsOffline != 0;
    mdbRuntime.pendingSession = true;
    mdbRuntime.phase = SESSION_IDLE;
    mdbRuntime.sessionStartMs = event.requestedAtMs > 0 ? event.requestedAtMs : millis();
    mdbRuntime.sessionItemId = 0;
    mdbRuntime.sessionAmount = currentConfiguredHumanPrice();
    mdbRuntime.vendAmount = currentConfiguredHumanPrice();
    mdbRuntime.vendApproved = false;
    mdbRuntime.vendUsed = false;
    mdbRuntime.vendDecisionSent = false;
    mdbRuntime.endSessionPending = false;
}

void processMdbAsyncQueue() {
    if (mdbAsyncQueue == nullptr) return;

    MdbAsyncEvent event{};
    if (xQueueReceive(mdbAsyncQueue, &event, 0) != pdPASS) return;

    switch (event.type) {
        case MDB_EVENT_START_SESSION:
            startMdbSessionFromEvent(event);
            break;
        default:
            MDB_LOG_EVENT("[MDB] Evento async desconocido: %u\n", (unsigned)event.type);
            break;
    }
}

void processMdbSessionTimeout() {
    if (!mdbRuntime.pendingSession) return;

    unsigned long elapsed = millis() - mdbRuntime.sessionStartMs;
    if (elapsed <= SESSION_TIMEOUT_MS) return;

    Serial.printf("[TMO] Timeout SESSION_IDLE — cancelando tap de %s\n",
                  mdbRuntime.sessionUID.c_str());
    logDiagEvent(EVT_SESSION_TIMEOUT, mdbRuntime.phase, elapsed);

    String cancelUid = mdbRuntime.sessionUID;
    bool wasOffline = mdbRuntime.sessionIsOffline;

    mdbRuntime.sessionUID = "";
    mdbRuntime.pendingSession = false;
    mdbRuntime.phase = MDB_DISABLED;
    mdbRuntime.vendApproved = false;
    mdbRuntime.vendUsed = false;
    mdbRuntime.vendDecisionSent = false;
    mdbRuntime.endSessionPending = false;
    mdbRuntime.sessionItemId = 0;
    mdbRuntime.sessionAmount = currentConfiguredHumanPrice();
    mdbRuntime.vendAmount = currentConfiguredHumanPrice();
    mdbRuntime.sessionStartMs = 0;
    mdbRuntime.sessionIsOffline = false;

    mdbRuntime.sessionIsOffline = wasOffline;
    notifyVendResult(cancelUid, 0, 0, false);
    mdbRuntime.sessionIsOffline = false;

    ledBlink(4, 150);
}

bool applyPricingConfig(const PricingConfig& nextConfigRaw, bool persistToNvs, const char* sourceLabel, uint32_t nextVersion = 0, const String& nextSource = String()) {
    PricingConfig nextConfig = nextConfigRaw;
    pricingNormalizeConfig(nextConfig);
    uint32_t normalizedVersion = nextVersion > 0 ? nextVersion : technicalConfigVersion;
    if (normalizedVersion == 0) normalizedVersion = 1;
    String normalizedSource = nextSource;
    normalizedSource.trim();
    normalizedSource.toLowerCase();
    if (normalizedSource.length() == 0) normalizedSource = technicalConfigSource;
    if (normalizedSource.length() == 0) normalizedSource = "backend";

    bool configChanged = !pricingEquals(nextConfig, pricingConfig);
    bool metaChanged = normalizedVersion != technicalConfigVersion || normalizedSource != technicalConfigSource;
    if (!configChanged && !metaChanged) return false;

    pricingConfig = nextConfig;
    technicalConfigVersion = normalizedVersion;
    technicalConfigSource = normalizedSource;

    if (persistToNvs) {
        saveConfig(wifiSSID, wifiPass, backendBase, pricingConfig, technicalConfigVersion, technicalConfigSource);
    }

    Serial.printf("[CFG] Config tecnica sincronizada desde %s: precio=%u perfil=%s feature=%u country=0x%04X scale=%u decimals=%u resp=%u misc=%u version=%lu source=%s\n",
                  sourceLabel ? sourceLabel : "origen_desconocido",
                  (unsigned)pricingConfig.priceCents,
                  pricingProfileCode(pricingConfig.profile),
                  (unsigned)pricingConfig.featureLevel,
                  (unsigned)pricingConfig.countryCode,
                  (unsigned)pricingConfig.scaleFactor,
                  (unsigned)pricingConfig.decimalPlaces,
                  (unsigned)pricingConfig.maxResponseTime,
                  (unsigned)pricingConfig.miscOptions,
                  (unsigned long)technicalConfigVersion,
                  technicalConfigSource.c_str());
    return true;
}

bool applyConfiguredPrice(uint32_t priceCents, bool persistToNvs, const char* sourceLabel) {
    PricingConfig nextConfig = pricingConfig;
    nextConfig.priceCents = pricingSanitizeHumanPrice(priceCents);
    return applyPricingConfig(nextConfig, persistToNvs, sourceLabel);
}

void mdbCommandTask(void*) {
    bool taskRegistered = false;

    for (;;) {
        if (watchdogReady && !taskRegistered) {
            esp_err_t addErr = esp_task_wdt_add(NULL);
            if (addErr == ESP_OK || addErr == ESP_ERR_INVALID_ARG) {
                taskRegistered = true;
            }
        }

        processMdbAsyncQueue();
        handleMDB();
        processMdbSessionTimeout();

        if (taskRegistered) {
            esp_task_wdt_reset();
        }

        vTaskDelay(1);
    }
}

uint8_t parseLimitMode(const String& raw) {
    String mode = raw;
    mode.trim();
    mode.toLowerCase();
    if (mode == "warn_only") return LIMIT_MODE_WARN_ONLY;
    if (mode == "off")       return LIMIT_MODE_OFF;
    return LIMIT_MODE_ENFORCE;
}


// ══════════════════════════════════════════════════════
//  PREFERENCIAS (reemplaza EEPROM, almacén NVS)
// ══════════════════════════════════════════════════════
void readConfig() {
    DeviceConfig config;
    deviceConfigLoad(prefs, config, BACKEND_URL);
    wifiSSID = config.wifiSSID;
    wifiPass = config.wifiPass;
    backendBase = normalizeBackendUrl(config.backendBase);
    pricingConfig = config.pricing;
    technicalConfigVersion = config.configVersion > 0 ? config.configVersion : 1;
    technicalConfigSource = config.configSource.length() > 0 ? config.configSource : "backend";

    Serial.printf("[CFG] SSID guardada:   %s\n", wifiSSID.c_str());
    Serial.printf("[CFG] Backend guardado: %s\n", backendBase.c_str());
    Serial.printf("[CFG] Precio guardado:  %u (perfil=%s, version=%lu, source=%s)\n",
                  (unsigned)pricingConfig.priceCents,
                  pricingProfileCode(pricingConfig.profile),
                  (unsigned long)technicalConfigVersion,
                  technicalConfigSource.c_str());
}

void saveConfig(const String& ssid, const String& pass, const String& url, const PricingConfig& pricing, uint32_t configVersion, const String& configSource) {
    DeviceConfig config;
    deviceConfigSetDefaults(config, BACKEND_URL);
    config.wifiSSID = ssid;
    config.wifiPass = pass;
    String urlNorm = normalizeBackendUrl(url);
    config.backendBase = urlNorm.length() > 0 ? urlNorm : String(BACKEND_URL);
    config.pricing = pricing;
    config.configVersion = configVersion > 0 ? configVersion : 1;
    config.configSource = configSource.length() > 0 ? configSource : String("backend");
    pricingNormalizeConfig(config.pricing);

    deviceConfigSave(prefs, config, BACKEND_URL);
    pricingConfig = config.pricing;
    technicalConfigVersion = config.configVersion;
    technicalConfigSource = config.configSource;

    Serial.printf("[CFG] Config guardada — SSID: %s | precio: %u | version=%lu | source=%s\n",
                  ssid.c_str(),
                  (unsigned)pricingConfig.priceCents,
                  (unsigned long)technicalConfigVersion,
                  technicalConfigSource.c_str());
}

void handleResetButtonRuntime() {
    if (portalMode || digitalRead(PIN_BOOT_BTN) != LOW) return;

    delay(25);  // debounce simple
    if (digitalRead(PIN_BOOT_BTN) != LOW) return;

    Serial.println("[PORTAL] BOOT presionado — mantener 5s para abrir el portal sin borrar configuracion");

    unsigned long t = millis();
    unsigned long lastBlinkMs = millis();
    bool slowBlinkState = false;
    bool portalReadyShown = false;

    bootFeedbackOff();

    while (digitalRead(PIN_BOOT_BTN) == LOW) {
        unsigned long now = millis();
        unsigned long heldMs = now - t;

        if (!portalReadyShown && now - lastBlinkMs >= 500) {
            slowBlinkState = !slowBlinkState;
            if (slowBlinkState) bootFeedbackOn();
            else                bootFeedbackOff();
            lastBlinkMs = now;
        }

        if (!portalReadyShown && heldMs >= PORTAL_BUTTON_HOLD_MS) {
            portalReadyShown = true;
            Serial.println("[PORTAL] Umbral listo — soltar ahora para abrir el portal de configuracion");
            bootFeedbackBlink(3, 90, 90);
            bootFeedbackOff();
            slowBlinkState = false;
            lastBlinkMs = millis();
        }

        delay(25);
    }

    bootFeedbackOff();
    unsigned long heldMs = millis() - t;

    if (heldMs >= PORTAL_BUTTON_HOLD_MS) {
        Serial.println("[PORTAL] Activando AP de configuracion sin borrar credenciales guardadas");
        ledBlink(3, 120);
        startPortal();
    } else {
        Serial.println("[PORTAL] Cancelado — soltado antes del umbral");
    }
}


// ══════════════════════════════════════════════════════
//  LITTLEFS — cards.json
// ══════════════════════════════════════════════════════
void loadCards() {
    if (!LittleFS.exists(CARDS_PATH)) {
        Serial.println("[CARDS] Sin cache de tarjetas en flash");
        cardCount = 0;
        return;
    }
    File f = LittleFS.open(CARDS_PATH, "r");
    if (!f) { Serial.println("[CARDS] Error abriendo cards.json"); return; }

    // Parsear directo desde el stream del archivo (sin buffer intermedio)
    DynamicJsonDocument doc(100000);
    DeserializationError err = deserializeJson(doc, f);
    f.close();

    if (err) {
        Serial.printf("[CARDS] Error JSON: %s\n", err.c_str());
        cardCount = 0;
        return;
    }

    strlcpy(savedDate, doc["date"] | "", sizeof(savedDate));
    nextResetTs = (uint32_t)(doc["next_reset_at"] | 0);
    JsonArray arr = doc["cards"];

    cardCount = 0;
    for (JsonObject c : arr) {
        if (cardCount >= MAX_CARDS) break;
        strlcpy(cards[cardCount].uid, c["uid"] | "", sizeof(cards[0].uid));
        cards[cardCount].limit = (uint8_t)(c["limit"] | 0);
        cards[cardCount].mode  = (uint8_t)(c["mode"]  | LIMIT_MODE_ENFORCE);
        cards[cardCount].used  = (uint8_t)(c["used"]  | 0);
        cardCount++;
    }
    Serial.printf("[CARDS] Cache cargado: %d tarjetas (fecha: %s, next_reset_at=%lu)\n",
                  cardCount, savedDate, (unsigned long)nextResetTs);
}

// Guarda cards.json en streaming para no allocar el doc completo
void saveCards() {
    File f = LittleFS.open(CARDS_PATH, "w");
    if (!f) { Serial.println("[CARDS] Error guardando cards.json"); return; }

    f.print("{\"date\":\"");
    f.print(savedDate);
    f.print("\",\"next_reset_at\":");
    f.print((unsigned long)nextResetTs);
    f.print(",\"cards\":[");
    for (int i = 0; i < cardCount; i++) {
        if (i > 0) f.print(",");
        f.printf("{\"uid\":\"%s\",\"limit\":%d,\"mode\":%d,\"used\":%d}",
                 cards[i].uid, cards[i].limit, cards[i].mode, cards[i].used);
    }
    f.print("]}");
    f.close();

    cardsDirty = false;
    Serial.printf("[CARDS] Cache guardado: %d tarjetas\n", cardCount);
}

bool fillDateFromClock(char* out, size_t outSize) {
    struct tm timeinfo;
    if (getLocalTime(&timeinfo)) {
        snprintf(out, outSize, "%04d-%02d-%02d",
                 1900 + timeinfo.tm_year, timeinfo.tm_mon + 1, timeinfo.tm_mday);
        return true;
    }

    uint32_t mdbTs = 0;
    if (getMdbMachineTimeTs(&mdbTs)) {
        return buildDateIsoFromEpoch(mdbTs, out, outSize);
    }

    return false;
}

bool advanceDateByOneDay(const char* currentDate, char* out, size_t outSize) {
    int year = 0;
    int month = 0;
    int day = 0;
    if (sscanf(currentDate, "%d-%d-%d", &year, &month, &day) != 3) return false;
    time_t currentTs = buildTimeUtc(year, month, day, 0, 0, 0);
    if (currentTs <= 0) return false;
    time_t nextTs = currentTs + 86400;
    struct tm next{};
    if (!gmtime_r(&nextTs, &next)) return false;
    snprintf(out, outSize, "%04d-%02d-%02d",
             1900 + next.tm_year,
             next.tm_mon + 1,
             next.tm_mday);
    return true;
}


// ══════════════════════════════════════════════════════
//  LITTLEFS — queue journal (append-only)
// ══════════════════════════════════════════════════════
void loadQueue() {
    bool migratedLegacy = false;
    int loaded = 0;
    offlineQueueEnsureJournal(LittleFS, QUEUE_PATH);
    if (!offlineQueueLoad(LittleFS, QUEUE_PATH, QUEUE_LEGACY_PATH, queueBuf, MAX_QUEUE, loaded, migratedLegacy)) {
        queueLen = 0;
        return;
    }

    queueLen = loaded;
    if (migratedLegacy) {
        Serial.printf("[QUEUE] Cola legacy migrada a journal: %d eventos pendientes\n", queueLen);
    } else {
        Serial.printf("[QUEUE] Cola journal cargada: %d eventos pendientes\n", queueLen);
    }
}

void saveQueue() {
    if (!offlineQueueRewrite(LittleFS, QUEUE_PATH, queueBuf, queueLen)) {
        Serial.println("[QUEUE] ERROR — no se pudo compactar la cola journal");
        logDiagEvent(EVT_QUEUE_PERSIST_FAIL, queueLen, 2);
    }
}


// ══════════════════════════════════════════════════════
//  OFFLINE: autenticación local con cache
// ══════════════════════════════════════════════════════
int localAuth(const String& uid) {
    for (int i = 0; i < cardCount; i++) {
        if (strncmp(cards[i].uid, uid.c_str(), 8) == 0) {
            if (cards[i].mode == LIMIT_MODE_ENFORCE
                && cards[i].limit > 0
                && cards[i].used >= cards[i].limit) {
                return LOCAL_AUTH_OVERLIMIT;
            }
            return LOCAL_AUTH_OK;
        }
    }
    return LOCAL_AUTH_UNKNOWN;
}

void incrementLocalUsed(const String& uid) {
    for (int i = 0; i < cardCount; i++) {
        if (strncmp(cards[i].uid, uid.c_str(), 8) == 0) {
            cards[i].used++;
            cardsDirty = true;
            return;
        }
    }
}

uint32_t getCurrentTs() {
    struct tm timeinfo;
    if (getLocalTime(&timeinfo)) {
        timeinfo.tm_isdst = 0;
        return (uint32_t)mktime(&timeinfo);
    }
    uint32_t mdbTs = 0;
    if (getMdbMachineTimeTs(&mdbTs)) {
        return mdbTs;
    }
    return (uint32_t)(millis() / 1000);  // fallback: uptime
}

void enqueueEvent(const String& uid, uint16_t itemId, uint16_t amount, bool ok) {
    if (queueLen >= MAX_QUEUE) {
        Serial.println("[QUEUE] ADVERTENCIA — cola llena, evento descartado");
        logDiagEvent(EVT_QUEUE_FULL, queueLen, amount);
        return;
    }

    QueueEntry entry{};
    strlcpy(entry.uid, uid.c_str(), sizeof(entry.uid));
    entry.item_id = itemId;
    entry.amount = amount;
    entry.vend_success = ok;
    entry.ts = getCurrentTs();

    if (!offlineQueueAppend(LittleFS, QUEUE_PATH, entry)) {
        queueBuf[queueLen] = entry;
        if (!offlineQueueRewrite(LittleFS, QUEUE_PATH, queueBuf, queueLen + 1)) {
            Serial.println("[QUEUE] ERROR — no se pudo persistir el evento offline");
            logDiagEvent(EVT_QUEUE_PERSIST_FAIL, queueLen, amount);
            return;
        }
    }

    queueBuf[queueLen] = entry;
    queueLen++;

    Serial.printf("[QUEUE] Encolado — uid:%s ok:%d total:%d\n", uid.c_str(), ok, queueLen);
    logDiagEvent(EVT_QUEUE_ENQUEUE, ok ? 1 : 0, queueLen);
}


// ══════════════════════════════════════════════════════
//  OFFLINE: flush de cola al backend
// ══════════════════════════════════════════════════════
void flushQueue() {
    if (queueLen == 0 || WiFi.status() != WL_CONNECTED) return;

    Serial.printf("[QUEUE] Enviando %d eventos al backend...\n", queueLen);

    const int BATCH = 50;
    int sent = 0;

    while (sent < queueLen) {
        int end = min(sent + BATCH, queueLen);
        feedWatchdog();

        // Construir JSON del lote
        String body = "[";
        for (int i = sent; i < end; i++) {
            if (i > sent) body += ",";
            body += "{\"uid\":\"";  body += queueBuf[i].uid;
            body += "\",\"item_id\":"; body += queueBuf[i].item_id;
            body += ",\"amount\":";    body += queueBuf[i].amount;
            body += ",\"ok\":";        body += (queueBuf[i].vend_success ? "true" : "false");
            body += ",\"ts\":";        body += (unsigned long)queueBuf[i].ts;
            body += "}";
        }
        body += "]";

        String url = backendBase + "/api/tap/queue";
        WiFiClient client;
        WiFiClientSecure secureClient;
        HTTPClient http;
        if (!beginHttpRequest(http, client, secureClient, url)) break;

        http.addHeader("Content-Type", "application/json");
        http.addHeader("X-Machine-Mac", macAddress);
        http.setTimeout(HTTP_TIMEOUT_MS * 3);

        int code = http.POST(body);
        http.end();
        feedWatchdog();

        if (code == 200 || code == 204) {
            sent = end;
        } else {
            Serial.printf("[QUEUE] Error HTTP %d — abortando flush\n", code);
            logDiagEvent(EVT_QUEUE_FLUSH_FAIL, code, queueLen);
            break;
        }
    }

    if (sent > 0) {
        int remaining = queueLen - sent;
        for (int i = 0; i < remaining; i++) queueBuf[i] = queueBuf[sent + i];
        queueLen = remaining;
        saveQueue();
        Serial.printf("[QUEUE] Flush OK: %d enviados, %d pendientes\n", sent, remaining);
        logDiagEvent(EVT_QUEUE_FLUSH_OK, sent, remaining);
    }
}


// ══════════════════════════════════════════════════════
//  OFFLINE: descargar cache de tarjetas del backend
// ══════════════════════════════════════════════════════
void downloadCards() {
    if (WiFi.status() != WL_CONNECTED) return;

    String url = backendBase + "/api/tap/cards";
    WiFiClient client;
    WiFiClientSecure secureClient;
    HTTPClient http;
    if (!beginHttpRequest(http, client, secureClient, url)) return;

    http.addHeader("X-Machine-Mac", macAddress);
    http.setTimeout(HTTP_TIMEOUT_MS * 3);

    feedWatchdog();
    int code = http.GET();
    feedWatchdog();
    if (code != 200) {
        Serial.printf("[CARDS] Error descarga HTTP %d\n", code);
        logDiagEvent(EVT_BACKEND_CARDS_FAIL, code, cardCount);
        http.end();
        return;
    }

    // Parsear directo desde el stream (no se almacena el payload completo en String)
    DynamicJsonDocument doc(100000);
    feedWatchdog();          // antes del parse
    DeserializationError err = deserializeJson(doc, http.getStream());
    http.end();
    feedWatchdog();          // después del parse

    if (err) {
        Serial.printf("[CARDS] Error JSON descarga: %s\n", err.c_str());
        logDiagEvent(EVT_BACKEND_CARDS_FAIL, -2, cardCount);
        return;
    }

    JsonArray arr;
    if (doc["cards"].is<JsonArray>()) {
        strlcpy(savedDate, doc["date"] | "", sizeof(savedDate));
        nextResetTs = (uint32_t)(doc["next_reset_at"] | 0);
        arr = doc["cards"].as<JsonArray>();
    } else {
        fillDateFromClock(savedDate, sizeof(savedDate));
        nextResetTs = 0;
        arr = doc.as<JsonArray>();
    }
    cardCount = 0;
    for (JsonObject c : arr) {
        if (cardCount >= MAX_CARDS) break;
        strlcpy(cards[cardCount].uid, c["uid"] | "", sizeof(cards[0].uid));
        cards[cardCount].limit = (uint8_t)(c["daily_limit"] | 0);
        cards[cardCount].mode  = parseLimitMode(String((const char*)(c["daily_limit_mode"] | "enforce")));
        cards[cardCount].used  = (uint8_t)(c["used_today"]  | 0);
        cardCount++;
    }

    saveCards();
    Serial.printf("[CARDS] Descarga OK: %d tarjetas (fecha: %s, next_reset_at=%lu)\n",
                  cardCount, savedDate, (unsigned long)nextResetTs);
    logDiagEvent(EVT_BACKEND_CARDS_OK, cardCount, nextResetTs);
}


// ══════════════════════════════════════════════════════
//  OFFLINE: reset diario de contadores de uso
// ══════════════════════════════════════════════════════
void checkMidnightReset() {
    if (nextResetTs > 0) {
        uint32_t nowTs = getCurrentTs();
        if (nowTs < nextResetTs) return;

        char newDate[11] = "";
        bool advanced = false;
        while (nextResetTs > 0 && nowTs >= nextResetTs) {
            char tmpDate[11] = "";
            if (!advanceDateByOneDay(savedDate, tmpDate, sizeof(tmpDate))) break;
            strlcpy(newDate, tmpDate, sizeof(newDate));
            strlcpy(savedDate, tmpDate, sizeof(savedDate));
            nextResetTs += 86400UL;
            advanced = true;
        }
        if (!advanced) return;

        Serial.printf("[CLOCK] Nuevo dia operativo — reseteando contadores (fecha=%s)\n", savedDate);
        for (int i = 0; i < cardCount; i++) cards[i].used = 0;
        cardsDirty = true;
        return;
    }

    char today[11] = "";
    if (!fillDateFromClock(today, sizeof(today))) return;
    if (strlen(savedDate) == 0 || strcmp(today, savedDate) == 0) return;

    Serial.printf("[CLOCK] Nuevo dia local: %s → %s — reseteando contadores\n", savedDate, today);
    strlcpy(savedDate, today, sizeof(savedDate));
    for (int i = 0; i < cardCount; i++) cards[i].used = 0;
    cardsDirty = true;
}


// ══════════════════════════════════════════════════════
//  PORTAL WIFI CAUTIVO
// ══════════════════════════════════════════════════════
String jsonEscape(const String& value) {
    String out;
    out.reserve(value.length() + 8);
    for (size_t i = 0; i < value.length(); i++) {
        char c = value.charAt(i);
        switch (c) {
            case '\\': out += "\\\\"; break;
            case '\"': out += "\\\""; break;
            case '\n': out += "\\n"; break;
            case '\t': out += "\\t"; break;
            case '\r': break;
            default: out += c; break;
        }
    }
    return out;
}

String htmlEscape(const String& value) {
    String out;
    out.reserve(value.length() + 8);
    for (size_t i = 0; i < value.length(); i++) {
        char c = value.charAt(i);
        switch (c) {
            case '&': out += "&amp;"; break;
            case '<': out += "&lt;"; break;
            case '>': out += "&gt;"; break;
            case '\"': out += "&quot;"; break;
            case '\'': out += "&#39;"; break;
            default: out += c; break;
        }
    }
    return out;
}

String buildPortalReplyJson(bool ok, const String& stage, const String& message, const String& extra = "") {
    String json = "{\"ok\":";
    json += ok ? "true" : "false";
    json += ",\"stage\":\"";
    json += jsonEscape(stage);
    json += "\",\"message\":\"";
    json += jsonEscape(message);
    json += "\"";
    if (extra.length() > 0) {
        json += ",\"extra\":\"";
        json += jsonEscape(extra);
        json += "\"";
    }
    json += "}";
    return json;
}

String testPortalConnection(const String& rawSsid, const String& rawPass, const String& rawUrl) {
    String ssid = rawSsid;
    String pass = rawPass;
    String url = rawUrl;
    ssid.trim();
    url = normalizeBackendUrl(url);

    if (ssid.length() == 0) {
        return buildPortalReplyJson(false, "validation", "El SSID es obligatorio.");
    }

    if (String(DEPLOYMENT_MODE) == "saas" || url.length() == 0) {
        url = String(BACKEND_URL);
    }

    if (!hasHttpScheme(url)) {
        return buildPortalReplyJson(false, "validation", "La URL debe comenzar con http:// o https://.");
    }

    WiFi.disconnect();
    delay(150);
    WiFi.mode(WIFI_AP_STA);
    WiFi.begin(ssid.c_str(), pass.c_str());
    //WiFi.setTxPower(WIFI_POWER_2dBm); 
    //Serial.printf("Set TX power: %d dBm\n", WIFI_POWER_2dBm);

    unsigned long started = millis();
    while (WiFi.status() != WL_CONNECTED && millis() - started < 12000) {
        delay(250);
    }

    if (WiFi.status() != WL_CONNECTED) {
        WiFi.disconnect();
        return buildPortalReplyJson(false, "wifi", "No se pudo conectar a esa red WiFi. Revisá SSID y contraseña.");
    }

    String ip = WiFi.localIP().toString();
    String healthUrl = url + "/health";
    WiFiClient client;
    WiFiClientSecure secureClient;
    HTTPClient http;
    bool backendOk = false;
    int code = -1;

    if (beginHttpRequest(http, client, secureClient, healthUrl)) {
        http.setTimeout(5000);
        code = http.GET();
        backendOk = (code == 200);
        http.end();
    }

    WiFi.disconnect();
    delay(150);

    if (!backendOk) {
        String detail = "WiFi OK (" + ip + "), pero el backend no respondió en /health.";
        if (code > 0) {
            detail += " HTTP ";
            detail += String(code);
            detail += ".";
        }
        return buildPortalReplyJson(false, "backend", detail, url);
    }

    return buildPortalReplyJson(true, "ok", "Conexión exitosa. WiFi y backend accesibles.", ip);
}

String buildWifiScanJson() {
    const int MAX_RESULTS = 20;
    String ssids[MAX_RESULTS];
    int rssis[MAX_RESULTS];
    bool secured[MAX_RESULTS];
    int uniqueCount = 0;

    int count = WiFi.scanNetworks(false, true);
    if (count <= 0) {
        WiFi.scanDelete();
        return "[]";
    }

    for (int i = 0; i < count; i++) {
        String ssid = WiFi.SSID(i);
        if (ssid.length() == 0) {
            continue;
        }

        int existing = -1;
        for (int j = 0; j < uniqueCount; j++) {
            if (ssids[j] == ssid) {
                existing = j;
                break;
            }
        }

        int rssi = WiFi.RSSI(i);
        bool secure = WiFi.encryptionType(i) != WIFI_AUTH_OPEN;

        if (existing >= 0) {
            if (rssi > rssis[existing]) {
                rssis[existing] = rssi;
                secured[existing] = secure;
            }
            continue;
        }

        if (uniqueCount >= MAX_RESULTS) {
            continue;
        }

        ssids[uniqueCount] = ssid;
        rssis[uniqueCount] = rssi;
        secured[uniqueCount] = secure;
        uniqueCount++;
    }

    for (int i = 0; i < uniqueCount - 1; i++) {
        for (int j = i + 1; j < uniqueCount; j++) {
            if (rssis[j] > rssis[i]) {
                String ssidTmp = ssids[i];
                int rssiTmp = rssis[i];
                bool secureTmp = secured[i];
                ssids[i] = ssids[j];
                rssis[i] = rssis[j];
                secured[i] = secured[j];
                ssids[j] = ssidTmp;
                rssis[j] = rssiTmp;
                secured[j] = secureTmp;
            }
        }
    }

    String json = "[";
    for (int i = 0; i < uniqueCount; i++) {
        if (i > 0) {
            json += ",";
        }
        json += "{\"ssid\":\"";
        json += jsonEscape(ssids[i]);
        json += "\",\"rssi\":";
        json += String(rssis[i]);
        json += ",\"secure\":";
        json += secured[i] ? "true" : "false";
        json += "}";
    }
    json += "]";
    WiFi.scanDelete();
    return json;
}

bool servePortalStaticFile(const char* fsPath, const char* contentType, const char* cacheControl = nullptr) {
    if (!LittleFS.exists(fsPath)) return false;

    File file = LittleFS.open(fsPath, "r");
    if (!file) return false;

    if (cacheControl && cacheControl[0] != '\0') {
        portalServer.sendHeader("Cache-Control", cacheControl);
    }
    portalServer.streamFile(file, contentType);
    file.close();
    return true;
}

String buildPortalFallbackHtml() {
    String ssidValue = htmlEscape(wifiSSID);
    String passValue = htmlEscape(wifiPass);
    String urlValue = htmlEscape(backendBase);
    String priceValue = String((unsigned long)pricingSanitizeHumanPrice(pricingConfig.priceCents));

    String html = F(
        "<!DOCTYPE html><html lang='es'><head>"
        "<meta charset='UTF-8'><meta name='viewport' content='width=device-width,initial-scale=1'>"
        "<title>CoffeeControl - Portal de emergencia</title>"
        "<style>"
        ":root{--bg:#f6f8fb;--panel:#fff;--tx:#243241;--tx2:#5d6c79;--br:#d6dfe7;--pri:#185fa5;--warn:#fff4d8;--warnx:#8a5b00;}"
        "*{box-sizing:border-box}body{margin:0;font-family:Arial,sans-serif;background:var(--bg);color:var(--tx);padding:18px;}"
        ".shell{max-width:480px;margin:0 auto}.card{background:var(--panel);border:1px solid var(--br);border-radius:18px;padding:18px;box-shadow:0 18px 40px rgba(17,74,130,.12)}"
        "h1{margin:0 0 8px;font-size:24px}.note{background:var(--warn);color:var(--warnx);border-radius:12px;padding:12px 14px;font-size:13px;line-height:1.45;margin:0 0 16px}"
        "label{display:block;font-size:12px;color:var(--tx2);margin:0 0 6px;font-weight:700;text-transform:uppercase;letter-spacing:.04em}"
        "input{width:100%;padding:12px;border:1px solid var(--br);border-radius:12px;margin:0 0 12px;font-size:14px}"
        ".actions{display:grid;grid-template-columns:1fr;gap:10px;margin-top:8px}button{padding:13px 14px;border:0;border-radius:12px;background:var(--pri);color:#fff;font-size:14px;font-weight:700}"
        ".meta{font-size:12px;color:var(--tx2);margin:14px 0 0;line-height:1.5}"
        "</style></head><body><main class='shell'><section class='card'>"
        "<h1>Portal de emergencia</h1>"
        "<p class='note'>Los archivos visuales del portal no estan cargados en LittleFS. Podes guardar la configuracion igual y despues subir el filesystem con <code>uploadfs</code>.</p>"
        "<form method='POST' action='/save'>"
        "<label for='ssid'>Red WiFi</label>"
        "<input id='ssid' name='ssid' autocomplete='off' required value='");
    html += ssidValue;
    html += F("'>"
        "<label for='pass'>Contrasena WiFi</label>"
        "<input id='pass' name='pass' type='password' autocomplete='off' value='");
    html += passValue;
    html += F("'>");

    if (String(DEPLOYMENT_MODE) != "saas") {
        html += F("<label for='url'>URL backend</label><input id='url' name='url' autocomplete='off' required value='");
        html += urlValue;
        html += F("'>");
    }

    html += F("<label for='price'>Precio</label><input id='price' name='price' type='number' min='1' step='1' inputmode='numeric' required value='");
    html += priceValue;
    html += F("'>"
        "<div class='actions'><button type='submit'>Guardar y reiniciar</button></div>"
        "</form>"
        "<p class='meta'>Si queres la experiencia completa del portal, subi los assets LittleFS del firmware. El endpoint <code>/info</code> sigue disponible para diagnostico rapido.</p>"
        "</section></main></body></html>");
    return html;
}

void startPortal() {
    portalMode = true;
    Serial.println("[PORTAL] Iniciando AP y portal de configuracion...");

    WiFi.mode(WIFI_AP_STA);
    WiFi.softAP(AP_SSID);

    IPAddress ip(192, 168, 4, 1);
    WiFi.softAPConfig(ip, ip, IPAddress(255, 255, 255, 0));

    dnsServer.setErrorReplyCode(DNSReplyCode::NoError);
    dnsServer.start(DNS_PORT, "*", ip);

    portalServer.on("/", HTTP_GET, []() {
        if (servePortalStaticFile("/portal/index.html", "text/html; charset=utf-8", "no-store")) return;
        portalServer.send(200, "text/html; charset=utf-8", buildPortalFallbackHtml());
    });

    portalServer.on("/portal/index.html", HTTP_GET, []() {
        if (servePortalStaticFile("/portal/index.html", "text/html; charset=utf-8", "no-store")) return;
        portalServer.send(200, "text/html; charset=utf-8", buildPortalFallbackHtml());
    });

    portalServer.on("/portal.css", HTTP_GET, []() {
        if (servePortalStaticFile("/portal/styles.css", "text/css; charset=utf-8", "public, max-age=300")) return;
        portalServer.send(404, "text/plain", "portal css missing");
    });

    portalServer.on("/portal.js", HTTP_GET, []() {
        if (servePortalStaticFile("/portal/app.js", "application/javascript; charset=utf-8", "public, max-age=300")) return;
        portalServer.send(404, "text/plain", "portal js missing");
    });

    portalServer.on("/info", HTTP_GET, []() {
        String json = "{\"mac\":\"" + macAddress + "\","
                      "\"fw\":\"v3.0\","
                      "\"mode\":\"" DEPLOYMENT_MODE "\","
                      "\"requires_url\":" + String(String(DEPLOYMENT_MODE) == "saas" ? "false" : "true") + ","
                      "\"ssid\":\"" + jsonEscape(wifiSSID) + "\","
                      "\"pass\":\"" + jsonEscape(wifiPass) + "\"," 
                      "\"url\":\"" + jsonEscape(backendBase) + "\"," 
                      "\"price\":" + String((unsigned long)pricingSanitizeHumanPrice(pricingConfig.priceCents)) + "," 
                      "\"price_profile\":\"" + jsonEscape(pricingProfileCode(pricingConfig.profile)) + "\"," 
                      "\"config_version\":" + String((unsigned long)technicalConfigVersion) + "," 
                      "\"config_source\":\"" + jsonEscape(technicalConfigSource) + "\"}";
        portalServer.sendHeader("Cache-Control", "no-store");
        portalServer.send(200, "application/json", json);
    });

    portalServer.on("/diag/events", HTTP_GET, []() {
        uint8_t limit = (uint8_t)portalServer.arg("limit").toInt();
        if (limit == 0) limit = 12;
        String json = eventLogBuildJson(diagEventLog, limit);
        portalServer.sendHeader("Cache-Control", "no-store");
        portalServer.send(200, "application/json", json);
    });

    portalServer.on("/diag/mdb", HTTP_GET, []() {
        String json = buildMdbSetupJson();
        portalServer.sendHeader("Cache-Control", "no-store");
        portalServer.send(200, "application/json", json);
    });

    portalServer.on("/diag/mdb/request-time", HTTP_POST, []() {
        mdbTimeDateProbePending = true;
        mdbTimeDateProbeRequestedAtMs = millis();
        String json = "{\"ok\":true,\"message\":\"Solicitud de hora MDB armada. Se enviara en el proximo POLL estando ENABLED.\",\"requested_at_ms\":";
        json += mdbTimeDateProbeRequestedAtMs;
        json += "}";
        portalServer.sendHeader("Cache-Control", "no-store");
        portalServer.send(200, "application/json", json);
    });

    portalServer.on("/scan", HTTP_GET, []() {
        Serial.println("[PORTAL] Escaneando redes WiFi...");
        String json = buildWifiScanJson();
        portalServer.sendHeader("Cache-Control", "no-store");
        portalServer.send(200, "application/json", json);
    });

    portalServer.on("/test", HTTP_POST, []() {
        String ssid = portalServer.arg("ssid");
        String pass = portalServer.arg("pass");
        String url  = portalServer.arg("url");
        String json = testPortalConnection(ssid, pass, url);
        portalServer.sendHeader("Cache-Control", "no-store");
        portalServer.send(200, "application/json", json);
    });

    // Captive portal detection — iOS, Android, Windows
    auto redirect = []() {
        portalServer.sendHeader("Location", "http://" AP_IP_STR, true);
        portalServer.send(302, "text/plain", "");
    };
    portalServer.on("/hotspot-detect.html",          HTTP_GET, redirect);
    portalServer.on("/library/test/success.html",    HTTP_GET, redirect);
    portalServer.on("/generate_204",                 HTTP_GET, redirect);
    portalServer.on("/connectivitycheck.html",       HTTP_GET, redirect);
    portalServer.on("/ncsi.txt",                     HTTP_GET, redirect);
    portalServer.on("/redirect",                     HTTP_GET, redirect);

    portalServer.on("/save", HTTP_POST, []() {
        String ssid = portalServer.arg("ssid");
        String pass = portalServer.arg("pass");
        String url  = portalServer.arg("url");
        String priceRaw = portalServer.arg("price");
        ssid.trim();
        url = normalizeBackendUrl(url);
        uint32_t priceValue = 0;

        if (ssid.length() == 0) {
            portalServer.send(400, "text/plain", "ssid requerido");
            return;
        }
        if (String(DEPLOYMENT_MODE) != "saas" && url.length() == 0) {
            portalServer.send(400, "text/plain", "url requerida");
            return;
        }
        if (String(DEPLOYMENT_MODE) == "saas" || url.length() == 0) {
            url = String(BACKEND_URL);
        }
        if (!hasHttpScheme(url)) {
            portalServer.send(400, "text/plain", "url invalida: debe comenzar con http:// o https://");
            return;
        }
        if (!parseUnsignedLongStrict(priceRaw, priceValue) || priceValue == 0) {
            portalServer.send(400, "text/plain", "precio invalido");
            return;
        }

        PricingConfig nextPricing = pricingConfig;
        nextPricing.priceCents = priceValue;
        saveConfig(ssid, pass, url, nextPricing, technicalConfigVersion + 1, "portal");
        portalServer.send(200, "text/plain", "ok");
        Serial.println("[PORTAL] Config guardada, reiniciando...");
        ledBlink(3, 200);
        delay(1500);
        ESP.restart();
    });

    portalServer.onNotFound([redirect]() { redirect(); });
    portalServer.begin();

    Serial.printf("[PORTAL] AP activo — SSID: %s (sin password)\n", AP_SSID);
    Serial.printf("[PORTAL] Abrir http://%s en el celular\n", AP_IP_STR);
    ledBlink(5, 100);
}


// ══════════════════════════════════════════════════════
//  WIFI
// ══════════════════════════════════════════════════════
bool checkBackend();   // forward declaration
void pollRemoteCommands(); // forward declaration
bool canProcessRemoteCommand(); // forward declaration

void requestImmediateRemoteCommandPoll() {
    remoteCommandPollRequested = true;
}

bool connectWiFi() {
    if (wifiSSID.length() == 0) return false;

    WiFi.mode(WIFI_STA);
    WiFi.begin(wifiSSID.c_str(), wifiPass.c_str());
    //WiFi.setTxPower(WIFI_POWER_2dBm); 
    Serial.printf("[WiFi] Conectando a %s", wifiSSID.c_str());
    //Serial.printf("Set TX power: %d dBm\n", WIFI_POWER_2dBm);
    int t = 0;

    while (WiFi.status() != WL_CONNECTED && t++ < 30) {
        delay(500);
        Serial.print(".");
        ledToggle();
        feedWatchdog();
    }

    if (WiFi.status() == WL_CONNECTED) {
        Serial.printf("\n[WiFi] OK — IP: %s\n", WiFi.localIP().toString().c_str());
        wifiReady = true;
        requestImmediateRemoteCommandPoll();
        logDiagEvent(EVT_WIFI_CONNECT_OK, WiFi.RSSI(), WiFi.localIP());

        // Sincronizar NTP como reloj principal del firmware
        configTime(0, 0, "pool.ntp.org", "time.nist.gov");

        // Verificar conectividad con el backend
        checkBackend();
        return true;
    }

    Serial.println("\n[WiFi] Error de conexion");
    logDiagEvent(EVT_WIFI_CONNECT_FAIL, -1, 0);
    return false;
}


// ══════════════════════════════════════════════════════
//  HTTP: tap, result, reconcile, register
// ══════════════════════════════════════════════════════
bool checkBackend() {
    if (WiFi.status() != WL_CONNECTED) {
        backendReady = false;
        backendLastError = "WiFi desconectado";
        logDiagEvent(EVT_BACKEND_HEALTH_FAIL, -1, 0);
        return false;
    }
    String url = backendBase + "/health";
    Serial.printf("[BACKEND] Intentando: %s\n", url.c_str());
    WiFiClient client;
    WiFiClientSecure secureClient;
    HTTPClient http;
    if (!beginHttpRequest(http, client, secureClient, url)) {
        Serial.println("[BACKEND] http.begin() fallo — URL invalida?");
        backendReady = false;
        backendLastError = "URL backend invalida o inaccesible";
        return false;
    }
    http.setTimeout(HTTP_TIMEOUT_MS);
    int code = http.GET();
    http.end();
    feedWatchdog();
    Serial.printf("[BACKEND] HTTP code: %d\n", code);
    bool ok = (code == 200);
    backendReady = ok;
    if (ok) {
        backendLastError = "";
        logDiagEvent(EVT_BACKEND_HEALTH_OK, code, 0);
    } else if (code > 0) {
        backendLastError = "HTTP " + String(code) + " en /health";
        logDiagEvent(EVT_BACKEND_HEALTH_FAIL, code, 0);
    } else {
        backendLastError = "Sin respuesta en /health";
        logDiagEvent(EVT_BACKEND_HEALTH_FAIL, -2, 0);
    }
    Serial.printf("[BACKEND] %s\n", ok ? "CONECTADO" : "SIN RESPUESTA");
    return ok;
}

int postTap(const String& uid) {
    if (WiFi.status() != WL_CONNECTED) return -1;

    String url = backendBase + "/api/tap";
    WiFiClient client;
    WiFiClientSecure secureClient;
    HTTPClient http;
    if (!beginHttpRequest(http, client, secureClient, url)) return -1;

    http.addHeader("Content-Type", "application/json");
    http.addHeader("X-Machine-Mac", macAddress);
    http.setTimeout(HTTP_TIMEOUT_MS);

    int code = http.POST("{\"nfc_uid\":\"" + uid + "\"}");
    http.end();
    feedWatchdog();
    return code;
}

void notifyVendResult(const String& uid, uint16_t itemId, uint16_t amount, bool ok) {
    uint32_t humanAmount = amount > 0 ? pricingMdbAmountToHuman(pricingConfig, amount) : 0;
    Serial.printf("[TAP] Resultado venta %s — item #%d $%lu centavos (MDB=%u)\n",
                  ok ? "EXITOSA" : "FALLIDA",
                  itemId,
                  (unsigned long)humanAmount,
                  (unsigned int)amount);

    // Si la sesión fue offline OR el WiFi cayó durante la sesión → encolar
    if (mdbRuntime.sessionIsOffline || WiFi.status() != WL_CONNECTED) {
        Serial.println("[TAP] Sin conexion online — encolando evento");
        enqueueEvent(uid, itemId, humanAmount, ok);
        if (ok) incrementLocalUsed(uid);
        return;
    }

    // Online: notificar al backend directamente
    String url = backendBase + "/api/tap/result";
    WiFiClient client;
    WiFiClientSecure secureClient;
    HTTPClient http;
    if (!beginHttpRequest(http, client, secureClient, url)) {
        // Si falla begin, encolar como fallback
        enqueueEvent(uid, itemId, amount, ok);
        return;
    }

    http.addHeader("Content-Type", "application/json");
    http.addHeader("X-Machine-Mac", macAddress);
    http.setTimeout(HTTP_TIMEOUT_MS);

    String body = "{\"nfc_uid\":\"" + uid
                + "\",\"vend_success\":" + (ok ? "true" : "false")
                + ",\"item_id\":" + itemId
                + ",\"amount\":" + humanAmount + "}";

    int code = http.POST(body);
    http.end();
    feedWatchdog();

    if (code <= 0) {
        // Sin respuesta → encolar para reintentar
        Serial.println("[TAP] Sin respuesta backend — encolando evento");
        enqueueEvent(uid, itemId, humanAmount, ok);
    }
}

void reconcileTaps() {
    if (!wifiReady) return;

    String url = backendBase + "/api/tap/reconcile";
    WiFiClient client;
    WiFiClientSecure secureClient;
    HTTPClient http;
    if (!beginHttpRequest(http, client, secureClient, url)) return;

    http.addHeader("Content-Type", "application/json");
    http.addHeader("X-Machine-Mac", macAddress);
    http.setTimeout(HTTP_TIMEOUT_MS);

    int code = http.POST("{}");
    http.end();
    feedWatchdog();

    if (code == 200) Serial.println("[RECONCILE] OK — taps huerfanos revertidos");
    else             Serial.printf("[RECONCILE] HTTP %d\n", code);
}

void registerMachine() {
    if (!wifiReady) return;

    String url = backendBase + "/api/machines/register";
    WiFiClient client;
    WiFiClientSecure secureClient;
    HTTPClient http;
    if (!beginHttpRequest(http, client, secureClient, url)) return;

    http.addHeader("Content-Type", "application/json");
    http.addHeader("X-Registration-Secret", REGISTRATION_SECRET);
    http.setTimeout(HTTP_TIMEOUT_MS);

    DynamicJsonDocument doc(1024);
    doc["mac"] = macAddress;
    doc["wifi_ssid"] = wifiSSID;
    doc["backend_url"] = backendBase;
    doc["firmware_version"] = FIRMWARE_VERSION;
    doc["price_cents"] = pricingSanitizeHumanPrice(pricingConfig.priceCents);
    doc["pricing_profile"] = pricingProfileCode(pricingConfig.profile);
    doc["config_version"] = technicalConfigVersion;
    doc["config_source"] = technicalConfigSource;
    doc["mdb_feature_level"] = pricingConfig.featureLevel;
    doc["mdb_country_code"] = pricingConfig.countryCode;
    doc["mdb_scale_factor"] = pricingConfig.scaleFactor;
    doc["mdb_decimal_places"] = pricingConfig.decimalPlaces;
    doc["mdb_max_response_time"] = pricingConfig.maxResponseTime;
    doc["mdb_misc_options"] = pricingConfig.miscOptions;
    doc["wifi_rssi"] = WiFi.RSSI();
    doc["wifi_ip"] = WiFi.localIP().toString();
    doc["backend_ok"] = backendReady;
    if (backendLastError.length() > 0) doc["backend_error"] = backendLastError;
    else                               doc["backend_error"] = nullptr;
    String body;
    serializeJson(doc, body);

    int code = http.POST(body);
    String responseBody = (code > 0) ? http.getString() : "";
    http.end();
    feedWatchdog();
    bool otaPendingAfterRegister = false;
    String otaPendingVersion = "";

    if (code == 200 && responseBody.length() > 0) {
        DynamicJsonDocument responseDoc(2048);
        DeserializationError err = deserializeJson(responseDoc, responseBody);
        if (!err) {
            JsonObject config = responseDoc["config"].as<JsonObject>();
            if (!config.isNull()) {
                PricingConfig nextConfig = pricingConfig;
                uint32_t remoteVersion = (uint32_t)(config["config_version"] | technicalConfigVersion);
                String remoteSource = String((const char*)(config["config_source"] | technicalConfigSource.c_str()));
                uint32_t remotePrice = (uint32_t)(config["price_cents"] | 0);
                if (remotePrice > 0) nextConfig.priceCents = remotePrice;
                nextConfig.profile = pricingProfileFromCode(
                    String((const char*)(config["pricing_profile"] | "")),
                    nextConfig.profile
                );
                nextConfig.featureLevel = (uint8_t)(config["mdb_feature_level"] | nextConfig.featureLevel);
                nextConfig.countryCode = (uint16_t)(config["mdb_country_code"] | nextConfig.countryCode);
                nextConfig.scaleFactor = (uint8_t)(config["mdb_scale_factor"] | nextConfig.scaleFactor);
                nextConfig.decimalPlaces = (uint8_t)(config["mdb_decimal_places"] | nextConfig.decimalPlaces);
                nextConfig.maxResponseTime = (uint8_t)(config["mdb_max_response_time"] | nextConfig.maxResponseTime);
                nextConfig.miscOptions = (uint8_t)(config["mdb_misc_options"] | nextConfig.miscOptions);
                applyPricingConfig(nextConfig, true, "backend/register", remoteVersion, remoteSource);
            }

            JsonObject ota = responseDoc["ota"].as<JsonObject>();
            if (!ota.isNull()) {
                String desiredVersion = String((const char*)(ota["desired_firmware_version"] | ""));
                String otaStatus = String((const char*)(ota["firmware_update_status"] | ""));
                desiredVersion.trim();
                otaStatus.trim();

                if (desiredVersion.length() > 0
                    && desiredVersion != String(FIRMWARE_VERSION)
                    && (otaStatus == "queued" || otaStatus == "in_progress" || otaStatus == "pending_reconnect")) {
                    otaPendingAfterRegister = true;
                    otaPendingVersion = desiredVersion;
                }
            }
        } else {
            Serial.printf("[REG] JSON invalido en respuesta: %s\n", err.c_str());
        }
    }

    if (code == 200) {
        Serial.println("[REG] OK — maquina APROBADA");
        requestImmediateRemoteCommandPoll();
        if (otaPendingAfterRegister && canProcessRemoteCommand()) {
            Serial.printf("[REG] OTA pendiente detectada (%s) — consultando comandos remotos ahora\n",
                          otaPendingVersion.c_str());
            remoteCommandPollRequested = false;
            lastCommandPollMs = millis();
            pollRemoteCommands();
        }
        logDiagEvent(EVT_BACKEND_REGISTER_OK, code, pricingSanitizeHumanPrice(pricingConfig.priceCents));
    } else if (code == 202) {
        Serial.println("[REG] PENDIENTE — esperando aprobacion");
        logDiagEvent(EVT_BACKEND_REGISTER_PENDING, code, 0);
        ledBlink(2, 300);
    } else if (code == 401) {
        Serial.println("[REG] ERROR 401 — REGISTRATION_SECRET incorrecto");
        logDiagEvent(EVT_BACKEND_REGISTER_FAIL, code, 0);
    } else if (code <= 0) {
        Serial.printf("[REG] Sin respuesta (verificar URL: %s)\n", backendBase.c_str());
        logDiagEvent(EVT_BACKEND_REGISTER_FAIL, -2, 0);
    } else {
        Serial.printf("[REG] HTTP %d\n", code);
        logDiagEvent(EVT_BACKEND_REGISTER_FAIL, code, 0);
    }
}

bool canProcessRemoteCommand() {
    return !mdbRuntime.pendingSession
        && mdbRuntime.sessionUID.length() == 0
        && mdbRuntime.phase != SESSION_IDLE
        && mdbRuntime.phase != VEND_PENDING;
}

bool ackRemoteCommandJson(uint32_t commandId, const char* status, const String& resultJson) {
    if (WiFi.status() != WL_CONNECTED) return false;

    WiFiClient client;
    WiFiClientSecure secureClient;
    HTTPClient http;
    String url = backendBase + "/api/machine-control/commands/" + String(commandId) + "/ack";
    if (!beginHttpRequest(http, client, secureClient, url)) return false;

    http.addHeader("Content-Type", "application/json");
    http.addHeader("X-Machine-Mac", macAddress);
    http.setTimeout(HTTP_TIMEOUT_MS);

    String body = "{\"status\":\"" + String(status) + "\",\"result\":" + resultJson + "}";
    int code = http.POST(body);
    http.end();
    feedWatchdog();

    if (code == 200) return true;
    Serial.printf("[REMOTE] ACK fallo para comando #%lu — HTTP %d\n",
                  (unsigned long)commandId, code);
    return false;
}

bool ackRemoteCommand(uint32_t commandId, const char* status, const String& message) {
    DynamicJsonDocument resultDoc(192);
    resultDoc["message"] = message;
    String resultJson;
    serializeJson(resultDoc, resultJson);
    return ackRemoteCommandJson(commandId, status, resultJson);
}

bool handleRemoteWifiScan(uint32_t commandId) {
    Serial.println("[REMOTE] Escaneando redes WiFi visibles...");

    int found = WiFi.scanNetworks(false, true);
    DynamicJsonDocument resultDoc(3072);
    JsonArray networks = resultDoc.createNestedArray("networks");

    if (found <= 0) {
        resultDoc["message"] = "No se encontraron redes visibles.";
        resultDoc["count"] = 0;
        String resultJson;
        serializeJson(resultDoc, resultJson);
        return ackRemoteCommandJson(commandId, "completed", resultJson);
    }

    int added = 0;
    for (int i = 0; i < found && added < 12; i++) {
        String ssid = WiFi.SSID(i);
        if (ssid.length() == 0) continue;

        bool duplicated = false;
        for (JsonObject existing : networks) {
            if (ssid == String((const char*)existing["ssid"])) {
                duplicated = true;
                break;
            }
        }
        if (duplicated) continue;

        JsonObject net = networks.createNestedObject();
        net["ssid"] = ssid;
        net["rssi"] = WiFi.RSSI(i);
        net["secure"] = WiFi.encryptionType(i) != WIFI_AUTH_OPEN;
        added++;
    }

    WiFi.scanDelete();
    resultDoc["count"] = added;
    resultDoc["message"] = String(added) + " red" + (added == 1 ? "" : "es") + " visible" + (added == 1 ? "" : "s") + " detectada" + (added == 1 ? "" : "s") + ".";

    String resultJson;
    serializeJson(resultDoc, resultJson);
    return ackRemoteCommandJson(commandId, "completed", resultJson);
}

bool handleRemoteWifiUpdate(uint32_t commandId, JsonObject payload) {
    const char* ssidValue = payload["ssid"] | "";
    const char* passValue = payload["pass"] | "";
    const char* urlValue  = payload["url"]  | "";
    bool preservePassword = payload["preserve_password"] | false;

    String nextSSID = String(ssidValue);
    String nextPass = String(passValue);
    String nextUrl  = String(urlValue);

    nextSSID.trim();
    nextUrl = normalizeBackendUrl(nextUrl);
    nextUrl.trim();

    if (nextSSID.length() == 0) {
        ackRemoteCommand(commandId, "failed", "SSID remoto requerido");
        return true;
    }
    if (preservePassword && nextPass.length() == 0) {
        nextPass = wifiPass;
    }
    if (nextUrl.length() == 0) {
        nextUrl = backendBase;
    } else if (!hasHttpScheme(nextUrl)) {
        ackRemoteCommand(commandId, "failed", "URL backend remota invalida");
        return true;
    }

    if (!ackRemoteCommand(commandId, "completed", "Configuracion WiFi guardada; reiniciando")) {
        return false;
    }

    saveConfig(nextSSID, nextPass, nextUrl, pricingConfig, technicalConfigVersion, technicalConfigSource);
    wifiSSID = nextSSID;
    wifiPass = nextPass;
    backendBase = nextUrl;

    Serial.printf("[REMOTE] Nueva WiFi guardada: %s\n", nextSSID.c_str());
    Serial.printf("[REMOTE] Backend conservado/actualizado: %s\n", backendBase.c_str());
    ledBlink(4, 70);
    delay(350);
    ESP.restart();
    return true;
}

bool handleRemoteConfigUpdate(uint32_t commandId, JsonObject payload) {
    PricingConfig nextConfig = pricingConfig;
    bool touched = false;
    uint32_t remoteVersion = (uint32_t)(payload["config_version"] | technicalConfigVersion);
    String remoteSource = String((const char*)(payload["config_source"] | technicalConfigSource.c_str()));

    if (!payload["price_cents"].isNull()) {
        uint32_t nextPrice = (uint32_t)(payload["price_cents"] | 0);
        if (nextPrice == 0) {
            ackRemoteCommand(commandId, "failed", "price_cents remoto invalido");
            return true;
        }
        nextConfig.priceCents = nextPrice;
        touched = true;
    }

    if (!payload["pricing_profile"].isNull()) {
        nextConfig.profile = pricingProfileFromCode(
            String((const char*)(payload["pricing_profile"] | "")),
            0xFF
        );
        if (nextConfig.profile == 0xFF) {
            ackRemoteCommand(commandId, "failed", "pricing_profile remoto invalido");
            return true;
        }
        touched = true;
    }

    if (!payload["mdb_feature_level"].isNull()) {
        nextConfig.featureLevel = (uint8_t)(payload["mdb_feature_level"] | nextConfig.featureLevel);
        touched = true;
    }
    if (!payload["mdb_country_code"].isNull()) {
        nextConfig.countryCode = (uint16_t)(payload["mdb_country_code"] | nextConfig.countryCode);
        touched = true;
    }
    if (!payload["mdb_scale_factor"].isNull()) {
        nextConfig.scaleFactor = (uint8_t)(payload["mdb_scale_factor"] | nextConfig.scaleFactor);
        touched = true;
    }
    if (!payload["mdb_decimal_places"].isNull()) {
        nextConfig.decimalPlaces = (uint8_t)(payload["mdb_decimal_places"] | nextConfig.decimalPlaces);
        touched = true;
    }
    if (!payload["mdb_max_response_time"].isNull()) {
        nextConfig.maxResponseTime = (uint8_t)(payload["mdb_max_response_time"] | nextConfig.maxResponseTime);
        touched = true;
    }
    if (!payload["mdb_misc_options"].isNull()) {
        nextConfig.miscOptions = (uint8_t)(payload["mdb_misc_options"] | nextConfig.miscOptions);
        touched = true;
    }

    if (!touched) {
        ackRemoteCommand(commandId, "failed", "config_update remoto vacio");
        return true;
    }

    bool changed = applyPricingConfig(nextConfig, true, "backend/command", remoteVersion, remoteSource);
    if (!ackRemoteCommand(commandId, "completed", changed
        ? "Configuracion aplicada sin reinicio"
        : "Configuracion ya vigente")) {
        return false;
    }

    ledBlink(changed ? 3 : 1, 70);
    logDiagEvent(EVT_REMOTE_CONFIG_APPLIED, changed ? 1 : 0, pricingSanitizeHumanPrice(nextConfig.priceCents));
    return true;
}

bool handleRemoteFirmwareUpdate(uint32_t commandId, JsonObject payload) {
    const uint32_t releaseId = (uint32_t)(payload["release_id"] | 0);
    const uint32_t sizeBytes = (uint32_t)(payload["size_bytes"] | 0);
    String version = String((const char*)(payload["version"] | ""));
    String md5 = String((const char*)(payload["md5"] | ""));
    String downloadPath = String((const char*)(payload["download_path"] | ""));

    version.trim();
    md5.trim();
    downloadPath.trim();

    if (releaseId == 0 || version.length() == 0 || sizeBytes == 0 || md5.length() != 32 || !downloadPath.startsWith("/")) {
        ackRemoteCommand(commandId, "failed", "Payload OTA invalido");
        return true;
    }

    String downloadUrl = backendBase + downloadPath;
    Serial.printf("[OTA] Descargando release %lu (%s) desde %s\n",
                  (unsigned long)releaseId,
                  version.c_str(),
                  downloadUrl.c_str());

    WiFiClient client;
    WiFiClientSecure secureClient;
    HTTPClient http;
    if (!beginHttpRequest(http, client, secureClient, downloadUrl)) {
        ackRemoteCommand(commandId, "failed", "No se pudo abrir la descarga OTA");
        return true;
    }

    http.addHeader("X-Machine-Mac", macAddress);
    http.setTimeout(OTA_HTTP_TIMEOUT_MS);
    int code = http.GET();
    if (code != 200) {
        http.end();
        ackRemoteCommand(commandId, "failed", "Descarga OTA rechazo HTTP " + String(code));
        return true;
    }

    const int responseLength = http.getSize();
    if (responseLength > 0 && (uint32_t)responseLength != sizeBytes) {
        http.end();
        ackRemoteCommand(commandId, "failed", "Tamano OTA inesperado");
        return true;
    }

    if (!Update.begin(sizeBytes)) {
        http.end();
        ackRemoteCommand(commandId, "failed", String("Update.begin fallo: ") + Update.errorString());
        return true;
    }
    if (!Update.setMD5(md5.c_str())) {
        Update.abort();
        http.end();
        ackRemoteCommand(commandId, "failed", "MD5 OTA invalido");
        return true;
    }

    size_t written = Update.writeStream(*http.getStreamPtr());
    bool updateOk = (written == sizeBytes) && Update.end();
    String updateError = Update.errorString();
    http.end();

    if (!updateOk) {
        Update.abort();
        ackRemoteCommand(commandId, "failed", String("OTA fallo: ") + updateError);
        return true;
    }

    DynamicJsonDocument resultDoc(256);
    resultDoc["message"] = String("Firmware ") + version + " aplicado; reiniciando";
    resultDoc["version"] = version;
    resultDoc["release_id"] = releaseId;
    String resultJson;
    serializeJson(resultDoc, resultJson);

    if (!ackRemoteCommandJson(commandId, "completed", resultJson)) {
        Serial.println("[OTA] ACK no confirmado; el re-registro debera cerrar el estado.");
    }

    Serial.printf("[OTA] Release %s grabada (%lu bytes). Reiniciando...\n",
                  version.c_str(),
                  (unsigned long)written);
    ledBlink(5, 80);
    delay(400);
    ESP.restart();
    return true;
}

bool handleRemoteDiagnosticsSnapshot(uint32_t commandId, JsonObject payload) {
    uint8_t limit = (uint8_t)(payload["limit"] | 20);
    if (limit == 0) limit = 20;
    if (limit > 32) limit = 32;

    String resultJson = buildDiagnosticsSnapshotJson(limit);
    return ackRemoteCommandJson(commandId, "completed", resultJson);
}

void pollRemoteCommands() {
    if (WiFi.status() != WL_CONNECTED) return;
    if (!canProcessRemoteCommand()) return;

    WiFiClient client;
    WiFiClientSecure secureClient;
    HTTPClient http;
    String url = backendBase + "/api/machine-control/commands/next";
    if (!beginHttpRequest(http, client, secureClient, url)) return;

    http.addHeader("X-Machine-Mac", macAddress);
    http.setTimeout(HTTP_TIMEOUT_MS);

    int code = http.GET();
    if (code == 204) {
        http.end();
        feedWatchdog();
        return;
    }
    if (code != 200) {
        if (code > 0) Serial.printf("[REMOTE] Poll comandos HTTP %d\n", code);
        http.end();
        feedWatchdog();
        return;
    }

    String body = http.getString();
    http.end();
    feedWatchdog();

    DynamicJsonDocument doc(768);
    DeserializationError err = deserializeJson(doc, body);
    if (err) {
        Serial.printf("[REMOTE] JSON invalido en comando: %s\n", err.c_str());
        return;
    }

    JsonObject command = doc["command"];
    if (command.isNull()) return;

    uint32_t commandId = command["id"] | 0;
    String commandType = command["type"] | "";
    if (commandId == 0 || commandType.length() == 0) return;

    Serial.printf("[REMOTE] Comando recibido #%lu: %s\n",
                  (unsigned long)commandId, commandType.c_str());

    if (commandType == "reboot") {
        if (ackRemoteCommand(commandId, "completed", "Reinicio remoto aceptado por la maquina")) {
            Serial.println("[REMOTE] Reiniciando por comando remoto...");
            ledBlink(3, 80);
            delay(250);
            ESP.restart();
        }
        return;
    }

    if (commandType == "wifi_scan") {
        handleRemoteWifiScan(commandId);
        return;
    }

    if (commandType == "wifi_update") {
        JsonObject payload = command["payload"].as<JsonObject>();
        if (payload.isNull()) {
            ackRemoteCommand(commandId, "failed", "Payload remoto invalido");
            return;
        }
        handleRemoteWifiUpdate(commandId, payload);
        return;
    }

    if (commandType == "config_update") {
        JsonObject payload = command["payload"].as<JsonObject>();
        if (payload.isNull()) {
            ackRemoteCommand(commandId, "failed", "Payload remoto invalido");
            return;
        }
        handleRemoteConfigUpdate(commandId, payload);
        return;
    }

    if (commandType == "firmware_update") {
        JsonObject payload = command["payload"].as<JsonObject>();
        if (payload.isNull()) {
            ackRemoteCommand(commandId, "failed", "Payload remoto invalido");
            return;
        }
        handleRemoteFirmwareUpdate(commandId, payload);
        return;
    }

    if (commandType == "diagnostics_snapshot") {
        JsonObject payload = command["payload"].as<JsonObject>();
        if (payload.isNull()) {
            DynamicJsonDocument emptyDoc(16);
            payload = emptyDoc.to<JsonObject>();
            handleRemoteDiagnosticsSnapshot(commandId, payload);
            return;
        }
        handleRemoteDiagnosticsSnapshot(commandId, payload);
        return;
    }

    ackRemoteCommand(commandId, "failed", "Comando no soportado por este firmware");
}


// ══════════════════════════════════════════════════════
//  NFC — con fallback offline
// ══════════════════════════════════════════════════════
void handleNFC() {
    if (millis() - lastNFCRead < NFC_COOLDOWN_MS) return;
    if (!rfid.PICC_IsNewCardPresent() || !rfid.PICC_ReadCardSerial()) return;

    // Fix Bug 6: no aceptar nuevos taps si hay sesión MDB activa
    if (mdbRuntime.phase == VEND_PENDING || mdbRuntime.phase == SESSION_IDLE) {
        Serial.println("[NFC] TAP IGNORADO — sesion MDB activa");
        rfid.PICC_HaltA();
        rfid.PCD_StopCrypto1();
        lastNFCRead = millis();
        return;
    }

    lastNFCRead = millis();

    // Leer UID
    String uid = "";
    for (byte i = 0; i < rfid.uid.size; i++) {
        if (rfid.uid.uidByte[i] < 0x10) uid += "0";
        uid += String(rfid.uid.uidByte[i], HEX);
    }
    uid.toUpperCase();
    rfid.PICC_HaltA();
    rfid.PCD_StopCrypto1();

    Serial.printf("[NFC] Tarjeta: %s\n", uid.c_str());
    logDiagEvent(EVT_NFC_READ, 0, uid.length() >= 4 ? strtoul(uid.substring(0, 4).c_str(), nullptr, 16) : 0);
    bool approved    = false;
    bool isOffline   = false;

    // ── Intentar autenticación online ────────────────
    if (WiFi.status() == WL_CONNECTED) {
        Serial.println("[TAP] Consultando backend...");
        int code = postTap(uid);

        if (code == 200) {
            Serial.println("[TAP] APROBADO (online)");
            approved = true;
            logDiagEvent(EVT_NFC_APPROVED_ONLINE, 200, 0);
        } else if (code == 403) {
            // Leer body para distinguir razón
            // (postTap devuelve solo el código; la razón viene en el body — se loguea genérico)
            Serial.println("[TAP] DENEGADO (online) — verificar razon en backend");
            logDiagEvent(EVT_NFC_DENIED, 403, 0);
            ledTagRejectedPattern();
            return;
        } else if (code == 401) {
            Serial.println("[TAP] ERROR 401 — re-registrando maquina...");
            logDiagEvent(EVT_NFC_DENIED, 401, 0);
            registerMachine();
            ledTagRejectedPattern();
            return;
        } else if (code > 0) {
            Serial.printf("[TAP] ERROR HTTP %d\n", code);
            logDiagEvent(EVT_NFC_DENIED, code, 0);
            ledTagRejectedPattern();
            return;
        }
        // code <= 0: sin respuesta → caer a modo offline
    }

    // ── Fallback offline ──────────────────────────────
    if (!approved) {
        Serial.println("[TAP] Backend no disponible — modo offline (cache local)");
        isOffline = true;
        int result = localAuth(uid);

        if (result == LOCAL_AUTH_OK) {
            Serial.println("[TAP] APROBADO (offline — cache local)");
            approved = true;
            logDiagEvent(EVT_NFC_APPROVED_OFFLINE, 1, 0);
        } else if (result == LOCAL_AUTH_OVERLIMIT) {
            Serial.println("[TAP] DENEGADO — limite diario alcanzado (offline)");
            logDiagEvent(EVT_NFC_DENIED, 1, 0);
            ledTagRejectedPattern();
            return;
        } else {
            Serial.println("[TAP] DENEGADO — tarjeta desconocida (offline)");
            logDiagEvent(EVT_NFC_DENIED, 2, 0);
            ledTagRejectedPattern();
            return;
        }
    }

    if (!enqueueMdbStartSession(uid, isOffline)) {
        Serial.println("[MDB] ERROR — no se pudo encolar inicio de sesion");
        ledTagRejectedPattern();
        return;
    }

    ledTagApprovedPattern();
}


// ══════════════════════════════════════════════════════
//  MDB handlers
// ══════════════════════════════════════════════════════
void mdbSendACK()  {
    MDB_LOG_TRACE("[MDB][TX] ACK (0x%02X) mode=1\n", MDB_ACK);
    mdb.sendAddress(MDB_ACK);  // ACK = 0x00 con 9no bit = 1
}
void mdbSendNAK()  {
    MDB_LOG_TRACE("[MDB][TX] NAK (0x%02X) mode=1\n", MDB_NAK);
    mdb.sendAddress(MDB_NAK);  // NAK = 0xFF con 9no bit = 1
}
void mdbSendByte(uint8_t b) {
    MDB_LOG_TRACE("[MDB][TX] Byte: 0x%02X\n", b);
    mdb.sendData(b);        // data con mode=0
    mdb.sendAddress(b);     // checksum con mode=1
}
void mdbSendData(uint8_t* data, uint8_t len) {
    uint8_t chk = 0;
    for (uint8_t i = 0; i < len; i++) {
        MDB_LOG_TRACE("[MDB][TX] Data[%d]: 0x%02X\n", i, data[i]);
        mdb.sendData(data[i]); chk += data[i];
    }
    MDB_LOG_TRACE("[MDB][TX] CHK: 0x%02X mode=1\n", chk);
    mdb.sendAddress(chk);  // Checksum con 9no bit = 1
}

void cmdReset() {
    mdbRuntime.phase = INACTIVE;
    mdbRuntime.justReset = true;
    mdbRuntime.pendingSession = false;
    mdbRuntime.vendApproved = false;
    mdbRuntime.vendDecisionSent = false;
    mdbRuntime.endSessionPending = false;
    mdbRuntime.vendUsed = false;
    mdbRuntime.sessionUID = "";
    mdbRuntime.sessionItemId = 0;
    mdbRuntime.sessionAmount = currentConfiguredHumanPrice();
    mdbRuntime.vendAmount = currentConfiguredHumanPrice();
    mdbRuntime.sessionIsOffline = false;
    mdbRuntime.sessionStartMs = 0;
    resetMdbSetupSnapshot();
    mdbSendACK();
    logDiagEvent(EVT_MDB_RESET, 0, 0);
    MDB_LOG_EVENT("[MDB] RESET recibido → INACTIVE (TX pin=%d)\n", PIN_MDB_TX);
}

void cmdGatewayReset() {
    resetMdbGatewaySnapshot();
    mdbGatewayRuntime.justReset = true;
    mdbGatewayRuntime.enabled = false;
    mdbGatewayRuntime.enabledFeatures = 0;
    mdbGatewayRuntime.featureLevel = 0;
    mdbGatewayRuntime.appMaxResponseSeconds = 5;
    logDiagEvent(EVT_MDB_GATEWAY_RESET, 0, 0);
    MDB_LOG_EVENTLN("[MDB-GW] RESET recibido");
}

void cmdGatewaySetup(uint8_t* d, uint8_t len) {
    captureMdbGatewayCommand(MDB_CMD_SETUP, d, len);

    if (len >= 1) mdbGatewayRuntime.vmcFeatureLevel = d[0];
    const uint8_t featureLevel = gatewayFeatureLevelForVmc();
    mdbGatewayRuntime.featureLevel = featureLevel;
    mdbGatewayRuntime.appMaxResponseSeconds = pricingConfig.maxResponseTime > 0 ? pricingConfig.maxResponseTime : 5;
    mdbGatewaySnapshot.gatewayFeatureLevel = featureLevel;
    mdbGatewaySnapshot.appMaxResponseSeconds = mdbGatewayRuntime.appMaxResponseSeconds;

    uint8_t response[4] = {
        0x01,
        featureLevel,
        (uint8_t)((mdbGatewayRuntime.appMaxResponseSeconds >> 8) & 0xFF),
        (uint8_t)(mdbGatewayRuntime.appMaxResponseSeconds & 0xFF)
    };
    mdbSendData(response, sizeof(response));
}

void cmdGatewayPoll() {
    if (mdbGatewayRuntime.justReset) {
        mdbSendByte(MDB_JUST_RESET);
        mdbGatewayRuntime.justReset = false;
    } else {
        mdbSendACK();
    }
}

void cmdGatewayReport(uint8_t* d, uint8_t len) {
    captureMdbGatewayCommand(MDB_CMD_VEND, d, len);
    mdbSendACK();
}

void cmdGatewayControl(uint8_t* d, uint8_t len) {
    captureMdbGatewayCommand(MDB_CMD_READER, d, len);
    if (len >= 1) {
        if (d[0] == MDB_GW_CONTROL_ENABLE) mdbGatewayRuntime.enabled = true;
        else if (d[0] == MDB_GW_CONTROL_DISABLE) mdbGatewayRuntime.enabled = false;
    }
    mdbSendACK();
}

bool buildGatewayTimeDateResponse(uint8_t* out, size_t outLen, const char** sourceLabel = nullptr) {
    if (!out || outLen < 11) return false;

    struct tm now{};
    if (!getGatewayCurrentTime(&now, sourceLabel)) return false;

    const uint16_t fullYear = (uint16_t)(1900 + now.tm_year);
    const uint8_t year = (uint8_t)(fullYear >= 2000 ? (fullYear - 2000) : fullYear % 100);
    const uint8_t month = (uint8_t)(now.tm_mon + 1);
    const uint8_t day = (uint8_t)now.tm_mday;
    const uint8_t hour = (uint8_t)now.tm_hour;
    const uint8_t minute = (uint8_t)now.tm_min;
    const uint8_t second = (uint8_t)now.tm_sec;
    const uint8_t dayOfWeek = (uint8_t)now.tm_wday;
    const uint8_t weekNumber = 0;

    out[0] = 0x01;
    out[1] = ((year / 10) << 4) | (year % 10);
    out[2] = ((month / 10) << 4) | (month % 10);
    out[3] = ((day / 10) << 4) | (day % 10);
    out[4] = ((hour / 10) << 4) | (hour % 10);
    out[5] = ((minute / 10) << 4) | (minute % 10);
    out[6] = ((second / 10) << 4) | (second % 10);
    out[7] = ((dayOfWeek / 10) << 4) | (dayOfWeek % 10);
    out[8] = ((weekNumber / 10) << 4) | (weekNumber % 10);
    out[9] = 0x00;
    out[10] = 0x00;

    mdbGatewaySnapshot.seenMask |= 0x10;
    mdbGatewaySnapshot.timeDateYear = year;
    mdbGatewaySnapshot.timeDateMonth = month;
    mdbGatewaySnapshot.timeDateDay = day;
    mdbGatewaySnapshot.timeDateHour = hour;
    mdbGatewaySnapshot.timeDateMinute = minute;
    mdbGatewaySnapshot.timeDateSecond = second;
    mdbGatewaySnapshot.lastTimeDateResponseMs = millis();
    return true;
}

void cmdGatewayExpansion(uint8_t* d, uint8_t len) {
    if (len == 0) {
        mdbSendNAK();
        return;
    }

    captureMdbGatewayCommand(MDB_CMD_EXPANSION, d, len);

    switch (d[0]) {
        case MDB_GW_EXP_IDENTIFICATION: {
            uint8_t response[34];
            memset(response, ' ', sizeof(response));
            response[0] = 0x06;
            memcpy(&response[1], "SFT", 3);
            String serial = macAddress;
            serial.replace(":", "");
            while (serial.length() < 12) serial += "0";
            serial = serial.substring(0, 12);
            memcpy(&response[4], serial.c_str(), 12);
            const char* model = "CC-GATEWAY  ";
            memcpy(&response[16], model, 12);
            response[28] = 0x00;
            response[29] = 0x01;
            const uint32_t features = gatewaySupportedFeatures();
            response[30] = (uint8_t)((features >> 24) & 0xFF);
            response[31] = (uint8_t)((features >> 16) & 0xFF);
            response[32] = (uint8_t)((features >> 8) & 0xFF);
            response[33] = (uint8_t)(features & 0xFF);
            mdbSendData(response, sizeof(response));
            break;
        }
        case MDB_GW_EXP_FEATURE_ENABLE: {
            if (len >= 5) {
                mdbGatewayRuntime.enabledFeatures =
                    ((uint32_t)d[1] << 24) | ((uint32_t)d[2] << 16) | ((uint32_t)d[3] << 8) | (uint32_t)d[4];
                mdbGatewaySnapshot.enabledFeatures = mdbGatewayRuntime.enabledFeatures;
            }
            mdbSendACK();
            break;
        }
        case MDB_GW_EXP_TIME_DATE_REQUEST: {
            uint8_t response[11];
            const char* timeSource = nullptr;
            if ((mdbGatewayRuntime.enabledFeatures & MDB_GW_FEATURE_TIME_DATE) == 0) {
                mdbSendNAK();
                break;
            }
            if (!buildGatewayTimeDateResponse(response, sizeof(response), &timeSource)) {
                mdbSendNAK();
                break;
            }
            logDiagEvent(
                EVT_MDB_GATEWAY_TIME_DATE_REQUEST,
                (int16_t)((mdbGatewaySnapshot.timeDateHour << 8) | mdbGatewaySnapshot.timeDateMinute),
                ((uint32_t)mdbGatewaySnapshot.timeDateYear << 24)
                    | ((uint32_t)mdbGatewaySnapshot.timeDateMonth << 16)
                    | ((uint32_t)mdbGatewaySnapshot.timeDateDay << 8)
                    | (uint32_t)mdbGatewaySnapshot.timeDateSecond
            );
            MDB_LOG_EVENT("[MDB-GW] TIME/DATE respondido desde %s\n", timeSource ? timeSource : "unknown");
            mdbSendData(response, sizeof(response));
            break;
        }
        default:
            mdbSendACK();
            break;
    }
}

void cmdSetup(uint8_t* d, uint8_t len) {
    if (len == 0) { mdbSendNAK(); return; }
    captureMdbSetup(d, len);
    if (DEBUG_MDB_TRACE) {
        MDB_LOG_TRACE("[MDB] VMC SETUP data: len=%d", len);
        for (int i = 0; i < len; i++) MDB_LOG_TRACE(" %02X", d[i]);
        MDB_LOG_TRACELN("");
    }
    if (d[0] == SETUP_CONFIG) {
        MDB_LOG_EVENTLN("[MDB] SETUP config → MDB_DISABLED");
        uint8_t r[7];
        pricingBuildSetupConfigResponse(pricingConfig, r);
        mdbSendData(r, sizeof(r));
        mdbRuntime.phase = MDB_DISABLED;
    } else {
        mdbSendACK();
    }
}

void cmdExpansion(uint8_t* d, uint8_t len) {
    if (len == 0) { mdbSendNAK(); return; }
    captureMdbExpansion(d, len);

    if (d[0] == EXPANSION_REQUEST_ID) {
        MDB_LOG_EVENTLN("[MDB] EXPANSION REQUEST_ID");
        uint8_t r[30];
        memset(r, ' ', sizeof(r));
        r[0] = 0x09;  // Peripheral ID
        memcpy(&r[1], "SFT", 3);
        r[28] = 0x00;
        r[29] = 0x01;
        mdbSendData(r, sizeof(r));
        return;
    }

    mdbSendACK();
}

void cmdPoll() {
    if (mdbRuntime.endSessionPending) {
        mdbSendByte(MDB_END_SESSION);
        mdbRuntime.endSessionPending = false;
        mdbRuntime.phase = ENABLED;
        mdbRuntime.sessionUID = "";
        mdbRuntime.sessionItemId = 0;
        mdbRuntime.sessionAmount = currentConfiguredHumanPrice();
        mdbRuntime.vendAmount = currentConfiguredHumanPrice();
        mdbRuntime.vendApproved = false;
        mdbRuntime.vendDecisionSent = false;
        mdbRuntime.vendUsed = false;
        mdbRuntime.sessionIsOffline = false;
        mdbRuntime.sessionStartMs = 0;
        return;
    }

    switch (mdbRuntime.phase) {
        case INACTIVE:
            if (mdbRuntime.justReset) {
                mdbSendByte(MDB_JUST_RESET);
                mdbRuntime.justReset = false;
                mdbRuntime.phase = MDB_DISABLED;
            } else {
                mdbSendACK();
            }
            break;

        case MDB_DISABLED:
            mdbSendACK();
            break;

        case ENABLED:
            if (mdbTimeDateProbePending) {
                MDB_LOG_EVENTLN("[MDB] TIME/DATE REQUEST manual");
                mdbSendByte(MDB_TIME_DATE_REQUEST);
                logDiagEvent(EVT_MDB_TIME_DATE_REQUEST_SENT, 1, millis() - mdbTimeDateProbeRequestedAtMs);
                mdbTimeDateProbePending = false;
            } else {
                mdbSendACK();
            }
            break;

        case SESSION_IDLE:
            if (mdbRuntime.pendingSession) {
                uint16_t sessionFunds = currentConfiguredSessionFunds();
                MDB_LOG_EVENT("[MDB] BEGIN SESSION → funds=0x%04X\n", sessionFunds);
                logDiagEvent(EVT_MDB_BEGIN_SESSION, mdbRuntime.phase, sessionFunds);
                uint8_t r[3] = {MDB_BEGIN_SESSION,
                                (uint8_t)((sessionFunds >> 8) & 0xFF),
                                (uint8_t)( sessionFunds        & 0xFF)};
                mdbSendData(r, 3);
                mdbRuntime.pendingSession = false;
                mdbRuntime.vendDecisionSent = false;
                mdbRuntime.endSessionPending = false;
            } else {
                mdbSendACK();
            }
            break;

        case VEND_PENDING:
            if (!mdbRuntime.vendDecisionSent) {
                if (mdbRuntime.vendApproved) {
                    uint8_t r[3] = {MDB_VEND_APPROVED,
                                    (uint8_t)((mdbRuntime.vendAmount >> 8) & 0xFF),
                                    (uint8_t)( mdbRuntime.vendAmount        & 0xFF)};
                    mdbSendData(r, 3);
                    mdbRuntime.vendApproved = false;
                    mdbRuntime.vendDecisionSent = true;
                } else {
                    mdbSendByte(MDB_VEND_DENIED);
                    mdbRuntime.vendDecisionSent = true;
                    mdbRuntime.phase = ENABLED;
                    mdbRuntime.sessionUID = "";
                    mdbRuntime.sessionItemId = 0;
                    mdbRuntime.sessionAmount = currentConfiguredHumanPrice();
                    mdbRuntime.vendAmount = currentConfiguredHumanPrice();
                    mdbRuntime.sessionIsOffline = false;
                    mdbRuntime.sessionStartMs = 0;
                }
            } else {
                mdbSendACK();
            }
            break;
    }
}

void cmdVend(uint8_t* d, uint8_t len) {
    if (len == 0) { mdbSendNAK(); return; }

    switch (d[0]) {
        case VEND_REQUEST:
            if (len >= 5) {
                mdbRuntime.sessionAmount = ((uint16_t)d[1] << 8) | d[2];
                mdbRuntime.sessionItemId = ((uint16_t)d[3] << 8) | d[4];
                MDB_LOG_EVENT("[MDB] VEND_REQUEST — item #%d $%d centavos\n",
                              mdbRuntime.sessionItemId, mdbRuntime.sessionAmount);
                logDiagEvent(EVT_MDB_VEND_REQUEST, mdbRuntime.sessionItemId, mdbRuntime.sessionAmount);
                // Fix Bug 2: solo 1 dispensado por autorización NFC
                if (mdbRuntime.vendUsed) {
                    MDB_LOG_EVENTLN("[MDB] Denegado — ya se dispenso en esta sesion");
                    mdbRuntime.vendApproved = false;
                    mdbRuntime.vendDecisionSent = false;
                    mdbRuntime.phase = VEND_PENDING;
                } else {
                    mdbRuntime.vendApproved = true;
                    mdbRuntime.vendDecisionSent = false;
                    mdbRuntime.vendAmount = mdbRuntime.sessionAmount;
                    mdbRuntime.phase = VEND_PENDING;
                }
            }
            mdbSendACK();
            break;

        case VEND_SUCCESS:
            if (mdbRuntime.vendUsed) {
                MDB_LOG_EVENTLN("[MDB] VEND_SUCCESS duplicado — ignorado");
                mdbSendACK();
                break;
            }
            MDB_LOG_EVENTLN("[MDB] VEND_SUCCESS — venta confirmada");
            logDiagEvent(EVT_MDB_VEND_SUCCESS, mdbRuntime.sessionItemId, mdbRuntime.sessionAmount);
            notifyVendResult(mdbRuntime.sessionUID, mdbRuntime.sessionItemId, mdbRuntime.sessionAmount, true);
            mdbRuntime.vendUsed = true;  // Fix Bug 2
            mdbSendACK();
            mdbRuntime.phase = SESSION_IDLE;
            break;

        case VEND_FAILURE:
            MDB_LOG_EVENTLN("[MDB] VEND_FAILURE — venta fallida");
            logDiagEvent(EVT_MDB_VEND_FAILURE, mdbRuntime.sessionItemId, mdbRuntime.sessionAmount);
            notifyVendResult(mdbRuntime.sessionUID, mdbRuntime.sessionItemId, mdbRuntime.sessionAmount, false);
            ledTagRejectedPattern();
            mdbSendACK();
            mdbRuntime.phase = SESSION_IDLE;
            mdbRuntime.sessionUID = "";
            mdbRuntime.vendUsed = false;
            mdbRuntime.sessionIsOffline = false;
            break;

        case VEND_END:
            MDB_LOG_EVENTLN("[MDB] VEND_END — sesion cerrada");
            logDiagEvent(EVT_MDB_VEND_END, mdbRuntime.sessionItemId, mdbRuntime.sessionAmount);
            // Fix Bug 1: si no hubo dispensado, cancelar tap en backend
            if (mdbRuntime.sessionUID.length() > 0 && !mdbRuntime.vendUsed) {
                MDB_LOG_EVENT("[MDB] VEND_END sin dispensado — cancelando tap de %s\n",
                              mdbRuntime.sessionUID.c_str());
                notifyVendResult(mdbRuntime.sessionUID, 0, 0, false);
            }
            mdbSendACK();
            mdbRuntime.endSessionPending = true;
            mdbRuntime.phase = SESSION_IDLE;
            break;

        case VEND_CANCEL:
            MDB_LOG_EVENTLN("[MDB] VEND_CANCEL");
            mdbSendByte(MDB_CANCELLED);
            mdbRuntime.phase = SESSION_IDLE;
            break;

        default: mdbSendNAK();
    }
}

void cmdReader(uint8_t* d, uint8_t len) {
    if (len == 0) { mdbSendNAK(); return; }

    if (d[0] == READER_ENABLE) {
        MDB_LOG_EVENTLN("[MDB] READER ENABLE → ENABLED");
        mdbRuntime.phase = ENABLED;
    }
    if (d[0] == READER_DISABLE) {
        MDB_LOG_EVENTLN("[MDB] READER DISABLE → MDB_DISABLED");
        // Fix Bug 1: cancelar tap si había sesión sin dispensado
        if (mdbRuntime.sessionUID.length() > 0 && !mdbRuntime.vendUsed) {
            MDB_LOG_EVENT("[MDB] READER_DISABLE mid-session — cancelando tap de %s\n",
                          mdbRuntime.sessionUID.c_str());
            notifyVendResult(mdbRuntime.sessionUID, 0, 0, false);
        }
        mdbRuntime.phase = MDB_DISABLED;
        mdbRuntime.sessionUID = "";
        mdbRuntime.sessionItemId = 0;
        mdbRuntime.sessionAmount = currentConfiguredHumanPrice();
        mdbRuntime.vendAmount = currentConfiguredHumanPrice();
        mdbRuntime.vendUsed = false;
        mdbRuntime.vendDecisionSent = false;
        mdbRuntime.endSessionPending = false;
        mdbRuntime.pendingSession = false;
        mdbRuntime.sessionIsOffline = false;
        mdbRuntime.sessionStartMs = 0;
    }
    mdbSendACK();
}

void handleMDB() {
    uint16_t first = mdb.read(2);
    if (first == 0xFFFF) return;

    unsigned long t0 = micros();  // timing debug

    // Filtrar: procesar cashless y communications gateway
    if (!MDB9bit::isAddress(first)) return;
    uint8_t addr = MDB9bit::value(first);
    const uint8_t addrBase = addr & 0xF8;
    const bool isCashless = (addrBase == MDB_ADDR_CASHLESS);
    const bool isGateway = (addrBase == MDB_ADDR_GATEWAY);
    if (!isCashless && !isGateway) return;

    uint8_t cmd = addr & 0x07;

    // RESET no tiene sub-data relevante → ACK inmediato (sin readFrame)
    if (cmd == MDB_CMD_RESET) {
        // Drenar checksum byte que ya está en el ring buffer
        mdb.read(1);
        if (isGateway) cmdGatewayReset();
        else           cmdReset();
        unsigned long dt = micros() - t0;
        MDB_LOG_TIMING("[MDB] RESET → ACK inmediato dt=%luus\n", dt);
        return;
    }

    // Para otros comandos, leer el frame completo
    uint16_t dataBuf[16];
    uint8_t  dataLen = mdb.readFrame(dataBuf, 16, 1);

    uint8_t d[16];
    for (uint8_t i = 0; i < dataLen; i++) {
        d[i] = MDB9bit::value(dataBuf[i]);
    }

    // ── Responder al VMC (deadline ≤5ms) ──
    if (isGateway) {
        switch (cmd) {
            case MDB_CMD_SETUP:     cmdGatewaySetup(d, dataLen);     break;
            case MDB_CMD_POLL:      cmdGatewayPoll();                break;
            case MDB_CMD_VEND:      cmdGatewayReport(d, dataLen);    break;
            case MDB_CMD_READER:    cmdGatewayControl(d, dataLen);   break;
            case MDB_CMD_EXPANSION: cmdGatewayExpansion(d, dataLen); break;
            default: mdbSendNAK(); break;
        }
    } else {
        switch (cmd) {
            case MDB_CMD_SETUP:  cmdSetup(d, dataLen);  break;
            case MDB_CMD_POLL:   cmdPoll();             break;
            case MDB_CMD_VEND:   cmdVend(d, dataLen);   break;
            case MDB_CMD_READER: cmdReader(d, dataLen); break;
            case MDB_CMD_EXPANSION: cmdExpansion(d, dataLen); break;
            default: mdbSendNAK(); break;
        }
    }

    // ── Después de responder, loguear ──
    unsigned long dt = micros() - t0;
    MDB_LOG_TIMING("[MDB] cmd=%d dt=%luus\n", cmd, dt);
}


// ══════════════════════════════════════════════════════
//  SETUP
// ══════════════════════════════════════════════════════
void setup() {
    Serial.begin(115200);
    delay(100);
    diagEventLog.clear();
    esp_reset_reason_t resetReason = esp_reset_reason();
    logDiagEvent(EVT_BOOT, (int16_t)resetReason, 0);

    pinMode(PIN_LED, OUTPUT);
    ledWrite(false);
    pinMode(PIN_BOOT_BTN, INPUT_PULLUP);
    bootFeedbackPinsInit();
    bootFeedbackOff();
    ledBlink(3, 100);

    // MAC address (identificador único de la máquina)
    macAddress = WiFi.macAddress();
    macAddress.replace(":", "");

    Serial.println();
    Serial.println("====================================");
    Serial.println("  CoffeeControl Firmware v3");
    Serial.printf ("  MAC:  %s\n", macAddress.c_str());
    Serial.printf ("  Modo: %s\n", DEPLOYMENT_MODE);
    Serial.printf ("  Reset: %s\n", resetReasonLabel(resetReason));
    Serial.println("====================================");
    Serial.println();

    // Config local (WiFi/backend/precio) antes de exponer MDB
    readConfig();

    Serial.println("[CLOCK] Reloj principal: NTP");

    // LittleFS
    if (!LittleFS.begin(true)) {
        Serial.println("[FS] ERROR critico — LittleFS no pudo iniciar");
    } else {
        Serial.println("[FS] LittleFS OK");
        loadCards();
        loadQueue();
    }

    // SPI + RC522
    pinMode(PIN_RC522_SS, OUTPUT);
    digitalWrite(PIN_RC522_SS, HIGH);
    pinMode(PIN_RC522_RST, OUTPUT);
    digitalWrite(PIN_RC522_RST, LOW);
    delay(20);
    digitalWrite(PIN_RC522_RST, HIGH);
    delay(50);
    SPI.begin(PIN_SPI_SCK, PIN_SPI_MISO, PIN_SPI_MOSI, PIN_RC522_SS);
    byte ver = 0x00;
    for (int attempt = 1; attempt <= 3; ++attempt) {
        rfid.PCD_Init();
        delay(50);
        ver = rfid.PCD_ReadRegister(MFRC522::VersionReg);
        if (ver != 0x00 && ver != 0xFF) {
            break;
        }
        Serial.printf("[NFC] Intento %d fallido — VersionReg=0x%02X (RST=%d SS=%d, SPI=1MHz)\n",
                      attempt,
                      ver,
                      digitalRead(PIN_RC522_RST),
                      digitalRead(PIN_RC522_SS));
        delay(50);
    }
    if (ver == 0x00 || ver == 0xFF) {
        Serial.println("[NFC] ERROR — RC522 no responde");
        Serial.printf("[NFC]   SCK=GPIO%d  MOSI=GPIO%d  MISO=GPIO%d  SS=GPIO%d  RST=GPIO%d\n",
                      PIN_SPI_SCK,
                      PIN_SPI_MOSI,
                      PIN_SPI_MISO,
                      PIN_RC522_SS,
                      PIN_RC522_RST);
    } else {
        Serial.printf("[NFC] RC522 OK — chip: 0x%02X\n", ver);
    }

    // MDB 9-bit software serial
    mdb.begin();
    Serial.printf("[MDB] UART HW listo (TX=GPIO%d, RX=GPIO%d, tx_inv=%s)\n",
                  PIN_MDB_TX,
                  PIN_MDB_RX,
                  MDB_UART_TX_INVERT ? "on" : "off");

    // Arrancar tarea MDB independiente para responder al VMC durante boot
    mdbAsyncQueue = xQueueCreate(MDB_ASYNC_QUEUE_LEN, sizeof(MdbAsyncEvent));
    if (mdbAsyncQueue == nullptr) {
        Serial.println("[MDB] ERROR — no se pudo crear la cola async");
    }

    xTaskCreatePinnedToCore(
        mdbCommandTask,
        "mdb_cmd", 12288, NULL, 4, NULL, 1
    );
    Serial.println("[MDB] Tarea MDB command handler iniciada");

    // WiFi
    if (wifiSSID.length() == 0) {
        Serial.println("[BOOT] Sin red configurada → modo portal");
        startPortal();
    } else {
        if (!connectWiFi()) {
            Serial.println("[BOOT] Fallo WiFi → funcionando offline (reintento cada 30s)");
        } else {
            Serial.printf("[CFG] Backend: %s\n", backendBase.c_str());

            checkBackend();
            registerMachine();
            reconcileTaps();    // Fix Bug 4: revertir taps huérfanos al reiniciar
            flushQueue();       // Enviar eventos offline pendientes
            downloadCards();    // Descargar cache de tarjetas para modo offline

        }
    }

    initWatchdog();
    Serial.println("[BOOT] Sistema listo\n");
}


// ══════════════════════════════════════════════════════
//  LOOP
// ══════════════════════════════════════════════════════
void loop() {
    handleResetButtonRuntime();

    if (portalMode) {
        feedWatchdog();
        dnsServer.processNextRequest();
        portalServer.handleClient();
        updateStatusLed();
        return;
    }

    // Modo normal: NFC (MDB ahora corre en tarea independiente)
    handleNFC();

    // ── Reconexión WiFi cada 30s ──────────────────────
    static unsigned long lastWifiCheck = 0;
    if (millis() - lastWifiCheck > 30000) {
        lastWifiCheck = millis();
        bool nowConnected = (WiFi.status() == WL_CONNECTED);

        if (!nowConnected) {
            wifiReady = false;
            Serial.println("[WiFi] Reconectando...");
            WiFi.reconnect();
        } else if (!wifiReady) {
            // Reconectado: vaciar cola y refrescar cards
            wifiReady = true;
            Serial.println("[WiFi] Reconectado");
            logDiagEvent(EVT_WIFI_RECONNECTED, WiFi.RSSI(), WiFi.localIP());
            checkBackend();
            registerMachine();
            flushQueue();
            downloadCards();
        }
    }

    // ── Refresh de tarjetas cada 10 minutos ──────────
    static unsigned long lastCardsRefresh = 0;
    if (wifiReady && millis() - lastCardsRefresh > 600000) {
        lastCardsRefresh = millis();
        downloadCards();
    }

    // ── Poll de comandos remotos cada 5s o inmediatamente tras reconectar/registrar ──
    if ((remoteCommandPollRequested || (millis() - lastCommandPollMs > COMMAND_POLL_MS))
        && WiFi.status() == WL_CONNECTED
        && canProcessRemoteCommand()) {
        remoteCommandPollRequested = false;
        lastCommandPollMs = millis();
        pollRemoteCommands();
    }

    // ── Reset de contadores al detectar día nuevo ─────
    static unsigned long lastMidnightCheck = 0;
    if (millis() - lastMidnightCheck > 60000) {
        lastMidnightCheck = millis();
        checkMidnightReset();
    }

    // ── Guardar cards si hay cambios offline ──────────
    static unsigned long lastSaveCheck = 0;
    if (cardsDirty && millis() - lastSaveCheck > 5000) {
        lastSaveCheck = millis();
        saveCards();
    }

    // ── Heartbeat cada 60s ────────────────────────────
    static unsigned long lastHeartbeat = 0;
    if (millis() - lastHeartbeat > 60000) {
        lastHeartbeat = millis();
        checkBackend();   // re-verificar backend en cada heartbeat
        registerMachine();  // actualiza last_seen y telemetría de red
        const char* stStr[] = {"INACTIVE","MDB_DISABLED","ENABLED","SESSION_IDLE","VEND_PENDING"};
        const char* clockSource = "UPTIME";
        struct tm timeinfo;
        if (getLocalTime(&timeinfo)) clockSource = "NTP";
        else if (mdbMachineTimeValid) clockSource = "MDB";
        Serial.printf("[STATUS] WiFi:%s | Backend:%s | MDB:%s | Cards:%d | Queue:%d | Clock:%s\n",
                     WiFi.status() == WL_CONNECTED ? "OK" : "DESCONECTADO",
                      backendReady ? "OK" : "OFFLINE",
                      stStr[mdbRuntime.phase], cardCount, queueLen,
                      clockSource);
    }

    updateStatusLed();
    feedWatchdog();
    yield();
}
