import type { TopLevelSpec } from 'vega-lite'
import type { RatePlan } from '../data/schema'
import type { Dayjs } from 'dayjs'
import { VegaEmbed } from 'react-vega'
import { windowed } from 'es-toolkit'
import { Card } from 'antd'

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

  const chart = (
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

  return <Card>{chart}</Card>
}

interface DayAndPlan {
  selectedPlan?: RatePlan | null
  date: Dayjs
}

export function DemandRateChart({ date, selectedPlan }: DayAndPlan) {
  if (!selectedPlan) {
    return null
  }
  const isWeekend = date.day() === 0 || date.day() === 6
  const schedule = isWeekend
    ? selectedPlan.demandWeekendSched
    : selectedPlan.demandWeekdaySched

  const periods = schedule?.[date.month()]
  let selectedTiers = periods?.flatMap((p, hour) => {
    const { demandRate_tiers } = selectedPlan

    return (
      demandRate_tiers?.[p].flatMap((x, tier) => {
        if (x.rate == 0) {
          return []
        }
        let next = {
          ...x,
          hour,
          period: p,
          tier,
        }

        if (hour == 23) {
          return [next, { ...next, hour: 24 }]
        }

        // if the tier isn't in the next hour, set it to zero
        else if (
          !demandRate_tiers[periods[hour + 1]]?.[tier]?.rate &&
          !demandRate_tiers[periods[hour + 2]]?.[tier]?.rate
        ) {
          return [
            next,
            { ...next, hour: hour + 1 },
            { ...next, rate: NaN, hour: hour + 2 },
          ]
        }

        return next
      }) ?? []
    )
  })

  if (selectedTiers == null) {
    return null
  }

  const values = windowed(selectedTiers, 2).flatMap(([x, y], i) => {
    if (x.rate != y.rate) {
      if (selectedTiers[i - 1]?.rate != x.rate) {
        return [x, { ...x, hour: y.hour }, y]
      }
      if (selectedTiers[i + 1])
        return [
          x,
          { ...x, hour: y.hour },
          { ...x, hour: y.hour + 1, rate: null },
          y,
        ]
    }

    return [x, y]
  })

  const chart = (
    <VegaEmbed
      spec={
        {
          $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
          width: 400,
          height: 200,
          data: { values },
          mark: {
            type: 'line',
            interpolate: 'step-after',
            tooltip: true,
          },
          title: 'Demand Rate',
          encoding: {
            y: {
              field: 'rate',
              type: 'quantitative',
              title: `$ per ${selectedPlan?.demandRateUnits ?? 'kW'}`,
              stack: null,
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
              field: 'period',
              title: 'Period',
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

  return <Card>{chart}</Card>
}

export function DemandTierRateChart({ date, selectedPlan }: DayAndPlan) {
  if (!selectedPlan) {
    return null
  }
  const isWeekend = date.day() === 0 || date.day() === 6
  const schedule = isWeekend
    ? selectedPlan.demandWeekendSched
    : selectedPlan.demandWeekdaySched

  const periods = schedule?.[date.month()]
  let selectedTiers = periods?.flatMap((p) => {
    const { demandRate_tiers } = selectedPlan

    return (
      demandRate_tiers?.[p].flatMap((x, tier) => {
        if (x.rate === 0) {
          return []
        }
        let next = {
          ...x,
          tier,
          period: p,
        }

        if (next.max == null) {
          const prev = demandRate_tiers?.[p]?.[tier - 1]

          next = {
            ...next,
            max: prev?.max != null ? prev.max : 0,
          }

          return [next, { ...next, max: (next.max ?? 0) * 1.5 || 100 }]
        }

        return next
      }) ?? []
    )
  })

  if (selectedTiers == null) {
    return null
  }

  if (selectedTiers[0].max != 0) {
    selectedTiers = [{ ...selectedTiers[0], max: 0 }, ...selectedTiers]
  }

  const chart = (
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
            tooltip: true,
          },
          title: 'Demand Rate Tiers',
          encoding: {
            y: {
              field: 'rate',
              type: 'quantitative',
              title: `$ per ${selectedPlan?.demandRateUnits ?? 'kW'}`,
              stack: null,
            },
            x: {
              field: 'max',
              type: 'quantitative',
              title: `Max (${selectedPlan?.demandRateUnits ?? 'kW'})`,
              scale: {
                domainMax: Math.max(...selectedTiers.map((x) => x.max ?? 0)),
              },
            },
            color: {
              field: 'period',
              title: 'Period',
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

  return <Card>{chart}</Card>
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

  let windowed = []
  if (selectedTiers.length == 1 && selectedTiers[0].max == null) {
    const only = selectedTiers[0]
    windowed = [
      { ...only, max: 0, tier: 0 },
      { ...only, max: 1000, tier: 0 },
    ]
  } else {
    windowed = selectedTiers.flatMap((t, i) => {
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
  }

  const chart = (
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
          title: `Flat Demand Rate`,
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
          },
        } satisfies TopLevelSpec
      }
      options={{ mode: 'vega-lite', actions: false }}
    />
  )

  return <Card>{chart}</Card>
}
