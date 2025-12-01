import { windowed } from "es-toolkit";

export interface TierInfo {
  rate?: number | null;
  adj?: number | null;
  max?: number | null;
  unit?: "kWh" | "kWh daily" | "kWh/kW" | null;
}

export interface ChartTierPoint {
  rate: number;
  max: number;
  tier: number;
  unit?: string | null;
}

/**
 * Combines rate and adj into a single effective rate
 */
export function effectiveRate(tier: TierInfo): number {
  return (tier.rate ?? 0) + (tier.adj ?? 0);
}

/**
 * Processes tiers for a single period into chart-ready data points.
 * Each tier needs two points: one at its start (previous tier's max) and one at its end (its own max).
 */
export function processTiersForPeriod(
  tiers: TierInfo[],
  extendLastTierBy = 1.5,
): ChartTierPoint[] {
  if (!tiers.length) return [];

  const points: ChartTierPoint[] = [];
  let prevMax = 0;

  for (let tierIdx = 0; tierIdx < tiers.length; tierIdx++) {
    const tier = tiers[tierIdx];
    if (!tier) continue;

    const rate = effectiveRate(tier);
    const isLastTier = tierIdx === tiers.length - 1;

    // Start point of this tier (at previous tier's max)
    points.push({
      rate,
      max: prevMax,
      tier: tierIdx,
      unit: tier.unit,
    });

    // End point of this tier
    if (tier.max != null) {
      points.push({
        rate,
        max: tier.max,
        tier: tierIdx,
        unit: tier.unit,
      });
      prevMax = tier.max;
    } else if (isLastTier && prevMax > 0) {
      // Last tier without max: extend the chart
      points.push({
        rate,
        max: prevMax * extendLastTierBy,
        tier: tierIdx,
        unit: tier.unit,
      });
    }
  }

  return points;
}

/**
 * Gets the tiers for a specific period, handling the nested structure
 */
export function getTiersForPeriod(
  energyRateTiers: TierInfo[][] | null | undefined,
  period: number,
): TierInfo[] {
  return energyRateTiers?.[period] ?? [];
}

/**
 * For a given month's schedule (array of 24 period indices),
 * get unique periods and their tiers
 */
export function getPeriodsFromSchedule(
  schedule: number[] | null | undefined,
): number[] {
  if (!schedule) return [];
  return [...new Set(schedule)];
}

// Legacy windowed approach - kept for comparison/testing
export function processWithWindowed(tiers: TierInfo[]): ChartTierPoint[] {
  if (tiers.length === 0) return [];

  const firstTier = tiers[0];
  if (tiers.length === 1) {
    if (!firstTier || firstTier.max == null) return [];
    const rate = effectiveRate(firstTier);
    return [
      { rate, max: 0, tier: 0, unit: firstTier.unit },
      { rate, max: firstTier.max, tier: 0, unit: firstTier.unit },
    ];
  }

  return windowed(tiers, 2)
    .flatMap(([x, y], tierIdx) => {
      if (!x || !y) return [];

      const xRate = effectiveRate(x);
      const yRate = effectiveRate(y);
      const results: (ChartTierPoint | null)[] = [];

      // First tier starts at 0
      if (tierIdx === 0) {
        results.push({ rate: xRate, max: 0, tier: tierIdx, unit: x.unit });
      }

      if (x.max != null) {
        // End of current tier
        results.push({ rate: xRate, max: x.max, tier: tierIdx, unit: x.unit });
        // Start of next tier (same x position, different rate)
        results.push({
          rate: yRate,
          max: x.max,
          tier: tierIdx + 1,
          unit: y.unit,
        });
      }

      // If this is the last window and y has no max, extend
      if (y.max == null && x.max != null) {
        results.push({
          rate: yRate,
          max: x.max * 1.5,
          tier: tierIdx + 1,
          unit: y.unit,
        });
      } else if (y.max != null) {
        results.push({
          rate: yRate,
          max: y.max,
          tier: tierIdx + 1,
          unit: y.unit,
        });
      }

      return results;
    })
    .filter((x): x is ChartTierPoint => x != null);
}
