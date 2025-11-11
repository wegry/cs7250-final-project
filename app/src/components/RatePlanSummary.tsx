import { Statistic, Timeline } from 'antd'
import type { generationPriceInAMonth } from '../prices'
import { RatePlan } from '../data/schema'
import { sortBy } from 'es-toolkit'
import { useMemo } from 'react'

export function RatePlanSummary({
  usage,
  energyUsage,
  ratePlan,
}: {
  usage: ReturnType<typeof generationPriceInAMonth>
  energyUsage?: string | null
  ratePlan: RatePlan
}) {
  const timelineEntries = useMemo(() => {
    const values = Object.entries({
      'Plan End': { date: ratePlan?.enddate, color: 'red' },
      'Plan Start': { date: ratePlan?.effectiveDate, color: 'green' },
      'Last Update': { date: ratePlan?.latest_update, color: 'gray' },
    })
    return sortBy(values, [([k, v]) => v.date]).flatMap(([k, v]) => {
      if (v.date == null) {
        return []
      }
      return {
        label: k,
        children: v.date.format(),
        color: v.color,
      }
    })
  }, [ratePlan])

  return (
    <div>
      <h3>
        {ratePlan.utilityName}/{ratePlan.rateName}
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
      {timelineEntries.length > 0 && (
        <>
          <h4>Timeline</h4>
          <Timeline mode="left" items={timelineEntries} />
        </>
      )}
    </div>
  )
}
