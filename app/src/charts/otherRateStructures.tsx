import { Card, Statistic } from "antd";
import type { Dayjs } from "dayjs";
import { uniqBy } from "es-toolkit";
import { useMemo } from "react";
import { VegaEmbed } from "react-vega";
import type { TopLevelSpec } from "vega-lite";
import { Heatmap } from "../components/Schedule";
import type { RatePlan } from "../data/schema";
import { getFirstDayOfType } from "../dates";
import { price } from "../formatters";
import { buildPeriodColorScale, getViridisColors } from "./color";
import { MONTHS } from "./constants";

interface DayAndPlan {
  selectedPlan?: RatePlan | null;
  date: Dayjs;
}

const hoverParams = [
  {
    name: "hover",
    select: {
      type: "point" as const,
      on: "pointerover",
      nearest: true,
      clear: "pointerout",
    },
  },
];

export function CoincidentRateChart({ date, selectedPlan }: DayAndPlan) {
  const periods = selectedPlan?.coincidentSched?.[date.month()];
  const values = periods?.flatMap(
    (p, i) =>
      selectedPlan?.coincidentRate_tiers?.[p]?.map((x) => ({
        ...x,
        tier: p,
        hour: i,
      })) ?? [],
  );

  if (values == null) {
    return null;
  }

  values.push({ ...values.at(-1)!, hour: 24 });

  const isBoring = uniqBy(values, (x) => x.rate).length === 1;

  if (isBoring) {
    return (
      <Card>
        <Statistic
          title="Coincident Demand Rate"
          value={price.format(values[0]?.rate ?? 0)}
          suffix={`/ ${selectedPlan?.coincidentRateUnits ?? "kW"} all day`}
        />
      </Card>
    );
  }

  const spec: TopLevelSpec = {
    $schema: "https://vega.github.io/schema/vega-lite/v6.json",
    width: 320,
    height: 200,
    data: { values },
    params: hoverParams,
    mark: {
      type: "line",
      strokeWidth: 2,
      interpolate: "step-after",
      point: { filled: true, size: 60 },
    },
    title: `Coincident Demand Rate (${date.format("dddd LL")})`,
    encoding: {
      x: {
        field: "hour",
        type: "quantitative",
        title: "Hour of Day",
        axis: { labelAngle: 0, tickCount: 24 },
        scale: { domain: [0, 24] },
      },
      y: {
        field: "rate",
        type: "quantitative",
        title: `Rate (${selectedPlan?.coincidentRateUnits ?? "kW"})`,
      },
      color: { type: "nominal", legend: null, scale: { scheme: "viridis" } },
      tooltip: [
        { field: "hour", title: "Hour" },
        { field: "rate", title: "Rate", format: ".3f" },
        { field: "tier", title: "Period" },
      ],
    },
  };

  return (
    <Card>
      <VegaEmbed spec={spec} options={{ mode: "vega-lite", actions: false }} />
    </Card>
  );
}

export function DemandRateChart({ date, selectedPlan }: DayAndPlan) {
  if (!selectedPlan) return null;

  const isWeekend = date.day() === 0 || date.day() === 6;
  const schedule = isWeekend
    ? selectedPlan.demandWeekendSched
    : selectedPlan.demandWeekdaySched;

  const monthSchedule = schedule?.[date.month()];
  const selectedTiers = monthSchedule?.flatMap((period, hour) => {
    const { demandRate_tiers } = selectedPlan;
    const nextPeriod = monthSchedule[hour + 1];

    return (
      demandRate_tiers?.[period]?.flatMap((x, tier) => {
        const base = { ...x, hour, period, tier };

        // End of day: close with point at hour 24
        if (hour === 23) {
          return [base, { ...base, hour: 24 }];
        }
        // Period boundary: close the step, then insert null to break the line
        if (nextPeriod !== period) {
          return [
            base,
            { ...base, hour: hour + 1 },
            { ...base, hour: hour + 1, rate: null },
          ];
        }
        return base;
      }) ?? []
    );
  });

  // Use consistent color scale from ALL periods in the full demand schedule
  const colorScale = useMemo(
    () => buildPeriodColorScale(selectedPlan, "demand"),
    [selectedPlan],
  );

  // Don't render if no data
  if (!selectedTiers?.length) return null;

  const spec: TopLevelSpec = {
    $schema: "https://vega.github.io/schema/vega-lite/v6.json",
    width: 400,
    height: 240,
    title: `Demand Rate Structure (${date.format("dddd LL")})`,
    data: { values: selectedTiers },
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
        field: "rate",
        type: "quantitative",
        title: "$ per kW",
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
        { field: "hour", title: "Hour" },
        { field: "period", title: "Period" },
        { field: "tier", title: "Tier" },
        { field: "rate", title: "$ per kW", format: ".4f" },
      ],
    },
  };

  return (
    <Card>
      <VegaEmbed spec={spec} options={{ mode: "vega-lite", actions: false }} />
    </Card>
  );
}

export function DemandTierRateChart({ date, selectedPlan }: DayAndPlan) {
  if (!selectedPlan) return null;

  const isWeekend = date.day() === 0 || date.day() === 6;
  const schedule = isWeekend
    ? selectedPlan.demandWeekendSched
    : selectedPlan.demandWeekdaySched;

  const colorScale = useMemo(
    () => buildPeriodColorScale(selectedPlan, "demand"),
    [selectedPlan],
  );

  const periods = schedule?.[date.month()];
  let selectedTiers = periods?.flatMap((p) => {
    const { demandRate_tiers } = selectedPlan;

    return (
      demandRate_tiers?.[p]?.flatMap((x, tier) => {
        let next = { ...x, tier, period: p };

        if (next.max == null) {
          const prev = demandRate_tiers?.[p]?.[tier - 1];
          next = { ...next, max: prev?.max != null ? prev.max : 0 };
          return [next, { ...next, max: (next.max ?? 0) * 1.5 || 100 }];
        }
        return next;
      }) ?? []
    );
  });

  if (selectedTiers?.[0] == null) return null;

  if (selectedTiers[0].max != 0) {
    selectedTiers = [{ ...selectedTiers[0], max: 0 }, ...selectedTiers];
  }

  const isBoring =
    uniqBy(selectedTiers, (x) => [x.rate, x.period].join("/")).length === 1;

  if (isBoring && selectedTiers.length) {
    return (
      <Card>
        <Statistic
          title="Demand Rate Tiers"
          value={price.format(selectedTiers[0]?.rate ?? 0)}
          suffix={`/ ${selectedPlan?.demandRateUnits ?? "kW"}`}
        />
      </Card>
    );
  }

  const spec: TopLevelSpec = {
    $schema: "https://vega.github.io/schema/vega-lite/v6.json",
    width: 320,
    height: 200,
    data: { values: selectedTiers },
    params: hoverParams,
    mark: {
      type: "line",
      interpolate: "step-after",
      point: { filled: true, size: 60 },
    },
    title: `Demand Rate Tiers (${date.format("dddd LL")})`,
    encoding: {
      y: {
        field: "rate",
        type: "quantitative",
        title: `$ per ${selectedPlan?.demandRateUnits ?? "kW"}`,
        stack: null,
      },
      x: {
        field: "max",
        type: "quantitative",
        title: `Max (${selectedPlan?.demandRateUnits ?? "kW"})`,
        scale: { domainMax: Math.max(...selectedTiers.map((x) => x.max ?? 0)) },
      },
      color: { field: "period", title: "Period", scale: colorScale },
      tooltip: [
        { field: "max", title: "Max Demand", format: ".1f" },
        { field: "rate", title: "$ per kW", format: ".3f" },
        { field: "period", title: "Period" },
        { field: "tier", title: "Tier" },
      ],
    },
  };

  return (
    <Card>
      <VegaEmbed spec={spec} options={{ mode: "vega-lite", actions: false }} />
    </Card>
  );
}

export function FlatDemandMonthsChart({
  selectedPlan,
  date,
  onDateChange,
}: {
  selectedPlan?: RatePlan | null;
  date: Dayjs;
  onDateChange?: (newDate: Dayjs) => void;
}) {
  if (!selectedPlan?.flatDemandMonths) return null;

  const flatDemandMonths = selectedPlan.flatDemandMonths;

  // Get unique tier indices
  const uniqueTiers = [...new Set(flatDemandMonths)].sort((a, b) => a - b);

  // If all months have the same tier, no need for a heatmap
  if (uniqueTiers.length <= 1) return null;

  const colors = getViridisColors(uniqueTiers.length);
  const colorScale = {
    domain: uniqueTiers.map(String),
    range: colors,
  };

  const data = flatDemandMonths.map((tierIndex, monthIndex) => ({
    month: MONTHS[monthIndex],
    monthIndex,
    period: String(tierIndex),
  }));

  const interactive = !!onDateChange;

  const spec: TopLevelSpec = {
    $schema: "https://vega.github.io/schema/vega-lite/v6.json",
    title: "Flat Demand Schedule",
    width: 15,
    height: 200,
    data: { values: data },
    params: interactive
      ? [
          {
            name: "cellClick",
            select: {
              type: "point",
              on: "click",
              fields: ["monthIndex"],
            },
          },
        ]
      : [],
    mark: {
      type: "rect",
      width: 15,
      height: 15,
      stroke: "white",
      cursor: interactive ? "pointer" : "default",
    },
    encoding: {
      y: { field: "month", type: "ordinal", title: null, sort: MONTHS },
      color: {
        field: "period",
        type: "ordinal",
        title: "Period",
        scale: colorScale,
      },
      tooltip: [
        { field: "month", title: "Month" },
        { field: "period", title: "Period" },
      ],
    },
    config: { axis: { grid: false }, view: { stroke: null } },
  };

  const handleCellClick = (monthIndex: number) => {
    if (!onDateChange) return;
    // Default to first weekday of the month since flat demand doesn't vary by day type
    const newDate = getFirstDayOfType(date.year(), monthIndex, "weekday");
    onDateChange(newDate);
  };

  return (
    <Heatmap
      spec={spec}
      onCellClick={onDateChange ? (m) => handleCellClick(m) : undefined}
    />
  );
}

export function FlatDemandChart({
  date,
  selectedPlan,
  onDateChange,
}: DayAndPlan & {
  onDateChange?: (newDate: Dayjs) => void;
}) {
  const currentMonth = date.month();
  const tierIndex = selectedPlan?.flatDemandMonths?.[currentMonth];
  const selectedTiers = selectedPlan?.flatDemand_tiers?.[tierIndex!];

  if (selectedTiers == null) return null;

  let values = [];
  if (selectedTiers.length == 1 && selectedTiers[0]?.max == null) {
    const only = selectedTiers[0];
    values = [
      { ...only, max: 0, tier: 0 },
      { ...only, max: 1000, tier: 0 },
    ];
  } else {
    values = selectedTiers.flatMap((t, i) => {
      let prev = selectedTiers[i - 1];
      let next = { ...t, tier: i };

      if (!prev) prev = { ...next, max: 0 };
      if (t.max == null) next = { ...next, max: (prev.max ?? 0) * 1.5 };

      return [{ ...prev, tier: i, rate: next.rate }, next];
    });
  }

  const isBoring = uniqBy(values, (x) => x.rate).length === 1;
  const calendar = (
    <FlatDemandMonthsChart
      onDateChange={onDateChange}
      date={date}
      selectedPlan={selectedPlan}
    />
  );

  if (isBoring && values.length) {
    return (
      <>
        {calendar}
        <Card>
          <Statistic
            title="Flat Demand Rate"
            value={price.format(values[0]?.rate ?? 0)}
            suffix={`/ ${selectedPlan?.flatDemandUnits ?? "kW"}`}
          />
        </Card>
      </>
    );
  }

  const spec: TopLevelSpec = {
    $schema: "https://vega.github.io/schema/vega-lite/v6.json",
    width: 320,
    height: 200,
    data: { values },
    params: hoverParams,
    mark: {
      type: "line",
      interpolate: "step-after",
      point: { filled: true, size: 60 },
    },
    title: `Flat Demand Rate (${date.format("dddd LL")})`,
    encoding: {
      y: {
        field: "rate",
        type: "quantitative",
        title: `Rate (${selectedPlan?.flatDemandUnits ?? "kW"})`,
      },
      x: {
        field: "max",
        type: "quantitative",
        title: `Max Demand (${selectedPlan?.flatDemandUnits ?? "kW"})`,
        scale: { domainMax: Math.max(...values.map((x) => x.max ?? 0)) },
      },
      color: { field: "tier", title: "Tier", scale: { scheme: "viridis" } },
      tooltip: [
        { field: "max", title: "Max Demand", format: ".1f" },
        { field: "rate", title: "Rate", format: ".3f" },
        { field: "tier", title: "Tier" },
      ],
    },
  };

  return (
    <>
      {calendar}
      <Card>
        <VegaEmbed
          spec={spec}
          options={{ mode: "vega-lite", actions: false }}
        />
      </Card>
    </>
  );
}
