import type { TopLevelSpec } from "vega-lite";
import type { RatePlan } from "../data/schema";
import { VegaEmbed } from "react-vega";
import type { Dayjs } from "dayjs";
import { Card } from "antd";
import { useMemo } from "react";
import { buildPeriodColorScale } from "./color";

// ============ Utility Types & Functions ============

interface TierInfo {
  rate?: number | null;
  adj?: number | null;
  max?: number | null;
  unit?: "kWh" | "kWh daily" | "kWh/kW" | null;
}

interface ChartTierPoint {
  rate: number;
  max: number;
  tier: number;
  period: number;
  unit?: string | null;
}

function effectiveRate(tier: TierInfo): number {
  return (tier.rate ?? 0) + (tier.adj ?? 0);
}

function processTiersForPeriod(
  tiers: TierInfo[],
  period: number,
  extendLastTierBy = 1.3,
): ChartTierPoint[] {
  if (!tiers.length) return [];

  const points: ChartTierPoint[] = [];
  let prevMax = 0;

  for (let tierIdx = 0; tierIdx < tiers.length; tierIdx++) {
    const tier = tiers[tierIdx];
    if (!tier) continue;

    const rate = effectiveRate(tier);
    const isLastTier = tierIdx === tiers.length - 1;

    points.push({ rate, max: prevMax, tier: tierIdx, period, unit: tier.unit });

    if (tier.max != null) {
      points.push({
        rate,
        max: tier.max,
        tier: tierIdx,
        period,
        unit: tier.unit,
      });
      prevMax = tier.max;
    } else if (isLastTier && prevMax > 0) {
      points.push({
        rate,
        max: prevMax * extendLastTierBy,
        tier: tierIdx,
        period,
        unit: tier.unit,
      });
    }
  }

  return points;
}

function getPeriodsFromSchedule(
  schedule: number[] | null | undefined,
): number[] {
  if (!schedule) return [];
  return [...new Set(schedule)].sort((a, b) => a - b);
}

// ============ Component ============

export function EnergyTiersChart({
  date,
  selectedPlan,
}: {
  selectedPlan?: RatePlan | null;
  date: Dayjs;
}) {
  const isWeekend = [0, 6].includes(date.day());
  const schedule = isWeekend
    ? selectedPlan?.energyWeekendSched?.[date.month()]
    : selectedPlan?.energyWeekdaySched?.[date.month()];
  const periods = useMemo(() => getPeriodsFromSchedule(schedule), [schedule]);

  // Use consistent color scale from ALL periods in the full schedule
  const colorScale = useMemo(
    () => buildPeriodColorScale(selectedPlan, "energy"),
    [selectedPlan],
  );

  // Process today's periods into chart data
  const chartData = useMemo(() => {
    const allPoints: ChartTierPoint[] = [];

    for (const period of periods) {
      const tiers = selectedPlan?.energyRate_tiers?.[period] ?? [];
      const points = processTiersForPeriod(tiers, period);
      allPoints.push(...points);
    }

    return allPoints;
  }, [selectedPlan?.energyRate_tiers, periods]);

  // Calculate domain max for x-axis
  const domainMax = useMemo(() => {
    if (!chartData.length) return undefined;
    return Math.max(...chartData.map((p) => p.max));
  }, [chartData]);

  // Get unit for axis label
  const unit =
    selectedPlan?.energyRate_tiers?.[periods[0] ?? 0]?.[0]?.unit ?? "kWh";

  // Don't render if no meaningful data
  if (chartData.length <= 1 || chartData.every((x) => x.max === 0)) {
    return null;
  }

  const spec: TopLevelSpec = {
    $schema: "https://vega.github.io/schema/vega-lite/v6.json",
    width: 400,
    height: 240,
    title: `Energy Usage Tiers (${date.format("dddd LL")})`,
    data: { values: chartData },
    mark: {
      type: "line",
      interpolate: "step-after",
      point: { filled: true, size: 50 },
      strokeWidth: 2,
    },
    encoding: {
      x: {
        field: "max",
        type: "quantitative",
        title: `Usage (${unit})`,
        scale: { domainMax },
      },
      y: {
        field: "rate",
        type: "quantitative",
        title: "$ per kWh",
        axis: { format: ".2f" },
      },
      color: {
        field: "period",
        type: "nominal",
        title: "Period",
        scale: colorScale,
      },
      strokeDash: {
        field: "tier",
        type: "ordinal",
        title: "Tier",
        legend: null,
      },
      tooltip: [
        { field: "period", title: "Period" },
        { field: "tier", title: "Tier" },
        { field: "max", title: "Usage Limit", format: ".1f" },
        { field: "rate", title: "$ per kWh", format: ".4f" },
      ],
    },
  };

  return (
    <Card>
      <VegaEmbed spec={spec} options={{ mode: "vega-lite", actions: false }} />
    </Card>
  );
}

// ============ Exports for testing ============

export { effectiveRate, processTiersForPeriod, getPeriodsFromSchedule };
export type { TierInfo, ChartTierPoint };
