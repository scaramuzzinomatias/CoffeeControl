#include "device_config.h"

namespace {
String normalizeStoredUrl(String url) {
    url.trim();
    if (url.startsWith("Http://") || url.startsWith("HTTP://")) {
        return "http://" + url.substring(7);
    }
    if (url.startsWith("Https://") || url.startsWith("HTTPS://")) {
        return "https://" + url.substring(8);
    }
    return url;
}
}

void deviceConfigSetDefaults(DeviceConfig& config, const char* defaultBackendUrl) {
    config.wifiSSID = "";
    config.wifiPass = "";
    config.backendBase = String(defaultBackendUrl);
    config.pricing = pricingDefaultConfig();
}

void deviceConfigLoad(Preferences& prefs, DeviceConfig& config, const char* defaultBackendUrl) {
    deviceConfigSetDefaults(config, defaultBackendUrl);

    prefs.begin("cc", true);
    config.wifiSSID = prefs.getString("ssid", "");
    config.wifiPass = prefs.getString("pass", "");

    String storedUrl = normalizeStoredUrl(prefs.getString("url", ""));
    if (storedUrl.length() > 0) {
        config.backendBase = storedUrl;
    }

    config.pricing.priceCents = pricingSanitizeHumanPrice(
        (uint32_t)prefs.getULong("price_cents", config.pricing.priceCents)
    );
    config.pricing.profile = (uint8_t)prefs.getUChar("price_profile", config.pricing.profile);
    prefs.end();
}

void deviceConfigSave(Preferences& prefs, const DeviceConfig& config, const char* defaultBackendUrl) {
    prefs.begin("cc", false);
    prefs.putString("ssid", config.wifiSSID);
    prefs.putString("pass", config.wifiPass);

    String url = normalizeStoredUrl(config.backendBase);
    if (url.length() == 0) {
        url = String(defaultBackendUrl);
    }
    prefs.putString("url", url);
    prefs.putULong("price_cents", pricingSanitizeHumanPrice(config.pricing.priceCents));
    prefs.putUChar("price_profile", config.pricing.profile);
    prefs.end();
}
