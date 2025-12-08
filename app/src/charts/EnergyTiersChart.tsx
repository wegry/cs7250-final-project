import type { TopLevelSpec } from "vega-lite";
import type { RatePlan } from "../data/schema";
import { VegaEmbed } from "react-vega";
import type { Dayjs } from "dayjs";
import { Card } from "antd";
import { useMemo } from "react";
import { buildPeriodColorScale } from "./color";
import { buildInteractiveLegend } from "./interactiveLegend";
import { useSyncedLegend } from "./LegendSelectionContext";

interface TierInfo {
  rate?: number | null;
  adj?: number | null;
  max?: number | null;
  unit?: "kWh" | "kWh daily" | "kWh/kW" | null;
}

interface ChartTierSegment {
  rate: number;
  min: number;
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
  extendLastTierBy = 1.3
): ChartTierSegment[] {
  if (!tiers.length) return [];

  const segments: ChartTierSegment[] = [];
  let prevMax = 0;

  for (let tierIdx = 0; tierIdx < tiers.length; tierIdx++) {
    const tier = tiers[tierIdx];
    if (!tier) continue;

    const rate = effectiveRate(tier);
    const isLastTier = tierIdx === tiers.length - 1;

    let max: number;
    if (tier.max != null) {
      max = tier.max;
    } else if (isLastTier && prevMax > 0) {
      max = prevMax * extendLastTierBy;
    } else {
      continue;
    }

    segments.push({
      rate,
      min: prevMax,
      max,
      tier: tierIdx,
      period,
      unit: tier.unit,
    });

    prevMax = max;
  }

  return segments;
}

function getPeriodsFromSchedule(
  schedule: number[] | null | undefined
): number[] {
  if (!schedule) return [];
  return [...new Set(schedule)].sort((a, b) => a - b);
}

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

  const colorScale = useMemo(
    () => buildPeriodColorScale(selectedPlan, "energy"),
    [selectedPlan]
  );

  const chartData = useMemo(() => {
    const allSegments: ChartTierSegment[] = [];
    for (const period of periods) {
      const tiers = selectedPlan?.energyRate_tiers?.[period] ?? [];
      const segments = processTiersForPeriod(tiers, period);
      allSegments.push(...segments);
    }
    return allSegments;
  }, [selectedPlan?.energyRate_tiers, periods]);

  const legend = useMemo(() => buildInteractiveLegend(chartData), [chartData]);

  const { handleEmbed } = useSyncedLegend({
    hasPeriodLegend: legend.showPeriodLegend,
    hasTierLegend: legend.showTierLegend,
  });

  const domainMax = useMemo(() => {
    if (!chartData.length) return undefined;
    return Math.max(...chartData.map((p) => p.max));
  }, [chartData]);

  const unit =
    selectedPlan?.energyRate_tiers?.[periods[0] ?? 0]?.[0]?.unit ?? "kWh";

  if (chartData.length <= 1 || chartData.every((x) => x.max === 0)) {
    return null;
  }

  const spec: TopLevelSpec = {
    $schema: "https://vega.github.io/schema/vega-lite/v6.json",
    width: 400,
    height: 240,
    title: `Energy Usage Tiers (${date.format("dddd LL")})`,
    data: { values: chartData },
    params: legend.params,
    mark: { type: "rule", strokeWidth: 3 },
    encoding: {
      x: {
        field: "min",
        type: "quantitative",
        title: `Usage (${unit})`,
        scale: { domainMax },
      },
      x2: { field: "max" },
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
        legend: legend.colorLegend,
      },
      strokeDash: {
        field: "tier",
        type: "ordinal",
        title: "Tier",
        legend: legend.strokeDashLegend,
      },
      opacity: legend.opacityEncoding,
      tooltip: [
        { field: "period", title: "Period" },
        { field: "tier", title: "Tier" },
        { field: "min", title: "Usage From", format: ".1f" },
        { field: "max", title: "Usage To", format: ".1f" },
        { field: "rate", title: "$ per kWh", format: ".4f" },
      ],
    },
  };

  return (
    <Card>
      <VegaEmbed
        spec={spec}
        options={{ mode: "vega-lite", actions: false }}
        onEmbed={handleEmbed}
      />
    </Card>
  );
}

export { effectiveRate, processTiersForPeriod, getPeriodsFromSchedule };
export type { TierInfo, ChartTierSegment };
