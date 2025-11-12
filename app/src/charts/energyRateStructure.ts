import type { TopLevelSpec } from 'vega-lite'
import type {
  RatePlan,
  RetailPriceData,
  WholesalePrice,
  WholesalePriceData,
} from '../data/schema'
import type { RefObject } from 'react'
import { useVegaEmbed } from 'react-vega'
import type { Dayjs } from 'dayjs'
import { sortBy, uniqWith } from 'es-toolkit'

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
    min: minWholesale,
    avg: avgWholesale,
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
// Vega-Lite spec generator
export function createPricingChartSpec(
  retailData: RetailPriceData[],
  wholesaleData: WholesalePriceData[] | undefined | null
): TopLevelSpec {
  return {
    $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
    width: 400,
    height: 200,
    title: '24-Hour Pricing Structure',
    layer: [
      // Reference lines layer (wholesale prices)
      {
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
            title: 'Wholesale Prices',
          },
        },
      },
      // Main retail price lines layer
      {
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
            field: 'series',
            type: 'nominal',
            title: 'Retail Price',
            scale: {
              scheme: 'viridis',
            },
          },
          detail: {
            field: 'series',
            type: 'nominal',
          },
        },
      },
    ],
  }
}

export function useTiersChart({
  date,
  selectedPlan,
  tierRef,
}: {
  tierRef: RefObject<HTMLDivElement | null>
  selectedPlan?: RatePlan | null
  date: Dayjs
}) {
  const periods = new Set(selectedPlan?.energyWeekdaySched?.[date.month()])
  const selectedTiers = sortBy(
    uniqWith(
      Array.from(periods).flatMap(
        (p) => selectedPlan?.energyRate_tiers?.[p] ?? []
      ),
      (a, b) => a.max === b.max && a.rate === b.rate
    ),
    ['rate']
  )
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

  useVegaEmbed({
    ref: tierRef,
    spec: {
      $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
      width: 400,
      height: 200,
      data: { values: windowed },
      mark: {
        type: 'line',
        interpolate: 'step-after',
      },
      title: 'Energy Usage Tiers',
      encoding: {
        y: { field: 'rate', type: 'quantitative', title: 'Rate' },
        x: {
          field: 'max',
          type: 'quantitative',
          title: 'Max Usage ' + selectedTiers?.[0]?.unit,
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
    } satisfies TopLevelSpec,
    options: { mode: 'vega-lite', actions: false },
  })
}
