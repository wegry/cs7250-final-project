import type { LogicalComposition } from "vega-lite/types_unstable/logical.js";

interface LegendDataPoint {
  period?: number;
  tier?: number;
}

type SelectionParam = {
  name: string;
  select: { type: "point"; fields: string[] };
  bind: "legend";
};

type OpacityEncoding =
  | { value: number }
  | {
      condition:
        | { test: LogicalComposition<any>; value: number }
        | { param: string; empty: boolean; value: number };
      value: number;
    };

export interface InteractiveLegendResult {
  params: SelectionParam[];
  opacityEncoding: OpacityEncoding;
  colorLegend: null | undefined;
  strokeDashLegend: null | undefined;
  showPeriodLegend: boolean;
  showTierLegend: boolean;
}

/**
 * Builds interactive legend configuration for Vega-Lite specs.
 * - Clicking a legend item dims other items (opacity -> 0.2)
 * - Hides legends when there's only 1 unique value
 * - Supports both period (color) and tier (strokeDash) legends
 * - Works with useSyncedLegend for cross-chart selection sync
 */
export function buildInteractiveLegend<T extends LegendDataPoint>(
  data: T[],
  options: { periodField?: string; tierField?: string } = {},
): InteractiveLegendResult {
  const { periodField = "period", tierField = "tier" } = options;

  const uniquePeriods = [
    ...new Set(data.map((d) => d.period).filter((p) => p !== undefined)),
  ];
  const uniqueTiers = [
    ...new Set(data.map((d) => d.tier).filter((t) => t !== undefined)),
  ];

  const showPeriodLegend = uniquePeriods.length > 1;
  const showTierLegend = uniqueTiers.length > 1;

  const params: SelectionParam[] = [];

  if (showPeriodLegend) {
    params.push({
      name: "periodSel",
      select: { type: "point", fields: [periodField] },
      bind: "legend",
    });
  }

  if (showTierLegend) {
    params.push({
      name: "tierSel",
      select: { type: "point", fields: [tierField] },
      bind: "legend",
    });
  }

  // Build opacity encoding based on which legends are active
  let opacityEncoding: OpacityEncoding = { value: 1 };

  if (showPeriodLegend && showTierLegend) {
    // Both legends: item is highlighted if it matches ALL active selections
    opacityEncoding = {
      condition: {
        test: {
          and: [
            {
              or: [{ param: "periodSel", empty: true }, { param: "periodSel" }],
            },
            { or: [{ param: "tierSel", empty: true }, { param: "tierSel" }] },
          ],
        },
        value: 1,
      },
      value: 0.2,
    };
  } else if (showPeriodLegend) {
    opacityEncoding = {
      condition: { param: "periodSel", empty: true, value: 1 },
      value: 0.2,
    };
  } else if (showTierLegend) {
    opacityEncoding = {
      condition: { param: "tierSel", empty: true, value: 1 },
      value: 0.2,
    };
  }

  return {
    params,
    opacityEncoding,
    colorLegend: showPeriodLegend ? undefined : null,
    strokeDashLegend: showTierLegend ? undefined : null,
    showPeriodLegend,
    showTierLegend,
  };
}
