import type { TopLevelSpec } from "vega-lite";
import type { RatePlan } from "../data/schema";
import { VegaEmbed } from "react-vega";
import type { Dayjs } from "dayjs";
import { Card, Segmented } from "antd";
import { useMemo, useState } from "react";

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
    if (!tier) {
      continue;
    }
    const rate = effectiveRate(tier);
    const isLastTier = tierIdx === tiers.length - 1;

    // Start point of this tier (at previous tier's max)
    points.push({
      rate,
      max: prevMax,
      tier: tierIdx,
      period,
      unit: tier.unit,
    });

    // End point of this tier
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
      // Last tier without max: extend the chart
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
  const schedule = selectedPlan?.energyWeekdaySched?.[date.month()];
  const periods = useMemo(() => getPeriodsFromSchedule(schedule), [schedule]);

  // If multiple periods, allow user to select which one to view
  const [selectedPeriod, setSelectedPeriod] = useState<number | null>(null);
  const activePeriod = selectedPeriod ?? periods[0] ?? 0;

  // Get tiers for the active period
  const tiers = useMemo(() => {
    return selectedPlan?.energyRate_tiers?.[activePeriod] ?? [];
  }, [selectedPlan?.energyRate_tiers, activePeriod]);

  // Process tiers into chart data
  const chartData = useMemo(() => {
    return processTiersForPeriod(tiers, activePeriod);
  }, [tiers, activePeriod]);

  // Calculate domain max for x-axis (handles trailing off)
  const domainMax = useMemo(() => {
    if (!chartData.length) return undefined;
    const maxValue = Math.max(...chartData.map((p) => p.max));
    return maxValue;
  }, [chartData]);

  // Get unit for axis label
  const unit = tiers[0]?.unit ?? "kWh";

  // Don't render if no meaningful tier data
  if (chartData.length <= 1) {
    return null;
  }

  const spec: TopLevelSpec = {
    $schema: "https://vega.github.io/schema/vega-lite/v6.json",
    width: 320,
    height: 200,
    title: `Energy Usage Tiers (${date.format("dddd LL")})`,
    data: { values: chartData },
    params: [
      {
        name: "hover",
        select: {
          type: "point",
          on: "pointerover",
          nearest: true,
          clear: "pointerout",
        },
      },
    ],
    mark: {
      type: "line",
      interpolate: "step-after",
      point: { filled: true, size: 60 },
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
      },
      color: {
        field: "tier",
        type: "ordinal",
        title: "Tier",
        scale: { scheme: "viridis" },
      },
      tooltip: [
        { field: "max", title: "Usage Limit", format: ".1f" },
        { field: "rate", title: "$ per kWh", format: ".4f" },
        { field: "tier", title: "Tier" },
      ],
    },
  };

  return (
    <Card>
      {periods.length > 1 && (
        <div style={{ marginBottom: 16 }}>
          <Segmented
            options={periods.map((p) => ({
              label: `Period ${p}`,
              value: p,
            }))}
            value={activePeriod}
            onChange={(value) => setSelectedPeriod(value as number)}
          />
        </div>
      )}
      <VegaEmbed spec={spec} options={{ mode: "vega-lite", actions: false }} />
    </Card>
  );
}

// ============ Exports for testing ============

export { effectiveRate, processTiersForPeriod, getPeriodsFromSchedule };
export type { TierInfo, ChartTierPoint };
