#include "pricing.h"

namespace {
constexpr uint32_t DEFAULT_HUMAN_PRICE = 1200;
constexpr uint32_t MAX_HUMAN_PRICE = 65000;
}

PricingConfig pricingDefaultConfig() {
    PricingConfig config{};
    config.priceCents = DEFAULT_HUMAN_PRICE;
    config.profile = MDB_PRICING_PROFILE_RUBINO_HALF_CREDIT;
    config.featureLevel = 0x01;
    config.countryCode = 0x0032;    // Argentina (032)
    config.scaleFactor = 0x64;      // 100
    config.decimalPlaces = 0x02;
    config.maxResponseTime = 0x05;
    config.miscOptions = 0x00;
    return config;
}

uint32_t pricingSanitizeHumanPrice(uint32_t priceCents) {
    if (priceCents == 0) return DEFAULT_HUMAN_PRICE;
    if (priceCents > MAX_HUMAN_PRICE) return MAX_HUMAN_PRICE;
    return priceCents;
}

uint16_t pricingBeginSessionFunds(const PricingConfig& config) {
    uint32_t humanPrice = pricingSanitizeHumanPrice(config.priceCents);

    switch (config.profile) {
        case MDB_PRICING_PROFILE_RUBINO_HALF_CREDIT:
            return (uint16_t)(humanPrice / 2);
        case MDB_PRICING_PROFILE_IDENTITY:
        default:
            return (uint16_t)humanPrice;
    }
}

uint16_t pricingDefaultVendAmount(const PricingConfig& config) {
    return (uint16_t)pricingSanitizeHumanPrice(config.priceCents);
}

uint32_t pricingMdbAmountToHuman(const PricingConfig& config, uint16_t mdbAmount) {
    switch (config.profile) {
        case MDB_PRICING_PROFILE_RUBINO_HALF_CREDIT:
            return (uint32_t)mdbAmount * 2U;
        case MDB_PRICING_PROFILE_IDENTITY:
        default:
            return mdbAmount;
    }
}

void pricingBuildSetupConfigResponse(const PricingConfig& config, uint8_t out[7]) {
    out[0] = config.featureLevel;
    out[1] = (uint8_t)((config.countryCode >> 8) & 0xFF);
    out[2] = (uint8_t)(config.countryCode & 0xFF);
    out[3] = config.scaleFactor;
    out[4] = config.decimalPlaces;
    out[5] = config.maxResponseTime;
    out[6] = config.miscOptions;
}

const char* pricingProfileCode(uint8_t profile) {
    switch (profile) {
        case MDB_PRICING_PROFILE_RUBINO_HALF_CREDIT:
            return "rubino_half_credit";
        case MDB_PRICING_PROFILE_IDENTITY:
            return "identity";
        default:
            return "unknown";
    }
}
