import { describe, it, expect } from "vitest";
import {
  effectiveRate,
  processTiersForPeriod,
  getPeriodsFromSchedule,
  type TierInfo,
} from "./EnergyTiersChart";

describe("effectiveRate", () => {
  it("adds rate and adj together", () => {
    expect(effectiveRate({ rate: 0.1, adj: 0.02 })).toBeCloseTo(0.12);
  });

  it("handles null adj", () => {
    expect(effectiveRate({ rate: 0.1, adj: null })).toBeCloseTo(0.1);
  });

  it("handles null rate", () => {
    expect(effectiveRate({ rate: null, adj: 0.02 })).toBeCloseTo(0.02);
  });

  it("handles both null", () => {
    expect(effectiveRate({ rate: null, adj: null })).toBe(0);
  });

  it("handles undefined values", () => {
    expect(effectiveRate({})).toBe(0);
  });
});

describe("processTiersForPeriod", () => {
  it("returns empty for empty input", () => {
    expect(processTiersForPeriod([], 0)).toEqual([]);
  });

  it("handles single tier with max", () => {
    const tiers: TierInfo[] = [{ rate: 0.1, adj: 0.01, max: 500 }];
    const result = processTiersForPeriod(tiers, 0);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      rate: 0.11,
      max: 0,
      tier: 0,
      period: 0,
      unit: undefined,
    });
    expect(result[1]).toEqual({
      rate: 0.11,
      max: 500,
      tier: 0,
      period: 0,
      unit: undefined,
    });
  });

  it("handles single tier without max (no extension possible)", () => {
    const tiers: TierInfo[] = [{ rate: 0.1, max: null }];
    const result = processTiersForPeriod(tiers, 0);

    // Can't extend since prevMax is 0
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      rate: 0.1,
      max: 0,
      tier: 0,
      period: 0,
      unit: undefined,
    });
  });

  it("handles two tiers where second has no max", () => {
    const tiers: TierInfo[] = [
      { rate: 0.08, max: 500, unit: "kWh" },
      { rate: 0.12, max: null, unit: "kWh" },
    ];
    const result = processTiersForPeriod(tiers, 1);

    expect(result).toEqual([
      { rate: 0.08, max: 0, tier: 0, period: 1, unit: "kWh" },
      { rate: 0.08, max: 500, tier: 0, period: 1, unit: "kWh" },
      { rate: 0.12, max: 500, tier: 1, period: 1, unit: "kWh" },
      { rate: 0.12, max: 650, tier: 1, period: 1, unit: "kWh" }, // 500 * 1.3
    ]);
  });

  it("handles three tiers with rate + adj", () => {
    const tiers: TierInfo[] = [
      { rate: 0.05, adj: 0.01, max: 300 },
      { rate: 0.08, adj: 0.02, max: 800 },
      { rate: 0.12, adj: 0.03, max: null },
    ];
    const result = processTiersForPeriod(tiers, 0);

    expect(result).toEqual([
      {
        rate: 0.060000000000000005,
        max: 0,
        tier: 0,
        period: 0,
        unit: undefined,
      },
      {
        rate: 0.060000000000000005,
        max: 300,
        tier: 0,
        period: 0,
        unit: undefined,
      },
      { rate: 0.1, max: 300, tier: 1, period: 0, unit: undefined },
      { rate: 0.1, max: 800, tier: 1, period: 0, unit: undefined },
      { rate: 0.15, max: 800, tier: 2, period: 0, unit: undefined },
      { rate: 0.15, max: 1040, tier: 2, period: 0, unit: undefined }, // 800 * 1.3
    ]);
  });

  it("respects custom extension multiplier", () => {
    const tiers: TierInfo[] = [
      { rate: 0.08, max: 500 },
      { rate: 0.12, max: null },
    ];
    const result = processTiersForPeriod(tiers, 0, 2.0);

    const lastPoint = result[result.length - 1];
    expect(lastPoint?.max).toBe(1000); // 500 * 2.0
  });

  it("includes period in all output points", () => {
    const tiers: TierInfo[] = [
      { rate: 0.08, max: 500 },
      { rate: 0.12, max: null },
    ];
    const result = processTiersForPeriod(tiers, 2);

    expect(result.every((p) => p.period === 2)).toBe(true);
  });
});

describe("getPeriodsFromSchedule", () => {
  it("returns empty for null schedule", () => {
    expect(getPeriodsFromSchedule(null)).toEqual([]);
  });

  it("returns empty for undefined schedule", () => {
    expect(getPeriodsFromSchedule(undefined)).toEqual([]);
  });

  it("returns unique sorted periods", () => {
    const schedule = [0, 0, 0, 1, 1, 1, 2, 2, 1, 1, 0, 0];
    expect(getPeriodsFromSchedule(schedule)).toEqual([0, 1, 2]);
  });

  it("handles single period schedule", () => {
    const schedule = [0, 0, 0, 0, 0, 0];
    expect(getPeriodsFromSchedule(schedule)).toEqual([0]);
  });

  it("handles typical TOU schedule (24 hours)", () => {
    // Off-peak (0) overnight, on-peak (1) during day, mid-peak (2) shoulders
    const schedule = [
      0,
      0,
      0,
      0,
      0,
      0, // 12am-6am: off-peak
      2,
      2,
      2,
      2, // 6am-10am: mid-peak
      1,
      1,
      1,
      1,
      1,
      1, // 10am-4pm: on-peak
      2,
      2,
      2,
      2, // 4pm-8pm: mid-peak
      0,
      0,
      0,
      0, // 8pm-12am: off-peak
    ];
    expect(getPeriodsFromSchedule(schedule)).toEqual([0, 1, 2]);
  });
});

describe("edge cases", () => {
  it("handles all tiers having max values", () => {
    const tiers: TierInfo[] = [
      { rate: 0.05, max: 200 },
      { rate: 0.08, max: 500 },
      { rate: 0.12, max: 1000 },
    ];
    const result = processTiersForPeriod(tiers, 0);

    // No extension needed - last tier has a max
    expect(result[result.length - 1]?.max).toBe(1000);
    expect(result).toHaveLength(6); // 2 points per tier
  });

  it("handles zero rates", () => {
    const tiers: TierInfo[] = [
      { rate: 0, max: 100 },
      { rate: 0.1, max: null },
    ];
    const result = processTiersForPeriod(tiers, 0);

    expect(result[0]?.rate).toBe(0);
    expect(result[2]?.rate).toBe(0.1);
  });

  it("handles negative adj (credit)", () => {
    const tiers: TierInfo[] = [{ rate: 0.1, adj: -0.02, max: 500 }];
    const result = processTiersForPeriod(tiers, 0);

    expect(result[0]?.rate).toBeCloseTo(0.08);
  });
});
