import { useQuery } from "@tanstack/react-query";
import { RatePlan } from "../data/schema";
import * as queries from "../data/queries";

async function getRatePlan(label?: string | null) {
  if (!label) {
    return null;
  }
  const raw = (await queries.ratePlanDetail(label)).toArray();

  const { data, error } = RatePlan.safeParse(raw[0], { reportInput: true });
  if (error) {
    console.error(error);
    throw error;
  }

  return data ?? null;
}

export function useRatePlan(label?: string | null) {
  return useQuery({
    queryFn: () => getRatePlan(label),
    queryKey: ["ratePlan", label],
  });
}
