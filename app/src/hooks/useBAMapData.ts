import { useQuery } from "@tanstack/react-query";
// import type { UtilityMapData } from '../charts/baMap'

// export function useUtilityMapData() {
//   return useQuery({
//     queryKey: ['utility-map-data'],
//     queryFn: async () => {
//       const response = await fetch('/geodata/utility-map-data.json')
//       if (!response.ok) throw new Error('Failed to load utility map data')
//       return (await response.json()) as UtilityMapData[]
//     },
//   })
// }

export function useBASummary() {
  return useQuery({
    queryKey: ["ba-summary"],
    queryFn: async () => {
      const response = await fetch("/ba-summary.json");
      if (!response.ok) throw new Error("Failed to load BA summary data");
      return (await response.json()) as Array<{
        name: string;
        utilities: string[];
        totalPlans: number;
        avgEnergyRate: number | null;
        numUtilities: number;
      }>;
    },
  });
}
