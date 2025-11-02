import * as vega from 'vega'
import * as vegaLite from 'vega-lite'
import { type RatePlan } from './data/schema'
import { range, sum, countBy } from 'es-toolkit'

/** Month is 1 indexed */
function extractPeriodsOfMonth(matrix: number[][] | null, month: number) {
  if (matrix == null) {
    return []
  }
  return matrix[month - 1]
}

export function chart(
  data: RatePlan,
  { includeAdjusted = true }: { includeAdjusted: boolean }
) {
  const periodsThisMonth = extractPeriodsOfMonth(
    data.energyweekdayschedule,
    new Date().getMonth()
  ).flatMap((period, i) => {
    const periodInfo = data?.ratestructure?.energyrate?.[`period${period}`]
    if (!periodInfo) {
      return []
    }

    return range(0, 2).flatMap((tier) => {
      const tierInfo = periodInfo?.[`tier${tier}`]

      if (!tierInfo) {
        return []
      }

      const value = sum(
        [includeAdjusted ? tierInfo.adj : null, tierInfo.rate].map(
          (x) => x ?? 0
        )
      )

      const result = {
        hour: i,
        value,
        tier,
      }

      if (result.hour == 23) {
        return [result, { ...result, hour: 24 }]
      }

      return result
    })
  })

  // console.log(periodsThisMonth)

  const spec: vegaLite.TopLevelSpec = {
    $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
    data: { values: periodsThisMonth },
    mark: { type: 'line', interpolate: 'step-before' },
    title: 'Weekday energy rate schedule',
    encoding: {
      x: { field: 'hour', type: 'quantitative' },
      y: { field: 'value', type: 'quantitative' },
      color: {
        field: 'tier',
        scale: {
          scheme: 'viridis',
        },
      },
    },
  }

  // Compile Vega-Lite to Vega
  const vegaSpec = vegaLite.compile(spec).spec

  // Create Vega view and render
  const view = new vega.View(vega.parse(vegaSpec), {
    renderer: 'svg', // or 'canvas'
    container: '#myDiv', // your div selector
    hover: true,
  })

  view.run()
}
