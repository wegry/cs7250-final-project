import * as vega from 'vega'
import * as vegaLite from 'vega-lite'
import { type RatePlan } from './data/schema'
import { range, sum, countBy } from 'es-toolkit'

/** Month is 1 indexed */
function extractPeriodsOfMonth(matrix: number[][] | null, month: number) {
  if (matrix == null) {
    return []
  }
  return matrix[month]
}

export function chart(
  data: RatePlan,
  div: HTMLElement,
  { includeAdjusted = true, month }: { includeAdjusted: boolean; month: number }
) {
  const pullData = (
    periods: (typeof data)['energyweekdayschedule'],
    name: string
  ) =>
    extractPeriodsOfMonth(periods, month).flatMap((period, i) => {
      const periodInfo = data?.ratestructure?.energyrate?.[`period${period}`]
      if (!periodInfo) {
        return []
      }

      return Object.entries(periodInfo).flatMap(([prefixedTier, tierInfo]) => {
        if (!tierInfo) {
          return []
        }

        const tier = prefixedTier.match(/\d+$/g)

        const value = sum(
          [includeAdjusted ? tierInfo.adj : null, tierInfo.rate].map(
            (x) => x ?? 0
          )
        )

        const result = {
          hour: i,
          value,
          tier,
          period,
          name,
        }

        if (result.hour == 23) {
          return [result, { ...result, hour: 24 }]
        }

        return result
      })
    })

  const weekdayPeriodsThisMonth = pullData(
    data.energyweekdayschedule,
    'Weekdays'
  )
  const weekendPeriodsThisMonth = pullData(
    data.energyweekendschedule,
    'Weekends'
  )
  const wholeWeekPeriodsThisMonth = [
    ...weekdayPeriodsThisMonth,
    ...weekendPeriodsThisMonth,
  ]

  const hideLegend =
    Object.keys(countBy(wholeWeekPeriodsThisMonth, (x) => x.tier)).length == 1

  const spec: vegaLite.TopLevelSpec = {
    $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
    data: { values: wholeWeekPeriodsThisMonth },
    title: 'Weekday energy rate schedule',
    layer: [
      {
        transform: [{ filter: "datum.name === 'Weekdays'" }], // Filters data only for this layer
        mark: { type: 'line', interpolate: 'step-after' },
      },
      {
        transform: [{ filter: "datum.name === 'Weekends'" }], // Filters data only for this layer
        mark: {
          type: 'line',
          interpolate: 'catmull-rom',
          tension: 0,
          opacity: 0.7,
          strokeDash: [5, 5],
        },
      },
    ],
    encoding: {
      x: { field: 'hour', type: 'quantitative' },
      y: { field: 'value', type: 'quantitative' },
      tooltip: { field: 'period' },
      color: {
        field: 'tier',
        scale: {
          scheme: 'viridis',
        },
        // ...(hideLegend ? { legend: null } : {}),
      },
    },
  }

  // Compile Vega-Lite to Vega
  const vegaSpec = vegaLite.compile(spec).spec

  // Create Vega view and render
  const view = new vega.View(vega.parse(vegaSpec), {
    renderer: 'svg', // or 'canvas'
    container: div, // your div selector
    hover: true,
  })

  view.run()
}
