#pragma once

#include <Arduino.h>
#include <Preferences.h>

#include "pricing.h"

struct DeviceConfig {
    String wifiSSID;
    String wifiPass;
    String backendBase;
    PricingConfig pricing;
};

void deviceConfigSetDefaults(DeviceConfig& config, const char* defaultBackendUrl);
void deviceConfigLoad(Preferences& prefs, DeviceConfig& config, const char* defaultBackendUrl);
void deviceConfigSave(Preferences& prefs, const DeviceConfig& config, const char* defaultBackendUrl);
