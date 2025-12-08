import { useQuery } from "@tanstack/react-query";
import { getActiveRatePlans } from "../data/queries";
import { GroupedRatePlanOptionArray } from "../data/schema";

export function useRatePlans() {
  return useQuery({
    queryKey: ["ratePlans", "active"],
    queryFn: async () => {
      const result = await getActiveRatePlans();
      const raw = result.toArray();

      const { data, error } = GroupedRatePlanOptionArray.safeParse(raw, {
        reportInput: true,
      });

      if (error) {
        console.error(error);
        throw error;
      }

      return data;
    },
  });
}
