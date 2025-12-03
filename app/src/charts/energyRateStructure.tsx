import { Button, Card, Popover, Statistic } from "antd";
import type { Dayjs } from "dayjs";
import { sum, uniqBy } from "es-toolkit";
import { useMemo } from "react";
import { VegaEmbed } from "react-vega";
import type { TopLevelSpec } from "vega-lite";
import type { RatePlan } from "../data/schema";
import { price } from "../formatters";
import { buildPeriodColorScale } from "./color";

interface ChartDataPoint {
  hourStart: number;
  hourEnd: number;
  tier: number;
  period: number;
  baseRate: number | null;
  adj?: number;
  value: number;
}

export function EnergyRateChart({
  date,
  selectedPlan,
}: {
  selectedPlan?: RatePlan | null;
  date: Dayjs;
}) {
  const retailData = pullData(selectedPlan, date);

  const isBoring = useMemo(
    () =>
      uniqBy(retailData, (x) => [x.period, x.tier, x.value, x.adj].join("/"))
        .length === 1,
    [retailData],
  );

  const sameAllYearLong = useMemo(
    () =>
      new Set(
        selectedPlan?.energyWeekdaySched
          ?.concat(selectedPlan.energyWeekendSched ?? [])
          ?.flat(),
      ).size === 1,
    [selectedPlan],
  );

  const colorScale = useMemo(
    () => buildPeriodColorScale(selectedPlan, "energy"),
    [selectedPlan],
  );

  if (!retailData.length) {
    return null;
  }

  if (isBoring) {
    const first = retailData[0]!;
    return (
      <Card>
        <Statistic
          title="Energy Price"
          value={price.format((first.baseRate ?? 0) + (first.adj ?? 0))}
          suffix={
            <>
              / kWh all day {sameAllYearLong ? "all year" : ""}
              {first.adj != null && (
                <Popover
                  trigger="click"
                  content={`Base rate of ${price.format(first.baseRate ?? 0)} includes adjustment of ${price.format(first.adj ?? 0)}`}
                >
                  <Button size="large" style={{ marginLeft: 8 }}>
                    Adj.
                  </Button>
                </Popover>
              )}
            </>
          }
        />
      </Card>
    );
  }

  const spec: TopLevelSpec = {
    $schema: "https://vega.github.io/schema/vega-lite/v6.json",
    width: 400,
    height: 240,
    title: `Energy Rate Structure (${date.format("dddd LL")})`,
    data: { values: retailData },
    mark: {
      type: "rule",
      strokeWidth: 3,
    },
    encoding: {
      x: {
        field: "hourStart",
        type: "quantitative",
        title: "Hour of Day",
        scale: { domain: [0, 24] },
        axis: { tickCount: 24, labelAngle: 0 },
      },
      x2: { field: "hourEnd" },
      y: {
        field: "value",
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
      },
      tooltip: [
        { field: "hourStart", title: "From Hour" },
        { field: "hourEnd", title: "To Hour" },
        { field: "period", title: "Period" },
        { field: "tier", title: "Tier" },
        { field: "value", title: "$ per kWh", format: ".4f" },
      ],
    },
  };

  return (
    <Card>
      <VegaEmbed spec={spec} options={{ mode: "vega-lite", actions: false }} />
    </Card>
  );
}

function pullData(
  data: RatePlan | null | undefined,
  date: Dayjs,
): ChartDataPoint[] {
  const tiers = data?.energyRate_tiers;
  const schedule = [0, 6].includes(date.day())
    ? data?.energyWeekendSched
    : data?.energyWeekdaySched;

  const monthSchedule = schedule?.[date.month()];
  if (!monthSchedule) return [];

  const results: ChartDataPoint[] = [];

  let segmentStart = 0;
  let currentPeriod = monthSchedule[0]!;

  for (let hour = 1; hour <= 24; hour++) {
    const period = hour < 24 ? monthSchedule[hour] : null;

    if (period !== currentPeriod) {
      // Close the current segment
      if (currentPeriod != null) {
        const periodInfo = tiers?.[currentPeriod];
        if (periodInfo) {
          for (let t = 0; t < periodInfo.length; t++) {
            const tierInfo = periodInfo[t];
            if (!tierInfo) continue;

            results.push({
              hourStart: segmentStart,
              hourEnd: hour,
              tier: t,
              period: currentPeriod,
              baseRate: tierInfo.rate!,
              adj: tierInfo.adj ?? undefined,
              value: sum([tierInfo.rate, tierInfo.adj].map((x) => x ?? 0)),
            });
          }
        }
      }
      segmentStart = hour;
      currentPeriod = period!;
    }
  }

  return results;
}
