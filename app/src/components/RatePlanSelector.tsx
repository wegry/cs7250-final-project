import { useRatePlans } from '../hooks/useRatePlans'

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

  if (error) {
    return <div>Error loading rate plans: {error.message}</div>
  }

  return (
    <label>
      {label}
      <select
        value={value ?? ratePlans?.[0].label}
        onChange={(e) => onChange(e.target.value)}
        disabled={isLoading}
      >
        {isLoading ? (
          <option>Loading...</option>
        ) : (
          ratePlans?.map((plan) => (
            <option key={plan.label} value={plan.label}>
              {`${plan.utility}/${plan.name}/${plan.label}`}
            </option>
          ))
        )}
      </select>
    </label>
  )
}
