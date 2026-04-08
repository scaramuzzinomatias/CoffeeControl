#include "offline_queue.h"

#include <ArduinoJson.h>

namespace {

bool fsHasPath(fs::FS& fs, const char* path) {
    File root = fs.open("/");
    if (!root) return false;

    String expected = path;
    File file = root.openNextFile();
    while (file) {
        String current = file.name();
        file.close();
        if (current == expected) {
            root.close();
            return true;
        }
        file = root.openNextFile();
    }

    root.close();
    return false;
}

bool loadJournal(fs::FS& fs, const char* path, QueueEntry* entries, int capacity, int& outCount) {
    outCount = 0;
    if (!fsHasPath(fs, path)) return false;

    File f = fs.open(path, "r");
    if (!f) return false;

    while (f.available() >= (int)sizeof(QueueEntry) && outCount < capacity) {
        const size_t read = f.read((uint8_t*)&entries[outCount], sizeof(QueueEntry));
        if (read != sizeof(QueueEntry)) break;
        outCount++;
    }

    f.close();
    return true;
}

bool loadLegacyJson(fs::FS& fs, const char* path, QueueEntry* entries, int capacity, int& outCount) {
    outCount = 0;
    if (!fsHasPath(fs, path)) return false;

    File f = fs.open(path, "r");
    if (!f) return false;

    DynamicJsonDocument doc(80000);
    if (deserializeJson(doc, f) != DeserializationError::Ok) {
        f.close();
        outCount = 0;
        return false;
    }
    f.close();

    JsonArray arr = doc.as<JsonArray>();
    for (JsonObject e : arr) {
        if (outCount >= capacity) break;
        strlcpy(entries[outCount].uid, e["uid"] | "", sizeof(entries[0].uid));
        entries[outCount].item_id = (uint16_t)(e["item_id"] | 0);
        entries[outCount].amount = (uint16_t)(e["amount"] | 0);
        entries[outCount].vend_success = (bool)(e["ok"] | false);
        entries[outCount].ts = (uint32_t)(e["ts"] | 0);
        outCount++;
    }

    return true;
}

String buildTempPath(const char* journalPath) {
    String temp = String(journalPath);
    temp += ".tmp";
    return temp;
}

}  // namespace

bool offlineQueueEnsureJournal(fs::FS& fs, const char* journalPath) {
    if (fsHasPath(fs, journalPath)) return true;

    File f = fs.open(journalPath, "w");
    if (!f) return false;
    f.close();
    return true;
}

bool offlineQueueLoad(fs::FS& fs,
                      const char* journalPath,
                      const char* legacyJsonPath,
                      QueueEntry* entries,
                      int capacity,
                      int& outCount,
                      bool& migratedLegacy) {
    migratedLegacy = false;

    if (loadJournal(fs, journalPath, entries, capacity, outCount)) {
        return true;
    }

    if (!loadLegacyJson(fs, legacyJsonPath, entries, capacity, outCount)) {
        outCount = 0;
        return false;
    }

    migratedLegacy = true;
    offlineQueueRewrite(fs, journalPath, entries, outCount);
    fs.remove(legacyJsonPath);
    return true;
}

bool offlineQueueAppend(fs::FS& fs, const char* journalPath, const QueueEntry& entry) {
    File f = fs.open(journalPath, "a");
    if (!f) return false;
    const size_t written = f.write((const uint8_t*)&entry, sizeof(QueueEntry));
    f.flush();
    f.close();
    return written == sizeof(QueueEntry);
}

bool offlineQueueRewrite(fs::FS& fs, const char* journalPath, const QueueEntry* entries, int count) {
    String tempPath = buildTempPath(journalPath);
    fs.remove(tempPath);

    if (count <= 0) {
        fs.remove(journalPath);
        return true;
    }

    File temp = fs.open(tempPath.c_str(), "w");
    if (!temp) return false;

    for (int i = 0; i < count; i++) {
        const size_t written = temp.write((const uint8_t*)&entries[i], sizeof(QueueEntry));
        if (written != sizeof(QueueEntry)) {
            temp.close();
            fs.remove(tempPath);
            return false;
        }
    }

    temp.flush();
    temp.close();

    fs.remove(journalPath);
    if (!fs.rename(tempPath.c_str(), journalPath)) {
        fs.remove(tempPath);
        return false;
    }

    return true;
}
