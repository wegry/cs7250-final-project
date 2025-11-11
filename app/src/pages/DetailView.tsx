import { useRef } from 'react'
import { useImmer } from 'use-immer'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { RatePlanSelector } from '../components/RatePlanSelector'
import { useRatePlanInData } from '../hooks/useRateInPlanData'
import * as s from './DetailView.module.css'
import { useRatePlan } from '../hooks/useRatePlan'
import { DatePicker, Form, Select } from 'antd'
import { useVegaEmbed } from 'react-vega'

import type { RatePlan, RetailPriceData } from '../data/schema'
import dayjs, { Dayjs } from 'dayjs'
import { useWholesaleData } from '../hooks/useWholesaleData'
import { sum } from 'es-toolkit'
import { HUB_DICT } from '../data/queries'
import { RatePlanTimeline } from '../components/RatePlanTimeline'
import {
  createPricingChartSpec,
  prepareWholesaleData,
  useTiersChart,
} from '../charts/energyRateStructure'
import type { TopLevelSpec } from 'vega-lite'

interface State {
  adjustedIncluded: boolean
  date: Dayjs
  wholesale: keyof typeof HUB_DICT
}

export default function DetailView() {
  const { id: ratePlanParam } = useParams()
  const { data: selectedPlan } = useRatePlan(ratePlanParam)

  const { data: supercedesExistsInData } = useRatePlanInData(
    selectedPlan?.supercedes
  )
  const [state, updateState] = useImmer<State>({
    adjustedIncluded: true,
    date: dayjs(),
    wholesale: 'New England',
  })
  const { data: wholesaleData } = useWholesaleData(state.wholesale, state.date)
  const energyRateRef = useRef<HTMLDivElement>(null)
  const tierRef = useRef<HTMLDivElement>(null)
  const retailData = pullData(selectedPlan, state.date)
  const preparedWholesale = prepareWholesaleData(wholesaleData)
  useVegaEmbed({
    ref: energyRateRef,
    spec: createPricingChartSpec(retailData, preparedWholesale),
    options: { mode: 'vega-lite', actions: false },
  })
  useTiersChart({
    tierRef: tierRef,
    selectedPlan,
    date: state.date,
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
            value={state.date}
            onChange={(e) =>
              updateState((state) => {
                state.date = e
              })
            }
          />
        </Form.Item>

        {supercedesExistsInData && (
          <div>
            Supercedes{' '}
            <Link to={`/detail/${selectedPlan?.supercedes}`}>
              {selectedPlan?.supercedes}{' '}
            </Link>
          </div>
        )}
      </Form>

      <div ref={energyRateRef}></div>
      <div ref={tierRef}></div>
      <RatePlanTimeline ratePlan={selectedPlan} />
    </main>
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
