import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import type { View } from "vega";
import type { Result } from "vega-embed";

interface LegendSelection {
  periods: number[] | null;
  tiers: number[] | null;
}

interface ViewEntry {
  view: View;
  hasPeriodLegend: boolean;
  hasTierLegend: boolean;
}

interface LegendSelectionContextValue {
  updateSelection: (sourceId: string, sel: Partial<LegendSelection>) => void;
  registerView: (
    id: string,
    view: View,
    opts: { hasPeriodLegend: boolean; hasTierLegend: boolean }
  ) => void;
  unregisterView: (id: string) => void;
}

const LegendSelectionContext =
  createContext<LegendSelectionContextValue | null>(null);

/**
 * Build the Vega-Lite selection tuple format for point selections.
 */
function buildSelectionTuple(field: string, values: number[]): unknown[] {
  if (!values.length) return [];
  return values.map((value) => ({
    unit: "",
    fields: [{ type: "E", field }],
    values: [value],
  }));
}

/**
 * Extract values from a Vega-Lite selection store.
 */
function extractSelectionValues(storeData: unknown[]): number[] | null {
  if (!storeData || !Array.isArray(storeData) || storeData.length === 0) {
    return null;
  }

  const values: number[] = [];
  for (const tuple of storeData) {
    const t = tuple as { values?: number[] };
    if (t?.values?.[0] !== undefined) {
      values.push(t.values[0]);
    }
  }
  return values.length > 0 ? values : null;
}

/**
 * Compare two selection arrays for equality.
 */
function selectionsEqual(a: number[] | null, b: number[] | null): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort((x, y) => x - y);
  const sortedB = [...b].sort((x, y) => x - y);
  return sortedA.every((v, i) => v === sortedB[i]);
}

export function LegendSelectionProvider({ children }: { children: ReactNode }) {
  const viewsRef = useRef<Map<string, ViewEntry>>(new Map());
  // Store current selection state in a ref to avoid closure issues
  const selectionRef = useRef<LegendSelection>({ periods: null, tiers: null });

  const updateSelection = useCallback(
    (sourceId: string, sel: Partial<LegendSelection>) => {
      const current = selectionRef.current;

      // Check what actually changed
      const periodsChanged =
        sel.periods !== undefined &&
        !selectionsEqual(current.periods, sel.periods);
      const tiersChanged =
        sel.tiers !== undefined && !selectionsEqual(current.tiers, sel.tiers);

      // If nothing changed, do nothing (prevents echo loops)
      if (!periodsChanged && !tiersChanged) {
        return;
      }

      // Update our stored selection
      if (periodsChanged) {
        selectionRef.current = {
          ...selectionRef.current,
          periods: sel.periods ?? null,
        };
      }
      if (tiersChanged) {
        selectionRef.current = {
          ...selectionRef.current,
          tiers: sel.tiers ?? null,
        };
      }

      // Sync to all registered views EXCEPT the source
      viewsRef.current.forEach((entry, id) => {
        if (id === sourceId) return;

        try {
          if (periodsChanged && entry.hasPeriodLegend) {
            const tupleValue = sel.periods?.length
              ? buildSelectionTuple("period", sel.periods)
              : [];
            entry.view.data("periodSel_store", tupleValue);
            entry.view.runAsync();
          }
          if (tiersChanged && entry.hasTierLegend) {
            const tupleValue = sel.tiers?.length
              ? buildSelectionTuple("tier", sel.tiers)
              : [];
            entry.view.data("tierSel_store", tupleValue);
            entry.view.runAsync();
          }
        } catch (e) {
          console.warn("[LegendSync] Failed to sync to view", id, e);
        }
      });
    },
    []
  );

  const registerView = useCallback(
    (
      id: string,
      view: View,
      opts: { hasPeriodLegend: boolean; hasTierLegend: boolean }
    ) => {
      viewsRef.current.set(id, { view, ...opts });
    },
    []
  );

  const unregisterView = useCallback((id: string) => {
    viewsRef.current.delete(id);
  }, []);

  const value = useMemo(
    () => ({ updateSelection, registerView, unregisterView }),
    [updateSelection, registerView, unregisterView]
  );

  return (
    <LegendSelectionContext.Provider value={value}>
      {children}
    </LegendSelectionContext.Provider>
  );
}

export function useLegendSelection() {
  return useContext(LegendSelectionContext);
}

/**
 * Hook to sync a Vega-Lite chart's legend selection with other charts.
 */
export function useSyncedLegend(opts: {
  hasPeriodLegend: boolean;
  hasTierLegend: boolean;
}) {
  const ctx = useLegendSelection();
  const id = useId();
  const resultRef = useRef<Result | null>(null);
  const optsRef = useRef(opts);
  optsRef.current = opts;

  const handleEmbed = useCallback(
    (result: Result) => {
      resultRef.current = result;
      if (!ctx) return;

      const { hasPeriodLegend, hasTierLegend } = optsRef.current;
      ctx.registerView(id, result.view, { hasPeriodLegend, hasTierLegend });

      if (hasPeriodLegend) {
        try {
          result.view.addDataListener("periodSel_store", (_name, value) => {
            const periods = extractSelectionValues(value);
            ctx.updateSelection(id, { periods });
          });
        } catch (e) {
          console.warn(
            "[LegendSync] Could not add periodSel_store listener",
            e
          );
        }
      }

      if (hasTierLegend) {
        try {
          result.view.addDataListener("tierSel_store", (_name, value) => {
            const tiers = extractSelectionValues(value);
            ctx.updateSelection(id, { tiers });
          });
        } catch (e) {
          console.warn("[LegendSync] Could not add tierSel_store listener", e);
        }
      }
    },
    [ctx, id]
  );

  useEffect(() => {
    return () => {
      ctx?.unregisterView(id);
    };
  }, [ctx, id]);

  return { handleEmbed, id };
}
