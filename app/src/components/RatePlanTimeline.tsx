import { orderBy } from "es-toolkit";
import { useMemo } from "react";
import type { RatePlan } from "../data/schema";
import { Timeline } from "antd";
import { DetailSection } from "./DetailSection";
import { useBodyResizeObserver } from "../hooks/useBodyResizeObserver";

export function RatePlanTimeline({ ratePlan }: { ratePlan?: RatePlan | null }) {
  const { isMobile } = useBodyResizeObserver();
  const timelineEntries = useMemo(() => {
    const values = Object.entries({
      "Plan End": { date: ratePlan?.endDate, color: "red" },
      "Effective Date": { date: ratePlan?.effectiveDate, color: "green" },
    }).concat(
      ratePlan?.revisions?.map((x, i) => [
        `Revision ${i + 1}`,
        { color: "gray", ...x },
      ]) ?? [],
    );
    return orderBy(values, [([, v]) => v.date ?? 0], ["desc"]).flatMap(
      ([k, v]) => {
        if (v.date == null) {
          return [];
        }
        return {
          label: k,
          children: v.date.format("ll"),
          color: v.color,
        };
      },
    );
  }, [ratePlan]);

  return (
    <DetailSection
      breakBefore
      description={null}
      hide={timelineEntries.length === 0}
      title="Timeline"
    >
      <Timeline
        orientation={isMobile ? "vertical" : "horizontal"}
        mode="start"
        items={timelineEntries}
      />
    </DetailSection>
  );
}
