#pragma once

#include <Arduino.h>

enum EventLogCode : uint16_t {
    EVT_BOOT = 1,
    EVT_WIFI_CONNECT_OK = 10,
    EVT_WIFI_CONNECT_FAIL = 11,
    EVT_WIFI_RECONNECTED = 12,
    EVT_BACKEND_HEALTH_OK = 20,
    EVT_BACKEND_HEALTH_FAIL = 21,
    EVT_BACKEND_REGISTER_OK = 22,
    EVT_BACKEND_REGISTER_PENDING = 23,
    EVT_BACKEND_REGISTER_FAIL = 24,
    EVT_BACKEND_CARDS_OK = 25,
    EVT_BACKEND_CARDS_FAIL = 26,
    EVT_NFC_READ = 30,
    EVT_NFC_APPROVED_ONLINE = 31,
    EVT_NFC_APPROVED_OFFLINE = 32,
    EVT_NFC_DENIED = 33,
    EVT_QUEUE_ENQUEUE = 40,
    EVT_QUEUE_FULL = 41,
    EVT_QUEUE_FLUSH_OK = 42,
    EVT_QUEUE_FLUSH_FAIL = 43,
    EVT_QUEUE_PERSIST_FAIL = 44,
    EVT_MDB_RESET = 50,
    EVT_MDB_BEGIN_SESSION = 51,
    EVT_MDB_VEND_REQUEST = 52,
    EVT_MDB_VEND_SUCCESS = 53,
    EVT_MDB_VEND_FAILURE = 54,
    EVT_MDB_VEND_END = 55,
    EVT_SESSION_TIMEOUT = 56,
    EVT_MDB_SETUP_CONFIG = 57,
    EVT_MDB_SETUP_PRICES = 58,
    EVT_MDB_EXPANSION_REQUEST_ID = 59,
    EVT_MDB_TIME_DATE_FILE = 60,
    EVT_REMOTE_CONFIG_APPLIED = 61,
    EVT_MDB_TIME_DATE_REQUEST_SENT = 62,
    EVT_MDB_GATEWAY_RESET = 70,
    EVT_MDB_GATEWAY_SETUP = 71,
    EVT_MDB_GATEWAY_CONTROL = 72,
    EVT_MDB_GATEWAY_IDENTIFICATION = 73,
    EVT_MDB_GATEWAY_FEATURE_ENABLE = 74,
    EVT_MDB_GATEWAY_TIME_DATE_REQUEST = 75,
    EVT_MDB_GATEWAY_REPORT = 76
};

struct __attribute__((packed)) EventLogEntry {
    uint32_t uptimeMs;
    uint16_t code;
    int16_t arg1;
    uint32_t arg2;
};

class EventLog {
public:
    static constexpr uint8_t CAPACITY = 64;

    EventLog();
    void clear();
    void push(uint16_t code, int16_t arg1 = 0, uint32_t arg2 = 0, uint32_t uptimeMs = 0);
    uint8_t size() const;
    bool getOldest(uint8_t index, EventLogEntry& out) const;

private:
    EventLogEntry entries_[CAPACITY];
    uint8_t head_;
    uint8_t count_;
};

const char* eventLogCodeName(uint16_t code);
String eventLogBuildJson(const EventLog& log, uint8_t maxEntries = 16);
