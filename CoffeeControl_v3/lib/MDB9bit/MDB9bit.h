/*
 * MDB9bit.h — Protocolo MDB 9-bit para ESP32-C3
 *
 * RX & TX: UART1 hardware a 9600 8E1.
 *   MDB frame: START | D0-D7 | MODE | STOP  (11 bits)
 *   8E1 frame: START | D0-D7 | PAR  | STOP  (11 bits)
 *   → Alineación perfecta. El bit de paridad cae donde MODE de MDB.
 *
 *   Para TX: mode=1 (address) → paridad ODD forzada
 *            mode=0 (data)    → paridad EVEN forzada
 *   Se cambia la config de paridad antes de cada byte TX.
 *
 *   Detección address/data RX: por rx_tout del hardware UART.
 *
 * Conexión en ESP32-C3 Super Mini:
 *   MDB_TX = GPIO20  (salida al bus MDB via BC548, UART1 TX)
 *   MDB_RX = GPIO21  (entrada del bus MDB via BC548, UART1 RX)
 *   Ambos BC548 common-emitter → señal invertida en TX y RX
 */

#pragma once
#include <Arduino.h>
#include "driver/uart.h"

#define MDB_UART_NUM   UART_NUM_1
#define MDB_UART_BUF   256
#define MDB_TX_BUF     256
#define MDB_RX_RING    64

class MDB9bit {
public:
    MDB9bit(uint8_t txPin, uint8_t rxPin)
        : _tx(txPin), _rx(rxPin), _ringHead(0), _ringTail(0) {}

    void begin() {
        // ── UART1 hardware 8E1 para RX y TX ─────────────────
        uart_config_t cfg = {};
        cfg.baud_rate  = MDB_BAUD;
        cfg.data_bits  = UART_DATA_8_BITS;
        cfg.parity     = UART_PARITY_EVEN;
        cfg.stop_bits  = UART_STOP_BITS_1;
        cfg.flow_ctrl  = UART_HW_FLOWCTRL_DISABLE;
        cfg.source_clk = UART_SCLK_APB;

        uart_driver_install(MDB_UART_NUM, MDB_UART_BUF, MDB_TX_BUF, 16, &_evtQueue, 0);
        uart_param_config(MDB_UART_NUM, &cfg);
        // TX en _tx (GPIO20), RX en _rx (GPIO21)
        uart_set_pin(MDB_UART_NUM, _tx, _rx,
                     UART_PIN_NO_CHANGE, UART_PIN_NO_CHANGE);

        // BC548 common-emitter invierte señal en TX solamente
        // RX funciona sin inversión (ya probado)
        uart_set_line_inverse(MDB_UART_NUM, UART_SIGNAL_TXD_INV);

        // FIFO threshold alto → no dispara evento por bytes individuales
        uart_set_rx_full_threshold(MDB_UART_NUM, 120);
        // rx_tout: 3 symbol periods (~312µs de silencio) → flush FIFO
        uart_set_rx_timeout(MDB_UART_NUM, 3);

        xTaskCreatePinnedToCore(_uartTask, "mdb_rx", 2048, this, 5, NULL, 0);
    }

    // ── Transmisión (UART hardware) ─────────────────────────

    void sendAddress(uint8_t b) { _sendByte(b, 1); }
    void sendData(uint8_t b)    { _sendByte(b, 0); }

    void sendFrame(uint8_t addr, uint8_t* data, uint8_t len) {
        sendAddress(addr);
        uint8_t chk = 0;
        for (uint8_t i = 0; i < len; i++) { sendData(data[i]); chk += data[i]; }
        sendData(chk);
    }

    // ── Recepción (lee del buffer circular) ──────────────────

    uint16_t read(uint32_t timeoutMs = 10) {
        uint32_t deadline = millis() + timeoutMs;
        while (_ringHead == _ringTail) {
            if (millis() > deadline) return 0xFFFF;
            vTaskDelay(1);
        }
        uint16_t val = _ring[_ringTail];
        _ringTail = (_ringTail + 1) % MDB_RX_RING;
        return val;
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
    static const uint32_t MDB_BAUD = 9600;

    volatile uint16_t _ring[MDB_RX_RING];
    volatile uint8_t  _ringHead;
    volatile uint8_t  _ringTail;
    QueueHandle_t     _evtQueue;

    void _pushRing(uint16_t word) {
        uint8_t next = (_ringHead + 1) % MDB_RX_RING;
        if (next != _ringTail) {
            _ring[_ringHead] = word;
            _ringHead = next;
        }
    }

    // ── Tarea UART: rx_tout agrupa bytes por frame ───────────
    static void _uartTask(void* arg) {
        MDB9bit* self = (MDB9bit*)arg;
        uart_event_t evt;
        static uint32_t frameCount = 0;

        Serial.println("[MDB-UART] Tarea RX iniciada (rx_tout frame detection)");

        while (true) {
            if (xQueueReceive(self->_evtQueue, &evt, portMAX_DELAY)) {
                if (evt.type == UART_DATA) {
                    uint8_t buf[32];
                    int len = uart_read_bytes(MDB_UART_NUM, buf,
                                (evt.size < 32) ? evt.size : 32, 0);
                    if (len <= 0) continue;

                    frameCount++;

                    // Primer byte del burst = address (bit8 = 1)
                    self->_pushRing(buf[0] | 0x100);
                    // Resto = data (bit8 = 0)
                    for (int i = 1; i < len; i++) {
                        self->_pushRing(buf[i]);
                    }
                }
            }
        }
    }

    // ── TX UART hardware ────────────────────────────────────
    // Para simular 9-bit MDB con 8E1:
    //   mode=0 (data):    byte con paridad EVEN → parity bit refleja data
    //   mode=1 (address): necesitamos forzar parity=1
    //     Para byte con número par de 1s → EVEN da parity=0, ODD da parity=1
    //     Para byte con número impar de 1s → EVEN da parity=1, ODD da parity=0
    //   Solución: calcular qué paridad produce bit9=1 y setearla
    void _sendByte(uint8_t b, uint8_t bit9) {
        // Calcular cuántos 1s tiene el byte
        uint8_t ones = 0;
        uint8_t tmp = b;
        while (tmp) { ones += tmp & 1; tmp >>= 1; }
        bool evenOnes = (ones % 2 == 0);

        if (bit9 == 0) {
            // Mode=0: parity bit debe ser 0
            // EVEN parity: si ones es par → parity=0 ✓
            // EVEN parity: si ones es impar → parity=1 ✗ → usar ODD
            uart_set_parity(MDB_UART_NUM, evenOnes ? UART_PARITY_EVEN : UART_PARITY_ODD);
        } else {
            // Mode=1: parity bit debe ser 1
            // EVEN parity: si ones es par → parity=0 ✗ → usar ODD
            // EVEN parity: si ones es impar → parity=1 ✓
            uart_set_parity(MDB_UART_NUM, evenOnes ? UART_PARITY_ODD : UART_PARITY_EVEN);
        }

        // Esperar a que TX FIFO esté vacío antes de cambiar paridad
        uart_wait_tx_done(MDB_UART_NUM, pdMS_TO_TICKS(10));
        uart_write_bytes(MDB_UART_NUM, (const char*)&b, 1);
        uart_wait_tx_done(MDB_UART_NUM, pdMS_TO_TICKS(10));
    }
};
