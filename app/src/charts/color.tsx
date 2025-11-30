import { interpolateViridis } from "d3-scale-chromatic";
import type { RatePlan } from "../data/schema";

export function getViridisColors(n: number): string[] {
  if (n === 1) {
    return [interpolateViridis(0.5)];
  } else if (n === 2) {
    return [interpolateViridis(0.0), interpolateViridis(0.8)];
  } else if (n === 3) {
    return [
      interpolateViridis(0.0),
      interpolateViridis(0.4),
      interpolateViridis(0.8),
    ];
  }
  return Array.from({ length: n }, (_, i) => interpolateViridis(i / (n - 1)));
}

export function getAllPeriods(
  plan: RatePlan | null | undefined,
  type: "energy" | "demand" | "flatDemand",
): number[] {
  if (!plan) return [];

  if (type === "flatDemand") {
    return Array.from(new Set(plan.flatDemandMonths));
  }

  const weekdaySched = plan[`${type}WeekdaySched`];
  const weekendSched = plan[`${type}WeekendSched`];

  const periods = new Set<number>();
  [weekdaySched, weekendSched].forEach((schedule) => {
    if (!schedule) return;
    schedule.flat().forEach((p) => {
      if (p != null) periods.add(p);
    });
  });

  return [...periods].sort((a, b) => a - b);
}

/** Build a consistent color scale for all periods in a schedule */
export function buildPeriodColorScale(
  plan: RatePlan | null | undefined,
  type: "energy" | "demand" | "flatDemand",
): { domain: number[]; range: string[] } {
  const periods = getAllPeriods(plan, type);
  const colors = getViridisColors(periods.length);
  return { domain: periods, range: colors };
}
