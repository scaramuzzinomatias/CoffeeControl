/*
 * CoffeeControl — Firmware ESP8266 (con MDB 9 bits por software)
 * ─────────────────────────────────────────────────────────────
 * Hardware:
 *   - ESP8266 (NodeMCU / Wemos D1 mini)
 *   - Módulo RC522 (NFC 13.56 MHz, vía SPI)
 *   - MAX3232 (adaptador de nivel 5V↔3.3V para MDB)
 *
 * El 9° bit MDB se genera por software (bit-banging).
 * No se necesita ATtiny85 ni hardware adicional.
 * ─────────────────────────────────────────────────────────────
 */

#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <WiFiClient.h>
#include <SPI.h>
#include <MFRC522.h>
#include "MDB9bit.h"

// ══════════════════════════════════════════════════════════════
//  CONFIGURACIÓN
// ══════════════════════════════════════════════════════════════
#define WIFI_SSID       "TuRedWiFi"
#define WIFI_PASSWORD   "TuPassword"
#define BACKEND_URL     "http://192.168.1.100:3000/api/tap"
#define MACHINE_ID      1
#define MACHINE_SECRET  "cc-secret-1"

// ══════════════════════════════════════════════════════════════
//  PINES
// ══════════════════════════════════════════════════════════════
#define RC522_SS_PIN   D4
#define RC522_RST_PIN  D3
#define MDB_TX_PIN     D2
#define MDB_RX_PIN     D1
#define LED_PIN        LED_BUILTIN

// ══════════════════════════════════════════════════════════════
//  COMANDOS MDB
// ══════════════════════════════════════════════════════════════
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

// ══════════════════════════════════════════════════════════════
//  ESTADO MDB
// ══════════════════════════════════════════════════════════════
enum MDBState { INACTIVE, DISABLED, ENABLED, SESSION_IDLE, VEND_PENDING };

// ══════════════════════════════════════════════════════════════
//  OBJETOS GLOBALES
// ══════════════════════════════════════════════════════════════
MFRC522  rfid(RC522_SS_PIN, RC522_RST_PIN);
MDB9bit  mdb(MDB_TX_PIN, MDB_RX_PIN);

MDBState mdbState       = INACTIVE;
bool     justReset      = true;
bool     pendingSession = false;
bool     vendApproved   = false;
uint16_t vendAmount     = 0;
String   sessionUID     = "";
uint16_t sessionItemId  = 0;
uint16_t sessionAmount  = 0;

unsigned long lastNFCRead = 0;
#define NFC_COOLDOWN_MS 2500
#define HTTP_TIMEOUT_MS 4000

// ══════════════════════════════════════════════════════════════
//  SETUP
// ══════════════════════════════════════════════════════════════
void setup() {
  Serial.begin(115200);
  delay(100);
  Serial.println("\n[BOOT] CoffeeControl — MDB 9bit por software");
  pinMode(LED_PIN, OUTPUT);
  ledBlink(3, 100);
  SPI.begin();
  rfid.PCD_Init();
  Serial.println("[NFC] RC522 listo");
  mdb.begin();
  Serial.println("[MDB] 9-bit software serial listo");
  connectWiFi();
  Serial.println("[BOOT] Sistema listo");
}

// ══════════════════════════════════════════════════════════════
//  LOOP
// ══════════════════════════════════════════════════════════════
void loop() {
  handleMDB();
  if (mdbState == ENABLED) handleNFC();
  yield();
}

// ══════════════════════════════════════════════════════════════
//  MDB — Recepción y despacho
// ══════════════════════════════════════════════════════════════
void handleMDB() {
  uint16_t first = mdb.read(2);
  if (first == 0xFFFF) return;
  if (!MDB9bit::isAddress(first)) return;
  uint8_t addr = MDB9bit::value(first);
  if ((addr & 0xF8) != MDB_ADDR_CASHLESS) return;
  uint8_t cmd = addr & 0x07;

  uint16_t dataBuf[16];
  uint8_t  dataLen = mdb.readFrame(dataBuf, 16, 3);
  uint8_t  d[16];
  for (uint8_t i = 0; i < dataLen; i++) d[i] = MDB9bit::value(dataBuf[i]);

  Serial.printf("[MDB] CMD=0x%02X len=%d\n", cmd, dataLen);

  switch (cmd) {
    case MDB_CMD_RESET:  cmdReset();            break;
    case MDB_CMD_SETUP:  cmdSetup(d, dataLen);  break;
    case MDB_CMD_POLL:   cmdPoll();             break;
    case MDB_CMD_VEND:   cmdVend(d, dataLen);   break;
    case MDB_CMD_READER: cmdReader(d, dataLen); break;
    default: mdbSendNAK(); break;
  }
}

void cmdReset() {
  mdbState = INACTIVE; justReset = true;
  pendingSession = false; vendApproved = false; sessionUID = "";
  mdbSendACK();
}

void cmdSetup(uint8_t* d, uint8_t len) {
  if (len == 0) { mdbSendNAK(); return; }
  if (d[0] == SETUP_CONFIG) {
    uint8_t resp[] = { 0x02, 0x00, 0x24, 0x01, 0x02, 0x0A, 0x00 };
    mdbSendData(resp, sizeof(resp));
    mdbState = DISABLED;
  } else if (d[0] == SETUP_PRICES) {
    mdbSendACK();
  } else {
    mdbSendNAK();
  }
}

void cmdPoll() {
  switch (mdbState) {
    case INACTIVE:
      if (justReset) {
        mdbSendByte(MDB_JUST_RESET);
        justReset = false; mdbState = DISABLED;
      } else mdbSendACK();
      break;
    case DISABLED: mdbSendACK(); break;
    case ENABLED:  mdbSendACK(); break;
    case SESSION_IDLE:
      if (pendingSession) {
        uint8_t r[3] = { MDB_BEGIN_SESSION, (FUNDS_UNLIMITED>>8)&0xFF, FUNDS_UNLIMITED&0xFF };
        mdbSendData(r, 3); pendingSession = false;
      } else mdbSendACK();
      break;
    case VEND_PENDING:
      if (vendApproved) {
        uint8_t r[3] = { MDB_VEND_APPROVED, (vendAmount>>8)&0xFF, vendAmount&0xFF };
        mdbSendData(r, 3); vendApproved = false;
      } else {
        mdbSendByte(MDB_VEND_DENIED);
        mdbState = ENABLED; sessionUID = "";
      }
      break;
  }
}

void cmdVend(uint8_t* d, uint8_t len) {
  if (len == 0) { mdbSendNAK(); return; }
  switch (d[0]) {
    case VEND_REQUEST:
      if (len >= 5) {
        sessionAmount = ((uint16_t)d[1]<<8)|d[2];
        sessionItemId = ((uint16_t)d[3]<<8)|d[4];
        vendApproved = true; vendAmount = sessionAmount;
        mdbState = VEND_PENDING;
      }
      break;
    case VEND_SUCCESS:
      notifyVendResult(sessionUID, sessionItemId, sessionAmount, true);
      mdbSendACK(); mdbState = SESSION_IDLE; sessionUID = "";
      break;
    case VEND_FAILURE:
      notifyVendResult(sessionUID, sessionItemId, sessionAmount, false);
      mdbSendACK(); mdbState = SESSION_IDLE; sessionUID = "";
      break;
    case VEND_END:
      mdbSendByte(MDB_END_SESSION);
      mdbState = ENABLED; sessionUID = "";
      break;
    case VEND_CANCEL:
      mdbSendByte(MDB_CANCELLED); mdbState = SESSION_IDLE; break;
    default: mdbSendNAK();
  }
}

void cmdReader(uint8_t* d, uint8_t len) {
  if (len == 0) { mdbSendNAK(); return; }
  if (d[0] == READER_ENABLE)  { mdbState = ENABLED; Serial.println("[MDB] READER ENABLE"); }
  if (d[0] == READER_DISABLE) { mdbState = DISABLED; sessionUID = ""; Serial.println("[MDB] READER DISABLE"); }
  mdbSendACK();
}

// ══════════════════════════════════════════════════════════════
//  MDB — Envío (todas las respuestas son bytes de DATO, bit9=0)
// ══════════════════════════════════════════════════════════════
void mdbSendACK()  { mdb.sendData(MDB_ACK); }
void mdbSendNAK()  { mdb.sendData(MDB_NAK); }
void mdbSendByte(uint8_t b) { mdb.sendData(b); mdb.sendData(b); }
void mdbSendData(uint8_t* data, uint8_t len) {
  uint8_t chk = 0;
  for (uint8_t i = 0; i < len; i++) { mdb.sendData(data[i]); chk += data[i]; }
  mdb.sendData(chk);
}

// ══════════════════════════════════════════════════════════════
//  NFC
// ══════════════════════════════════════════════════════════════
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
  rfid.PICC_HaltA(); rfid.PCD_StopCrypto1();
  Serial.printf("[NFC] %s\n", uid.c_str());
  int code = postTap(uid);
  if (code == 200) {
    sessionUID = uid; pendingSession = true; mdbState = SESSION_IDLE;
    ledBlink(2, 100);
  } else {
    ledBlink(code == 403 ? 5 : 3, 80);
  }
}

// ══════════════════════════════════════════════════════════════
//  HTTP
// ══════════════════════════════════════════════════════════════
int postTap(const String& uid) {
  if (WiFi.status() != WL_CONNECTED) return -1;
  WiFiClient c; HTTPClient h;
  if (!h.begin(c, BACKEND_URL)) return -1;
  h.addHeader("Content-Type", "application/json");
  h.addHeader("X-Machine-Secret", MACHINE_SECRET);
  h.setTimeout(HTTP_TIMEOUT_MS);
  int code = h.POST("{\"nfc_uid\":\"" + uid + "\",\"machine_id\":" + MACHINE_ID + "}");
  h.end(); return code;
}

void notifyVendResult(const String& uid, uint16_t itemId, uint16_t amount, bool ok) {
  if (WiFi.status() != WL_CONNECTED) return;
  WiFiClient c; HTTPClient h;
  String url = String(BACKEND_URL) + (ok ? "/confirm" : "/cancel");
  if (!h.begin(c, url)) return;
  h.addHeader("Content-Type", "application/json");
  h.addHeader("X-Machine-Secret", MACHINE_SECRET);
  h.setTimeout(HTTP_TIMEOUT_MS);
  h.POST("{\"nfc_uid\":\"" + uid + "\",\"machine_id\":" + MACHINE_ID
       + ",\"item_id\":" + itemId + ",\"amount\":" + amount + "}");
  h.end();
}

// ══════════════════════════════════════════════════════════════
//  WiFi
// ══════════════════════════════════════════════════════════════
void connectWiFi() {
  WiFi.mode(WIFI_STA); WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("[WiFi] Conectando");
  int t = 0;
  while (WiFi.status() != WL_CONNECTED && t++ < 30) { delay(500); Serial.print("."); ledToggle(); }
  Serial.printf("\n[WiFi] %s — %s\n",
    WiFi.status()==WL_CONNECTED ? "OK" : "ERROR",
    WiFi.localIP().toString().c_str());
}

void ledBlink(int n, int ms) {
  for (int i=0;i<n;i++) { digitalWrite(LED_PIN,LOW);delay(ms);digitalWrite(LED_PIN,HIGH);delay(ms); }
}
void ledToggle() { digitalWrite(LED_PIN, !digitalRead(LED_PIN)); }
