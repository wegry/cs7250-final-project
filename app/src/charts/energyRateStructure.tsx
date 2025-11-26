import type { TopLevelSpec } from 'vega-lite'
import type {
  RatePlan,
  RetailPriceData,
  WholesalePrice,
  WholesalePriceData,
} from '../data/schema'
import { VegaEmbed } from 'react-vega'
import type { Dayjs } from 'dayjs'
import { sum, uniqBy, windowed } from 'es-toolkit'
import type { UnitSpec } from 'vega-lite/types_unstable/spec/unit.js'
import { Card, Statistic } from 'antd'
import { price } from '../formatters'
import { useMemo } from 'react'

// Helper to convert wholesale prices to per-kWh
export function convertWholesaleToKwh(wholesalePrice: WholesalePrice) {
  return {
    max: wholesalePrice['High price $/MWh'] / 1000,
    min: wholesalePrice['Low price $/MWh'] / 1000,
    avg: wholesalePrice['Wtd avg price $/MWh'] / 1000,
  }
}
// Function to prepare wholesale reference lines
export function prepareWholesaleData(
  wholesalePrice: WholesalePrice | undefined | null
): WholesalePriceData[] {
  if (!wholesalePrice) {
    return []
  }
  const {
    max: maxWholesale,
    avg: avgWholesale,
    min: minWholesale,
  } = convertWholesaleToKwh(wholesalePrice)
  return [
    {
      hour: 0,
      value: maxWholesale,
      line: `Max Wholesale (${maxWholesale.toFixed(3)})`,
    },
    {
      hour: 24,
      value: maxWholesale,
      line: `Max Wholesale (${maxWholesale.toFixed(3)})`,
    },
    {
      hour: 0,
      value: avgWholesale,
      line: `Avg Wholesale (${avgWholesale.toFixed(3)})`,
    },
    {
      hour: 24,
      value: avgWholesale,
      line: `Avg Wholesale (${avgWholesale.toFixed(3)})`,
    },
    {
      hour: 0,
      value: minWholesale,
      line: `Min Wholesale (${minWholesale.toFixed(3)})`,
    },
    {
      hour: 24,
      value: minWholesale,
      line: `Min Wholesale (${minWholesale.toFixed(3)})`,
    },
  ]
}

export function EnergyRateChart({
  date,
  selectedPlan,
  wholesaleData,
}: {
  selectedPlan?: RatePlan | null
  date: Dayjs
  wholesaleData: WholesalePriceData[]
}) {
  const retailData = pullData(selectedPlan, date)

  if (!(retailData.length || wholesaleData.length)) {
    return null
  }

  const layer: UnitSpec<'value' | 'hour' | 'line' | 'tier' | 'period'>[] = []
  // Reference lines layer (wholesale prices)
  if (wholesaleData.length) {
    layer.push({
      data: { values: wholesaleData ?? [] },
      mark: {
        type: 'line',
        strokeWidth: 1,
        opacity: 0.5,
        strokeDash: [5, 5],
      },
      encoding: {
        x: {
          field: 'hour',
          type: 'quantitative',
        },
        y: {
          field: 'value',
          type: 'quantitative',
        },
        color: {
          field: 'line',
          type: 'nominal',
          scale: {
            scheme: 'magma',
          },
          title: 'Wholesale Prices',
        },
      },
    })
  }

  if (retailData.length) {
    // Main retail price lines layer
    layer.push({
      data: { values: retailData },
      mark: {
        type: 'line',
        strokeWidth: 2,
        interpolate: 'step-after',
        tension: 0,
      },
      encoding: {
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
        y: {
          field: 'value',
          type: 'quantitative',
          title: '$ per kWh',
        },
        color: {
          field: 'tier',
          type: 'nominal',
          title: 'Tier',
          scale: {
            scheme: 'viridis',
          },
        },
        detail: {
          field: 'tier',
          type: 'nominal',
        },
        tooltip: [
          { field: 'hour', title: 'Hour' },
          { field: 'value', title: '$ per kWh', format: '.3f' },
          { field: 'period', title: 'Period' },
          { field: 'tier', title: 'Tier' },
        ],
      },
    })
  }

  const isBoring = useMemo(
    () =>
      uniqBy(retailData, (x) => [x.period, x.tier, x.value].join('/')).length ==
      1,
    [retailData]
  )

  if (isBoring) {
    return (
      <Card>
        <Statistic
          title={`Energy Price`}
          value={price.format(retailData?.[0].value)}
          suffix="per kWh all day"
        ></Statistic>
      </Card>
    )
  }

  const chart = (
    <VegaEmbed
      spec={
        {
          $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
          width: 400,
          height: 200,
          title: 'Energy Rate Structure',
          resolve: {
            legend: { color: 'independent' },
            scale: { color: 'independent' },
          },
          layer,
        } satisfies TopLevelSpec
      }
      options={{ mode: 'vega-lite', actions: false }}
    />
  )

  return <Card>{chart}</Card>
}

function pullData(
  data: RatePlan | null | undefined,
  date: Dayjs
): RetailPriceData[] {
  const tiers = data?.energyRate_tiers
  const schedule = [0, 6].includes(date.day())
    ? data?.energyWeekendSched
    : data?.energyWeekdaySched
  return (
    schedule?.[date.month()].flatMap((period, i) => {
      const periodInfo = tiers?.[period]
      if (!periodInfo) {
        return []
      }

      return periodInfo.flatMap((tierInfo, j) => {
        if (!tierInfo) {
          return []
        }

        const tier = j

        const value = sum([tierInfo.rate].map((x) => x ?? 0))

        const result = {
          hour: i,
          value,
          tier,
          period,
        }

        if (result.hour == 23) {
          return [result, { ...result, hour: 24 }]
        }

        return result ?? []
      })
    }) ?? []
  )
}

export function TiersChart({
  date,
  selectedPlan,
}: {
  selectedPlan?: RatePlan | null
  date: Dayjs
}) {
  const periods = new Set(selectedPlan?.energyWeekdaySched?.[date.month()])

  const selectedTiers = Array.from(periods).flatMap(
    (p) => selectedPlan?.energyRate_tiers?.[p] ?? []
  )

  /** We want a graph where the tier boundaries are tier 'max' to next tier 'max' */
  const windows = windowed(structuredClone(selectedTiers), 2)
    .flatMap(([x, y], tier) => {
      if (!(x.max || y.max)) {
        return []
      }
      const nextTier = tier + 1
      let padFirst = null
      if (tier == 0) {
        padFirst = { ...x, max: 0, tier }
      }
      if (!y.max && x.max) {
        return [
          padFirst,
          { ...x, tier },
          { ...y, tier: nextTier, max: x.max },
          { ...y, tier: nextTier, max: x.max * 1.5 },
        ]
      } else if (y.max && x.max) {
        return [
          padFirst,
          { ...x, tier },
          { ...y, tier: nextTier, max: x.max },
          { ...y, tier: nextTier },
        ]
      }

      return [padFirst, { ...x, tier }, { ...y, tier: tier + 1 }]
    })
    .filter((x) => x != null)

  if (windows.length <= 1) {
    return null
  }

  const chart = (
    <VegaEmbed
      spec={
        {
          $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
          width: 400,
          height: 200,
          data: { values: windows },
          mark: {
            type: 'line',
            interpolate: 'step-after',
            tooltip: true,
          },
          title: 'Energy Usage Tiers',
          encoding: {
            y: { field: 'rate', type: 'quantitative', title: '$ per kWh' },
            x: {
              field: 'max',
              type: 'quantitative',
              title: `Usage (${selectedTiers?.[0]?.unit})`,
              scale: {
                domainMax:
                  Math.max(...windows.map((x) => x.max ?? 0)) || undefined,
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

  return <Card>{chart}</Card>
}
