import { Button, Card, Popover, Statistic } from "antd";
import type { Dayjs } from "dayjs";
import { sum, uniqBy } from "es-toolkit";
import { useMemo } from "react";
import { VegaEmbed } from "react-vega";
import type { TopLevelSpec } from "vega-lite";
import type {
  RatePlan,
  RetailPriceData,
  WholesalePrice,
  WholesalePriceData,
} from "../data/schema";
import { price } from "../formatters";

export function convertWholesaleToKwh(wholesalePrice: WholesalePrice) {
  return {
    max: wholesalePrice["High price $/MWh"] / 1000,
    min: wholesalePrice["Low price $/MWh"] / 1000,
    avg: wholesalePrice["Wtd avg price $/MWh"] / 1000,
  };
}

export function prepareWholesaleData(
  wholesalePrice: WholesalePrice | undefined | null,
): WholesalePriceData[] {
  if (!wholesalePrice) return [];
  const { max, avg, min } = convertWholesaleToKwh(wholesalePrice);
  return [
    { hour: 0, value: max, line: `Max Wholesale (${max.toFixed(3)})` },
    { hour: 24, value: max, line: `Max Wholesale (${max.toFixed(3)})` },
    { hour: 0, value: avg, line: `Avg Wholesale (${avg.toFixed(3)})` },
    { hour: 24, value: avg, line: `Avg Wholesale (${avg.toFixed(3)})` },
    { hour: 0, value: min, line: `Min Wholesale (${min.toFixed(3)})` },
    { hour: 24, value: min, line: `Min Wholesale (${min.toFixed(3)})` },
  ];
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

  if (!retailData.length) {
    return null;
  }

  if (isBoring && retailData.length) {
    const first = retailData?.[0];
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
    width: 320,
    height: 200,
    title: `Energy Rate Structure (${date.format("dddd LL")})`,
    resolve: {
      legend: { color: "independent" },
      scale: { color: "independent" },
    },
    layer: [
      ...(retailData.length
        ? [
            {
              data: { values: retailData },
              params: [
                {
                  name: "hover",
                  select: {
                    type: "point" as const,
                    on: "pointerover",
                    nearest: true,
                    clear: "pointerout",
                  },
                },
              ],
              mark: {
                type: "line" as const,
                strokeWidth: 2,
                interpolate: "step-after" as const,
                point: { filled: true, size: 60 },
              },
              encoding: {
                x: {
                  field: "hour",
                  type: "quantitative" as const,
                  title: "Hour of Day",
                  scale: { domain: [0, 24] },
                  axis: { tickCount: 24, labelAngle: 0 },
                },
                y: {
                  field: "value",
                  type: "quantitative" as const,
                  title: "$ per kWh",
                },
                color: {
                  field: "tier",
                  type: "nominal" as const,
                  title: "Tier",
                  scale: { scheme: "viridis" as const },
                },
                tooltip: [
                  { field: "hour", title: "Hour" },
                  { field: "value", title: "$ per kWh", format: ".3f" },
                  { field: "period", title: "Period" },
                  { field: "tier", title: "Tier" },
                ],
              },
            },
          ]
        : []),
    ],
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
): RetailPriceData[] {
  const tiers = data?.energyRate_tiers;
  const schedule = [0, 6].includes(date.day())
    ? data?.energyWeekendSched
    : data?.energyWeekdaySched;

  return (
    schedule?.[date.month()]?.flatMap((period, i) => {
      const periodInfo = tiers?.[period];
      if (!periodInfo) return [];

      return periodInfo.flatMap((tierInfo, j) => {
        if (!tierInfo) return [];
        const result: RetailPriceData = {
          hour: i,
          baseRate: tierInfo.rate,
          value: sum([tierInfo.rate, tierInfo.adj].map((x) => x ?? 0)),
          tier: j,
          period,
          adj: tierInfo.adj ?? undefined,
        };
        return result.hour === 23 ? [result, { ...result, hour: 24 }] : result;
      });
    }) ?? []
  );
}
