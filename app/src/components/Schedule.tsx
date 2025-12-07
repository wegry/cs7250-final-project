import { useCallback, useRef, useEffect } from "react";
import { Card } from "antd";
import { VegaEmbed } from "react-vega";
import type { Result } from "vega-embed";
import type { TopLevelSpec } from "vega-lite";
import { RatePlan } from "../data/schema";
import { type Dayjs } from "dayjs";
import { getViridisColors } from "../charts/color";
import { MONTHS } from "../charts/constants";
import { getFirstDayOfType } from "../dates";

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
  period: string;
  dayType?: string;
};

function transformToHourly(
  schedule: number[][] | null,
  dayType?: string
): DataPoint[] {
  if (!schedule) return [];
  const data: DataPoint[] = [];
  for (let m = 0; m < schedule.length; m++) {
    for (let h = 0; h < (schedule[m]?.length || 0); h++) {
      data.push({
        month: MONTHS[m]!,
        monthIndex: m,
        hour: h,
        period: String(schedule[m]?.[h]),
        ...(dayType && { dayType }),
      });
    }
  }
  return data;
}

function transformCollapsed(
  schedule: number[][] | null,
  dayType?: string
): DataPoint[] {
  if (!schedule) return [];
  const data: DataPoint[] = [];
  for (let m = 0; m < schedule.length; m++) {
    if (schedule[m]?.length) {
      data.push({
        month: MONTHS[m]!,
        monthIndex: m,
        period: String(schedule[m]?.[0]),
        ...(dayType && { dayType }),
      });
    }
  }
  return data;
}

function filterColorScale(
  colorScale: { domain: string[]; range: string[] },
  data: DataPoint[]
): { domain: string[]; range: string[] } {
  const periodsInData = new Set(data.map((d) => d.period));
  return {
    domain: colorScale.domain.filter((p) => periodsInData.has(p)),
    range: colorScale.domain.flatMap((p, i) =>
      periodsInData.has(p) && colorScale.range[i] ? [colorScale.range[i]] : []
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

function createSingleScheduleSpec(
  title: string,
  schedule: number[][] | null,
  colorScale: { domain: string[]; range: string[] },
  interactive: boolean
): TopLevelSpec {
  const hourly = hasHourlyVariation(schedule);
  const data = hourly
    ? transformToHourly(schedule)
    : transformCollapsed(schedule);
  const filtered = filterColorScale(colorScale, data);

  return {
    $schema: "https://vega.github.io/schema/vega-lite/v6.json",
    title,
    width: hourly ? 400 : 15,
    height: 200,
    data: { values: data },
    params: interactive
      ? [
          {
            name: "cellClick",
            select: {
              type: "point",
              on: "click",
              fields: ["monthIndex", "dayType"],
            },
          },
        ]
      : [],
    mark: baseMarkConfig(interactive),
    encoding: {
      y: { field: "month", type: "ordinal", title: null, sort: MONTHS },
      color: {
        field: "period",
        type: "ordinal",
        title: "Period",
        scale: filtered,
      },
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

function createCombinedScheduleSpec(
  title: string,
  weekdaySchedule: number[][] | null,
  weekendSchedule: number[][] | null,
  colorScale: { domain: string[]; range: string[] },
  interactive: boolean
): TopLevelSpec {
  const weekdayHourly = hasHourlyVariation(weekdaySchedule);
  const weekendHourly = hasHourlyVariation(weekendSchedule);

  // Transform each schedule based on its own hourly variation
  const weekdayData = weekdayHourly
    ? transformToHourly(weekdaySchedule, "Weekday")
    : transformCollapsed(weekdaySchedule, "Weekday");
  const weekendData = weekendHourly
    ? transformToHourly(weekendSchedule, "Weekend")
    : transformCollapsed(weekendSchedule, "Weekend");

  const allData = [...weekdayData, ...weekendData];
  const filtered = filterColorScale(colorScale, allData);

  const params = interactive
    ? [
        {
          name: "cellClick",
          select: {
            type: "point",
            on: "click",
            fields: ["monthIndex", "dayType"],
          },
        },
      ]
    : [];

  const createUnitSpec = (
    data: DataPoint[],
    hourly: boolean,
    showYAxis: boolean,
    subTitle: string
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
      },
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
}

export function Heatmap({ spec, onCellClick }: HeatmapProps) {
  const resultRef = useRef<Result | null>(null);
  const callbackRef = useRef(onCellClick);

  useEffect(() => {
    callbackRef.current = onCellClick;
  }, [onCellClick]);

  const handleEmbed = useCallback((result: Result) => {
    resultRef.current = result;
    if (!callbackRef.current) return;

    result.view.addSignalListener("cellClick", (_name, value) => {
      const monthIndex = value?.monthIndex?.[0];
      const dayType = value?.dayType?.[0];
      if (monthIndex !== undefined && callbackRef.current) {
        const resolvedDayType = dayType === "Weekend" ? "weekend" : "weekday";
        callbackRef.current(monthIndex, resolvedDayType);
      }
    });
  }, []);

  return (
    <Card>
      <VegaEmbed
        spec={spec}
        options={{ actions: false }}
        onEmbed={handleEmbed}
      />
    </Card>
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
  type: "energy" | "demand";
  onDateChange?: (newDate: Dayjs) => void;
}) {
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
  const colorScale = { domain: sortedPeriods.map(String), range: colors };

  const handleCellClick = (
    monthIndex: number,
    dayType: "weekday" | "weekend"
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
        interactive
      )
    : createCombinedScheduleSpec(
        title,
        weekdaySchedule,
        weekendSchedule,
        colorScale,
        interactive
      );

  return (
    <Heatmap
      spec={spec}
      onCellClick={onDateChange ? handleCellClick : undefined}
    />
  );
}
