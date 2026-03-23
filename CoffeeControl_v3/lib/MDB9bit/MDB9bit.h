/*
 * MDB9bit.h — Protocolo MDB 9-bit por software para ESP32-C3
 *
 * Adaptación de la versión ESP8266:
 *   - ICACHE_RAM_ATTR → IRAM_ATTR (ESP32)
 *   - delayMicroseconds / noInterrupts / interrupts → estándar Arduino
 *
 * El protocolo MDB usa 9 bits:
 *   9° bit = 1 → byte de DIRECCIÓN
 *   9° bit = 0 → byte de DATO
 *
 * Conexión en ESP32-C3 Super Mini:
 *   MDB_TX = GPIO6  (salida al bus MDB)
 *   MDB_RX = GPIO5  (entrada del bus MDB)
 */

#pragma once
#include <Arduino.h>

class MDB9bit {
public:
    MDB9bit(uint8_t txPin, uint8_t rxPin)
        : _tx(txPin), _rx(rxPin) {}

    void begin() {
        pinMode(_tx, OUTPUT);
        pinMode(_rx, INPUT);
        digitalWrite(_tx, HIGH);        // idle = HIGH en UART
        _bitUs = 1000000UL / MDB_BAUD;  // 104 µs a 9600 baud
    }

    // ── Transmisión ──────────────────────────────────────────

    void sendAddress(uint8_t b) { _sendByte(b, 1); }
    void sendData(uint8_t b)    { _sendByte(b, 0); }

    void sendFrame(uint8_t addr, uint8_t* data, uint8_t len) {
        sendAddress(addr);
        uint8_t chk = 0;
        for (uint8_t i = 0; i < len; i++) { sendData(data[i]); chk += data[i]; }
        sendData(chk);
    }

    // ── Recepción ────────────────────────────────────────────
    // Retorna uint16_t: bit8 = 9° bit MDB, bits 7..0 = dato
    // Retorna 0xFFFF si timeout.

    uint16_t read(uint32_t timeoutMs = 10) {
        uint32_t deadline = millis() + timeoutMs;
        while (digitalRead(_rx) == HIGH) {
            if (millis() > deadline) return 0xFFFF;
            yield();
        }
        // Estamos en START bit — esperar hasta mitad del primer bit de dato
        delayMicroseconds(_bitUs + _bitUs / 2);

        uint8_t value = 0;
        for (uint8_t i = 0; i < 8; i++) {
            value |= (digitalRead(_rx) << i);
            delayMicroseconds(_bitUs);
        }
        uint8_t bit9 = digitalRead(_rx);
        delayMicroseconds(_bitUs);

        return ((uint16_t)bit9 << 8) | value;
    }

    uint8_t readFrame(uint16_t* buf, uint8_t maxLen, uint32_t interByteMs = 5) {
        uint8_t count = 0;
        while (count < maxLen) {
            uint16_t b = read(interByteMs);
            if (b == 0xFFFF) break;
            buf[count++] = b;
        }
        return count;
    }

    static bool    isAddress(uint16_t b) { return (b >> 8) & 1; }
    static bool    isData(uint16_t b)    { return !isAddress(b); }
    static uint8_t value(uint16_t b)     { return b & 0xFF; }

private:
    uint8_t  _tx, _rx;
    uint32_t _bitUs;
    static const uint32_t MDB_BAUD = 9600;

    // IRAM_ATTR: la función se ejecuta desde RAM para timing preciso
    void IRAM_ATTR _sendByte(uint8_t b, uint8_t bit9) {
        noInterrupts();

        // START bit
        digitalWrite(_tx, LOW);
        delayMicroseconds(_bitUs);

        // 8 bits de dato (LSB primero)
        for (uint8_t i = 0; i < 8; i++) {
            digitalWrite(_tx, (b >> i) & 1);
            delayMicroseconds(_bitUs);
        }

        // 9° bit (1 = dirección, 0 = dato)
        digitalWrite(_tx, bit9);
        delayMicroseconds(_bitUs);

        // STOP bit
        digitalWrite(_tx, HIGH);
        delayMicroseconds(_bitUs);

        interrupts();
    }
};
