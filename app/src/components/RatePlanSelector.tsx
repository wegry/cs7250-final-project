import { Select } from "antd";
import { useRatePlans } from "../hooks/useRatePlans";
import type { Dayjs } from "dayjs";

interface RatePlanSelectorProps {
  /**
   * Use only plans active on this date
   */
  byDate?: Dayjs;
  value?: string | null;
  onChange: (value: string) => void;
  label?: string;
}

export function RatePlanSelector({
  value,
  byDate,
  onChange,
}: RatePlanSelectorProps) {
  const { data: options, isLoading, error } = useRatePlans(byDate);

  if (error) {
    return <div>Error loading rate plans: {error.message}</div>;
  }

  return (
    <Select
      disabled={isLoading}
      loading={isLoading}
      onChange={onChange}
      optionFilterProp="label"
      options={options}
      placeholder="Choose a rate plan"
      showSearch
      value={value}
    ></Select>
  );
}
