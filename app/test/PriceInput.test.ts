import { describe, it, expect } from "vitest";
import dayjs from "dayjs";
import { generationPriceInAMonth } from "../src/prices";
import type { RatePlan, SynthData } from "../src/data/schema";

describe("generationPriceInAMonth", () => {
  it("computes totals, energy cost, flat demand cost, and fixed charges", () => {
    const synthData: SynthData[] = Array.from({ length: 24 }, (_, h) => ({
      hour: h,
      usage_kw: 1,
      season: "winter",
      region: "New England",
    }));

    const schedule = Array.from({ length: 12 }, () => Array(24).fill(0));

    const flatDemandMonths = Array.from({ length: 12 }, () => 0);

    // flatDemand_tiers: list-of-lists-of-tier-objects (month index -> array of tier objects)
    const flatDemand_tiers = Array.from({ length: 12 }, () => [
      { unit: "kW", max: 999999, rate: 0.05, adj: null },
    ]);

    // energyRate_tiers: period index -> array of tier objects
    const energyRate_tiers = [
      [
        {
          adj: null,
          rate: 0.1,
          max: 999999,
          unit: "kWh", // must be one of 'kWh' | 'kWh daily' | 'kWh/kW'
        },
      ],
    ];

    // stub ratePlan; cast to RatePlan to satisfy TypeScript in test
    const ratePlan = ({
      utilityName: "UtilityX",
      rateName: "PlanY",

      energyWeekdaySched: schedule,
      energyWeekendSched: schedule,

      energyRate_tiers,
      fixedChargeFirstMeter: 30,
      fixedChargeUnits: "$/month",

      minCharge: null,
      minChargeUnits: null,

      flatDemandUnits: "kW",
      flatDemandMonths,
      flatDemand_tiers,

      demandWeekendSched: null,
      demandWeekdaySched: null,
      demandUnits: null,
      demandRate_tiers: null,
    } as unknown) as RatePlan;

    const start = dayjs("2024-01-01");

    const result = generationPriceInAMonth({
      ratePlan,
      synthData,
      monthStarting: start,
    });

    const days = start.add(1, "month").diff(start, "days");
    const kWh = 24 * days;
    const energyCost = kWh * 0.1;
    const flatDemandCost = kWh * 0.05;
    const fixed = 30;
    const total = energyCost + flatDemandCost + fixed;

    expect(result.kWh).toBeCloseTo(kWh);
    expect(result.energyRateCost).toBeCloseTo(energyCost);
    expect(result.flatDemandCost).toBeCloseTo(flatDemandCost);
    expect(result.fixedChargeCost).toBeCloseTo(fixed);
    expect(result.cost).toBeCloseTo(total);
  });
});
