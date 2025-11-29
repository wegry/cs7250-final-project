import { useQuery } from "@tanstack/react-query";
import { getWholesalePrices, type HUB_DICT } from "../data/queries";
import type { Dayjs } from "dayjs";

export function useWholesaleData(by: keyof typeof HUB_DICT, on: Dayjs) {
  return useQuery({
    queryFn: () => getWholesalePrices(by, on.format("YYYY-MM-DD")),
    queryKey: ["wholesale", by, on.format()],
  });
}
