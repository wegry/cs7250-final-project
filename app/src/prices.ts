import { Dayjs } from "dayjs";
import { RatePlan, SynthData } from "./data/schema";
import { mean, range, sum } from "es-toolkit";

export interface PriceBreakdown {
  total: number;
  fixedCharge: number;
  energyCharge: number;
  demandCharge: number;
  flatDemandCharge: number;
  coincidentDemandCharge: number;
  minChargeAdjustment: number;
  kWh: number;
  peakDemand_kW: number;
}

export function calculateMonthlyBill({
  ratePlan,
  synthData,
  monthStarting,
}: {
  ratePlan?: RatePlan | null;
  synthData?: SynthData[] | null;
  monthStarting: Dayjs;
}): PriceBreakdown | { kWh?: number } {
  if (!synthData) {
    return {};
  }

  // Build hourly usage profile (average kW for each hour)
  const hourlyUsage: number[] = range(0, 24).map((hour) =>
    mean(
      [synthData[hour]?.usage_kw, synthData[(hour + 1) % 24]?.usage_kw].flatMap(
        (x) => x ?? [],
      ),
    ),
  );

  const daysInMonth = monthStarting.add(1, "month").diff(monthStarting, "days");

  if (!ratePlan) {
    return { kWh: sum(hourlyUsage) * daysInMonth };
  }

  const {
    energyWeekdaySched,
    energyWeekendSched,
    energyRate_tiers,
    demandWeekdaySched,
    demandWeekendSched,
    demandRate_tiers,
    flatDemand_tiers,
    flatDemandMonths,
    coincidentSched,
    coincidentRate_tiers,
    fixedChargeFirstMeter,
    fixedChargeUnits,
    minCharge,
    minChargeUnits,
  } = ratePlan;

  let fixedCharge = 0;
  let energyCharge = 0;
  let demandCharge = 0;
  let flatDemandCharge = 0;
  let coincidentDemandCharge = 0;
  let totalUsage_kWh = 0;

  // Track peak demand per period for TOU demand charges
  const demandPeakByPeriod: Map<number, number> = new Map();
  // Track peak for coincident demand (usually single period)
  const coincidentPeakByPeriod: Map<number, number> = new Map();
  // Track overall peak for flat demand
  let overallPeakDemand = 0;

  // Fixed charge
  if (fixedChargeUnits === "$/month") {
    fixedCharge = fixedChargeFirstMeter ?? 0;
  } else if (fixedChargeUnits === "$/day") {
    fixedCharge = (fixedChargeFirstMeter ?? 0) * daysInMonth;
  } else if (fixedChargeUnits === "$/year") {
    fixedCharge = (fixedChargeFirstMeter ?? 0) / 12;
  }

  // Iterate through each day of the month
  let curr = monthStarting;
  const oneMonthLater = monthStarting.add(1, "month");

  while (curr.isBefore(oneMonthLater)) {
    const isWeekend = [0, 6].includes(curr.day());
    const energySched = isWeekend ? energyWeekendSched : energyWeekdaySched;
    const demandSched = isWeekend ? demandWeekendSched : demandWeekdaySched;

    const monthIdx = curr.month();

    for (let hour = 0; hour < 24; hour++) {
      const usageThisHour = hourlyUsage[hour] ?? 0;
      totalUsage_kWh += usageThisHour;
      overallPeakDemand = Math.max(overallPeakDemand, usageThisHour);

      // Energy charge calculation
      if (energySched && energyRate_tiers) {
        const energyPeriod = energySched[monthIdx]?.[hour];
        if (energyPeriod !== undefined) {
          const tiers = energyRate_tiers[energyPeriod];
          const rate = findTierRate(tiers, totalUsage_kWh);
          energyCharge += usageThisHour * rate;
        }
      }

      // Track demand peaks by period
      if (demandSched) {
        const demandPeriod = demandSched[monthIdx]?.[hour];
        if (demandPeriod !== undefined) {
          const currentPeak = demandPeakByPeriod.get(demandPeriod) ?? 0;
          demandPeakByPeriod.set(
            demandPeriod,
            Math.max(currentPeak, usageThisHour),
          );
        }
      }

      // Track coincident demand peaks
      if (coincidentSched) {
        const coincidentPeriod = coincidentSched[monthIdx]?.[hour];
        if (coincidentPeriod !== undefined) {
          const currentPeak = coincidentPeakByPeriod.get(coincidentPeriod) ?? 0;
          coincidentPeakByPeriod.set(
            coincidentPeriod,
            Math.max(currentPeak, usageThisHour),
          );
        }
      }
    }

    curr = curr.add(1, "day");
  }

  // Calculate TOU demand charges from peaks
  if (demandRate_tiers) {
    for (const [period, peakKw] of demandPeakByPeriod) {
      const tiers = demandRate_tiers[period];
      demandCharge += calculateTieredDemandCost(tiers, peakKw);
    }
  }

  // Calculate flat demand charge (applies to specific months)
  const currentMonth = monthStarting.month();
  const flatDemandApplies =
    !flatDemandMonths || flatDemandMonths.length === 0
      ? true
      : flatDemandMonths.includes(currentMonth);

  if (flatDemand_tiers && flatDemandApplies) {
    // Flat demand typically uses period 0 or a single tier structure
    const tiers = flatDemand_tiers[0];
    flatDemandCharge = calculateTieredDemandCost(tiers, overallPeakDemand);
  }

  // Calculate coincident demand charges
  if (coincidentRate_tiers) {
    for (const [period, peakKw] of coincidentPeakByPeriod) {
      const tiers = coincidentRate_tiers[period];
      if (tiers) {
        for (const tier of tiers) {
          coincidentDemandCharge += peakKw * (tier.rate ?? 0);
          coincidentDemandCharge += tier.adj ?? 0;
        }
      }
    }
  }

  let subtotal =
    fixedCharge +
    energyCharge +
    demandCharge +
    flatDemandCharge +
    coincidentDemandCharge;

  // Minimum charge adjustment
  let minChargeAdjustment = 0;
  if (minCharge) {
    let effectiveMin = 0;
    if (minChargeUnits === "$/month") {
      effectiveMin = minCharge;
    } else if (minChargeUnits === "$/day") {
      effectiveMin = minCharge * daysInMonth;
    }
    if (subtotal < effectiveMin) {
      minChargeAdjustment = effectiveMin - subtotal;
    }
  }

  const total = subtotal + minChargeAdjustment;

  return {
    total,
    fixedCharge,
    energyCharge,
    demandCharge,
    flatDemandCharge,
    coincidentDemandCharge,
    minChargeAdjustment,
    kWh: totalUsage_kWh,
    peakDemand_kW: overallPeakDemand,
  };
}

// Find the applicable rate from tiered energy structure
function findTierRate(
  tiers:
    | Array<{ rate?: number; adj?: number | null; max?: number | null }>
    | undefined,
  cumulativeUsage: number,
): number {
  if (!tiers) return 0;
  for (const tier of tiers) {
    if ((tier.max ?? Infinity) >= cumulativeUsage) {
      return (tier.rate ?? 0) + (tier.adj ?? 0);
    }
  }
  // If no tier matched, use the last tier's rate
  const lastTier = tiers[tiers.length - 1];
  return (lastTier?.rate ?? 0) + (lastTier?.adj ?? 0);
}

// Calculate demand cost with tiered structure
function calculateTieredDemandCost(
  tiers:
    | Array<{ rate?: number | null; adj?: number | null; max?: number | null }>
    | undefined,
  peakKw: number,
): number {
  if (!tiers || peakKw <= 0) return 0;

  let cost = 0;
  let remainingDemand = peakKw;
  let prevMax = 0;

  for (const tier of tiers) {
    const tierMax = tier.max ?? Infinity;
    const tierSize = tierMax - prevMax;
    const demandInTier = Math.min(remainingDemand, tierSize);

    if (demandInTier > 0) {
      cost += demandInTier * (tier.rate ?? 0);
      cost += tier.adj ?? 0;
      remainingDemand -= demandInTier;
    }

    prevMax = tierMax;
    if (remainingDemand <= 0) break;
  }

  return cost;
}
