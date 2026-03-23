/*
 * CoffeeControl — Firmware ESP8266 v2
 * ─────────────────────────────────────────────────────
 * Novedades respecto a v1:
 *   - Se autentica con su MAC address (no hay secret hardcodeado)
 *   - Portal WiFi cautivo: levanta AP "CoffeeControl-Setup",
 *     el cliente configura el WiFi desde el celular
 *   - Se autoregistra en el backend al primer tap
 *   - Un solo .bin para todas las máquinas — sin tocar código
 * ─────────────────────────────────────────────────────
 */

#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <ESP8266WebServer.h>
#include <DNSServer.h>
#include <WiFiClient.h>
#include <EEPROM.h>
#include <SPI.h>
#include <MFRC522.h>
#include "MDB9bit.h"

// ── Pines ─────────────────────────────────────────────
#define RC522_SS_PIN   D4
#define RC522_RST_PIN  D3
#define MDB_TX_PIN     D2
#define MDB_RX_PIN     D1
#define LED_PIN        LED_BUILTIN

// ── Modo de deployment ────────────────────────────────
// Descomentar UNA de las dos opciones antes de compilar:

// Opción B — servidor local (el técnico ingresa la URL en el portal)
#define DEPLOYMENT_MODE  "local"
#define BACKEND_URL      "http://192.168.1.50:3000"   // fallback si el campo queda vacío
#define REGISTRATION_SECRET "coffeecontrol-registro-2024"  // debe coincidir con .env

// Opción C — SaaS (URL fija, el portal no muestra el campo URL)
// #define DEPLOYMENT_MODE  "saas"
// #define BACKEND_URL      "https://api.coffeecontrol.com"

// ── Configuración del portal ──────────────────────────
#define AP_SSID        "CoffeeControl-Setup"
// Sin password — red abierta para facilitar la configuración
#define AP_IP          "192.168.4.1"
#define DNS_PORT       53

// ── Reset físico ──────────────────────────────────────
// Mantener presionado RESET_PIN durante RESET_HOLD_MS AL ENCENDER (mientras
// conectás la alimentación o durante el arranque) para borrar la EEPROM
// y volver al portal de configuración.
// NOTA: D0 (GPIO16) NO soporta INPUT_PULLUP en software — requiere resistencia
// de 10kΩ externa entre D0 y 3.3V en el PCB. Pulsador entre D0 y GND.
#define RESET_PIN      D0   // GPIO16 — pull-up externo de 10kΩ a 3.3V requerido
#define RESET_HOLD_MS  5000 // 5 segundos

// ── EEPROM layout ─────────────────────────────────────
// addr 0..63  = SSID WiFi (64 bytes)
// addr 64..127 = Password WiFi (64 bytes)
// addr 128..191 = Backend URL (64 bytes)
// addr 192 = flag de configurado (0xAA = ok)
#define EEPROM_SIZE     200
#define EEPROM_SSID     0
#define EEPROM_PASS     64
#define EEPROM_URL      128
#define EEPROM_FLAG     192
#define EEPROM_OK_FLAG  0xAA

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

#define NFC_COOLDOWN_MS    2500
#define HTTP_TIMEOUT_MS    4000

// ── Estado MDB ────────────────────────────────────────
enum MDBState { INACTIVE, DISABLED, ENABLED, SESSION_IDLE, VEND_PENDING };

// ── Objetos ───────────────────────────────────────────
MFRC522          rfid(RC522_SS_PIN, RC522_RST_PIN);
MDB9bit          mdb(MDB_TX_PIN, MDB_RX_PIN);
ESP8266WebServer portalServer(80);
DNSServer        dnsServer;

// ── Variables globales ────────────────────────────────
MDBState mdbState       = INACTIVE;
bool     justReset      = true;
bool     pendingSession = false;
bool     vendApproved   = false;
uint16_t vendAmount     = 0;
String   sessionUID     = "";
uint16_t sessionItemId  = 0;
uint16_t sessionAmount  = 0;
unsigned long lastNFCRead = 0;

String   wifiSSID    = "";
String   wifiPass    = "";
String   backendBase = BACKEND_URL;
String   macAddress  = "";

bool     portalMode  = false;   // true = estamos en modo configuración
bool     wifiReady   = false;

// ══════════════════════════════════════════════════════
//  EEPROM — leer / escribir configuración WiFi
// ══════════════════════════════════════════════════════
void readConfig() {
    EEPROM.begin(EEPROM_SIZE);

    if (EEPROM.read(EEPROM_FLAG) != EEPROM_OK_FLAG) {
        Serial.println("[CFG] Sin configuración guardada");
        return;
    }

    char ssid[65] = {0}, pass[65] = {0}, url[65] = {0};
    for (int i = 0; i < 64; i++) ssid[i] = EEPROM.read(EEPROM_SSID + i);
    for (int i = 0; i < 64; i++) pass[i] = EEPROM.read(EEPROM_PASS + i);
    for (int i = 0; i < 64; i++) url[i]  = EEPROM.read(EEPROM_URL  + i);

    wifiSSID    = String(ssid);
    wifiPass    = String(pass);
    if (strlen(url) > 0) backendBase = String(url);

    Serial.printf("[CFG] SSID: %s\n", wifiSSID.c_str());
}

void saveConfig(String ssid, String pass, String url) {
    EEPROM.begin(EEPROM_SIZE);

    // Limpiar área
    for (int i = 0; i < EEPROM_SIZE; i++) EEPROM.write(i, 0);

    // Escribir
    for (int i = 0; i < min((int)ssid.length(), 63); i++)
        EEPROM.write(EEPROM_SSID + i, ssid[i]);
    for (int i = 0; i < min((int)pass.length(), 63); i++)
        EEPROM.write(EEPROM_PASS + i, pass[i]);
    for (int i = 0; i < min((int)url.length(), 63); i++)
        EEPROM.write(EEPROM_URL  + i, url[i]);

    EEPROM.write(EEPROM_FLAG, EEPROM_OK_FLAG);
    EEPROM.commit();

    Serial.printf("[CFG] Config guardada — SSID: %s\n", ssid.c_str());
}

// ══════════════════════════════════════════════════════
//  PORTAL WIFI CAUTIVO
// ══════════════════════════════════════════════════════
// El portal se genera dinámicamente según el modo de deployment
// En modo SaaS no muestra el campo URL
String buildPortalHTML() {
    String isSaas = (String(DEPLOYMENT_MODE) == "saas") ? "true" : "false";
    String html = F("<!DOCTYPE html><html lang='es'>"
        "<head><meta charset='UTF-8'><meta name='viewport' content='width=device-width,initial-scale=1'>"
        "<title>CoffeeControl</title>"
        "<style>"
        "*{box-sizing:border-box;margin:0;padding:0;}"
        "body{font-family:-apple-system,sans-serif;background:#f5f5f3;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px;}"
        ".card{background:#fff;border-radius:12px;padding:28px;width:100%;max-width:360px;border:1px solid rgba(0,0,0,.1);}"
        "h1{font-size:18px;font-weight:500;margin-bottom:4px;}"
        ".sub{font-size:13px;color:#888;margin-bottom:22px;}"
        "label{font-size:12px;color:#666;display:block;margin-bottom:4px;}"
        "input{width:100%;border:1px solid #ccc;border-radius:8px;padding:9px 10px;font-size:14px;margin-bottom:14px;}"
        "input:focus{outline:2px solid #185FA5;border-color:transparent;}"
        ".info{font-size:11px;color:#aaa;margin-bottom:16px;padding:8px 10px;background:#f9f9f7;border-radius:6px;font-family:monospace;}"
        ".step{font-size:11px;color:#185FA5;margin-bottom:20px;padding:8px 10px;background:#e6f1fb;border-radius:6px;}"
        "button{width:100%;padding:11px;background:#185FA5;color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:500;cursor:pointer;}"
        ".ok{display:none;background:#eaf3de;color:#27500a;border-radius:8px;padding:12px;font-size:13px;text-align:center;margin-top:14px;}"
        ".err{display:none;background:#fcebeb;color:#791f1f;border-radius:8px;padding:10px;font-size:13px;margin-bottom:12px;}"
        "</style></head>"
        "<body><div class='card'>"
        "<h1>CoffeeControl</h1>"
        "<div class='sub'>Configuración de red</div>"
        "<div class='step'>Ingresá los datos del WiFi de la empresa. La máquina se conectará automáticamente.</div>"
        "<div class='err' id='err'></div>"
        "<form id='f'>"
        "<label>Red WiFi (SSID) *</label>"
        "<input type='text' name='ssid' placeholder='NombreDeLaRed' required autocomplete='off'>"
        "<label>Contraseña WiFi</label>"
        "<input type='password' name='pass' placeholder='(dejar vacío si es abierta)' autocomplete='off'>");

    // Campo URL solo en modo local
    if (String(DEPLOYMENT_MODE) != "saas") {
        html += F("<label>URL del servidor *</label>"
                  "<input type='text' name='url' placeholder='http://192.168.1.50:3000' required autocomplete='off'>"
                  "<div style='font-size:11px;color:#aaa;margin-top:-10px;margin-bottom:14px'>"
                  "Consultá al administrador de IT si no la sabés."
                  "</div>");
    }

    html += F("<div class='info' id='mac'>Cargando ID...</div>"
              "<button type='submit'>Guardar y conectar</button>"
              "</form>"
              "<div class='ok' id='ok'>Listo. La máquina se conectará en unos segundos y aparecerá en el panel de administración.</div>"
              "</div>"
              "<script>"
              "fetch('/info').then(r=>r.json()).then(d=>{"
              "  document.getElementById('mac').textContent='ID: '+d.mac+' · Firmware: '+d.fw;"
              "});"
              "document.getElementById('f').onsubmit=function(e){"
              "  e.preventDefault();"
              "  const d=new FormData(this);"
              "  const ssid=d.get('ssid');"
              "  if(!ssid){document.getElementById('err').textContent='El SSID es requerido';document.getElementById('err').style.display='block';return;}"
              "  fetch('/save',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},"
              "    body:'ssid='+encodeURIComponent(ssid)+'&pass='+encodeURIComponent(d.get('pass')||'')+'&url='+encodeURIComponent(d.get('url')||'')"
              "  }).then(r=>{"
              "    if(r.ok){document.getElementById('ok').style.display='block';document.getElementById('f').style.display='none';}"
              "    else{document.getElementById('err').textContent='Error al guardar';document.getElementById('err').style.display='block';}"
              "  });"
              "};"
              "</script></body></html>");
    return html;
}

void checkResetButton() {
    // Mantener presionado al encender durante 5s → borra config WiFi/URL
    // GPIO16 (D0) NO soporta INPUT_PULLUP — se usa INPUT con pull-up externo
    pinMode(RESET_PIN, INPUT);
    delay(10); // estabilizar el pin

    if (digitalRead(RESET_PIN) == LOW) {
        Serial.print("[RESET] Botón presionado, mantener 5s para borrar config");
        unsigned long t = millis();
        int dots = 0;
        while (digitalRead(RESET_PIN) == LOW) {
            if (millis() - t > RESET_HOLD_MS) {
                // Borrar EEPROM
                EEPROM.begin(EEPROM_SIZE);
                for (int i = 0; i < EEPROM_SIZE; i++) EEPROM.write(i, 0);
                EEPROM.commit();
                Serial.println("\n[RESET] Config borrada — reiniciando al portal");
                ledBlink(10, 100);
                ESP.restart();
            }
            if (millis() - t > dots * 500) {
                Serial.print(".");
                dots++;
            }
            delay(50);
        }
        Serial.println(" (soltado antes de tiempo)");
    }
}

void startPortal() {
    portalMode = true;
    Serial.println("[PORTAL] Iniciando AP y portal de configuración...");

    WiFi.mode(WIFI_AP);
    WiFi.softAP(AP_SSID);  // Sin password — red abierta

    IPAddress ip(192, 168, 4, 1);
    WiFi.softAPConfig(ip, ip, IPAddress(255, 255, 255, 0));

    // DNS: redirige todo a 192.168.4.1 → activa el popup de portal cautivo
    dnsServer.setErrorReplyCode(DNSReplyCode::NoError);
    dnsServer.start(DNS_PORT, "*", ip);

    String portalHtml = buildPortalHTML();

    // Página principal del portal
    portalServer.on("/", HTTP_GET, [portalHtml]() {
        portalServer.send(200, "text/html", portalHtml);
    });

    // Info de la máquina (MAC + versión firmware)
    portalServer.on("/info", HTTP_GET, []() {
        String json = "{\"mac\":\"" + macAddress + "\",\"fw\":\"v2.0\",\"mode\":\"" + String(DEPLOYMENT_MODE) + "\"}";
        portalServer.send(200, "application/json", json);
    });

    // Captive portal detection — iOS
    portalServer.on("/hotspot-detect.html", HTTP_GET, []() {
        portalServer.sendHeader("Location", "http://" AP_IP, true);
        portalServer.send(302, "text/plain", "");
    });
    portalServer.on("/library/test/success.html", HTTP_GET, []() {
        portalServer.sendHeader("Location", "http://" AP_IP, true);
        portalServer.send(302, "text/plain", "");
    });

    // Captive portal detection — Android
    portalServer.on("/generate_204", HTTP_GET, []() {
        portalServer.sendHeader("Location", "http://" AP_IP, true);
        portalServer.send(302, "text/plain", "");
    });
    portalServer.on("/connectivitycheck.html", HTTP_GET, []() {
        portalServer.sendHeader("Location", "http://" AP_IP, true);
        portalServer.send(302, "text/plain", "");
    });

    // Guardar configuración
    portalServer.on("/save", HTTP_POST, []() {
        String ssid = portalServer.arg("ssid");
        String pass = portalServer.arg("pass");
        String url  = portalServer.arg("url");

        if (ssid.length() == 0) {
            portalServer.send(400, "text/plain", "ssid requerido");
            return;
        }

        // En modo SaaS la URL siempre viene del firmware
        if (String(DEPLOYMENT_MODE) == "saas" || url.length() == 0) {
            url = String(BACKEND_URL);
        }

        saveConfig(ssid, pass, url);
        portalServer.send(200, "text/plain", "ok");

        Serial.println("[PORTAL] Configuración guardada, reiniciando...");
        ledBlink(3, 200);
        delay(1500);
        ESP.restart();
    });

    // Captive portal — cualquier URL redirige al portal
    portalServer.onNotFound([]() {
        portalServer.sendHeader("Location", "http://" AP_IP, true);
        portalServer.send(302, "text/plain", "");
    });

    portalServer.begin();
    Serial.printf("[PORTAL] AP activo — SSID: %s (sin password)\n", AP_SSID);
    Serial.printf("[PORTAL] Abrir http://%s en el celular\n", AP_IP);
    ledBlink(5, 100);
}

// ══════════════════════════════════════════════════════
//  WIFI — conectar a la red de la empresa
// ══════════════════════════════════════════════════════
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
        digitalWrite(LED_PIN, HIGH);
        wifiReady = true;
        return true;
    }

    Serial.println("\n[WiFi] Error de conexión");
    return false;
}

// ══════════════════════════════════════════════════════
//  AUTOREGISTRO — POST /api/machines/register
//  El backend recibe la MAC y crea la máquina como "pendiente"
//  El admin la aprueba desde el panel
// ══════════════════════════════════════════════════════
void registerMachine() {
    if (!wifiReady) return;

    Serial.printf("[REG] Registrando MAC %s en %s ...\n", macAddress.c_str(), backendBase.c_str());

    WiFiClient client;
    HTTPClient http;
    String url = backendBase + "/api/machines/register";

    if (!http.begin(client, url)) {
        Serial.println("[REG] ERROR — no se pudo iniciar HTTP");
        return;
    }

    http.addHeader("Content-Type", "application/json");
    http.addHeader("X-Registration-Secret", REGISTRATION_SECRET);
    http.setTimeout(HTTP_TIMEOUT_MS);

    String body = "{\"mac\":\"" + macAddress + "\"}";
    int code = http.POST(body);

    if (code == 200) {
        Serial.println("[REG] OK — maquina APROBADA, operativa");
    } else if (code == 202) {
        Serial.println("[REG] PENDIENTE — esperando aprobacion del admin en el panel");
        ledBlink(2, 300);
    } else if (code == 401) {
        Serial.println("[REG] ERROR 401 — secret incorrecto, verificar REGISTRATION_SECRET en firmware y .env");
    } else if (code <= 0) {
        Serial.printf("[REG] ERROR — sin respuesta del backend (codigo %d)\n", code);
        Serial.printf("[REG]   Verificar URL: %s\n", backendBase.c_str());
    } else {
        Serial.printf("[REG] ERROR HTTP %d\n", code);
    }

    http.end();
}

// ══════════════════════════════════════════════════════
//  SETUP
// ══════════════════════════════════════════════════════
void setup() {
    Serial.begin(115200);
    delay(100);
    Serial.println("\n[BOOT] CoffeeControl Firmware v2");

    pinMode(LED_PIN, OUTPUT);
    ledBlink(3, 100);

    // Verificar botón de reset ANTES de todo lo demás
    checkResetButton();

    // Leer MAC antes de todo
    macAddress = WiFi.macAddress();
    macAddress.replace(":", "");  // "AABBCCDDEEFF" sin separadores
    Serial.println();
    Serial.println("====================================");
    Serial.println("  CoffeeControl Firmware v2");
    Serial.printf( "  MAC:  %s\n", macAddress.c_str());
    Serial.printf( "  Modo: %s\n", DEPLOYMENT_MODE);
    Serial.println("====================================");
    Serial.println();

    // SPI + RC522
    SPI.begin();
    rfid.PCD_Init();
    delay(50);
    byte ver = rfid.PCD_ReadRegister(MFRC522::VersionReg);
    if (ver == 0x00 || ver == 0xFF) {
        Serial.println("[NFC] ERROR — RC522 no responde (revisar cableado SPI y alimentacion 3.3V)");
        Serial.printf("[NFC]   SS=D4  SCK=D5  MOSI=D7  MISO=D6  RST=D3\n");
    } else {
        Serial.printf("[NFC] RC522 OK — version chip: 0x%02X\n", ver);
    }

    // MDB
    mdb.begin();
    Serial.println("[MDB] 9-bit software serial listo");

    // Leer config guardada
    readConfig();

    if (wifiSSID.length() == 0) {
        // Sin configuración → modo portal
        Serial.println("[BOOT] Sin red configurada → modo portal");
        startPortal();
    } else {
        // Con configuración → conectar
        if (!connectWiFi()) {
            // Falló la conexión → abrir portal para reconfigurar
            Serial.println("[BOOT] Fallo WiFi → modo portal");
            startPortal();
        } else {
            // Conectado → registrarse en el backend
            Serial.printf("[CFG] Backend: %s\n", backendBase.c_str());
            Serial.printf("[CFG] Modo deployment: %s\n", DEPLOYMENT_MODE);
            registerMachine();
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
    // NFC funciona siempre — no requiere que MDB haya llegado a ENABLED
    handleMDB();
    handleNFC();

    // Reconexión WiFi periódica
    static unsigned long lastWifiCheck = 0;
    if (millis() - lastWifiCheck > 30000) {
        lastWifiCheck = millis();
        if (WiFi.status() != WL_CONNECTED) {
            Serial.println("[WiFi] Reconectando...");
            WiFi.reconnect();
        }
    }

    // Heartbeat — resumen de estado cada 60 segundos
    static unsigned long lastHeartbeat = 0;
    if (millis() - lastHeartbeat > 60000) {
        lastHeartbeat = millis();
        const char* mdbStStr[] = {"INACTIVE","DISABLED","ENABLED","SESSION_IDLE","VEND_PENDING"};
        Serial.printf("[STATUS] WiFi:%s | MDB:%s | Backend:%s\n",
            WiFi.status() == WL_CONNECTED ? "OK" : "DESCONECTADO",
            mdbStStr[mdbState],
            backendBase.c_str());
    }

    yield();
}

// ══════════════════════════════════════════════════════
//  NFC
// ══════════════════════════════════════════════════════
void handleNFC() {
    if (millis() - lastNFCRead < NFC_COOLDOWN_MS) return;
    if (!rfid.PICC_IsNewCardPresent() || !rfid.PICC_ReadCardSerial()) return;

    lastNFCRead = millis();

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

    Serial.println("[TAP] Enviando al backend...");
    int code = postTap(uid);

    if (code == 200) {
        Serial.println("[TAP] APROBADO — iniciando sesion MDB");
        sessionUID = uid; pendingSession = true; mdbState = SESSION_IDLE;
        ledBlink(2, 100);
    } else if (code == 403) {
        Serial.println("[TAP] DENEGADO — limite diario alcanzado");
        ledBlink(5, 80);
    } else if (code == 401) {
        Serial.println("[TAP] ERROR 401 — maquina no reconocida, re-registrando...");
        registerMachine();
        ledBlink(3, 300);
    } else if (code <= 0) {
        Serial.printf("[TAP] ERROR — sin respuesta (codigo %d), WiFi: %s\n",
            code, WiFi.status() == WL_CONNECTED ? "conectado" : "DESCONECTADO");
        ledBlink(3, 200);
    } else {
        Serial.printf("[TAP] ERROR %d\n", code);
        ledBlink(3, 200);
    }
}

// ══════════════════════════════════════════════════════
//  HTTP — tap con autenticación por MAC
// ══════════════════════════════════════════════════════
int postTap(const String& uid) {
    if (WiFi.status() != WL_CONNECTED) return -1;

    WiFiClient client;
    HTTPClient http;
    if (!http.begin(client, backendBase + "/api/tap")) return -1;

    http.addHeader("Content-Type", "application/json");
    // Autenticación: MAC address en lugar de secret
    http.addHeader("X-Machine-Mac", macAddress);
    http.setTimeout(HTTP_TIMEOUT_MS);

    int code = http.POST("{\"nfc_uid\":\"" + uid + "\"}");
    http.end();
    return code;
}

void notifyVendResult(const String& uid, uint16_t itemId, uint16_t amount, bool ok) {
    Serial.printf("[TAP] Notificando venta %s — item #%d  $%d centavos\n", ok ? "EXITOSA" : "FALLIDA", itemId, amount);
    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("[TAP] ADVERTENCIA — WiFi desconectado, no se pudo notificar al backend");
        return;
    }
    WiFiClient client; HTTPClient http;
    String url = backendBase + (ok ? "/api/tap/confirm" : "/api/tap/cancel");
    if (!http.begin(client, url)) return;
    http.addHeader("Content-Type", "application/json");
    http.addHeader("X-Machine-Mac", macAddress);
    http.setTimeout(HTTP_TIMEOUT_MS);
    http.POST("{\"nfc_uid\":\"" + uid + "\",\"item_id\":" + itemId + ",\"amount\":" + amount + "}");
    http.end();
}

// ══════════════════════════════════════════════════════
//  MDB (igual que v1)
// ══════════════════════════════════════════════════════
void handleMDB() {
    uint16_t first = mdb.read(2);
    if (first == 0xFFFF) return;
    if (!MDB9bit::isAddress(first)) return;
    uint8_t addr = MDB9bit::value(first);
    if ((addr & 0xF8) != MDB_ADDR_CASHLESS) return;
    uint8_t cmd = addr & 0x07;
    uint16_t dataBuf[16]; uint8_t dataLen = mdb.readFrame(dataBuf, 16, 3);
    uint8_t d[16];
    for (uint8_t i = 0; i < dataLen; i++) d[i] = MDB9bit::value(dataBuf[i]);

    switch (cmd) {
        case MDB_CMD_RESET:  cmdReset();           break;
        case MDB_CMD_SETUP:  cmdSetup(d,dataLen);  break;
        case MDB_CMD_POLL:   cmdPoll();            break;
        case MDB_CMD_VEND:   cmdVend(d,dataLen);   break;
        case MDB_CMD_READER: cmdReader(d,dataLen); break;
        default: mdbSendNAK(); break;
    }
}

void cmdReset() {
    Serial.println("[MDB] RESET recibido → estado: INACTIVE");
    mdbState=INACTIVE; justReset=true; pendingSession=false;
    vendApproved=false; sessionUID=""; mdbSendACK();
}
void cmdSetup(uint8_t*d,uint8_t len){
    if(len==0){mdbSendNAK();return;}
    if(d[0]==SETUP_CONFIG){
        Serial.println("[MDB] SETUP config → respondiendo capacidades, estado: DISABLED");
        uint8_t r[]={0x02,0x00,0x24,0x01,0x02,0x0A,0x00};
        mdbSendData(r,sizeof(r)); mdbState=DISABLED;
    } else { mdbSendACK(); }
}
void cmdPoll(){
    switch(mdbState){
        case INACTIVE:
            if(justReset){mdbSendByte(MDB_JUST_RESET);justReset=false;mdbState=DISABLED;}
            else mdbSendACK(); break;
        case DISABLED: mdbSendACK(); break;
        case ENABLED:  mdbSendACK(); break;
        case SESSION_IDLE:
            if(pendingSession){
                uint8_t r[3]={MDB_BEGIN_SESSION,(FUNDS_UNLIMITED>>8)&0xFF,FUNDS_UNLIMITED&0xFF};
                mdbSendData(r,3); pendingSession=false;
            } else mdbSendACK(); break;
        case VEND_PENDING:
            if(vendApproved){
                uint8_t r[3]={MDB_VEND_APPROVED,(vendAmount>>8)&0xFF,vendAmount&0xFF};
                mdbSendData(r,3); vendApproved=false;
            } else {
                mdbSendByte(MDB_VEND_DENIED); mdbState=ENABLED; sessionUID="";
            } break;
    }
}
void cmdVend(uint8_t*d,uint8_t len){
    if(len==0){mdbSendNAK();return;}
    switch(d[0]){
        case VEND_REQUEST:
            if(len>=5){sessionAmount=((uint16_t)d[1]<<8)|d[2];sessionItemId=((uint16_t)d[3]<<8)|d[4];
            Serial.printf("[MDB] VEND_REQUEST — item #%d  $%d centavos\n", sessionItemId, sessionAmount);
            vendApproved=true;vendAmount=sessionAmount;mdbState=VEND_PENDING;} break;
        case VEND_SUCCESS:
            Serial.println("[MDB] VEND_SUCCESS — venta confirmada por la maquina");
            notifyVendResult(sessionUID,sessionItemId,sessionAmount,true);
            mdbSendACK();mdbState=SESSION_IDLE;sessionUID=""; break;
        case VEND_FAILURE:
            Serial.println("[MDB] VEND_FAILURE — venta fallida (error mecanico)");
            notifyVendResult(sessionUID,sessionItemId,sessionAmount,false);
            mdbSendACK();mdbState=SESSION_IDLE;sessionUID=""; break;
        case VEND_END:
            Serial.println("[MDB] VEND_END → sesion cerrada");
            mdbSendByte(MDB_END_SESSION);mdbState=ENABLED;sessionUID=""; break;
        case VEND_CANCEL:
            Serial.println("[MDB] VEND_CANCEL");
            mdbSendByte(MDB_CANCELLED);mdbState=SESSION_IDLE; break;
        default: mdbSendNAK();
    }
}
void cmdReader(uint8_t*d,uint8_t len){
    if(len==0){mdbSendNAK();return;}
    if(d[0]==READER_ENABLE){
        Serial.println("[MDB] READER ENABLE → NFC habilitado, esperando tarjeta");
        mdbState=ENABLED;
    }
    if(d[0]==READER_DISABLE){
        Serial.println("[MDB] READER DISABLE → NFC deshabilitado");
        mdbState=DISABLED;sessionUID="";
    }
    mdbSendACK();
}

void mdbSendACK(){mdb.sendData(MDB_ACK);}
void mdbSendNAK(){mdb.sendData(MDB_NAK);}
void mdbSendByte(uint8_t b){mdb.sendData(b);mdb.sendData(b);}
void mdbSendData(uint8_t*data,uint8_t len){
    uint8_t chk=0;
    for(uint8_t i=0;i<len;i++){mdb.sendData(data[i]);chk+=data[i];}
    mdb.sendData(chk);
}

void ledBlink(int n,int ms){
    for(int i=0;i<n;i++){digitalWrite(LED_PIN,LOW);delay(ms);digitalWrite(LED_PIN,HIGH);delay(ms);}
}
void ledToggle(){digitalWrite(LED_PIN,!digitalRead(LED_PIN));}
