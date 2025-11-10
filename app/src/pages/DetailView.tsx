import { useRef } from 'react'
import { useImmer } from 'use-immer'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { RatePlanSelector } from '../components/RatePlanSelector'
import { useRatePlanInData } from '../hooks/useRateInPlanData'
import * as s from './DetailView.module.css'
import { useRatePlan } from '../hooks/useRatePlan'
import { DatePicker, Form, Select } from 'antd'
import { useVegaEmbed } from 'react-vega'

import type { TopLevelSpec } from 'vega-lite'
import type {
  RatePlan,
  RetailPriceData,
  WholesalePrice,
  WholesalePriceData,
} from '../data/schema'
import dayjs, { Dayjs } from 'dayjs'
import { useWholesaleData } from '../hooks/useWholesaleData'
import { sum } from 'es-toolkit'
import { HUB_DICT } from '../data/queries'

interface State {
  adjustedIncluded: boolean
  date: Dayjs
  wholesale: keyof typeof HUB_DICT
}

export default function DetailView() {
  const { id: ratePlanParam } = useParams()
  const { data: selectedPlan } = useRatePlan(ratePlanParam)

  const { data: supersedesExistsInData } = useRatePlanInData(
    selectedPlan?.supersedes
  )
  const [state, updateState] = useImmer<State>({
    adjustedIncluded: true,
    date: dayjs().set('year', 2024),
    wholesale: 'New England',
  })
  const { data: wholesaleData } = useWholesaleData(state.wholesale, state.date)
  const chartRef = useRef<HTMLDivElement>(null)
  const retailData = pullData(selectedPlan, state.date.month())
  const preparedWholesale = prepareWholesaleData(wholesaleData)
  useVegaEmbed({
    ref: chartRef,
    spec: createPricingChartSpec(retailData, preparedWholesale),
    options: { mode: 'vega-lite', actions: false },
  })

  const nav = useNavigate()

  const handleRatePlanChange = async (value: string) => {
    nav(`/detail/${value}`)
  }

  return (
    <main className={s.main}>
      <h1>Visualizing Dynamic Electricity Pricing</h1>

      <Form layout="horizontal">
        <Form.Item label="Rate Plan">
          <RatePlanSelector
            value={ratePlanParam}
            onChange={handleRatePlanChange}
          />
        </Form.Item>
        <Form.Item label="Wholesale Market">
          <Select
            options={Object.keys(HUB_DICT)
              .toSorted()
              .map((x) => {
                return {
                  label: x,
                  value: x,
                }
              })}
            onChange={(e) => {
              updateState((state) => {
                state.wholesale = e
              })
            }}
            value={state.wholesale}
          />
        </Form.Item>
        <Form.Item label="For Date">
          <DatePicker
            allowClear={false}
            minDate={dayjs('2024-01-01')}
            maxDate={dayjs('2024-12-31')}
            value={state.date}
            onChange={(e) =>
              updateState((state) => {
                state.date = e
              })
            }
          />
        </Form.Item>

        <div>
          {supersedesExistsInData ? (
            <>
              Supersedes{' '}
              <Link to={`/detail/${selectedPlan?.supersedes}`}>
                {selectedPlan?.supersedes}{' '}
              </Link>
            </>
          ) : (
            'Latest Plan'
          )}
        </div>
      </Form>

      <div id="my-div" ref={chartRef}></div>
    </main>
  )
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
      value: minWholesale,
      line: `Min Wholesale (${minWholesale.toFixed(3)})`,
    },
    {
      hour: 24,
      value: minWholesale,
      line: `Min Wholesale (${minWholesale.toFixed(3)})`,
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
  ]
}

// Vega-Lite spec generator
export function createPricingChartSpec(
  retailData: RetailPriceData[],
  wholesaleData: WholesalePriceData[] | undefined | null
): TopLevelSpec {
  return {
    $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
    width: 700,
    height: 400,
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
            title: '$ per unit',
          },
          color: {
            field: 'series',
            type: 'nominal',
            title: 'Retail Price',
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

// Helper to convert wholesale prices to per-kWh
export function convertWholesaleToKwh(wholesalePrice: WholesalePrice) {
  return {
    max: wholesalePrice['High price $/MWh'] / 1000,
    min: wholesalePrice['Low price $/MWh'] / 1000,
    avg: wholesalePrice['Wtd avg price $/MWh'] / 1000,
  }
}

function pullData(
  data: RatePlan | null | undefined,
  month: number
): RetailPriceData[] {
  return (
    data?.energyweekdayschedule?.[month].flatMap((period, i) => {
      const periodInfo = data?.ratestructure?.energyrate?.[`period${period}`]
      if (!periodInfo) {
        return []
      }

      return Object.entries(periodInfo).flatMap(([prefixedTier, tierInfo]) => {
        if (!tierInfo) {
          return []
        }

        const tier = prefixedTier.match(/\d+$/g)?.[0]

        const value = sum([tierInfo.rate].map((x) => x ?? 0))

        const result = {
          hour: i,
          value,
          series: `Tier ${tier}`,
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
