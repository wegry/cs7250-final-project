// import type { UtilityMapData } from '../charts/baMap'
import { useQuery } from "@tanstack/react-query";
import { BASummaryArraySchema, type BASummary } from "../data/schema";

export function useBASummary() {
  return useQuery<BASummary[]>({
    queryKey: ["ba-summary"],
    queryFn: async () => {
      const response = await fetch("/ba-summary.json");
      if (!response.ok) throw new Error("Failed to load BA summary data");
      const data = await response.json();
      return BASummaryArraySchema.parse(data);
    },
  });
}
