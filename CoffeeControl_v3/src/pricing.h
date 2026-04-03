#pragma once

#include <Arduino.h>

enum PricingProfile : uint8_t {
    MDB_PRICING_PROFILE_RUBINO_HALF_CREDIT = 0,
    MDB_PRICING_PROFILE_IDENTITY = 1,
};

struct PricingConfig {
    uint32_t priceCents;
    uint8_t  profile;
    uint8_t  featureLevel;
    uint16_t countryCode;
    uint8_t  scaleFactor;
    uint8_t  decimalPlaces;
    uint8_t  maxResponseTime;
    uint8_t  miscOptions;
};

PricingConfig pricingDefaultConfig();
uint32_t pricingSanitizeHumanPrice(uint32_t priceCents);
uint16_t pricingBeginSessionFunds(const PricingConfig& config);
uint16_t pricingDefaultVendAmount(const PricingConfig& config);
void pricingBuildSetupConfigResponse(const PricingConfig& config, uint8_t out[7]);
const char* pricingProfileCode(uint8_t profile);
