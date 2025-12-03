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

interface HourSegment {
  hourStart: number;
  hourEnd: number;
  value: number;
  baseRate?: number | null;
  adj?: number | null;
  period: number;
  tier: number;
}

interface TierSegment {
  min: number;
  max: number;
  value: number;
  baseRate?: number | null;
  adj?: number | null;
  period: number;
  tier: number;
}

export function CoincidentRateChart({ date, selectedPlan }: DayAndPlan) {
  const periods = selectedPlan?.coincidentSched?.[date.month()];

  const segments = useMemo(() => {
    if (!periods) return [];

    const result: HourSegment[] = [];
    let segmentStart = 0;
    let currentPeriod = periods[0];

    for (let hour = 1; hour <= 24; hour++) {
      const period = hour < 24 ? periods[hour] : null;

      if (period !== currentPeriod) {
        if (currentPeriod != null) {
          const tiers =
            selectedPlan?.coincidentRate_tiers?.[currentPeriod] ?? [];
          for (let t = 0; t < tiers.length; t++) {
            const tier = tiers[t];
            if (!tier) continue;
            const value = sum([tier.rate, tier.adj].map((v) => v ?? 0));
            result.push({
              hourStart: segmentStart,
              hourEnd: hour,
              value,
              baseRate: tier.rate,
              adj: tier.adj,
              period: currentPeriod,
              tier: t,
            });
          }
        }
        segmentStart = hour;
        currentPeriod = period!;
      }
    }
    return result;
  }, [periods, selectedPlan?.coincidentRate_tiers]);

  if (!segments.length) return null;

  const isBoring = uniqBy(segments, (x) => x.value).length === 1;
  const first = segments[0];

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
    data: { values: segments },
    mark: { type: "rule", strokeWidth: 3 },
    title: `Coincident Demand Rate (${date.format("dddd LL")})`,
    encoding: {
      x: {
        field: "hourStart",
        type: "quantitative",
        title: "Hour of Day",
        axis: { labelAngle: 0, tickCount: 24 },
        scale: { domain: [0, 24] },
      },
      x2: { field: "hourEnd" },
      y: {
        field: "value",
        type: "quantitative",
        title: `Rate (${selectedPlan?.coincidentRateUnits ?? "kW"})`,
      },
      color: {
        field: "period",
        type: "nominal",
        legend: null,
        scale: { scheme: "viridis" },
      },
      tooltip: [
        { field: "hourStart", title: "From Hour" },
        { field: "hourEnd", title: "To Hour" },
        { field: "value", title: "Rate", format: ".3f" },
        { field: "baseRate", title: "Base Rate", format: ".3f" },
        { field: "adj", title: "Adjustment", format: ".3f" },
        { field: "period", title: "Period" },
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

  const colorScale = useMemo(
    () => buildPeriodColorScale(selectedPlan, "demand"),
    [selectedPlan]
  );

  const segments = useMemo(() => {
    if (!monthSchedule) return [];

    const result: HourSegment[] = [];
    let segmentStart = 0;
    let currentPeriod = monthSchedule[0];

    for (let hour = 1; hour <= 24; hour++) {
      const period = hour < 24 ? monthSchedule[hour] : null;

      if (period !== currentPeriod) {
        if (currentPeriod != null) {
          const tiers = selectedPlan.demandRate_tiers?.[currentPeriod] ?? [];
          for (let t = 0; t < tiers.length; t++) {
            const tier = tiers[t];
            if (!tier) continue;
            const value = sum([tier.rate, tier.adj].map((v) => v ?? 0));
            result.push({
              hourStart: segmentStart,
              hourEnd: hour,
              value,
              baseRate: tier.rate,
              adj: tier.adj,
              period: currentPeriod,
              tier: t,
            });
          }
        }
        segmentStart = hour;
        currentPeriod = period!;
      }
    }
    return result;
  }, [monthSchedule, selectedPlan.demandRate_tiers]);

  if (!segments.length) {
    return null;
  } else if (segments.every((x) => x.value === 0)) {
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
    data: { values: segments },
    mark: { type: "rule", strokeWidth: 3 },
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
      },
      tooltip: [
        { field: "hourStart", title: "From Hour" },
        { field: "hourEnd", title: "To Hour" },
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
    [selectedPlan]
  );

  const periods = schedule?.[date.month()];

  const segments = useMemo(() => {
    if (!periods) return [];

    const uniquePeriods = [...new Set(periods)];
    const result: TierSegment[] = [];

    for (const p of uniquePeriods) {
      const tiers = selectedPlan.demandRate_tiers?.[p] ?? [];
      let prevMax = 0;

      for (let t = 0; t < tiers.length; t++) {
        const tier = tiers[t];
        if (!tier) continue;

        const value = sum([tier.rate, tier.adj].map((v) => v ?? 0));
        const isLast = t === tiers.length - 1;

        let max: number;
        if (tier.max != null) {
          max = tier.max;
        } else if (isLast && prevMax > 0) {
          max = prevMax * 1.5;
        } else if (isLast) {
          max = 100;
        } else {
          continue;
        }

        result.push({
          min: prevMax,
          max,
          value,
          baseRate: tier.rate,
          adj: tier.adj,
          period: p,
          tier: t,
        });

        prevMax = max;
      }
    }
    return result;
  }, [periods, selectedPlan.demandRate_tiers]);

  if (!segments.length) return null;

  const isBoring =
    uniqBy(segments, (x) => [x.value, x.period].join("/")).length === 1;
  const first = segments[0];

  if (isBoring && first?.value === 0) {
    return null;
  }

  if (isBoring) {
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
    data: { values: segments },
    mark: { type: "rule", strokeWidth: 3 },
    title: `Demand Rate Tiers (${date.format("dddd LL")})`,
    encoding: {
      x: {
        field: "min",
        type: "quantitative",
        title: `Max (${selectedPlan?.demandRateUnits ?? "kW"})`,
        scale: { domainMax: Math.max(...segments.map((x) => x.max)) },
      },
      x2: { field: "max" },
      y: {
        field: "value",
        type: "quantitative",
        title: `$ per ${selectedPlan?.demandRateUnits ?? "kW"}`,
      },
      color: { field: "period", title: "Period", scale: colorScale },
      strokeDash: { field: "tier", type: "ordinal", title: "Tier" },
      tooltip: [
        { field: "min", title: "Demand From", format: ".1f" },
        { field: "max", title: "Demand To", format: ".1f" },
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
    [selectedPlan]
  );

  const currentMonth = date.month();
  const periodIndex = selectedPlan?.flatDemandMonths?.[currentMonth];
  const tiers = selectedPlan?.flatDemand_tiers?.[periodIndex!];

  const segments = useMemo(() => {
    if (!tiers?.length) return [];

    const result: TierSegment[] = [];
    let prevMax = 0;

    for (let t = 0; t < tiers.length; t++) {
      const tier = tiers[t];
      if (!tier) continue;

      const value = sum([tier.rate, tier.adj].map((v) => v ?? 0));
      const isLast = t === tiers.length - 1;

      let max: number;
      if (tier.max != null) {
        max = tier.max;
      } else if (isLast && prevMax > 0) {
        max = prevMax * 1.5;
      } else if (isLast) {
        max = 100;
      } else {
        continue;
      }

      result.push({
        min: prevMax,
        max,
        value,
        baseRate: tier.rate,
        adj: tier.adj,
        period: periodIndex!,
        tier: t,
      });

      prevMax = max;
    }
    return result;
  }, [tiers, periodIndex]);

  if (!segments.length) return null;

  const isBoring =
    uniqBy(segments, (x) => [x.value, x.period].join("/")).length === 1;
  const first = segments[0];

  const calendar = (
    <FlatDemandMonthsChart
      onDateChange={onDateChange}
      date={date}
      selectedPlan={selectedPlan}
    />
  );

  if (isBoring) {
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
    data: { values: segments },
    mark: { type: "rule", strokeWidth: 3 },
    title: `Flat Demand Tiers (${date.format("MMMM")})`,
    encoding: {
      x: {
        field: "min",
        type: "quantitative",
        title: `Max Demand (${selectedPlan?.flatDemandUnits ?? "kW"})`,
        scale: { domainMax: Math.max(...segments.map((x) => x.max)) },
      },
      x2: { field: "max" },
      y: {
        field: "value",
        type: "quantitative",
        title: `$ per ${selectedPlan?.flatDemandUnits ?? "kW"}`,
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
        { field: "min", title: "Demand From", format: ".1f" },
        { field: "max", title: "Demand To", format: ".1f" },
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
