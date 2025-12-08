// RatePlanSelector.tsx
import { Select } from "antd";
import type { RatePlanOption } from "../data/schema";
import { useRatePlans } from "../hooks/useRatePlans";

interface RatePlanSelectorProps {
  value?: string | null;
  onChange: (value: string) => void;
}

export function RatePlanSelector({ value, onChange }: RatePlanSelectorProps) {
  const { data: options, isLoading, error } = useRatePlans();

  if (error) {
    return <div>Error loading rate plans: {error.message}</div>;
  }

  // Search both utility name (group label) and rate name (option label)
  const filterOption = (
    input: string | undefined,
    option?: RatePlanOption,
  ): boolean => {
    const search = input?.toLowerCase();
    return (
      (option?.label?.toLowerCase().includes(search!) ||
        option?.utilityName?.toLowerCase().includes(search!)) ??
      false
    );
  };

  return (
    <Select<string, RatePlanOption>
      disabled={isLoading}
      loading={isLoading}
      onChange={onChange}
      size="large"
      // Not sure why this type isn't matching. It may have something to do with the second type param on <Select>
      options={options as any}
      placeholder="Choose a rate plan"
      showSearch={{ filterOption }}
      value={value}
    />
  );
}
