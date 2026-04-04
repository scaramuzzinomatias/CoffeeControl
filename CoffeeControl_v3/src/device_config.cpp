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
    config.pricing.featureLevel = (uint8_t)prefs.getUChar("feat_lvl", config.pricing.featureLevel);
    config.pricing.countryCode = (uint16_t)prefs.getUInt("country", config.pricing.countryCode);
    config.pricing.scaleFactor = (uint8_t)prefs.getUChar("scale", config.pricing.scaleFactor);
    config.pricing.decimalPlaces = (uint8_t)prefs.getUChar("decimal", config.pricing.decimalPlaces);
    config.pricing.maxResponseTime = (uint8_t)prefs.getUChar("resp_ms", config.pricing.maxResponseTime);
    config.pricing.miscOptions = (uint8_t)prefs.getUChar("misc_opt", config.pricing.miscOptions);
    pricingNormalizeConfig(config.pricing);
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
    PricingConfig pricing = config.pricing;
    pricingNormalizeConfig(pricing);
    prefs.putULong("price_cents", pricing.priceCents);
    prefs.putUChar("price_profile", pricing.profile);
    prefs.putUChar("feat_lvl", pricing.featureLevel);
    prefs.putUInt("country", pricing.countryCode);
    prefs.putUChar("scale", pricing.scaleFactor);
    prefs.putUChar("decimal", pricing.decimalPlaces);
    prefs.putUChar("resp_ms", pricing.maxResponseTime);
    prefs.putUChar("misc_opt", pricing.miscOptions);
    prefs.end();
}
