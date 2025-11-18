import type { TopLevelSpec } from 'vega-lite'
import type { RatePlan } from '../data/schema'
import type { Dayjs } from 'dayjs'
import { VegaEmbed } from 'react-vega'

export function CoincidentRateChart({
  date,
  selectedPlan,
}: {
  selectedPlan?: RatePlan | null
  date: Dayjs
}) {
  const periods = selectedPlan?.coincidentSched?.[date.month()]
  const values = periods?.flatMap((p, i) =>
    selectedPlan?.coincidentRate_tiers?.[p].map((x) => ({
      ...x,
      tier: p,
      hour: i,
    }))
  )

  if (values == null) {
    return null
  }

  values.push({ ...values.at(-1)!, hour: 24 })

  return (
    <VegaEmbed
      spec={
        {
          $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
          width: 400,
          height: 200,
          data: { values },
          mark: {
            type: 'line',
            strokeWidth: 2,
            tooltip: true,
            interpolate: 'step-after',
          },
          title: 'Coincident Demand Rate',
          encoding: {
            x: {
              field: 'hour',
              type: 'quantitative',
              title: 'Hour of Day',
              axis: {
                labelAngle: 0,
                tickCount: 24,
              },
              scale: {
                domain: [0, 24],
              },
            },
            y: {
              field: 'rate',
              type: 'quantitative',
              title: `Rate (${selectedPlan?.coincidentRateUnits ?? 'kW'})`,
            },
            color: {
              // field: 'tier',
              type: 'nominal',
              legend: null,
              scale: {
                scheme: 'viridis',
              },
            },
          },
        } satisfies TopLevelSpec
      }
      options={{ mode: 'vega-lite', actions: false }}
    />
  )
}

export function DemandRateChart({
  date,
  selectedPlan,
}: {
  selectedPlan?: RatePlan | null
  date: Dayjs
}) {
  const isWeekend = date.day() === 0 || date.day() === 6
  const schedule = isWeekend
    ? selectedPlan?.demandWeekendSched
    : selectedPlan?.demandWeekdaySched

  const periods = schedule?.[date.month()]
  let selectedTiers = periods?.flatMap(
    (p, i) =>
      selectedPlan?.demandRate_tiers?.[p].flatMap((x, j) => {
        let next = {
          ...x,
          hour: i,
          tier: j,
        }

        if (next.hour == 23) {
          return [next, { ...next, hour: 24 }]
        }

        return next
      }) ?? []
  )

  if (selectedTiers == null) {
    return null
  }

  const endingHourByTier = new Map<number, number>()

  for (const point of selectedTiers) {
    const curr = endingHourByTier.get(point.tier)
    if (curr == null) {
      endingHourByTier.set(point.tier, point.hour)
    } else {
      endingHourByTier.set(point.tier, Math.max(point.hour, curr))
    }
  }

  for (const [k, v] of endingHourByTier) {
    if (v == 24) {
      continue
    }

    const item = selectedTiers.findLast((x) => x.tier === k)
    if (item == null) {
      throw new Error('wut')
    }

    selectedTiers.push({ ...item, hour: v + 1 })
  }

  return (
    <VegaEmbed
      spec={
        {
          $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
          width: 400,
          height: 200,
          data: { values: selectedTiers },
          mark: {
            type: 'line',
            interpolate: 'step-after',
          },
          title: 'Demand Rate Tiers',
          encoding: {
            y: {
              field: 'rate',
              type: 'quantitative',
              title: `Rate (${selectedPlan?.demandRateUnits ?? 'kW'})`,
            },
            x: {
              field: 'hour',
              type: 'quantitative',
              title: 'Hour of Day',
              scale: { domain: [0, 24] },
              axis: {
                tickCount: 24,
                labelAngle: 0,
              },
            },
            color: {
              field: 'tier',
              type: 'nominal',
              title: 'Tier',
              scale: {
                scheme: 'viridis',
              },
            },
          },
        } satisfies TopLevelSpec
      }
      options={{ mode: 'vega-lite', actions: false }}
    />
  )
}

export function FlatDemandChart({
  date,
  selectedPlan,
}: {
  selectedPlan?: RatePlan | null
  date: Dayjs
}) {
  const currentMonth = date.month()
  const tierIndex = selectedPlan?.flatDemandMonths?.[currentMonth]

  const selectedTiers = selectedPlan?.flatDemand_tiers?.[tierIndex!]

  if (selectedTiers == null) {
    return null
  }

  const windowed = selectedTiers.flatMap((t, i) => {
    let prev = selectedTiers[i - 1]
    let next = { ...t, tier: i }

    if (!prev) {
      prev = { ...next, max: 0 }
    }
    if (t.max == null) {
      next = {
        ...next,
        max: (prev.max ?? 0) * 1.5,
      }
    }

    return [{ ...prev, tier: i, rate: next.rate }, next]
  })

  return (
    <VegaEmbed
      spec={
        {
          $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
          width: 400,
          height: 200,
          data: { values: windowed },
          mark: {
            type: 'line',
            interpolate: 'step-after',
          },
          title: `Flat Demand Rate Tiers`,
          encoding: {
            y: {
              field: 'rate',
              type: 'quantitative',
              title: `Rate (${selectedPlan?.flatDemandUnits ?? 'kW'})`,
            },
            x: {
              field: 'max',
              type: 'quantitative',
              title: `Max Demand (${selectedPlan?.flatDemandUnits ?? 'kW'})`,
              scale: {
                domainMax: Math.max(...windowed.map((x) => x.max ?? 0)),
              },
            },
            color: {
              field: 'tier',
              type: 'nominal',
              title: 'Tier',
              scale: {
                scheme: 'viridis',
              },
            },
          },
        } satisfies TopLevelSpec
      }
      options={{ mode: 'vega-lite', actions: false }}
    />
  )
}
