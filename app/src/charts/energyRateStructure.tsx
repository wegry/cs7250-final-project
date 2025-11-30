import { Button, Card, Popover, Statistic } from "antd";
import type { Dayjs } from "dayjs";
import { sum, uniqBy } from "es-toolkit";
import { useMemo } from "react";
import { VegaEmbed } from "react-vega";
import type { TopLevelSpec } from "vega-lite";
import type { RatePlan, RetailPriceData } from "../data/schema";
import { price } from "../formatters";
import { getViridisColors } from "../charts/color";

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
      uniqBy(
        retailData.filter((x) => x.value !== null),
        (x) => [x.period, x.tier, x.value, x.adj].join("/")
      ).length === 1,
    [retailData]
  );

  const sameAllYearLong = useMemo(
    () =>
      new Set(
        selectedPlan?.energyWeekdaySched
          ?.concat(selectedPlan.energyWeekendSched ?? [])
          ?.flat()
      ).size === 1,
    [selectedPlan]
  );

  // Build color scale for periods
  const colorScale = useMemo(() => {
    const periods = [
      ...new Set(
        retailData.filter((d) => d.value !== null).map((d) => d.period)
      ),
    ].sort((a, b) => a - b);
    const colors = getViridisColors(periods.length);
    return { domain: periods, range: colors };
  }, [retailData]);

  if (!retailData.length) {
    return null;
  }

  if (isBoring) {
    const first = retailData.find((d) => d.value !== null);
    if (!first) {
      return null;
    }

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
      type: "line",
      strokeWidth: 2,
      interpolate: "step-after",
      point: { filled: true, size: 50 },
    },
    encoding: {
      x: {
        field: "hour",
        type: "quantitative",
        title: "Hour of Day",
        scale: { domain: [0, 24] },
        axis: { tickCount: 24, labelAngle: 0 },
      },
      y: {
        field: "value",
        type: "quantitative",
        title: "$ per kWh",
        axis: {
          format: ".2f",
        },
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
        { field: "hour", title: "Hour" },
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

type ChartDataPoint = RetailPriceData;

function pullData(
  data: RatePlan | null | undefined,
  date: Dayjs
): ChartDataPoint[] {
  const tiers = data?.energyRate_tiers;
  const schedule = [0, 6].includes(date.day())
    ? data?.energyWeekendSched
    : data?.energyWeekdaySched;

  const monthSchedule = schedule?.[date.month()];
  if (!monthSchedule) return [];

  const results: ChartDataPoint[] = [];

  for (let i = 0; i < monthSchedule.length; i++) {
    const period = monthSchedule[i];
    if (period == null) {
      continue;
    }
    const nextPeriod = monthSchedule[i + 1];
    const periodInfo = tiers?.[period];
    if (!periodInfo) continue;

    for (let j = 0; j < periodInfo.length; j++) {
      const tierInfo = periodInfo[j];
      if (!tierInfo) continue;

      const value = sum([tierInfo.rate, tierInfo.adj].map((x) => x ?? 0));
      const base = {
        tier: j,
        period,
        baseRate: tierInfo.rate,
        adj: tierInfo.adj ?? undefined,
      };

      results.push({ ...base, hour: i, value });

      // End of day: close with point at hour 24
      if (i === 23) {
        results.push({ ...base, hour: 24, value });
      }
      // Period boundary: close the step, then insert null to break the line
      else if (nextPeriod !== period) {
        results.push({ ...base, hour: i + 1, value });
        results.push({ ...base, hour: i + 1, value: null });
      }
    }
  }

  return results;
}
