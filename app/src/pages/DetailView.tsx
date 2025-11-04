import { useState, useEffect, useRef } from 'react'
import { useImmer } from 'use-immer'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { chart } from '../chart'
import { get_query } from '../data/duckdb'
import { RatePlan } from '../data/schema'
import * as queries from '../data/queries'
import { RatePlanSelector } from '../components/RatePlanSelector'
import { useRatePlanInData } from '../hooks/useRatePlans'
import { useQuery } from '@tanstack/react-query'
import * as s from './DetailView.module.css'

interface UiState {
  rawData?: string
  adjustedIncluded: boolean
  date: Date | null
}

async function getRatePlan(label?: string) {
  if (!label) {
    return null
  }
  const raw = (await queries.ratePlanDetail(label)).toArray()

  const { data, error } = RatePlan.safeParse(raw[0])
  if (error) {
    console.error(error)
    throw error
  }

  return data
}

export default function DetailView() {
  const { id: ratePlanParam } = useParams()
  const [state, updateState] = useImmer<UiState>({
    rawData: undefined,
    adjustedIncluded: true,
    date: null,
  })
  const chartRef = useRef<HTMLDivElement>(null)

  const { data: selectedPlan } = useQuery({
    queryFn: () => getRatePlan(ratePlanParam),
    queryKey: ['ratePlan', ratePlanParam],
  })

  const { data: supersedesExistsInData } = useRatePlanInData(
    selectedPlan?.supersedes
  )

  useEffect(() => {
    if (selectedPlan && chartRef.current) {
      chart(selectedPlan, chartRef.current, {
        includeAdjusted: state.adjustedIncluded,
        month: (state.date ?? new Date()).getMonth(),
      })
    }
  }, [state, selectedPlan])

  useEffect(() => {
    // Update raw view
    updateState((state) => {
      state.rawData = JSON.stringify(
        selectedPlan ?? {},
        (key, value) => {
          if (typeof value === 'bigint') {
            return value.toString()
          }
          return value
        },
        2
      ).replaceAll(/\[\s+([^\[\]{}]+?)\s+\]/g, (match, content) => {
        const cleaned = content.replace(/\s+/g, ' ').trim()
        return `[${cleaned}]`
      })
    })
  }, [selectedPlan])

  const nav = useNavigate()

  const handleRatePlanChange = async (value: string) => {
    nav(`/detail/${value}`)
  }

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateState((draft) => {
      draft.date = e.target.valueAsDate
    })
  }

  const handleAdjustedRateToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateState((draft) => {
      draft.adjustedIncluded = e.target.checked
    })
  }

  // Set initial date to current date in 2024
  useEffect(() => {
    const date = new Date()
    date.setFullYear(2024)
    updateState((draft) => {
      draft.date = date
    })
  }, [])

  return (
    <main className={s.main}>
      <h1>Visualizing Dynamic Electricity Pricing</h1>

      <div>
        <RatePlanSelector
          value={ratePlanParam}
          onChange={handleRatePlanChange}
        />
      </div>

      <div>
        <label>
          For date:
          <input
            type="date"
            id="date-picker"
            min="2024-01-01"
            max="2024-12-31"
            value={state.date?.toISOString().slice(0, 10) || ''}
            onChange={handleDateChange}
          />
        </label>
      </div>

      <label>
        Include Adjusted Rate?
        <input
          id="include-adjusted-rate"
          type="checkbox"
          checked={state.adjustedIncluded}
          onChange={handleAdjustedRateToggle}
        />
      </label>

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

      <div id="my-div" ref={chartRef}></div>

      <pre id="raw-view">{state.rawData}</pre>
    </main>
  )
}
