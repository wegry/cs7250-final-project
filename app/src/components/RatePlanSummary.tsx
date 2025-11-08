import { Statistic } from 'antd'
import type { generationPriceInAMonth } from '../prices'
import { RatePlan } from '../data/schema'

export function RatePlanSummary({
  usage,
  energyUsage,
  ratePlan,
}: {
  usage: ReturnType<typeof generationPriceInAMonth>
  energyUsage?: string | null
  ratePlan: RatePlan
}) {
  return (
    <div>
      <h3>
        {ratePlan.utility}/{ratePlan.name}
      </h3>
      <Statistic
        title="Monthly cost on plan"
        value={usage.cost?.toLocaleString([], {
          currency: 'USD',
          style: 'currency',
        })}
      />
      {energyUsage == null || !isNaN(Number(energyUsage)) ? null : (
        <Statistic
          title="Monthly energy use"
          value={`${usage.kWh?.toLocaleString([], {
            style: 'decimal',
          })} kWh`}
        />
      )}
    </div>
  )
}
