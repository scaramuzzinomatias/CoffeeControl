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
 *   - DS3231 RTC para reset de medianoche (I²C GPIO5/6), fallback NTP
 *   - MDB 9-bit por software (IRAM_ATTR, GPIO20/21)
 *     Nota: el ESP32-C3 NO soporta 9-bit en UART hardware (registro
 *     bit_num tiene solo 2 bits → máx. 8 bits de dato). El bit-banging
 *     con IRAM_ATTR es la única opción y funciona perfectamente.
 * ─────────────────────────────────────────────────────
 * Pines ESP32-C3 Super Mini — pinout definitivo:
 *   GPIO0  = SPI SCK  (RC522)
 *   GPIO1  = SPI MOSI (RC522)
 *   GPIO3  = SPI MISO (RC522)   ← NO usar GPIO2: strapping pin
 *   GPIO4  = RC522 SS  (CS)
 *   GPIO7  = RC522 RST
 *   GPIO5  = I²C SDA (DS3231)   ← pines recomendados por datasheet
 *   GPIO6  = I²C SCL (DS3231)   ← Wire.begin(5, 6)
 *   GPIO10 = LED externo (activo HIGH)
 *   GPIO9  = BOOT button (pull-up interno, LOW = presionado, abre portal en runtime)
 *   GPIO20 = MDB TX (bit-banging, salida al bus)
 *   GPIO21 = MDB RX (bit-banging, entrada del bus)
 *
 * Pines que NO conectar nada:
 *   GPIO2  = strapping (debe estar HIGH al boot)
 *   GPIO8  = LED onboard azul + strapping (usar solo post-boot, debe estar HIGH al boot)
 *   GPIO18/19 = USB D-/D+ (programación)
 */

#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <WebServer.h>
#include <DNSServer.h>
#include <Preferences.h>
#include <SPI.h>
#include <Wire.h>
#include <MFRC522.h>
#include <LittleFS.h>
#include <ArduinoJson.h>
#include <RTClib.h>
#include "MDB9bit.h"

// ── Pines ─────────────────────────────────────────────
#define PIN_SPI_SCK    0
#define PIN_SPI_MOSI   1
#define PIN_SPI_MISO   3   // GPIO2 es strapping pin → usar GPIO3
#define PIN_RC522_SS   4
#define PIN_RC522_RST  7
#define PIN_I2C_SDA    5   // pines recomendados por referencia oficial
#define PIN_I2C_SCL    6
#define PIN_LED       10
#define PIN_LED_ONBOARD 8   // LED onboard azul del Super Mini (activo LOW, usar solo post-boot)
#define PIN_BOOT_BTN   9   // BOOT button: pull-up interno, LOW = presionado
#define PIN_MDB_TX    20   // GPIO20/21: UART0 nativo (no hay beneficio de HW
#define PIN_MDB_RX    21   // para MDB 9-bit — ESP32-C3 max 8-bit en hardware)

// ── Modo de deployment ────────────────────────────────
// Opción B — servidor local (URL configurable en el portal)
#define DEPLOYMENT_MODE       "local"
#define BACKEND_URL           "http://192.168.1.50:3000"   // fallback si campo vacío
#define REGISTRATION_SECRET   "coffeecontrol-registro-2024"

// ── Portal WiFi cautivo ───────────────────────────────
#define AP_SSID        "CoffeeControl-Setup"
#define AP_IP_STR      "192.168.4.1"
#define DNS_PORT       53
#define PORTAL_BUTTON_HOLD_MS  5000   // mantener 5s → abrir portal sin borrar config

// ── MDB constantes ────────────────────────────────────
#define MDB_ADDR_CASHLESS  0x10
#define MDB_CMD_RESET      0x00
#define MDB_CMD_SETUP      0x01
#define MDB_CMD_POLL       0x02
#define MDB_CMD_VEND       0x03
#define MDB_CMD_READER     0x04
#define SETUP_CONFIG       0x00
#define SETUP_PRICES       0x01
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
#define FUNDS_UNLIMITED    0xFFFF

// ── Timing ────────────────────────────────────────────
#define NFC_COOLDOWN_MS    2500
#define HTTP_TIMEOUT_MS    4000
#define SESSION_TIMEOUT_MS 12000
#define COMMAND_POLL_MS    15000

// ── Offline ───────────────────────────────────────────
#define MAX_CARDS          1500   // límite práctico (~100KB ArduinoJson doc)
#define MAX_QUEUE          1000
#define CARDS_PATH         "/cards.json"
#define QUEUE_PATH         "/queue.json"

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

struct __attribute__((packed)) QueueEntry {
    char     uid[9];
    uint16_t item_id;
    uint16_t amount;
    bool     vend_success;
    uint32_t ts;       // Unix timestamp
};

// ── Objetos globales ──────────────────────────────────
MFRC522     rfid(PIN_RC522_SS, PIN_RC522_RST);
MDB9bit     mdb(PIN_MDB_TX, PIN_MDB_RX);
WebServer   portalServer(80);
DNSServer   dnsServer;
RTC_DS3231  rtc;
Preferences prefs;

// ── Estado MDB ────────────────────────────────────────
MDBState mdbState      = INACTIVE;
bool     justReset     = true;
bool     pendingSession = false;
bool     vendApproved  = false;
uint16_t vendAmount    = 0;
String   sessionUID    = "";
uint16_t sessionItemId = 0;
uint16_t sessionAmount = 0;
bool     vendUsed      = false;
bool     sessionIsOffline = false;
unsigned long lastNFCRead    = 0;
unsigned long sessionStartMs = 0;

// ── WiFi / backend ────────────────────────────────────
String wifiSSID    = "";
String wifiPass    = "";
String backendBase = BACKEND_URL;
String macAddress  = "";
String backendLastError = "";
bool   portalMode    = false;
bool   wifiReady     = false;
bool   backendReady  = false;   // true si /health respondio OK
bool   rtcAvailable  = false;

// ── Offline: cache de tarjetas ────────────────────────
CardEntry cards[MAX_CARDS];
int       cardCount  = 0;
bool      cardsDirty = false;
char      savedDate[11] = "";   // "YYYY-MM-DD" para detectar cambio de día
uint32_t  nextResetTs = 0;      // Unix timestamp UTC del próximo reset de contadores

// ── Offline: cola de eventos ──────────────────────────
QueueEntry queueBuf[MAX_QUEUE];
int        queueLen = 0;


// ══════════════════════════════════════════════════════
//  HELPERS LED (activo HIGH)
// ══════════════════════════════════════════════════════
void ledBlink(int n, int ms) {
    for (int i = 0; i < n; i++) {
        digitalWrite(PIN_LED, HIGH); delay(ms);
        digitalWrite(PIN_LED, LOW);  delay(ms);
    }
}
void ledToggle() { digitalWrite(PIN_LED, !digitalRead(PIN_LED)); }

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

void startPortal();

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
    prefs.begin("cc", true);  // namespace "cc", read-only
    wifiSSID = prefs.getString("ssid", "");
    wifiPass = prefs.getString("pass", "");
    String url = normalizeBackendUrl(prefs.getString("url", ""));
    prefs.end();
    if (url.length() > 0) {
        backendBase = url;
    }
    Serial.printf("[CFG] SSID guardada:   %s\n", wifiSSID.c_str());
    Serial.printf("[CFG] Backend guardado: %s\n", backendBase.c_str());
}

void saveConfig(const String& ssid, const String& pass, const String& url) {
    prefs.begin("cc", false);  // read-write
    prefs.putString("ssid", ssid);
    prefs.putString("pass", pass);
    String urlNorm = normalizeBackendUrl(url);
    prefs.putString("url", urlNorm.length() > 0 ? urlNorm : String(BACKEND_URL));
    prefs.end();
    Serial.printf("[CFG] Config guardada — SSID: %s\n", ssid.c_str());
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

bool fillDateFromRtcOrNtp(char* out, size_t outSize) {
    if (rtcAvailable) {
        DateTime now = rtc.now();
        snprintf(out, outSize, "%04d-%02d-%02d",
                 now.year(), now.month(), now.day());
        return true;
    }

    struct tm timeinfo;
    if (!getLocalTime(&timeinfo)) return false;
    snprintf(out, outSize, "%04d-%02d-%02d",
             1900 + timeinfo.tm_year, timeinfo.tm_mon + 1, timeinfo.tm_mday);
    return true;
}

bool advanceDateByOneDay(const char* currentDate, char* out, size_t outSize) {
    int year = 0;
    int month = 0;
    int day = 0;
    if (sscanf(currentDate, "%d-%d-%d", &year, &month, &day) != 3) return false;
    DateTime current(year, month, day, 0, 0, 0);
    DateTime next = current + TimeSpan(1, 0, 0, 0);
    snprintf(out, outSize, "%04d-%02d-%02d", next.year(), next.month(), next.day());
    return true;
}


// ══════════════════════════════════════════════════════
//  LITTLEFS — queue.json
// ══════════════════════════════════════════════════════
void loadQueue() {
    if (!LittleFS.exists(QUEUE_PATH)) { queueLen = 0; return; }
    File f = LittleFS.open(QUEUE_PATH, "r");
    if (!f) return;

    DynamicJsonDocument doc(80000);
    if (deserializeJson(doc, f) != DeserializationError::Ok) {
        f.close(); queueLen = 0; return;
    }
    f.close();

    JsonArray arr = doc.as<JsonArray>();
    queueLen = 0;
    for (JsonObject e : arr) {
        if (queueLen >= MAX_QUEUE) break;
        strlcpy(queueBuf[queueLen].uid, e["uid"] | "", sizeof(queueBuf[0].uid));
        queueBuf[queueLen].item_id      = (uint16_t)(e["item_id"] | 0);
        queueBuf[queueLen].amount       = (uint16_t)(e["amount"]  | 0);
        queueBuf[queueLen].vend_success = (bool)(e["ok"] | false);
        queueBuf[queueLen].ts           = (uint32_t)(e["ts"] | 0);
        queueLen++;
    }
    Serial.printf("[QUEUE] Cola cargada: %d eventos pendientes\n", queueLen);
}

void saveQueue() {
    if (queueLen == 0) {
        LittleFS.remove(QUEUE_PATH);
        return;
    }
    File f = LittleFS.open(QUEUE_PATH, "w");
    if (!f) return;

    f.print("[");
    for (int i = 0; i < queueLen; i++) {
        if (i > 0) f.print(",");
        f.printf("{\"uid\":\"%s\",\"item_id\":%d,\"amount\":%d,\"ok\":%s,\"ts\":%lu}",
                 queueBuf[i].uid,
                 queueBuf[i].item_id,
                 queueBuf[i].amount,
                 queueBuf[i].vend_success ? "true" : "false",
                 (unsigned long)queueBuf[i].ts);
    }
    f.print("]");
    f.close();
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
    if (rtcAvailable) {
        return rtc.now().unixtime();
    }
    struct tm timeinfo;
    if (getLocalTime(&timeinfo)) {
        return (uint32_t)mktime(&timeinfo);
    }
    return (uint32_t)(millis() / 1000);  // fallback: uptime
}

void enqueueEvent(const String& uid, uint16_t itemId, uint16_t amount, bool ok) {
    if (queueLen >= MAX_QUEUE) {
        Serial.println("[QUEUE] ADVERTENCIA — cola llena, evento descartado");
        return;
    }
    strlcpy(queueBuf[queueLen].uid, uid.c_str(), sizeof(queueBuf[0].uid));
    queueBuf[queueLen].item_id      = itemId;
    queueBuf[queueLen].amount       = amount;
    queueBuf[queueLen].vend_success = ok;
    queueBuf[queueLen].ts           = getCurrentTs();
    queueLen++;

    saveQueue();  // Persistir inmediatamente por si hay corte de energía
    Serial.printf("[QUEUE] Encolado — uid:%s ok:%d total:%d\n", uid.c_str(), ok, queueLen);
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

        WiFiClient client;
        HTTPClient http;
        if (!http.begin(client, backendBase + "/api/tap/queue")) break;

        http.addHeader("Content-Type", "application/json");
        http.addHeader("X-Machine-Mac", macAddress);
        http.setTimeout(HTTP_TIMEOUT_MS * 3);

        int code = http.POST(body);
        http.end();

        if (code == 200 || code == 204) {
            sent = end;
        } else {
            Serial.printf("[QUEUE] Error HTTP %d — abortando flush\n", code);
            break;
        }
    }

    if (sent > 0) {
        int remaining = queueLen - sent;
        for (int i = 0; i < remaining; i++) queueBuf[i] = queueBuf[sent + i];
        queueLen = remaining;
        saveQueue();
        Serial.printf("[QUEUE] Flush OK: %d enviados, %d pendientes\n", sent, remaining);
    }
}


// ══════════════════════════════════════════════════════
//  OFFLINE: descargar cache de tarjetas del backend
// ══════════════════════════════════════════════════════
void downloadCards() {
    if (WiFi.status() != WL_CONNECTED) return;

    WiFiClient client;
    HTTPClient http;
    if (!http.begin(client, backendBase + "/api/tap/cards")) return;

    http.addHeader("X-Machine-Mac", macAddress);
    http.setTimeout(HTTP_TIMEOUT_MS * 3);

    int code = http.GET();
    if (code != 200) {
        Serial.printf("[CARDS] Error descarga HTTP %d\n", code);
        http.end();
        return;
    }

    // Parsear directo desde el stream (no se almacena el payload completo en String)
    DynamicJsonDocument doc(100000);
    DeserializationError err = deserializeJson(doc, client);
    http.end();

    if (err) {
        Serial.printf("[CARDS] Error JSON descarga: %s\n", err.c_str());
        return;
    }

    JsonArray arr;
    if (doc["cards"].is<JsonArray>()) {
        strlcpy(savedDate, doc["date"] | "", sizeof(savedDate));
        nextResetTs = (uint32_t)(doc["next_reset_at"] | 0);
        arr = doc["cards"].as<JsonArray>();
    } else {
        fillDateFromRtcOrNtp(savedDate, sizeof(savedDate));
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

        Serial.printf("[RTC] Nuevo dia operativo — reseteando contadores (fecha=%s)\n", savedDate);
        for (int i = 0; i < cardCount; i++) cards[i].used = 0;
        cardsDirty = true;
        return;
    }

    char today[11] = "";
    if (!fillDateFromRtcOrNtp(today, sizeof(today))) return;
    if (strlen(savedDate) == 0 || strcmp(today, savedDate) == 0) return;

    Serial.printf("[RTC] Nuevo dia local: %s → %s — reseteando contadores\n", savedDate, today);
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
    HTTPClient http;
    bool backendOk = false;
    int code = -1;

    if (http.begin(client, healthUrl)) {
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

String buildPortalHTML() {
    String ssidValue = htmlEscape(wifiSSID);
    String passValue = htmlEscape(wifiPass);
    String urlValue = htmlEscape(backendBase);
    String html = F("<!DOCTYPE html><html lang='es'>"
        "<head><meta charset='UTF-8'><meta name='viewport' content='width=device-width,initial-scale=1'>"
        "<title>CoffeeControl</title>"
        "<style>"
        ":root{--bg:#FCFCFA;--bg2:#F5F7FA;--panel:#FFFFFF;--tx:#243241;--tx2:#5D6C79;--tx3:#7B8792;--br:#D6DFE7;--brm:#C5CFD8;--pri:#185FA5;--pri2:#114A82;--soft:#E8F1FB;--ok:#E8F3E2;--oktx:#315C1D;--err:#F9E6E5;--errtx:#8A2A2A;--shadow:0 18px 44px rgba(17,74,130,.16);}"
        "*{box-sizing:border-box;margin:0;padding:0;}"
        "body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:radial-gradient(circle at top left,#F7FAFD 0,#F7FAFD 34%,#EEF3F8 100%);color:var(--tx);min-height:100vh;padding:22px;}"
        ".shell{width:100%;max-width:440px;margin:0 auto;}"
        ".hero{background:linear-gradient(135deg,#FFFFFF 0,#F5F8FB 100%);border:1px solid rgba(24,95,165,.12);border-radius:22px;padding:20px 20px 16px;box-shadow:var(--shadow);margin-bottom:14px;}"
        ".hero-top{display:flex;flex-direction:column;align-items:center;gap:14px;text-align:center;}"
        ".brand-lockup{width:100%;display:flex;justify-content:center;}"
        ".brand-svg{display:block;width:100%;max-width:380px;height:auto;}"
        ".eyebrow{font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--pri);font-weight:700;margin-bottom:4px;}"
        "h1{font-size:24px;line-height:1.05;font-weight:650;margin-bottom:5px;}"
        ".sub{font-size:13px;color:var(--tx2);line-height:1.45;}"
        ".hero-note{margin-top:10px;background:var(--soft);color:var(--pri2);border-radius:14px;padding:12px 14px;font-size:12px;line-height:1.45;border:1px solid rgba(24,95,165,.08);}"
        ".card{background:var(--panel);border:1px solid var(--br);border-radius:22px;padding:22px 20px;box-shadow:var(--shadow);}"
        ".section{margin-bottom:18px;}"
        ".section:last-of-type{margin-bottom:16px;}"
        ".section-title{font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--tx3);margin-bottom:10px;}"
        "label{font-size:12px;color:var(--tx2);display:block;margin-bottom:5px;font-weight:600;}"
        "input{width:100%;border:1px solid var(--brm);border-radius:12px;padding:11px 12px;font-size:14px;color:var(--tx);background:var(--bg);margin-bottom:12px;}"
        "input:focus{outline:2px solid rgba(24,95,165,.18);border-color:var(--pri);}"
        ".hint{font-size:11px;color:var(--tx3);margin-top:-6px;margin-bottom:12px;line-height:1.45;}"
        ".pw-row{display:flex;align-items:center;gap:7px;margin-top:-4px;margin-bottom:12px;font-size:12px;color:var(--tx2);}"
        ".pw-row input{width:auto;margin:0;padding:0;accent-color:var(--pri);}"
        ".ghost{width:100%;padding:11px 12px;background:var(--bg2);color:var(--tx);border:1px solid var(--brm);border-radius:12px;font-size:13px;font-weight:600;cursor:pointer;margin-bottom:10px;}"
        ".ghost:disabled{opacity:.68;cursor:wait;}"
        ".scan-status{display:none;font-size:12px;color:var(--tx2);background:var(--bg2);border-radius:12px;padding:10px 12px;margin-bottom:10px;line-height:1.45;border:1px solid var(--br);}"
        ".selected-net{display:none;align-items:flex-start;gap:10px;background:var(--soft);border:1px solid rgba(24,95,165,.14);border-radius:14px;padding:12px 13px;margin-bottom:10px;}"
        ".selected-dot{width:10px;height:10px;border-radius:50%;background:var(--pri);margin-top:5px;flex-shrink:0;box-shadow:0 0 0 4px rgba(24,95,165,.12);}"
        ".selected-kicker{font-size:11px;color:var(--pri2);text-transform:uppercase;letter-spacing:.08em;font-weight:700;}"
        ".selected-name{font-size:14px;font-weight:700;color:var(--tx);margin-top:3px;word-break:break-word;}"
        ".scan-list{display:none;max-height:220px;overflow:auto;margin-bottom:12px;padding-right:2px;}"
        ".net-btn{width:100%;text-align:left;padding:12px 13px;background:#fff;color:var(--tx);border:1px solid var(--br);border-radius:14px;font-size:13px;cursor:pointer;margin-bottom:8px;transition:transform .12s ease,border-color .12s ease,box-shadow .12s ease,background .12s ease;}"
        ".net-btn strong{display:block;font-size:13px;font-weight:700;}"
        ".net-meta{display:block;font-size:11px;color:var(--tx3);margin-top:4px;}"
        ".net-btn.is-active{border-color:var(--pri);background:var(--soft);box-shadow:0 0 0 3px rgba(24,95,165,.1);transform:translateY(-1px);}"
        ".status{display:none;font-size:12px;color:var(--pri2);background:var(--soft);border-radius:14px;padding:11px 12px;margin-bottom:12px;line-height:1.45;border:1px solid rgba(24,95,165,.1);}"
        ".info{font-size:11px;color:var(--tx3);margin-bottom:16px;padding:10px 12px;background:var(--bg2);border-radius:12px;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;border:1px solid var(--br);line-height:1.45;}"
        ".actions{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:6px;}"
        "button{width:100%;padding:12px 13px;background:var(--pri);color:#fff;border:none;border-radius:12px;font-size:14px;font-weight:650;cursor:pointer;}"
        ".ok{display:none;background:var(--ok);color:var(--oktx);border-radius:14px;padding:12px 13px;font-size:13px;text-align:center;margin-top:14px;line-height:1.45;}"
        ".err{display:none;background:var(--err);color:var(--errtx);border-radius:14px;padding:11px 12px;font-size:13px;margin-bottom:12px;line-height:1.45;}"
        "@media(max-width:420px){body{padding:16px;}.hero,.card{border-radius:18px;padding:18px 16px;}.actions{grid-template-columns:1fr;}}"
        "</style></head>"
        "<body><div class='shell'>"
        "<div class='hero'>"
        "<div class='hero-top'>"
        "<div class='brand-lockup'>"
        "<svg class='brand-svg' width='1200' height='430' viewBox='0 0 1200 430' xmlns='http://www.w3.org/2000/svg' aria-label='SmartQ CoffeeControl'>"
        "<g transform='translate(50,60)'>"
        "<rect x='0' y='0' width='200' height='200' rx='50' fill='#1da1d8'/>"
        "<text x='100' y='110' text-anchor='middle' dominant-baseline='middle' font-family='Arial, sans-serif' font-size='120' font-weight='bold' fill='white'>Q</text>"
        "</g>"
        "<text x='300' y='172' font-family='Arial, sans-serif' font-size='110' fill='#3a3f45'>Smart<tspan fill='#1da1d8'>Q</tspan></text>"
        "<line x1='300' y1='202' x2='950' y2='202' stroke='#1da1d8' stroke-width='4'/>"
        "<text x='300' y='262' font-family='Arial, sans-serif' font-size='50' fill='#6b6f75'>Vending m&#225;s inteligente</text>"
        "<text x='50' y='340' font-family='Arial, sans-serif' font-size='32' font-weight='bold' fill='#1da1d8' letter-spacing='3'>PORTAL DE INSTALACI&#211;N</text>"
        "<text x='50' y='398' font-family='Arial, sans-serif' font-size='68' font-weight='bold' fill='#243241'>CoffeeControl</text>"
        "</svg>"
        "</div>"
        "</div>"
        "<div class='hero-note'>Podes escanear redes visibles, validar la conexion antes de guardar y volver a este portal con BOOT sin borrar la configuracion actual.</div>"
        "</div>"
        "<div class='card'>"
        "<div class='err' id='err'></div>"
        "<div class='status' id='status'></div>"
        "<form id='f'>"
        "<div class='section'>"
        "<div class='section-title'>Conexion WiFi</div>"
        "<label>Red WiFi (SSID) *</label>"
        "<input type='text' name='ssid' id='ssidInput' placeholder='NombreDeLaRed' required autocomplete='off' value='");
    html += ssidValue;
    html += F("'>"
        "<div class='hint'>Podes escribir el SSID manualmente o elegir una red detectada.</div>"
        "<button type='button' class='ghost' id='scanBtn'>Escanear redes</button>"
        "<div class='scan-status' id='scanStatus'></div>"
        "<div class='selected-net' id='selectedNet'><div class='selected-dot'></div><div><div class='selected-kicker' id='selectedNetMode'>Red lista para guardar</div><div class='selected-name' id='selectedNetName'></div></div></div>"
        "<div class='scan-list' id='scanList'></div>"
        "<label>Contrasena WiFi</label>"
        "<input type='password' name='pass' id='wifiPass' autocomplete='off' value='");
    html += passValue;
    html += F("'>"
        "<label class='pw-row'><input type='checkbox' id='showPass'><span>Mostrar contrasena</span></label>"
        "<div class='hint'>Las credenciales guardadas no se borran hasta que guardes nuevos cambios.</div>"
        "</div>");

    if (String(DEPLOYMENT_MODE) != "saas") {
        html += F("<div class='section'>"
                  "<div class='section-title'>Servidor</div>"
                  "<label>URL del servidor *</label>"
                  "<input type='text' name='url' placeholder='http://192.168.1.50:3000' required autocomplete='off' value='");
        html += urlValue;
        html += F("'>"
                  "<div class='hint'>Usa la direccion del backend donde corre CoffeeControl.</div>"
                  "</div>");
    }

    html += F("<div class='info' id='mac'>Cargando ID...</div>"
              "<div class='actions'>"
              "<button type='button' class='ghost' id='testBtn'>Probar conexion</button>"
              "<button type='submit' id='saveBtn'>Guardar y conectar</button>"
              "</div>"
              "</form>"
              "<div class='ok' id='ok'>Listo. La maquina se conectara en unos segundos y aparecera en el panel de administracion.</div>"
              "</div>"
              "</div>"
              "<script>"
              "fetch('/info').then(r=>r.json()).then(d=>{"
              "  document.getElementById('mac').textContent='ID: '+d.mac+' | FW: '+d.fw+' | Modo: '+d.mode;"
              "});"
              "const ssidInput=document.getElementById('ssidInput');"
              "const scanBtn=document.getElementById('scanBtn');"
              "const scanStatus=document.getElementById('scanStatus');"
              "const scanList=document.getElementById('scanList');"
              "const selectedNet=document.getElementById('selectedNet');"
              "const selectedNetMode=document.getElementById('selectedNetMode');"
              "const selectedNetName=document.getElementById('selectedNetName');"
              "const form=document.getElementById('f');"
              "const errBox=document.getElementById('err');"
              "const okBox=document.getElementById('ok');"
              "const statusBox=document.getElementById('status');"
              "const testBtn=document.getElementById('testBtn');"
              "const saveBtn=document.getElementById('saveBtn');"
              "const urlInput=form.querySelector('[name=url]');"
              "let selectedSSID='';"
              "function clearAlerts(){errBox.style.display='none';okBox.style.display='none';}"
              "function showError(text){statusBox.style.display='none';okBox.style.display='none';errBox.textContent=text;errBox.style.display='block';}"
              "function showOk(text){errBox.style.display='none';statusBox.style.display='none';okBox.textContent=text;okBox.style.display='block';}"
              "function showStatus(text){errBox.style.display='none';statusBox.textContent=text;statusBox.style.display='block';}"
              "function setBusy(mode){const busy=!!mode;scanBtn.disabled=busy;testBtn.disabled=busy;saveBtn.disabled=busy;scanBtn.textContent=mode==='scan'?'Escaneando...':'Escanear redes';testBtn.textContent=mode==='test'?'Probando...':'Probar conexion';saveBtn.textContent=mode==='save'?'Guardando...':'Guardar y conectar';}"
              "function readForm(){const d=new FormData(form);const ssid=(d.get('ssid')||'').trim();const pass=d.get('pass')||'';const url=urlInput?(d.get('url')||'').trim():'';return {ssid,pass,url};}"
              "function validateForm(){const data=readForm();if(!data.ssid){showError('El SSID es requerido.');return null;}if(urlInput&&!data.url){showError('La URL del servidor es requerida.');return null;}if(urlInput&&!/^https?:\\/\\//i.test(data.url)){showError('La URL debe comenzar con http:// o https://.');return null;}return data;}"
              "function showScanStatus(text){scanStatus.textContent=text;scanStatus.style.display='block';}"
              "function markSelectedButton(){scanList.querySelectorAll('.net-btn').forEach(btn=>{btn.classList.toggle('is-active',selectedSSID&&btn.dataset.ssid===selectedSSID);});}"
              "function updateSelectedNet(ssid,modeText){if(!ssid){selectedNet.style.display='none';selectedNetName.textContent='';return;}selectedNet.style.display='flex';selectedNetMode.textContent=modeText;selectedNetName.textContent=ssid;}"
              "function syncTypedSSID(){const current=ssidInput.value.trim();if(!current){selectedSSID='';markSelectedButton();updateSelectedNet('','');return;}if(current!==selectedSSID){selectedSSID='';markSelectedButton();updateSelectedNet(current,'SSID manual listo para guardar');}}"
              "function renderNetworks(items){scanList.innerHTML='';if(!items.length){scanList.style.display='none';showScanStatus('No se encontraron redes visibles. Podes cargar el SSID manualmente.');syncTypedSSID();return;}showScanStatus('Toca una red para seleccionarla claramente o escribe una red oculta manualmente.');scanList.style.display='block';items.forEach(net=>{const btn=document.createElement('button');btn.type='button';btn.className='net-btn';btn.dataset.ssid=net.ssid;const name=document.createElement('strong');name.textContent=net.ssid;const meta=document.createElement('span');meta.className='net-meta';meta.textContent=(net.secure?'Contrasena requerida':'Red abierta')+' | Senal '+net.rssi+' dBm';btn.appendChild(name);btn.appendChild(meta);btn.onclick=function(){selectedSSID=net.ssid;ssidInput.value=net.ssid;updateSelectedNet(net.ssid,'Red detectada seleccionada');markSelectedButton();document.getElementById('wifiPass').focus();};scanList.appendChild(btn);});if(selectedSSID){markSelectedButton();}else{syncTypedSSID();}}"
              "function scanNetworks(){setBusy('scan');scanList.style.display='none';showScanStatus('Buscando redes WiFi cercanas...');fetch('/scan',{cache:'no-store'}).then(r=>{if(!r.ok) throw new Error('scan');return r.json();}).then(renderNetworks).catch(()=>{showScanStatus('No se pudo completar el escaneo. Podes cargar el SSID manualmente.');}).finally(()=>{setBusy('');});}"
              "scanBtn.addEventListener('click',scanNetworks);"
              "ssidInput.addEventListener('input',syncTypedSSID);"
              "testBtn.addEventListener('click',function(){const data=validateForm();if(!data) return;clearAlerts();showStatus('Probando conexion WiFi y backend...');setBusy('test');fetch('/test',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:'ssid='+encodeURIComponent(data.ssid)+'&pass='+encodeURIComponent(data.pass)+'&url='+encodeURIComponent(data.url)}).then(async r=>{const payload=await r.json().catch(()=>null);if(!payload) throw new Error('json');if(payload.ok){let msg=payload.message;if(payload.extra){msg+=' '+payload.extra;}showOk(msg);}else{let msg=payload.message||'No se pudo completar la prueba.';if(payload.extra){msg+=' '+payload.extra;}showError(msg);}}).catch(()=>{showError('No se pudo ejecutar la prueba de conexion desde el portal.');}).finally(()=>{setBusy('');});});"
              "document.getElementById('showPass').addEventListener('change',function(){document.getElementById('wifiPass').type=this.checked?'text':'password';});"
              "document.getElementById('f').onsubmit=function(e){e.preventDefault();const data=validateForm();if(!data) return;clearAlerts();showStatus('Guardando configuracion y reiniciando la maquina...');setBusy('save');fetch('/save',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:'ssid='+encodeURIComponent(data.ssid)+'&pass='+encodeURIComponent(data.pass)+'&url='+encodeURIComponent(data.url)}).then(async r=>{if(r.ok){showOk('Listo. La maquina se conectara en unos segundos y aparecera en el panel de administracion.');document.getElementById('status').style.display='none';form.style.display='none';}else{const text=await r.text().catch(()=>'Error al guardar');showError(text||'Error al guardar');}}).catch(()=>{showError('No se pudo guardar la configuracion desde el portal.');}).finally(()=>{if(form.style.display!=='none'){setBusy('');}});};"
              "syncTypedSSID();"
              "</script></body></html>");
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

    String portalHtml = buildPortalHTML();

    portalServer.on("/", HTTP_GET, [portalHtml]() {
        portalServer.send(200, "text/html", portalHtml);
    });

    portalServer.on("/info", HTTP_GET, []() {
        String json = "{\"mac\":\"" + macAddress + "\","
                      "\"fw\":\"v3.0\","
                      "\"mode\":\"" DEPLOYMENT_MODE "\"}";
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
        ssid.trim();
        url = normalizeBackendUrl(url);

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

        saveConfig(ssid, pass, url);
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

bool connectWiFi() {
    if (wifiSSID.length() == 0) return false;

    WiFi.mode(WIFI_STA);
    WiFi.begin(wifiSSID.c_str(), wifiPass.c_str());
    Serial.printf("[WiFi] Conectando a %s", wifiSSID.c_str());

    int t = 0;
    while (WiFi.status() != WL_CONNECTED && t++ < 30) {
        delay(500);
        Serial.print(".");
        ledToggle();
    }

    if (WiFi.status() == WL_CONNECTED) {
        Serial.printf("\n[WiFi] OK — IP: %s\n", WiFi.localIP().toString().c_str());
        digitalWrite(PIN_LED, HIGH);
        wifiReady = true;

        // Sincronizar NTP (fallback para DS3231)
        configTime(0, 0, "pool.ntp.org", "time.nist.gov");

        // Verificar conectividad con el backend
        checkBackend();
        return true;
    }

    Serial.println("\n[WiFi] Error de conexion");
    return false;
}


// ══════════════════════════════════════════════════════
//  HTTP: tap, result, reconcile, register
// ══════════════════════════════════════════════════════
bool checkBackend() {
    if (WiFi.status() != WL_CONNECTED) {
        backendReady = false;
        backendLastError = "WiFi desconectado";
        return false;
    }
    String url = backendBase + "/health";
    Serial.printf("[BACKEND] Intentando: %s\n", url.c_str());
    WiFiClient client;
    HTTPClient http;
    if (!http.begin(client, url)) {
        Serial.println("[BACKEND] http.begin() fallo — URL invalida?");
        backendReady = false;
        backendLastError = "URL backend invalida o inaccesible";
        return false;
    }
    http.setTimeout(HTTP_TIMEOUT_MS);
    int code = http.GET();
    http.end();
    Serial.printf("[BACKEND] HTTP code: %d\n", code);
    bool ok = (code == 200);
    backendReady = ok;
    if (ok) {
        backendLastError = "";
    } else if (code > 0) {
        backendLastError = "HTTP " + String(code) + " en /health";
    } else {
        backendLastError = "Sin respuesta en /health";
    }
    Serial.printf("[BACKEND] %s\n", ok ? "CONECTADO" : "SIN RESPUESTA");
    return ok;
}

int postTap(const String& uid) {
    if (WiFi.status() != WL_CONNECTED) return -1;

    WiFiClient client;
    HTTPClient http;
    if (!http.begin(client, backendBase + "/api/tap")) return -1;

    http.addHeader("Content-Type", "application/json");
    http.addHeader("X-Machine-Mac", macAddress);
    http.setTimeout(HTTP_TIMEOUT_MS);

    int code = http.POST("{\"nfc_uid\":\"" + uid + "\"}");
    http.end();
    return code;
}

void notifyVendResult(const String& uid, uint16_t itemId, uint16_t amount, bool ok) {
    Serial.printf("[TAP] Resultado venta %s — item #%d $%d centavos\n",
                  ok ? "EXITOSA" : "FALLIDA", itemId, amount);

    // Si la sesión fue offline OR el WiFi cayó durante la sesión → encolar
    if (sessionIsOffline || WiFi.status() != WL_CONNECTED) {
        Serial.println("[TAP] Sin conexion online — encolando evento");
        enqueueEvent(uid, itemId, amount, ok);
        if (ok) incrementLocalUsed(uid);
        return;
    }

    // Online: notificar al backend directamente
    WiFiClient client;
    HTTPClient http;
    if (!http.begin(client, backendBase + "/api/tap/result")) {
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
                + ",\"amount\":" + amount + "}";

    int code = http.POST(body);
    http.end();

    if (code <= 0) {
        // Sin respuesta → encolar para reintentar
        Serial.println("[TAP] Sin respuesta backend — encolando evento");
        enqueueEvent(uid, itemId, amount, ok);
    }
}

void reconcileTaps() {
    if (!wifiReady) return;

    WiFiClient client;
    HTTPClient http;
    if (!http.begin(client, backendBase + "/api/tap/reconcile")) return;

    http.addHeader("Content-Type", "application/json");
    http.addHeader("X-Machine-Mac", macAddress);
    http.setTimeout(HTTP_TIMEOUT_MS);

    int code = http.POST("{}");
    http.end();

    if (code == 200) Serial.println("[RECONCILE] OK — taps huerfanos revertidos");
    else             Serial.printf("[RECONCILE] HTTP %d\n", code);
}

void registerMachine() {
    if (!wifiReady) return;

    WiFiClient client;
    HTTPClient http;
    if (!http.begin(client, backendBase + "/api/machines/register")) return;

    http.addHeader("Content-Type", "application/json");
    http.addHeader("X-Registration-Secret", REGISTRATION_SECRET);
    http.setTimeout(HTTP_TIMEOUT_MS);

    DynamicJsonDocument doc(512);
    doc["mac"] = macAddress;
    doc["wifi_ssid"] = wifiSSID;
    doc["backend_url"] = backendBase;
    doc["wifi_rssi"] = WiFi.RSSI();
    doc["wifi_ip"] = WiFi.localIP().toString();
    doc["backend_ok"] = backendReady;
    if (backendLastError.length() > 0) doc["backend_error"] = backendLastError;
    else                               doc["backend_error"] = nullptr;
    String body;
    serializeJson(doc, body);

    int code = http.POST(body);
    http.end();

    if      (code == 200) Serial.println("[REG] OK — maquina APROBADA");
    else if (code == 202) { Serial.println("[REG] PENDIENTE — esperando aprobacion"); ledBlink(2, 300); }
    else if (code == 401) Serial.println("[REG] ERROR 401 — REGISTRATION_SECRET incorrecto");
    else if (code <= 0)   Serial.printf("[REG] Sin respuesta (verificar URL: %s)\n", backendBase.c_str());
    else                  Serial.printf("[REG] HTTP %d\n", code);
}

bool canProcessRemoteCommand() {
    return !pendingSession
        && sessionUID.length() == 0
        && mdbState != SESSION_IDLE
        && mdbState != VEND_PENDING;
}

bool ackRemoteCommandJson(uint32_t commandId, const char* status, const String& resultJson) {
    if (WiFi.status() != WL_CONNECTED) return false;

    WiFiClient client;
    HTTPClient http;
    String url = backendBase + "/api/machine-control/commands/" + String(commandId) + "/ack";
    if (!http.begin(client, url)) return false;

    http.addHeader("Content-Type", "application/json");
    http.addHeader("X-Machine-Mac", macAddress);
    http.setTimeout(HTTP_TIMEOUT_MS);

    String body = "{\"status\":\"" + String(status) + "\",\"result\":" + resultJson + "}";
    int code = http.POST(body);
    http.end();

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

    saveConfig(nextSSID, nextPass, nextUrl);
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

void pollRemoteCommands() {
    if (WiFi.status() != WL_CONNECTED) return;
    if (!canProcessRemoteCommand()) return;

    WiFiClient client;
    HTTPClient http;
    String url = backendBase + "/api/machine-control/commands/next";
    if (!http.begin(client, url)) return;

    http.addHeader("X-Machine-Mac", macAddress);
    http.setTimeout(HTTP_TIMEOUT_MS);

    int code = http.GET();
    if (code == 204) {
        http.end();
        return;
    }
    if (code != 200) {
        if (code > 0) Serial.printf("[REMOTE] Poll comandos HTTP %d\n", code);
        http.end();
        return;
    }

    String body = http.getString();
    http.end();

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

    ackRemoteCommand(commandId, "failed", "Comando no soportado por este firmware");
}


// ══════════════════════════════════════════════════════
//  NFC — con fallback offline
// ══════════════════════════════════════════════════════
void handleNFC() {
    if (millis() - lastNFCRead < NFC_COOLDOWN_MS) return;
    if (!rfid.PICC_IsNewCardPresent() || !rfid.PICC_ReadCardSerial()) return;

    // Fix Bug 6: no aceptar nuevos taps si hay sesión MDB activa
    if (mdbState == VEND_PENDING || mdbState == SESSION_IDLE) {
        Serial.println("[NFC] TAP IGNORADO — sesion MDB activa");
        ledBlink(6, 60);
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
    ledBlink(1, 50);

    bool approved    = false;
    bool isOffline   = false;

    // ── Intentar autenticación online ────────────────
    if (WiFi.status() == WL_CONNECTED) {
        Serial.println("[TAP] Consultando backend...");
        int code = postTap(uid);

        if (code == 200) {
            Serial.println("[TAP] APROBADO (online)");
            approved = true;
        } else if (code == 403) {
            // Leer body para distinguir razón
            // (postTap devuelve solo el código; la razón viene en el body — se loguea genérico)
            Serial.println("[TAP] DENEGADO (online) — verificar razon en backend");
            ledBlink(5, 80);
            return;
        } else if (code == 401) {
            Serial.println("[TAP] ERROR 401 — re-registrando maquina...");
            registerMachine();
            ledBlink(3, 300);
            return;
        } else if (code > 0) {
            Serial.printf("[TAP] ERROR HTTP %d\n", code);
            ledBlink(3, 200);
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
        } else if (result == LOCAL_AUTH_OVERLIMIT) {
            Serial.println("[TAP] DENEGADO — limite diario alcanzado (offline)");
            ledBlink(5, 80);
            return;
        } else {
            Serial.println("[TAP] DENEGADO — tarjeta desconocida (offline)");
            ledBlink(3, 200);
            return;
        }
    }

    // ── Iniciar sesión MDB ────────────────────────────
    sessionUID       = uid;
    sessionIsOffline = isOffline;
    pendingSession   = true;
    mdbState         = SESSION_IDLE;
    sessionStartMs   = millis();   // Fix Bug 5: iniciar timeout
    vendUsed         = false;      // Fix Bug 2: resetear flag de dispensado
    ledBlink(2, 100);
}


// ══════════════════════════════════════════════════════
//  MDB handlers
// ══════════════════════════════════════════════════════
void mdbSendACK()  { mdb.sendData(MDB_ACK); }
void mdbSendNAK()  { mdb.sendData(MDB_NAK); }
void mdbSendByte(uint8_t b) { mdb.sendData(b); mdb.sendData(b); }
void mdbSendData(uint8_t* data, uint8_t len) {
    uint8_t chk = 0;
    for (uint8_t i = 0; i < len; i++) { mdb.sendData(data[i]); chk += data[i]; }
    mdb.sendData(chk);
}

void cmdReset() {
    Serial.println("[MDB] RESET recibido → INACTIVE");
    mdbState = INACTIVE; justReset = true; pendingSession = false;
    vendApproved = false; vendUsed = false;
    sessionUID = ""; sessionIsOffline = false;
    mdbSendACK();
}

void cmdSetup(uint8_t* d, uint8_t len) {
    if (len == 0) { mdbSendNAK(); return; }
    if (d[0] == SETUP_CONFIG) {
        Serial.println("[MDB] SETUP config → MDB_DISABLED");
        uint8_t r[] = {0x02, 0x00, 0x24, 0x01, 0x02, 0x0A, 0x00};
        mdbSendData(r, sizeof(r));
        mdbState = MDB_DISABLED;
    } else {
        mdbSendACK();
    }
}

void cmdPoll() {
    switch (mdbState) {
        case INACTIVE:
            if (justReset) {
                mdbSendByte(MDB_JUST_RESET);
                justReset = false;
                mdbState = MDB_DISABLED;
            } else {
                mdbSendACK();
            }
            break;

        case MDB_DISABLED: mdbSendACK(); break;
        case ENABLED:  mdbSendACK(); break;

        case SESSION_IDLE:
            if (pendingSession) {
                uint8_t r[3] = {MDB_BEGIN_SESSION,
                                (FUNDS_UNLIMITED >> 8) & 0xFF,
                                 FUNDS_UNLIMITED        & 0xFF};
                mdbSendData(r, 3);
                pendingSession = false;
            } else {
                mdbSendACK();
            }
            break;

        case VEND_PENDING:
            if (vendApproved) {
                uint8_t r[3] = {MDB_VEND_APPROVED,
                                (uint8_t)((vendAmount >> 8) & 0xFF),
                                (uint8_t)( vendAmount        & 0xFF)};
                mdbSendData(r, 3);
                vendApproved = false;
            } else {
                mdbSendByte(MDB_VEND_DENIED);
                mdbState = ENABLED;
                sessionUID = "";
                sessionIsOffline = false;
            }
            break;
    }
}

void cmdVend(uint8_t* d, uint8_t len) {
    if (len == 0) { mdbSendNAK(); return; }

    switch (d[0]) {
        case VEND_REQUEST:
            if (len >= 5) {
                sessionAmount = ((uint16_t)d[1] << 8) | d[2];
                sessionItemId = ((uint16_t)d[3] << 8) | d[4];
                Serial.printf("[MDB] VEND_REQUEST — item #%d $%d centavos\n",
                              sessionItemId, sessionAmount);
                // Fix Bug 2: solo 1 dispensado por autorización NFC
                if (vendUsed) {
                    Serial.println("[MDB] Denegado — ya se dispenso en esta sesion");
                    vendApproved = false;
                    mdbState = VEND_PENDING;
                } else {
                    vendApproved = true;
                    vendAmount = sessionAmount;
                    mdbState = VEND_PENDING;
                }
            }
            break;

        case VEND_SUCCESS:
            Serial.println("[MDB] VEND_SUCCESS — venta confirmada");
            notifyVendResult(sessionUID, sessionItemId, sessionAmount, true);
            vendUsed = true;  // Fix Bug 2
            mdbSendACK();
            mdbState = SESSION_IDLE;
            break;

        case VEND_FAILURE:
            Serial.println("[MDB] VEND_FAILURE — venta fallida");
            notifyVendResult(sessionUID, sessionItemId, sessionAmount, false);
            mdbSendACK();
            mdbState = SESSION_IDLE;
            sessionUID = "";
            vendUsed = false;
            sessionIsOffline = false;
            break;

        case VEND_END:
            Serial.println("[MDB] VEND_END — sesion cerrada");
            // Fix Bug 1: si no hubo dispensado, cancelar tap en backend
            if (sessionUID.length() > 0 && !vendUsed) {
                Serial.printf("[MDB] VEND_END sin dispensado — cancelando tap de %s\n",
                              sessionUID.c_str());
                notifyVendResult(sessionUID, 0, 0, false);
            }
            mdbSendByte(MDB_END_SESSION);
            mdbState = ENABLED;
            sessionUID = "";
            vendUsed = false;
            sessionIsOffline = false;
            break;

        case VEND_CANCEL:
            Serial.println("[MDB] VEND_CANCEL");
            mdbSendByte(MDB_CANCELLED);
            mdbState = SESSION_IDLE;
            break;

        default: mdbSendNAK();
    }
}

void cmdReader(uint8_t* d, uint8_t len) {
    if (len == 0) { mdbSendNAK(); return; }

    if (d[0] == READER_ENABLE) {
        Serial.println("[MDB] READER ENABLE → ENABLED");
        mdbState = ENABLED;
    }
    if (d[0] == READER_DISABLE) {
        Serial.println("[MDB] READER DISABLE → MDB_DISABLED");
        // Fix Bug 1: cancelar tap si había sesión sin dispensado
        if (sessionUID.length() > 0 && !vendUsed) {
            Serial.printf("[MDB] READER_DISABLE mid-session — cancelando tap de %s\n",
                          sessionUID.c_str());
            notifyVendResult(sessionUID, 0, 0, false);
        }
        mdbState = MDB_DISABLED;
        sessionUID = "";
        vendUsed = false;
        pendingSession = false;
        sessionIsOffline = false;
    }
    mdbSendACK();
}

void handleMDB() {
    uint16_t first = mdb.read(2);
    if (first == 0xFFFF) return;
    if (!MDB9bit::isAddress(first)) return;

    uint8_t addr = MDB9bit::value(first);
    if ((addr & 0xF8) != MDB_ADDR_CASHLESS) return;

    uint8_t  cmd = addr & 0x07;
    uint16_t dataBuf[16];
    uint8_t  dataLen = mdb.readFrame(dataBuf, 16, 3);

    uint8_t d[16];
    for (uint8_t i = 0; i < dataLen; i++) d[i] = MDB9bit::value(dataBuf[i]);

    switch (cmd) {
        case MDB_CMD_RESET:  cmdReset();            break;
        case MDB_CMD_SETUP:  cmdSetup(d, dataLen);  break;
        case MDB_CMD_POLL:   cmdPoll();             break;
        case MDB_CMD_VEND:   cmdVend(d, dataLen);   break;
        case MDB_CMD_READER: cmdReader(d, dataLen); break;
        default: mdbSendNAK(); break;
    }
}


// ══════════════════════════════════════════════════════
//  SETUP
// ══════════════════════════════════════════════════════
void setup() {
    Serial.begin(115200);
    delay(100);

    pinMode(PIN_LED, OUTPUT);
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
    Serial.println("====================================");
    Serial.println();

    // I²C + DS3231 RTC
    Wire.begin(PIN_I2C_SDA, PIN_I2C_SCL);
    if (rtc.begin(&Wire)) {
        rtcAvailable = true;
        Serial.println("[RTC] DS3231 OK");
        if (rtc.lostPower()) {
            Serial.println("[RTC] Perdio alimentacion — se sincronizara con NTP");
        }
    } else {
        Serial.println("[RTC] DS3231 no encontrado — usando NTP para reloj");
    }

    // LittleFS
    if (!LittleFS.begin(true)) {
        Serial.println("[FS] ERROR critico — LittleFS no pudo iniciar");
    } else {
        Serial.println("[FS] LittleFS OK");
        loadCards();
        loadQueue();
    }

    // SPI + RC522
    SPI.begin(PIN_SPI_SCK, PIN_SPI_MISO, PIN_SPI_MOSI, PIN_RC522_SS);
    rfid.PCD_Init();
    delay(50);
    byte ver = rfid.PCD_ReadRegister(MFRC522::VersionReg);
    if (ver == 0x00 || ver == 0xFF) {
        Serial.println("[NFC] ERROR — RC522 no responde");
        Serial.println("[NFC]   SCK=GPIO0  MOSI=GPIO1  MISO=GPIO3  SS=GPIO4  RST=GPIO7");
    } else {
        Serial.printf("[NFC] RC522 OK — chip: 0x%02X\n", ver);
    }

    // MDB 9-bit software serial
    mdb.begin();
    Serial.println("[MDB] 9-bit software serial listo (TX=GPIO20, RX=GPIO21)");

    // WiFi
    readConfig();
    if (wifiSSID.length() == 0) {
        Serial.println("[BOOT] Sin red configurada → modo portal");
        startPortal();
    } else {
        if (!connectWiFi()) {
            Serial.println("[BOOT] Fallo WiFi → modo portal");
            startPortal();
        } else {
            Serial.printf("[CFG] Backend: %s\n", backendBase.c_str());

            checkBackend();
            registerMachine();
            reconcileTaps();    // Fix Bug 4: revertir taps huérfanos al reiniciar
            flushQueue();       // Enviar eventos offline pendientes
            downloadCards();    // Descargar cache de tarjetas para modo offline

            // Sincronizar RTC con NTP si perdió alimentación
            if (rtcAvailable && rtc.lostPower()) {
                delay(2000);    // Esperar que NTP sincronice
                struct tm timeinfo;
                if (getLocalTime(&timeinfo)) {
                    rtc.adjust(DateTime(1900 + timeinfo.tm_year,
                                       timeinfo.tm_mon + 1,
                                       timeinfo.tm_mday,
                                       timeinfo.tm_hour,
                                       timeinfo.tm_min,
                                       timeinfo.tm_sec));
                    Serial.println("[RTC] Ajustado con NTP");
                }
            }
        }
    }

    Serial.println("[BOOT] Sistema listo\n");
}


// ══════════════════════════════════════════════════════
//  LOOP
// ══════════════════════════════════════════════════════
void loop() {
    handleResetButtonRuntime();

    if (portalMode) {
        dnsServer.processNextRequest();
        portalServer.handleClient();
        return;
    }

    // Modo normal: MDB + NFC
    handleMDB();
    handleNFC();

    // ── Fix Bug 5: timeout SESSION_IDLE ──────────────
    if (pendingSession && (millis() - sessionStartMs > SESSION_TIMEOUT_MS)) {
        Serial.printf("[TMO] Timeout SESSION_IDLE — cancelando tap de %s\n",
                      sessionUID.c_str());
        String cancelUid    = sessionUID;
        bool   wasOffline   = sessionIsOffline;
        sessionUID          = "";
        pendingSession      = false;
        mdbState            = MDB_DISABLED;
        vendApproved        = false;
        vendUsed            = false;
        sessionIsOffline    = false;

        // wasOffline afecta cómo notifyVendResult enruta el evento
        sessionIsOffline = wasOffline;
        notifyVendResult(cancelUid, 0, 0, false);
        sessionIsOffline = false;

        ledBlink(4, 150);
    }

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

    // ── Poll de comandos remotos cada 15s ─────────────
    static unsigned long lastCommandPoll = 0;
    if (millis() - lastCommandPoll > COMMAND_POLL_MS) {
        lastCommandPoll = millis();
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
        Serial.printf("[STATUS] WiFi:%s | Backend:%s | MDB:%s | Cards:%d | Queue:%d | RTC:%s\n",
                     WiFi.status() == WL_CONNECTED ? "OK" : "DESCONECTADO",
                      backendReady ? "OK" : "OFFLINE",
                      stStr[mdbState], cardCount, queueLen,
                      rtcAvailable ? "DS3231" : "NTP");
    }

    yield();
}
