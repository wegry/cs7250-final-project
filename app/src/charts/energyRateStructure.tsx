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
import { Card, Statistic } from 'antd'
import { price } from '../formatters'
import { useMemo } from 'react'

export function convertWholesaleToKwh(wholesalePrice: WholesalePrice) {
  return {
    max: wholesalePrice['High price $/MWh'] / 1000,
    min: wholesalePrice['Low price $/MWh'] / 1000,
    avg: wholesalePrice['Wtd avg price $/MWh'] / 1000,
  }
}

export function prepareWholesaleData(
  wholesalePrice: WholesalePrice | undefined | null
): WholesalePriceData[] {
  if (!wholesalePrice) return []
  const { max, avg, min } = convertWholesaleToKwh(wholesalePrice)
  return [
    { hour: 0, value: max, line: `Max Wholesale (${max.toFixed(3)})` },
    { hour: 24, value: max, line: `Max Wholesale (${max.toFixed(3)})` },
    { hour: 0, value: avg, line: `Avg Wholesale (${avg.toFixed(3)})` },
    { hour: 24, value: avg, line: `Avg Wholesale (${avg.toFixed(3)})` },
    { hour: 0, value: min, line: `Min Wholesale (${min.toFixed(3)})` },
    { hour: 24, value: min, line: `Min Wholesale (${min.toFixed(3)})` },
  ]
}

export function EnergyRateChart({
  date,
  selectedPlan,
}: {
  selectedPlan?: RatePlan | null
  date: Dayjs
}) {
  const retailData = pullData(selectedPlan, date)

  const isBoring = useMemo(
    () =>
      uniqBy(retailData, (x) => [x.period, x.tier, x.value].join('/'))
        .length === 1,
    [retailData]
  )

  const sameAllYearLong = useMemo(
    () =>
      new Set(
        selectedPlan?.energyWeekdaySched
          ?.concat(selectedPlan.energyWeekendSched ?? [])
          ?.flat()
      ).size === 1,
    [selectedPlan]
  )

  if (!retailData.length) return null

  if (isBoring && retailData.length) {
    return (
      <Card>
        <Statistic
          title="Energy Price"
          value={price.format(retailData[0].value)}
          suffix={`/ kWh all day ${sameAllYearLong ? 'all year' : ''}`}
        />
      </Card>
    )
  }

  const spec: TopLevelSpec = {
    $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
    width: 400,
    height: 200,
    title: 'Energy Rate Structure',
    resolve: {
      legend: { color: 'independent' },
      scale: { color: 'independent' },
    },
    layer: [
      ...(retailData.length
        ? [
            {
              data: { values: retailData },
              params: [
                {
                  name: 'hover',
                  select: {
                    type: 'point' as const,
                    on: 'pointerover',
                    nearest: true,
                    clear: 'pointerout',
                  },
                },
              ],
              mark: {
                type: 'line' as const,
                strokeWidth: 2,
                interpolate: 'step-after' as const,
                point: { filled: true, size: 60 },
              },
              encoding: {
                x: {
                  field: 'hour',
                  type: 'quantitative' as const,
                  title: 'Hour of Day',
                  scale: { domain: [0, 24] },
                  axis: { tickCount: 24, labelAngle: 0 },
                },
                y: {
                  field: 'value',
                  type: 'quantitative' as const,
                  title: '$ per kWh',
                },
                color: {
                  field: 'tier',
                  type: 'nominal' as const,
                  title: 'Tier',
                  scale: { scheme: 'viridis' as const },
                },
                tooltip: [
                  { field: 'hour', title: 'Hour' },
                  { field: 'value', title: '$ per kWh', format: '.3f' },
                  { field: 'period', title: 'Period' },
                  { field: 'tier', title: 'Tier' },
                ],
              },
            },
          ]
        : []),
    ],
  }

  return (
    <Card>
      <VegaEmbed spec={spec} options={{ mode: 'vega-lite', actions: false }} />
    </Card>
  )
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
      if (!periodInfo) return []

      return periodInfo.flatMap((tierInfo, j) => {
        if (!tierInfo) return []
        const result: RetailPriceData = {
          hour: i,
          value: sum([tierInfo.rate].map((x) => x ?? 0)),
          tier: j,
          period,
        }
        return result.hour === 23 ? [result, { ...result, hour: 24 }] : result
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

  const spec: TopLevelSpec = {
    $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
    width: 400,
    height: 200,
    title: 'Energy Usage Tiers',
    data: { values: windows },
    params: [
      {
        name: 'hover',
        select: {
          type: 'point',
          on: 'pointerover',
          nearest: true,
          clear: 'pointerout',
        },
      },
    ],
    mark: {
      type: 'line',
      interpolate: 'step-after',
      point: { filled: true, size: 60 },
    },
    encoding: {
      y: { field: 'rate', type: 'quantitative', title: '$ per kWh' },
      x: {
        field: 'max',
        type: 'quantitative',
        title: `Usage (${selectedTiers?.[0]?.unit})`,
        scale: {
          domainMax: Math.max(...windows.map((x) => x.max ?? 0)) || undefined,
        },
      },
      color: {
        field: 'tier',
        type: 'nominal',
        title: 'Tier',
        scale: { scheme: 'viridis' },
      },
      tooltip: [
        { field: 'max', title: 'Usage Limit', format: '.1f' },
        { field: 'rate', title: '$ per kWh', format: '.3f' },
        { field: 'tier', title: 'Tier' },
      ],
    },
  }

  return (
    <>
      <Card>
        <VegaEmbed
          spec={spec}
          options={{ mode: 'vega-lite', actions: false }}
        />
      </Card>
    </>
  )
}
