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
 *   GPIO9  = BOOT button (pull-up interno, LOW = presionado, reset config)
 *   GPIO20 = MDB TX (bit-banging, salida al bus)
 *   GPIO21 = MDB RX (bit-banging, entrada del bus)
 *
 * Pines que NO conectar nada:
 *   GPIO2  = strapping (debe estar HIGH al boot)
 *   GPIO8  = LED onboard + strapping (debe estar HIGH al boot)
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
#define RESET_HOLD_MS  5000  // mantener pulsado 5s para borrar config

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

// ── Offline ───────────────────────────────────────────
#define MAX_CARDS          1500   // límite práctico (~100KB ArduinoJson doc)
#define MAX_QUEUE          1000
#define CARDS_PATH         "/cards.json"
#define QUEUE_PATH         "/queue.json"

// Resultados de localAuth()
#define LOCAL_AUTH_OK        0
#define LOCAL_AUTH_OVERLIMIT 1
#define LOCAL_AUTH_UNKNOWN   2

// ── Estado MDB ────────────────────────────────────────
enum MDBState { INACTIVE, MDB_DISABLED, ENABLED, SESSION_IDLE, VEND_PENDING };

// ── Estructuras offline (packed para ahorrar RAM) ─────
struct __attribute__((packed)) CardEntry {
    char    uid[9];    // "0A30FC80\0"
    uint8_t limit;     // daily_limit
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
bool   portalMode    = false;
bool   wifiReady     = false;
bool   backendReady  = false;   // true si /health respondio OK
bool   rtcAvailable  = false;

// ── Offline: cache de tarjetas ────────────────────────
CardEntry cards[MAX_CARDS];
int       cardCount  = 0;
bool      cardsDirty = false;
char      savedDate[11] = "";   // "YYYY-MM-DD" para detectar cambio de día

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


// ══════════════════════════════════════════════════════
//  PREFERENCIAS (reemplaza EEPROM, almacén NVS)
// ══════════════════════════════════════════════════════
void readConfig() {
    prefs.begin("cc", true);  // namespace "cc", read-only
    wifiSSID = prefs.getString("ssid", "");
    wifiPass = prefs.getString("pass", "");
    String url = prefs.getString("url", "");
    prefs.end();
    if (url.length() > 0) {
        // Normalizar esquema a minúsculas (evitar "Http://" del portal)
        if (url.startsWith("Http://") || url.startsWith("HTTP://")) {
            url = "http://" + url.substring(7);
        } else if (url.startsWith("Https://") || url.startsWith("HTTPS://")) {
            url = "https://" + url.substring(8);
        }
        backendBase = url;
    }
    Serial.printf("[CFG] SSID guardada:   %s\n", wifiSSID.c_str());
    Serial.printf("[CFG] Backend guardado: %s\n", backendBase.c_str());
}

void saveConfig(const String& ssid, const String& pass, const String& url) {
    prefs.begin("cc", false);  // read-write
    prefs.putString("ssid", ssid);
    prefs.putString("pass", pass);
    // Normalizar esquema a minúsculas antes de guardar
    String urlNorm = url;
    if (urlNorm.startsWith("Http://") || urlNorm.startsWith("HTTP://"))
        urlNorm = "http://" + urlNorm.substring(7);
    else if (urlNorm.startsWith("Https://") || urlNorm.startsWith("HTTPS://"))
        urlNorm = "https://" + urlNorm.substring(8);
    prefs.putString("url", urlNorm.length() > 0 ? urlNorm : String(BACKEND_URL));
    prefs.end();
    Serial.printf("[CFG] Config guardada — SSID: %s\n", ssid.c_str());
}

void clearConfig() {
    prefs.begin("cc", false);
    prefs.clear();
    prefs.end();
}

void checkResetButton() {
    // GPIO9 = BOOT button con pull-up interno, LOW = presionado
    pinMode(PIN_BOOT_BTN, INPUT_PULLUP);
    delay(10);

    if (digitalRead(PIN_BOOT_BTN) == LOW) {
        Serial.print("[RESET] Boton presionado, mantener 5s para borrar config");
        unsigned long t = millis();
        int dots = 0;
        while (digitalRead(PIN_BOOT_BTN) == LOW) {
            if (millis() - t > RESET_HOLD_MS) {
                clearConfig();
                Serial.println("\n[RESET] Config borrada — reiniciando al portal");
                ledBlink(10, 100);
                ESP.restart();
            }
            if (millis() - t > (unsigned long)(dots * 500)) { Serial.print("."); dots++; }
            delay(50);
        }
        Serial.println(" (soltado antes de tiempo)");
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
    JsonArray arr = doc["cards"];

    cardCount = 0;
    for (JsonObject c : arr) {
        if (cardCount >= MAX_CARDS) break;
        strlcpy(cards[cardCount].uid, c["uid"] | "", sizeof(cards[0].uid));
        cards[cardCount].limit = (uint8_t)(c["limit"] | 0);
        cards[cardCount].used  = (uint8_t)(c["used"]  | 0);
        cardCount++;
    }
    Serial.printf("[CARDS] Cache cargado: %d tarjetas (fecha: %s)\n", cardCount, savedDate);
}

// Guarda cards.json en streaming para no allocar el doc completo
void saveCards() {
    File f = LittleFS.open(CARDS_PATH, "w");
    if (!f) { Serial.println("[CARDS] Error guardando cards.json"); return; }

    f.print("{\"date\":\"");
    f.print(savedDate);
    f.print("\",\"cards\":[");
    for (int i = 0; i < cardCount; i++) {
        if (i > 0) f.print(",");
        f.printf("{\"uid\":\"%s\",\"limit\":%d,\"used\":%d}",
                 cards[i].uid, cards[i].limit, cards[i].used);
    }
    f.print("]}");
    f.close();

    cardsDirty = false;
    Serial.printf("[CARDS] Cache guardado: %d tarjetas\n", cardCount);
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
            if (cards[i].limit > 0 && cards[i].used >= cards[i].limit) {
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

    // Obtener fecha de hoy para el cache
    if (rtcAvailable) {
        DateTime now = rtc.now();
        snprintf(savedDate, sizeof(savedDate), "%04d-%02d-%02d",
                 now.year(), now.month(), now.day());
    } else {
        struct tm timeinfo;
        if (getLocalTime(&timeinfo)) {
            snprintf(savedDate, sizeof(savedDate), "%04d-%02d-%02d",
                     1900 + timeinfo.tm_year, timeinfo.tm_mon + 1, timeinfo.tm_mday);
        }
    }

    JsonArray arr = doc.as<JsonArray>();
    cardCount = 0;
    for (JsonObject c : arr) {
        if (cardCount >= MAX_CARDS) break;
        strlcpy(cards[cardCount].uid, c["uid"] | "", sizeof(cards[0].uid));
        cards[cardCount].limit = (uint8_t)(c["daily_limit"] | 0);
        cards[cardCount].used  = (uint8_t)(c["used_today"]  | 0);
        cardCount++;
    }

    saveCards();
    Serial.printf("[CARDS] Descarga OK: %d tarjetas (fecha: %s)\n", cardCount, savedDate);
}


// ══════════════════════════════════════════════════════
//  OFFLINE: reset diario de contadores de uso
// ══════════════════════════════════════════════════════
void checkMidnightReset() {
    char today[11] = "";

    if (rtcAvailable) {
        DateTime now = rtc.now();
        snprintf(today, sizeof(today), "%04d-%02d-%02d",
                 now.year(), now.month(), now.day());
    } else {
        struct tm timeinfo;
        if (!getLocalTime(&timeinfo)) return;
        snprintf(today, sizeof(today), "%04d-%02d-%02d",
                 1900 + timeinfo.tm_year, timeinfo.tm_mon + 1, timeinfo.tm_mday);
    }

    if (strlen(savedDate) == 0 || strcmp(today, savedDate) == 0) return;

    // Día nuevo detectado → resetear contadores de uso
    Serial.printf("[RTC] Nuevo dia: %s → %s — reseteando contadores\n", savedDate, today);
    strlcpy(savedDate, today, sizeof(savedDate));
    for (int i = 0; i < cardCount; i++) cards[i].used = 0;
    cardsDirty = true;
}


// ══════════════════════════════════════════════════════
//  PORTAL WIFI CAUTIVO
// ══════════════════════════════════════════════════════
String buildPortalHTML() {
    String html = F("<!DOCTYPE html><html lang='es'>"
        "<head><meta charset='UTF-8'><meta name='viewport' content='width=device-width,initial-scale=1'>"
        "<title>CoffeeControl</title>"
        "<style>"
        "*{box-sizing:border-box;margin:0;padding:0;}"
        "body{font-family:-apple-system,sans-serif;background:#f5f5f3;min-height:100vh;"
              "display:flex;align-items:center;justify-content:center;padding:20px;}"
        ".card{background:#fff;border-radius:12px;padding:28px;width:100%;max-width:360px;"
              "border:1px solid rgba(0,0,0,.1);}"
        "h1{font-size:18px;font-weight:500;margin-bottom:4px;}"
        ".sub{font-size:13px;color:#888;margin-bottom:22px;}"
        "label{font-size:12px;color:#666;display:block;margin-bottom:4px;}"
        "input{width:100%;border:1px solid #ccc;border-radius:8px;padding:9px 10px;"
              "font-size:14px;margin-bottom:14px;}"
        "input:focus{outline:2px solid #185FA5;border-color:transparent;}"
        ".info{font-size:11px;color:#aaa;margin-bottom:16px;padding:8px 10px;"
              "background:#f9f9f7;border-radius:6px;font-family:monospace;}"
        ".step{font-size:11px;color:#185FA5;margin-bottom:20px;padding:8px 10px;"
              "background:#e6f1fb;border-radius:6px;}"
        "button{width:100%;padding:11px;background:#185FA5;color:#fff;border:none;"
               "border-radius:8px;font-size:14px;font-weight:500;cursor:pointer;}"
        ".ok{display:none;background:#eaf3de;color:#27500a;border-radius:8px;"
            "padding:12px;font-size:13px;text-align:center;margin-top:14px;}"
        ".err{display:none;background:#fcebeb;color:#791f1f;border-radius:8px;"
             "padding:10px;font-size:13px;margin-bottom:12px;}"
        "</style></head>"
        "<body><div class='card'>"
        "<h1>CoffeeControl</h1>"
        "<div class='sub'>Configuracion de red</div>"
        "<div class='step'>Ingresa los datos del WiFi de la empresa. "
             "La maquina se conectara automaticamente.</div>"
        "<div class='err' id='err'></div>"
        "<form id='f'>"
        "<label>Red WiFi (SSID) *</label>"
        "<input type='text' name='ssid' placeholder='NombreDeLaRed' required autocomplete='off'>"
        "<label>Contrasena WiFi</label>"
        "<input type='password' name='pass' autocomplete='off'>");

    if (String(DEPLOYMENT_MODE) != "saas") {
        html += F("<label>URL del servidor *</label>"
                  "<input type='text' name='url' placeholder='http://192.168.1.50:3000' "
                  "required autocomplete='off'>"
                  "<div style='font-size:11px;color:#aaa;margin-top:-10px;margin-bottom:14px'>"
                  "Consultá al admin si no conoces la URL.</div>");
    }

    html += F("<div class='info' id='mac'>Cargando ID...</div>"
              "<button type='submit'>Guardar y conectar</button>"
              "</form>"
              "<div class='ok' id='ok'>Listo. La maquina se conectara en unos segundos "
              "y aparecera en el panel de administracion.</div>"
              "</div>"
              "<script>"
              "fetch('/info').then(r=>r.json()).then(d=>{"
              "  document.getElementById('mac').textContent="
              "    'ID: '+d.mac+' | FW: '+d.fw;"
              "});"
              "document.getElementById('f').onsubmit=function(e){"
              "  e.preventDefault();"
              "  const d=new FormData(this);"
              "  const ssid=d.get('ssid');"
              "  if(!ssid){"
              "    document.getElementById('err').textContent='El SSID es requerido';"
              "    document.getElementById('err').style.display='block';return;"
              "  }"
              "  fetch('/save',{method:'POST',"
              "    headers:{'Content-Type':'application/x-www-form-urlencoded'},"
              "    body:'ssid='+encodeURIComponent(ssid)"
              "        +'&pass='+encodeURIComponent(d.get('pass')||'')"
              "        +'&url='+encodeURIComponent(d.get('url')||'')"
              "  }).then(r=>{"
              "    if(r.ok){"
              "      document.getElementById('ok').style.display='block';"
              "      document.getElementById('f').style.display='none';"
              "    } else {"
              "      document.getElementById('err').textContent='Error al guardar';"
              "      document.getElementById('err').style.display='block';"
              "    }"
              "  });"
              "};"
              "</script></body></html>");
    return html;
}

void startPortal() {
    portalMode = true;
    Serial.println("[PORTAL] Iniciando AP y portal de configuracion...");

    WiFi.mode(WIFI_AP);
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

        if (ssid.length() == 0) {
            portalServer.send(400, "text/plain", "ssid requerido");
            return;
        }
        if (String(DEPLOYMENT_MODE) == "saas" || url.length() == 0) {
            url = String(BACKEND_URL);
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
        return false;
    }
    String url = backendBase + "/health";
    Serial.printf("[BACKEND] Intentando: %s\n", url.c_str());
    WiFiClient client;
    HTTPClient http;
    if (!http.begin(client, url)) {
        Serial.println("[BACKEND] http.begin() fallo — URL invalida?");
        backendReady = false;
        return false;
    }
    http.setTimeout(HTTP_TIMEOUT_MS);
    int code = http.GET();
    http.end();
    Serial.printf("[BACKEND] HTTP code: %d\n", code);
    bool ok = (code == 200);
    backendReady = ok;
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

    int code = http.POST("{\"mac\":\"" + macAddress + "\"}");
    http.end();

    if      (code == 200) Serial.println("[REG] OK — maquina APROBADA");
    else if (code == 202) { Serial.println("[REG] PENDIENTE — esperando aprobacion"); ledBlink(2, 300); }
    else if (code == 401) Serial.println("[REG] ERROR 401 — REGISTRATION_SECRET incorrecto");
    else if (code <= 0)   Serial.printf("[REG] Sin respuesta (verificar URL: %s)\n", backendBase.c_str());
    else                  Serial.printf("[REG] HTTP %d\n", code);
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
    ledBlink(3, 100);

    // Verificar botón BOOT ANTES de todo (reset config si se mantiene presionado)
    checkResetButton();

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
        Serial.println("[NFC]   SCK=GPIO0  MOSI=GPIO1  MISO=GPIO2  SS=GPIO3  RST=GPIO4");
    } else {
        Serial.printf("[NFC] RC522 OK — chip: 0x%02X\n", ver);
    }

    // MDB 9-bit software serial
    mdb.begin();
    Serial.println("[MDB] 9-bit software serial listo (RX=GPIO5, TX=GPIO6)");

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
        if (backendReady) registerMachine();  // actualiza last_seen para estado online/offline
        const char* stStr[] = {"INACTIVE","MDB_DISABLED","ENABLED","SESSION_IDLE","VEND_PENDING"};
        Serial.printf("[STATUS] WiFi:%s | Backend:%s | MDB:%s | Cards:%d | Queue:%d | RTC:%s\n",
                      WiFi.status() == WL_CONNECTED ? "OK" : "DESCONECTADO",
                      backendReady ? "OK" : "OFFLINE",
                      stStr[mdbState], cardCount, queueLen,
                      rtcAvailable ? "DS3231" : "NTP");
    }

    yield();
}
