import { Statistic } from 'antd'
import type { generationPriceInAMonth } from '../prices'
import { RatePlan } from '../data/schema'
import { RatePlanTimeline } from './RatePlanTimeline'

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
        {ratePlan.utilityName}/{ratePlan.rateName}
      </h3>

      <Statistic
        title="Monthly cost on plan (total)"
        value={usage.cost?.toLocaleString([], {
          currency: 'USD',
          style: 'currency',
        })}
      />

      <h4>Breakdown</h4>

      <Statistic
        title="Energy"
        value={usage.energyRateCost?.toLocaleString([], {
          currency: 'USD',
          style: 'currency',
        })}
      />

      <Statistic
        title="Fixed charges"
        value={usage.fixedChargeCost?.toLocaleString([], {
          currency: 'USD',
          style: 'currency',
        })}
      />

      <Statistic
        title="Flat demand"
        value={usage.flatDemandCost?.toLocaleString([], {
          currency: 'USD',
          style: 'currency',
        })}
      />

      <Statistic
        title="Demand"
        value={usage.demandCost?.toLocaleString([], {
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

      <RatePlanTimeline ratePlan={ratePlan} />
    </div>


  )
}
