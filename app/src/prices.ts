import { Dayjs } from 'dayjs'
import { RatePlan, SynthData } from './data/schema'
import { mean, range, sum } from 'es-toolkit'

export function generationPriceInAMonth({
  ratePlan,
  synthData,
  monthStarting,
}: {
  ratePlan?: RatePlan | null
  synthData?: SynthData[] | null
  monthStarting: Dayjs
}): { kWh?: number; cost?: number } {
  if (!synthData) {
    return {}
  }
  const hourlyUsage = []

  for (const hour of range(0, 24)) {
    const kWh = mean([
      synthData[hour]['usage_kw'],
      synthData[(hour + 1) % 24]['usage_kw'],
    ])

    hourlyUsage.push(kWh)
  }

  if (!ratePlan) {
    return {
      kWh:
        sum(hourlyUsage) *
        monthStarting.add(1, 'month').diff(monthStarting, 'days'),
    }
  }

  const {
    energyWeekdaySched: energyweekdayschedule,
    energyWeekendSched: energyweekendschedule,
    // ratestructure,
    energyRate_tiers: ratestructure,
    fixedChargeFirstMeter: fixedchargefirstmeter,
    fixedChargeUnits: fixedchargeunits,
    minCharge: mincharge,
    minChargeUnits: minchargeunits,
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

        const period = periods[hour]
        const tiers = ratestructure?.[period]
        const matchingTier = Object.entries(tiers ?? {}).find(([, v]) => {
          if (v?.unit == 'kWh' && (v?.max ?? Infinity) >= totalUsage_kWh) {
            return true
          }
        })
        const energyrate = matchingTier?.[1]?.rate ?? 0

        const usageThisHour = hourlyUsage[hour]

        totalUsage_kWh += usageThisHour
        totalCost += usageThisHour * energyrate
      }
    }

    if (mincharge) {
      if (minchargeunits == '$/month') {
        totalCost = Math.max(mincharge, totalCost)
      } else if (minchargeunits == '$/day') {
        totalCost = Math.max(
          oneMonthLater.diff(monthStarting, 'day'),
          totalCost
        )
      }
    }

    curr = curr.add(1, 'day')
  }

  return { kWh: totalUsage_kWh, cost: totalCost }
}
