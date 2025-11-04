import { Select } from 'antd'
import { useRatePlans } from '../hooks/useRatePlans'
import { useMemo } from 'react'

interface RatePlanSelectorProps {
  value?: string
  onChange: (value: string) => void
  label?: string
}

export function RatePlanSelector({
  value,
  onChange,
  label = 'Rate Plan Chooser',
}: RatePlanSelectorProps) {
  const { data: ratePlans, isLoading, error } = useRatePlans()

  const options = useMemo(() => {
    return ratePlans?.map((plan) => ({
      value: plan.label,
      label: `${plan.utility}/${plan.name}/${plan.label}`,
    }))
  }, [ratePlans])

  if (error) {
    return <div>Error loading rate plans: {error.message}</div>
  }

  return (
    <label>
      {label}
      <Select
        value={value ?? ratePlans?.[0].label}
        onChange={onChange}
        disabled={isLoading}
        loading={isLoading}
        options={options}
        showSearch
        optionFilterProp="label"
      ></Select>
    </label>
  )
}
