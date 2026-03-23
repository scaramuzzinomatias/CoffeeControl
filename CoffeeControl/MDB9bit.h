/*
 * MDB9bit.h — Implementación por software del protocolo MDB (9 bits)
 * para ESP8266.
 *
 * Técnica: bit-banging sobre GPIO.
 * A 9600 baud cada bit dura 104.16 µs.
 * El ESP8266 a 80 MHz tiene ~8.333 ciclos por bit → timing más que suficiente.
 *
 * El 9° bit en MDB:
 *   1 = byte de DIRECCIÓN (quién tiene que escuchar)
 *   0 = byte de DATO      (contenido del mensaje)
 *
 * Uso:
 *   MDB9bit mdb(TX_PIN, RX_PIN);
 *   mdb.begin();
 *   mdb.sendAddress(0x10);   // byte de dirección
 *   mdb.sendData(0x00);      // byte de dato
 *   uint16_t b = mdb.read(); // b >> 8 = bit9, b & 0xFF = dato
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
    digitalWrite(_tx, HIGH); // idle = HIGH en UART
    _bitUs = 1000000UL / MDB_BAUD; // 104 µs
  }

  // ── Transmisión ──────────────────────────────────────────

  // Byte de DIRECCIÓN: bit9 = 1
  void sendAddress(uint8_t b) {
    _sendByte(b, 1);
  }

  // Byte de DATO: bit9 = 0
  void sendData(uint8_t b) {
    _sendByte(b, 0);
  }

  // Envía un frame completo: [addr] [data...] [checksum]
  // checksum = suma acumulada mod 256 de todos los bytes de dato
  void sendFrame(uint8_t addr, uint8_t* data, uint8_t len) {
    sendAddress(addr);
    uint8_t chk = 0;
    for (uint8_t i = 0; i < len; i++) {
      sendData(data[i]);
      chk += data[i];
    }
    sendData(chk);
  }

  // ── Recepción ────────────────────────────────────────────

  // Retorna un uint16_t:
  //   bits 15..9  → no usados
  //   bit  8      → el 9° bit MDB (1=dirección, 0=dato)
  //   bits 7..0   → el byte en sí
  // Retorna 0xFFFF si timeout.
  uint16_t read(uint32_t timeoutMs = 10) {
    // Esperar flanco bajante (START bit)
    uint32_t deadline = millis() + timeoutMs;
    while (digitalRead(_rx) == HIGH) {
      if (millis() > deadline) return 0xFFFF; // timeout
      yield();
    }

    // Estamos en el START bit — esperar hasta la mitad del primer bit de dato
    delayMicroseconds(_bitUs + _bitUs / 2);

    uint8_t value = 0;
    for (uint8_t i = 0; i < 8; i++) {
      value |= (digitalRead(_rx) << i);
      delayMicroseconds(_bitUs);
    }

    // Leer el 9° bit
    uint8_t bit9 = digitalRead(_rx);
    delayMicroseconds(_bitUs);

    // STOP bit (ignorar)
    // delayMicroseconds(_bitUs);

    return ((uint16_t)bit9 << 8) | value;
  }

  // Lee un frame completo hasta timeout entre bytes
  // Llena buf[], retorna cantidad de bytes leídos
  uint8_t readFrame(uint16_t* buf, uint8_t maxLen, uint32_t interByteMs = 5) {
    uint8_t count = 0;
    while (count < maxLen) {
      uint16_t b = read(interByteMs);
      if (b == 0xFFFF) break; // timeout = fin del frame
      buf[count++] = b;
    }
    return count;
  }

  // Helpers de interpretación
  static bool isAddress(uint16_t b) { return (b >> 8) & 1; }
  static bool isData(uint16_t b)    { return !isAddress(b); }
  static uint8_t value(uint16_t b)  { return b & 0xFF; }

private:
  uint8_t  _tx, _rx;
  uint32_t _bitUs;
  static const uint32_t MDB_BAUD = 9600;

  // Envío de 1 byte con bit9 explícito
  // Frame: START(0) | b0..b7 | bit9 | STOP(1)
  void ICACHE_RAM_ATTR _sendByte(uint8_t b, uint8_t bit9) {
    // Deshabilitar interrupciones para timing preciso
    noInterrupts();

    // START bit
    digitalWrite(_tx, LOW);
    delayMicroseconds(_bitUs);

    // 8 bits de dato (LSB primero)
    for (uint8_t i = 0; i < 8; i++) {
      digitalWrite(_tx, (b >> i) & 1);
      delayMicroseconds(_bitUs);
    }

    // 9° bit (modo MDB: 1=dirección, 0=dato)
    digitalWrite(_tx, bit9);
    delayMicroseconds(_bitUs);

    // STOP bit
    digitalWrite(_tx, HIGH);
    delayMicroseconds(_bitUs);

    interrupts();
  }
};
