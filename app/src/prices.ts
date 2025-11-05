import { Dayjs } from 'dayjs'
import { RatePlan, SynthData } from './data/schema'
import { mean } from 'es-toolkit'

export function generationPriceInAMonth({
  ratePlan,
  synthData,
  monthStarting,
}: {
  ratePlan?: RatePlan
  synthData?: SynthData[]
  monthStarting: Dayjs
}) {
  if (!ratePlan || !synthData) {
    return {}
  }
  const {
    energyweekdayschedule,
    energyweekendschedule,
    ratestructure,
    fixedchargefirstmeter,
    fixedchargeunits,
  } = ratePlan
  const oneMonthLater = monthStarting.add(1, 'month')

  let totalUsage_kWh = 0
  let totalCost = 0

  if (fixedchargeunits == '$/month') {
    totalCost += fixedchargefirstmeter ?? 0
  }
  let curr = monthStarting

  while (curr.isBefore(oneMonthLater) || curr.isSame(oneMonthLater)) {
    const isWeekend = [0, 6].includes(curr.day())
    const energySchedule = isWeekend
      ? energyweekendschedule
      : energyweekdayschedule

    if (energySchedule) {
      const periods = energySchedule[curr.month()]
      for (let hour = 0; hour < 24; hour++) {
        if (fixedchargeunits == '$/day') {
          totalCost += fixedchargefirstmeter ?? 0
        }

        const hourlyAverage_kW = mean([
          synthData[hour]['usage_kw'],
          synthData[(hour + 1) % 24]['usage_kw'],
        ])
        const period = periods[hour]
        const tiers = ratestructure?.energyrate?.[`period${period}`]
        const matchingTier = Object.entries(tiers ?? {}).find(([, v]) => {
          if (v?.unit == 'kWh' && (v?.max ?? 0) >= totalUsage_kWh) {
            return true
          }
        })
        const energyrate = matchingTier?.[1]?.rate ?? 0

        totalUsage_kWh += hourlyAverage_kW
        totalCost += hourlyAverage_kW * energyrate
      }
    }

    curr = curr.add(1, 'day')
  }

  return { kWh: totalUsage_kWh, cost: totalCost }
}
