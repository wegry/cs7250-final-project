import { type Dayjs } from "dayjs";
import { useCallback, useEffect, useId, useRef } from "react";
import { VegaEmbed } from "react-vega";
import type { Result } from "vega-embed";
import type { TopLevelSpec } from "vega-lite";
import type { TopLevelParameter } from "vega-lite/types_unstable/spec/toplevel.js";
import { getViridisColors } from "../charts/color";
import { MONTHS } from "../charts/constants";
import { useLegendSelection } from "../charts/LegendSelectionContext";
import * as copy from "../copy";
import { RatePlan } from "../data/schema";
import { getFirstDayOfType } from "../dates";
import { CardWithTooltip } from "./CardWithTooltip";

const HOURS = Array.from({ length: 24 }, (_, i) => i);

function getUniquePeriods(schedule: number[][] | null): Set<number> {
  if (!schedule) return new Set();
  return new Set(schedule.flat());
}

function hasHourlyVariation(schedule: number[][] | null): boolean {
  if (!schedule) return false;
  return schedule.some((monthData) => {
    if (!monthData || monthData.length === 0) return false;
    const firstValue = monthData[0];
    return monthData.some((v) => v !== firstValue);
  });
}

type DataPoint = {
  month: string;
  monthIndex: number;
  hour?: number;
  period: number;
  dayType?: string;
};

function transformToHourly(
  schedule: number[][] | null,
  dayType?: string,
): DataPoint[] {
  if (!schedule) return [];
  const data: DataPoint[] = [];
  for (let m = 0; m < schedule.length; m++) {
    for (let h = 0; h < (schedule[m]?.length || 0); h++) {
      const period = schedule[m]?.[h] ?? 0;
      data.push({
        month: MONTHS[m]!,
        monthIndex: m,
        hour: h,
        period,
        ...(dayType && { dayType }),
      });
    }
  }
  return data;
}

function transformCollapsed(
  schedule: number[][] | null,
  dayType?: string,
): DataPoint[] {
  if (!schedule) return [];
  const data: DataPoint[] = [];
  for (let m = 0; m < schedule.length; m++) {
    if (schedule[m]?.length) {
      const period = schedule[m]?.[0] ?? 0;
      data.push({
        month: MONTHS[m]!,
        monthIndex: m,
        period,
        ...(dayType && { dayType }),
      });
    }
  }
  return data;
}

function filterColorScale(
  colorScale: { domain: number[]; range: string[] },
  data: DataPoint[],
): { domain: number[]; range: string[] } {
  const periodsInData = new Set(data.map((d) => d.period));
  return {
    domain: colorScale.domain.filter((p) => periodsInData.has(p)),
    range: colorScale.domain.flatMap((p, i) =>
      periodsInData.has(p) && colorScale.range[i] ? [colorScale.range[i]] : [],
    ),
  };
}

const baseMarkConfig = (interactive: boolean) => ({
  type: "rect" as const,
  width: 18,
  height: 18,
  strokeWidth: 0,
  stroke: "transparent",
  cursor: interactive ? ("pointer" as const) : ("default" as const),
});

function buildScheduleParams(
  interactive: boolean,
  hasMultiplePeriods: boolean,
) {
  const params: TopLevelParameter[] = [];

  if (interactive) {
    params.push({
      name: "cellClick",
      select: { type: "point", on: "click", fields: ["monthIndex", "dayType"] },
    });
  }

  // Add period selection for syncing with other charts (uses numeric period field)
  if (hasMultiplePeriods) {
    params.push({
      name: "periodSel",
      select: { type: "point", fields: ["period"] },
      bind: "legend",
    });
  }

  return params;
}

function buildOpacityEncoding(hasMultiplePeriods: boolean) {
  if (!hasMultiplePeriods) {
    return { value: 1 };
  }
  return {
    condition: { param: "periodSel", empty: true, value: 1 },
    value: 0.2,
  };
}

function createSingleScheduleSpec(
  title: string,
  schedule: number[][] | null,
  colorScale: { domain: number[]; range: string[] },
  interactive: boolean,
): TopLevelSpec {
  const hourly = hasHourlyVariation(schedule);
  const data = hourly
    ? transformToHourly(schedule)
    : transformCollapsed(schedule);
  const filtered = filterColorScale(colorScale, data);
  const hasMultiplePeriods = filtered.domain.length > 1;

  return {
    $schema: "https://vega.github.io/schema/vega-lite/v6.json",
    title,
    width: hourly ? 400 : 15,
    height: 200,
    data: { values: data },
    params: buildScheduleParams(interactive, hasMultiplePeriods),
    mark: baseMarkConfig(interactive),
    encoding: {
      y: { field: "month", type: "ordinal", title: null, sort: MONTHS },
      color: {
        field: "period",
        type: "ordinal",
        title: "Period",
        scale: filtered,
        legend: hasMultiplePeriods ? {} : null,
      },
      opacity: buildOpacityEncoding(hasMultiplePeriods),
      tooltip: hourly
        ? [
            { field: "month", title: "Month" },
            { field: "hour", title: "Hour" },
            { field: "period", title: "Period" },
          ]
        : [
            { field: "month", title: "Month" },
            { field: "period", title: "Period" },
          ],
      ...(hourly && {
        x: {
          field: "hour",
          type: "ordinal",
          title: "Hour of Day",
          axis: { labelAngle: 0, labelAlign: "right", bandPosition: 0 },
          sort: HOURS,
        },
      }),
    },
    config: { axis: { grid: false }, view: { stroke: null } },
  };
}

export interface RateAspect<T extends string | null = null> {
  type: "energy" | "demand" | Exclude<T, null>;
}

function createCombinedScheduleSpec(
  title: string,
  weekdaySchedule: number[][] | null,
  weekendSchedule: number[][] | null,
  colorScale: { domain: number[]; range: string[] },
  interactive: boolean,
): TopLevelSpec {
  const weekdayHourly = hasHourlyVariation(weekdaySchedule);
  const weekendHourly = hasHourlyVariation(weekendSchedule);

  const weekdayData = weekdayHourly
    ? transformToHourly(weekdaySchedule, "Weekday")
    : transformCollapsed(weekdaySchedule, "Weekday");
  const weekendData = weekendHourly
    ? transformToHourly(weekendSchedule, "Weekend")
    : transformCollapsed(weekendSchedule, "Weekend");

  const allData = [...weekdayData, ...weekendData];
  const filtered = filterColorScale(colorScale, allData);
  const hasMultiplePeriods = filtered.domain.length > 1;

  const params = buildScheduleParams(interactive, hasMultiplePeriods);

  const createUnitSpec = (
    data: DataPoint[],
    hourly: boolean,
    showYAxis: boolean,
    subTitle: string,
  ) => ({
    title: subTitle,
    width: hourly ? 400 : 15,
    height: 200,
    data: { values: data },
    mark: baseMarkConfig(interactive),
    encoding: {
      y: {
        field: "month",
        type: "ordinal" as const,
        title: null,
        sort: MONTHS,
        axis: showYAxis ? {} : null,
      },
      color: {
        field: "period",
        type: "ordinal" as const,
        title: "Period",
        scale: filtered,
        legend: hasMultiplePeriods ? {} : null,
      },
      opacity: buildOpacityEncoding(hasMultiplePeriods),
      tooltip: hourly
        ? [
            { field: "month", title: "Month" },
            { field: "hour", title: "Hour" },
            { field: "period", title: "Period" },
          ]
        : [
            { field: "month", title: "Month" },
            { field: "period", title: "Period" },
          ],
      ...(hourly && {
        x: {
          field: "hour",
          type: "ordinal" as const,
          title: "Hour of Day",
          axis: {
            labelAngle: 0,
            labelAlign: "right" as const,
            bandPosition: 0,
          },
          sort: HOURS,
        },
      }),
    },
  });

  return {
    $schema: "https://vega.github.io/schema/vega-lite/v6.json",
    title,
    params,
    hconcat: [
      createUnitSpec(weekdayData, weekdayHourly, true, "Weekday"),
      createUnitSpec(weekendData, weekendHourly, false, "Weekend"),
    ],
    config: { axis: { grid: false }, view: { stroke: null } },
  } as TopLevelSpec;
}

interface HeatmapProps {
  spec: TopLevelSpec;
  onCellClick?: (monthIndex: number, dayType: "weekday" | "weekend") => void;
  hasMultiplePeriods?: boolean;
}

export function Heatmap({
  type,
  spec,
  onCellClick,
  hasMultiplePeriods = true,
}: HeatmapProps & RateAspect<"flat demand">) {
  const resultRef = useRef<Result | null>(null);
  const callbackRef = useRef(onCellClick);
  const ctx = useLegendSelection();
  const id = useId();

  useEffect(() => {
    callbackRef.current = onCellClick;
  }, [onCellClick]);

  const handleEmbed = useCallback(
    (result: Result) => {
      resultRef.current = result;

      // Handle cell click for date navigation
      if (callbackRef.current) {
        result.view.addSignalListener("cellClick", (_name, value) => {
          const monthIndex = value?.monthIndex?.[0];
          const dayType = value?.dayType?.[0];
          if (monthIndex !== undefined && callbackRef.current) {
            const resolvedDayType =
              dayType === "Weekend" ? "weekend" : "weekday";
            callbackRef.current(monthIndex, resolvedDayType);
          }
        });
      }

      // Register with legend selection context for cross-chart sync
      if (ctx && hasMultiplePeriods) {
        ctx.registerView(id, result.view, {
          hasPeriodLegend: true,
          hasTierLegend: false,
        });

        // Listen to selection store for selection changes
        try {
          result.view.addDataListener("periodSel_store", (_name, value) => {
            if (!value || !Array.isArray(value) || value.length === 0) {
              ctx.updateSelection(id, { periods: null });
              return;
            }
            const periods = value.map(
              (t: { values: number[] }) => t.values[0]!,
            );
            ctx.updateSelection(id, {
              periods: periods.length ? periods : null,
            });
          });
        } catch (e) {
          console.warn("[Schedule] Could not add periodSel_store listener", e);
        }
      }
    },
    [ctx, id, hasMultiplePeriods],
  );

  useEffect(() => {
    return () => {
      ctx?.unregisterView(id);
    };
  }, [ctx, id]);

  return (
    <CardWithTooltip tooltip={copy.complexEnergyScheduleTooltip(type)}>
      <VegaEmbed
        spec={spec}
        options={{ actions: false }}
        onEmbed={handleEmbed}
      />
    </CardWithTooltip>
  );
}

export function ScheduleHeatmap({
  selectedPlan,
  date,
  type,
  onDateChange,
}: {
  selectedPlan?: RatePlan | null;
  date: Dayjs;
  onDateChange?: (newDate: Dayjs) => void;
} & RateAspect) {
  if (!selectedPlan) return null;

  const weekdaySchedule = selectedPlan[`${type}WeekdaySched`];
  const weekendSchedule = selectedPlan[`${type}WeekendSched`];
  const title = type === "energy" ? "Energy Schedule" : "Demand Schedule";

  if (!weekdaySchedule && !weekendSchedule) return null;

  const allPeriods = new Set<number>();
  [weekdaySchedule, weekendSchedule].forEach((s) => {
    getUniquePeriods(s).forEach((p) => allPeriods.add(p));
  });
  const sortedPeriods = [...allPeriods].sort((a, b) => a - b);

  if (sortedPeriods.length <= 1) return null;

  const colors = getViridisColors(sortedPeriods.length);
  const colorScale = { domain: sortedPeriods, range: colors };

  const handleCellClick = (
    monthIndex: number,
    dayType: "weekday" | "weekend",
  ) => {
    if (!onDateChange) return;
    const newDate = getFirstDayOfType(date.year(), monthIndex, dayType);
    onDateChange(newDate);
  };

  const interactive = !!onDateChange;
  const schedulesMatch =
    weekdaySchedule &&
    JSON.stringify(weekdaySchedule) === JSON.stringify(weekendSchedule);

  const spec = schedulesMatch
    ? createSingleScheduleSpec(
        "All Week " + title,
        weekdaySchedule,
        colorScale,
        interactive,
      )
    : createCombinedScheduleSpec(
        title,
        weekdaySchedule,
        weekendSchedule,
        colorScale,
        interactive,
      );

  return (
    <Heatmap
      spec={spec}
      type={type}
      onCellClick={onDateChange ? handleCellClick : undefined}
      hasMultiplePeriods={sortedPeriods.length > 1}
    />
  );
}
