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
}): { kWh?: number; cost?: number ; flatDemandCost?: number ; 
  energyRateCost?: number ; fixedChargeCost?: number ; demandCost?: number } {
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

    flatDemandUnits: flatdemandunits,//unionOfLiterals(['kVA', 'kW', 'kVA daily', 'hp']).nullish(),
    flatDemandMonths: flatdemandmonths,//z.preprocess(
    flatDemand_tiers: flatdemand_tiers,//tierShape(

    demandWeekendSched: demandweekendschedule,
    demandWeekdaySched: demandweekdayschedule,
    demandUnits: demandunits,
    demandRate_tiers: demand_tiers

  } = ratePlan
  const oneMonthLater = monthStarting.add(1, 'month')

  let totalUsage_kWh = 0
  let totalCost = 0
  let fixedChargeCost = 0
  let flatDemandCost=0
  let energyRateCost = 0
  let demandCost = 0

  if (fixedchargeunits == '$/month') {
    totalCost += fixedchargefirstmeter ?? 0
    fixedChargeCost += fixedchargefirstmeter ?? 0
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
          fixedChargeCost += fixedchargefirstmeter ?? 0
        }
        // Energy Rate Calculation
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
        energyRateCost += usageThisHour * energyrate

        // Flat Demand Calculation
        if (flatdemandmonths) {
          const period_flat_demand = flatdemandmonths[curr.month()]
          const tiers_flat_demand = flatdemand_tiers?.[period_flat_demand]

          const usageThisHour_flat = hourlyUsage[hour]

          const threshold = flatdemandunits === 'kVA'
            ? usageThisHour_flat / 0.8
            : usageThisHour_flat

          const matchingTierFlat = Object.entries(tiers_flat_demand ?? {}).find(
            ([, v]) =>
              v?.unit &&
              (v?.max ?? Infinity) >= threshold
          )

          const flatrate = matchingTierFlat?.[1]?.rate ?? 0

          totalCost += usageThisHour_flat * flatrate
          flatDemandCost += usageThisHour_flat * flatrate
        }


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

  return { kWh: totalUsage_kWh, cost: totalCost, flatDemandCost: flatDemandCost, 
    energyRateCost: energyRateCost, fixedChargeCost: fixedChargeCost, demandCost: demandCost  }
}
