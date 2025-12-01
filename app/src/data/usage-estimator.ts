import { SynthData } from "./schema";

export type DwellingType = "house" | "townhouse" | "apartment";
export type Region = "midwest" | "northeast" | "south" | "west";

export interface DwellingProfile {
  dwellingType: DwellingType;
  region: Region;
  hasGasHeat: boolean;
  hasGasAppliances: boolean;
  hasEV: boolean;
}

// Base hourly load profiles (kW) - represents typical weekday patterns
const BASE_PROFILES: Record<DwellingType, number[]> = {
  // Larger homes = higher base load
  house: [
    0.8,
    0.7,
    0.6,
    0.6,
    0.6,
    0.7, // 12am-6am: sleeping
    1.2,
    1.8,
    1.4,
    1.0,
    0.9,
    0.9, // 6am-12pm: morning routine
    0.9,
    0.9,
    1.0,
    1.2,
    1.5,
    2.0, // 12pm-6pm: afternoon
    2.5,
    2.8,
    2.2,
    1.8,
    1.4,
    1.0, // 6pm-12am: evening peak
  ],
  townhouse: [
    0.6, 0.5, 0.5, 0.5, 0.5, 0.5, 0.9, 1.4, 1.1, 0.8, 0.7, 0.7, 0.7, 0.7, 0.8,
    1.0, 1.2, 1.6, 2.0, 2.2, 1.8, 1.4, 1.1, 0.8,
  ],
  apartment: [
    0.4, 0.4, 0.3, 0.3, 0.3, 0.4, 0.7, 1.0, 0.8, 0.6, 0.5, 0.5, 0.5, 0.5, 0.6,
    0.7, 0.9, 1.2, 1.5, 1.6, 1.4, 1.1, 0.8, 0.5,
  ],
};

// Heating/cooling load additions by hour (kW) for electric HVAC
const HVAC_PROFILES = {
  winterHeating: {
    // Electric heat pump or resistance - peaks morning/evening
    house: [
      2.0, 2.0, 2.2, 2.2, 2.5, 3.0, 3.5, 3.0, 2.0, 1.5, 1.2, 1.0, 1.0, 1.0, 1.2,
      1.5, 2.0, 2.5, 3.0, 3.2, 3.0, 2.8, 2.5, 2.2,
    ],
    townhouse: [
      1.4, 1.4, 1.5, 1.5, 1.8, 2.1, 2.4, 2.1, 1.4, 1.0, 0.8, 0.7, 0.7, 0.7, 0.8,
      1.0, 1.4, 1.8, 2.1, 2.2, 2.1, 2.0, 1.8, 1.5,
    ],
    apartment: [
      0.8, 0.8, 0.9, 0.9, 1.0, 1.2, 1.4, 1.2, 0.8, 0.6, 0.5, 0.4, 0.4, 0.4, 0.5,
      0.6, 0.8, 1.0, 1.2, 1.3, 1.2, 1.1, 1.0, 0.9,
    ],
  },
  summerCooling: {
    // AC load - peaks afternoon
    house: [
      0.5, 0.4, 0.4, 0.4, 0.4, 0.5, 0.8, 1.2, 1.8, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0,
      5.0, 4.5, 4.0, 3.5, 3.0, 2.5, 1.8, 1.2, 0.8,
    ],
    townhouse: [
      0.4, 0.3, 0.3, 0.3, 0.3, 0.4, 0.6, 0.9, 1.3, 1.8, 2.1, 2.4, 2.8, 3.2, 3.5,
      3.5, 3.2, 2.8, 2.4, 2.1, 1.8, 1.3, 0.9, 0.6,
    ],
    apartment: [
      0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.4, 0.6, 0.8, 1.1, 1.3, 1.5, 1.7, 1.9, 2.1,
      2.1, 1.9, 1.7, 1.5, 1.3, 1.0, 0.8, 0.5, 0.3,
    ],
  },
};

// Regional climate multipliers
const REGIONAL_CLIMATE: Record<
  Region,
  { winterMult: number; summerMult: number }
> = {
  midwest: { winterMult: 1.3, summerMult: 1.1 }, // Cold winters, warm summers
  northeast: { winterMult: 1.2, summerMult: 0.9 }, // Cold winters, mild summers
  south: { winterMult: 0.6, summerMult: 1.4 }, // Mild winters, hot summers
  west: { winterMult: 0.8, summerMult: 1.0 }, // Mild overall (varies)
};

// EV charging profile - Model Y with 7.6kW Level 2 charger, charging overnight
const EV_CHARGING_PROFILE = [
  7.6,
  7.6,
  7.6,
  7.6,
  4.0,
  0, // 12am-6am: main charging window
  0,
  0,
  0,
  0,
  0,
  0, // 6am-12pm: at work
  0,
  0,
  0,
  0,
  0,
  0, // 12pm-6pm: at work
  0,
  0,
  0,
  0,
  7.6,
  7.6, // 6pm-12am: evening plug-in
];

// Gas appliance savings (reduces electric load for cooking, water heating, dryer)
const GAS_APPLIANCE_REDUCTION: Record<DwellingType, number[]> = {
  house: [
    0.1, 0.1, 0.1, 0.1, 0.1, 0.2, 0.4, 0.5, 0.3, 0.2, 0.2, 0.3, 0.4, 0.3, 0.2,
    0.2, 0.3, 0.5, 0.6, 0.5, 0.3, 0.2, 0.1, 0.1,
  ],
  townhouse: [
    0.08, 0.08, 0.08, 0.08, 0.08, 0.15, 0.3, 0.4, 0.25, 0.15, 0.15, 0.25, 0.3,
    0.25, 0.15, 0.15, 0.25, 0.4, 0.5, 0.4, 0.25, 0.15, 0.08, 0.08,
  ],
  apartment: [
    0.05, 0.05, 0.05, 0.05, 0.05, 0.1, 0.2, 0.25, 0.15, 0.1, 0.1, 0.15, 0.2,
    0.15, 0.1, 0.1, 0.15, 0.25, 0.3, 0.25, 0.15, 0.1, 0.05, 0.05,
  ],
};

export function estimateHourlyUsage(
  profile: DwellingProfile,
  season: "winter" | "summer",
): SynthData[] {
  const { dwellingType, region, hasGasHeat, hasGasAppliances, hasEV } = profile;
  const climate = REGIONAL_CLIMATE[region];

  const hourlyUsage: number[] = [];

  for (let hour = 0; hour < 24; hour++) {
    let usage = BASE_PROFILES[dwellingType][hour]!;

    // Add HVAC load if electric (not gas heat)
    if (!hasGasHeat) {
      if (season === "winter") {
        usage +=
          HVAC_PROFILES.winterHeating[dwellingType][hour]! * climate.winterMult;
      } else {
        usage +=
          HVAC_PROFILES.summerCooling[dwellingType][hour]! * climate.summerMult;
      }
    } else {
      // Even with gas heat, still need AC in summer
      if (season === "summer") {
        usage +=
          HVAC_PROFILES.summerCooling[dwellingType][hour]! * climate.summerMult;
      }
    }

    // Reduce load if gas appliances
    if (hasGasAppliances) {
      usage -= GAS_APPLIANCE_REDUCTION[dwellingType][hour]!;
    }

    // Add EV charging
    if (hasEV) {
      usage += EV_CHARGING_PROFILE[hour]!;
    }

    // Floor at 0.2 kW (always some base load)
    hourlyUsage.push(Math.max(0.2, usage));
  }

  // Map to region string for compatibility with existing SynthData type
  const regionMap: Record<Region, SynthData["region"]> = {
    midwest: "Texas", // Similar grid characteristics
    northeast: "New England",
    south: "Texas",
    west: "Southern California",
  };

  return hourlyUsage.map((usage_kw, hour) => ({
    hour,
    usage_kw,
    season,
    region: regionMap[region],
  }));
}

export function estimateMonthlyKwh(
  profile: DwellingProfile,
  season: "winter" | "summer",
): number {
  const hourly = estimateHourlyUsage(profile, season);
  const dailyKwh = hourly.reduce((sum, h) => sum + h.usage_kw, 0);
  return dailyKwh * 30; // Approximate month
}
