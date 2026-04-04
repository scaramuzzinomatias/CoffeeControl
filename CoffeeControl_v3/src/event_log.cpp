#include "event_log.h"

namespace {
String eventNameJson(uint16_t code) {
    return String(eventLogCodeName(code));
}
}

EventLog::EventLog() : head_(0), count_(0) {
    clear();
}

void EventLog::clear() {
    head_ = 0;
    count_ = 0;
    memset(entries_, 0, sizeof(entries_));
}

void EventLog::push(uint16_t code, int16_t arg1, uint32_t arg2, uint32_t uptimeMs) {
    EventLogEntry& slot = entries_[head_];
    slot.uptimeMs = uptimeMs;
    slot.code = code;
    slot.arg1 = arg1;
    slot.arg2 = arg2;

    head_ = (uint8_t)((head_ + 1) % CAPACITY);
    if (count_ < CAPACITY) count_++;
}

uint8_t EventLog::size() const {
    return count_;
}

bool EventLog::getOldest(uint8_t index, EventLogEntry& out) const {
    if (index >= count_) return false;
    const uint8_t oldest = (uint8_t)((head_ + CAPACITY - count_) % CAPACITY);
    const uint8_t pos = (uint8_t)((oldest + index) % CAPACITY);
    out = entries_[pos];
    return true;
}

const char* eventLogCodeName(uint16_t code) {
    switch (code) {
        case EVT_BOOT: return "BOOT";
        case EVT_WIFI_CONNECT_OK: return "WIFI_CONNECT_OK";
        case EVT_WIFI_CONNECT_FAIL: return "WIFI_CONNECT_FAIL";
        case EVT_WIFI_RECONNECTED: return "WIFI_RECONNECTED";
        case EVT_BACKEND_HEALTH_OK: return "BACKEND_HEALTH_OK";
        case EVT_BACKEND_HEALTH_FAIL: return "BACKEND_HEALTH_FAIL";
        case EVT_BACKEND_REGISTER_OK: return "BACKEND_REGISTER_OK";
        case EVT_BACKEND_REGISTER_PENDING: return "BACKEND_REGISTER_PENDING";
        case EVT_BACKEND_REGISTER_FAIL: return "BACKEND_REGISTER_FAIL";
        case EVT_BACKEND_CARDS_OK: return "BACKEND_CARDS_OK";
        case EVT_BACKEND_CARDS_FAIL: return "BACKEND_CARDS_FAIL";
        case EVT_NFC_READ: return "NFC_READ";
        case EVT_NFC_APPROVED_ONLINE: return "NFC_APPROVED_ONLINE";
        case EVT_NFC_APPROVED_OFFLINE: return "NFC_APPROVED_OFFLINE";
        case EVT_NFC_DENIED: return "NFC_DENIED";
        case EVT_QUEUE_ENQUEUE: return "QUEUE_ENQUEUE";
        case EVT_QUEUE_FULL: return "QUEUE_FULL";
        case EVT_QUEUE_FLUSH_OK: return "QUEUE_FLUSH_OK";
        case EVT_QUEUE_FLUSH_FAIL: return "QUEUE_FLUSH_FAIL";
        case EVT_QUEUE_PERSIST_FAIL: return "QUEUE_PERSIST_FAIL";
        case EVT_MDB_RESET: return "MDB_RESET";
        case EVT_MDB_BEGIN_SESSION: return "MDB_BEGIN_SESSION";
        case EVT_MDB_VEND_REQUEST: return "MDB_VEND_REQUEST";
        case EVT_MDB_VEND_SUCCESS: return "MDB_VEND_SUCCESS";
        case EVT_MDB_VEND_FAILURE: return "MDB_VEND_FAILURE";
        case EVT_MDB_VEND_END: return "MDB_VEND_END";
        case EVT_SESSION_TIMEOUT: return "SESSION_TIMEOUT";
        case EVT_MDB_SETUP_CONFIG: return "MDB_SETUP_CONFIG";
        case EVT_MDB_SETUP_PRICES: return "MDB_SETUP_PRICES";
        case EVT_MDB_EXPANSION_REQUEST_ID: return "MDB_EXPANSION_REQUEST_ID";
        case EVT_MDB_TIME_DATE_FILE: return "MDB_TIME_DATE_FILE";
        case EVT_REMOTE_CONFIG_APPLIED: return "REMOTE_CONFIG_APPLIED";
        case EVT_MDB_TIME_DATE_REQUEST_SENT: return "MDB_TIME_DATE_REQUEST_SENT";
        case EVT_MDB_GATEWAY_RESET: return "MDB_GATEWAY_RESET";
        case EVT_MDB_GATEWAY_SETUP: return "MDB_GATEWAY_SETUP";
        case EVT_MDB_GATEWAY_CONTROL: return "MDB_GATEWAY_CONTROL";
        case EVT_MDB_GATEWAY_IDENTIFICATION: return "MDB_GATEWAY_IDENTIFICATION";
        case EVT_MDB_GATEWAY_FEATURE_ENABLE: return "MDB_GATEWAY_FEATURE_ENABLE";
        case EVT_MDB_GATEWAY_TIME_DATE_REQUEST: return "MDB_GATEWAY_TIME_DATE_REQUEST";
        case EVT_MDB_GATEWAY_REPORT: return "MDB_GATEWAY_REPORT";
        default: return "UNKNOWN";
    }
}

String eventLogBuildJson(const EventLog& log, uint8_t maxEntries) {
    const uint8_t available = log.size();
    const uint8_t take = (maxEntries == 0 || maxEntries > available) ? available : maxEntries;
    const uint8_t start = (available > take) ? (available - take) : 0;

    String json = "{\"capacity\":";
    json += EventLog::CAPACITY;
    json += ",\"count\":";
    json += available;
    json += ",\"events\":[";

    bool first = true;
    for (uint8_t i = start; i < available; i++) {
        EventLogEntry entry{};
        if (!log.getOldest(i, entry)) continue;
        if (!first) json += ",";
        first = false;
        json += "{\"ms\":";
        json += entry.uptimeMs;
        json += ",\"code\":";
        json += entry.code;
        json += ",\"name\":\"";
        json += eventNameJson(entry.code);
        json += "\",\"arg1\":";
        json += entry.arg1;
        json += ",\"arg2\":";
        json += entry.arg2;
        json += "}";
    }

    json += "]}";
    return json;
}
