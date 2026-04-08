#pragma once

#include <Arduino.h>
#include <FS.h>

struct __attribute__((packed)) QueueEntry {
    char     uid[9];
    uint16_t item_id;
    uint16_t amount;
    bool     vend_success;
    uint32_t ts;
};

bool offlineQueueLoad(fs::FS& fs,
                      const char* journalPath,
                      const char* legacyJsonPath,
                      QueueEntry* entries,
                      int capacity,
                      int& outCount,
                      bool& migratedLegacy);

bool offlineQueueEnsureJournal(fs::FS& fs, const char* journalPath);
bool offlineQueueAppend(fs::FS& fs, const char* journalPath, const QueueEntry& entry);
bool offlineQueueRewrite(fs::FS& fs, const char* journalPath, const QueueEntry* entries, int count);
