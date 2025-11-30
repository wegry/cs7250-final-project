import { Card, Statistic } from "antd";
import type { Dayjs } from "dayjs";
import { sum, uniqBy } from "es-toolkit";
import { useMemo } from "react";
import { VegaEmbed } from "react-vega";
import type { TopLevelSpec } from "vega-lite";
import { AdjPopover } from "../components/AdjPopover";
import { Heatmap } from "../components/Schedule";
import type { RatePlan } from "../data/schema";
import { getFirstDayOfType } from "../dates";
import { price } from "../formatters";
import { buildPeriodColorScale } from "./color";
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
      selectedPlan?.coincidentRate_tiers?.[p]?.map((x) => {
        const value = sum([x.rate, x.adj].map((v) => v ?? 0));
        return {
          ...x,
          tier: p,
          hour: i,
          value,
          baseRate: x.rate,
        };
      }) ?? [],
  );

  if (values == null || !values.length) return null;

  values.push({ ...values.at(-1)!, hour: 24 });

  const isBoring = uniqBy(values, (x) => x.value).length === 1;
  const first = values[0];

  if (isBoring) {
    return (
      <Card>
        <Statistic
          title="Coincident Demand Rate"
          value={price.format(first?.value ?? 0)}
          suffix={
            <>
              / {selectedPlan?.coincidentRateUnits ?? "kW"} all day
              <AdjPopover baseRate={first?.baseRate} adj={first?.adj} />
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
        field: "value",
        type: "quantitative",
        title: `Rate (${selectedPlan?.coincidentRateUnits ?? "kW"})`,
      },
      color: { type: "nominal", legend: null, scale: { scheme: "viridis" } },
      tooltip: [
        { field: "hour", title: "Hour" },
        { field: "value", title: "Rate", format: ".3f" },
        { field: "baseRate", title: "Base Rate", format: ".3f" },
        { field: "adj", title: "Adjustment", format: ".3f" },
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
        const value = sum([x.rate, x.adj].map((v) => v ?? 0));
        const base = { ...x, hour, period, tier, value, baseRate: x.rate };

        if (hour === 23) {
          return [base, { ...base, hour: 24 }];
        }
        if (nextPeriod !== period) {
          return [
            base,
            { ...base, hour: hour + 1 },
            { ...base, hour: hour + 1, value: null },
          ];
        }
        return base;
      }) ?? []
    );
  });

  const colorScale = useMemo(
    () => buildPeriodColorScale(selectedPlan, "demand"),
    [selectedPlan],
  );

  if (!selectedTiers?.length) {
    return null;
  } else if (selectedTiers.every((x) => x.value === 0)) {
    return (
      <Card>
        <Statistic
          title="Demand rate"
          value={price.format(0)}
          suffix="all day"
        />
      </Card>
    );
  }

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
        field: "value",
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
        { field: "value", title: "$ per kW", format: ".4f" },
        { field: "baseRate", title: "Base Rate", format: ".4f" },
        { field: "adj", title: "Adjustment", format: ".4f" },
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
        const value = sum([x.rate, x.adj].map((v) => v ?? 0));
        let next = { ...x, tier, period: p, value, baseRate: x.rate };

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
    uniqBy(selectedTiers, (x) => [x.value, x.period].join("/")).length === 1;
  const first = selectedTiers[0];

  const isReallyBoring = isBoring && first?.value === 0;

  if (isReallyBoring) {
    return null;
  }

  if (isBoring && selectedTiers.length) {
    return (
      <Card>
        <Statistic
          title="Demand Rate Tiers"
          value={price.format(first?.value ?? 0)}
          suffix={
            <>
              / {selectedPlan?.demandRateUnits ?? "kW"}
              <AdjPopover baseRate={first?.baseRate} adj={first?.adj} />
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
        field: "value",
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
        { field: "value", title: "$ per kW", format: ".3f" },
        { field: "baseRate", title: "Base Rate", format: ".3f" },
        { field: "adj", title: "Adjustment", format: ".3f" },
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
  if (!selectedPlan?.flatDemandMonths) {
    return null;
  }

  const flatDemandMonths = selectedPlan.flatDemandMonths;
  const uniqueTiers = [...new Set(flatDemandMonths)].sort((a, b) => a - b);

  if (uniqueTiers.length <= 1) {
    return null;
  }

  const colorScale = buildPeriodColorScale(selectedPlan, "flatDemand");

  const data = flatDemandMonths.map((periodIndex, monthIndex) => ({
    month: MONTHS[monthIndex],
    monthIndex,
    period: periodIndex,
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
  const colorScale = useMemo(
    () => buildPeriodColorScale(selectedPlan, "flatDemand"),
    [selectedPlan],
  );

  const currentMonth = date.month();
  const periodIndex = selectedPlan?.flatDemandMonths?.[currentMonth];
  const tiers = selectedPlan?.flatDemand_tiers?.[periodIndex!];

  if (!tiers?.length) return null;

  let values = tiers.flatMap((t, tierIdx) => {
    const prev = tiers[tierIdx - 1];
    const value = sum([t.rate, t.adj].map((v) => v ?? 0));
    const base = {
      ...t,
      tier: tierIdx,
      period: periodIndex,
      value,
      baseRate: t.rate,
    };

    // Handle the first tier starting at 0
    const startMax = tierIdx === 0 ? 0 : (prev?.max ?? 0);

    if (t.max == null) {
      // Open-ended tier - extend to 1.5x the previous max or 100
      const extendedMax = (prev?.max ?? 0) * 1.5 || 100;
      return [
        { ...base, max: startMax },
        { ...base, max: extendedMax },
      ];
    }

    return [
      { ...base, max: startMax },
      { ...base, max: t.max },
    ];
  });

  const isBoring =
    uniqBy(values, (x) => [x.value, x.period].join("/")).length === 1;
  const first = values[0];

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
            value={price.format(first?.value ?? 0)}
            suffix={
              <>
                / {selectedPlan?.flatDemandUnits ?? "kW"}
                <AdjPopover baseRate={first?.baseRate} adj={first?.adj} />
              </>
            }
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
    title: `Flat Demand Tiers (${date.format("MMMM")})`,
    encoding: {
      x: {
        field: "max",
        type: "quantitative",
        title: `Max Demand (${selectedPlan?.flatDemandUnits ?? "kW"})`,
        scale: { domainMax: Math.max(...values.map((x) => x.max ?? 0)) },
      },
      y: {
        field: "value",
        type: "quantitative",
        title: `$ per ${selectedPlan?.flatDemandUnits ?? "kW"}`,
        stack: null,
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
        { field: "max", title: "Max Demand", format: ".1f" },
        { field: "value", title: "$ per kW", format: ".3f" },
        { field: "baseRate", title: "Base Rate", format: ".3f" },
        { field: "adj", title: "Adjustment", format: ".3f" },
        { field: "period", title: "Period" },
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
