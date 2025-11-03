import { useState, useEffect, useRef } from 'react'
import { useImmer } from 'use-immer'
import { useSearchParams } from 'react-router-dom'
import { chart } from '../chart'
import { get_query } from '../data/duckdb'
import { RatePlan, RatePlanSelect } from '../data/schema'
import * as queries from '../data/queries'

interface UiState {
  selected?: RatePlan
  adjustedIncluded: boolean
  date: Date | null
}

interface RatePlanOption {
  label: string
  utility: string
  name: string
}

const RATE_QUERY_PARAM = 'rate-plan'

export default function DetailView() {
  const [ratePlans, setRatePlans] = useState<RatePlanOption[]>([])
  const [state, updateState] = useImmer<UiState>({
    selected: undefined,
    adjustedIncluded: true,
    date: null,
  })
  const [searchParams, setSearchParams] = useSearchParams()
  const chartRef = useRef<HTMLDivElement>(null)
  const rawRef = useRef<HTMLPreElement>(null)
  const [supersedesContent, setSupersedesContent] =
    useState<string>('Latest plan')

  // Load rate plans on mount
  useEffect(() => {
    async function loadRatePlans() {
      const result = await get_query(queries.selectList)
      const table = result.toArray()

      try {
        const rows = RatePlanSelect.parse(table, { reportInput: true })
        setRatePlans(rows)

        // Set initial selected rate plan from URL or first option
        const rateQueryId = searchParams.get(RATE_QUERY_PARAM) || rows[0]?.label
        if (rateQueryId) {
          await setSelected(rateQueryId)
        }
      } catch (e) {
        console.error(e)
        throw e
      }
    }

    loadRatePlans()
  }, [])

  // Render chart when state changes
  useEffect(() => {
    if (state.selected && chartRef.current) {
      chart(state.selected, chartRef.current, {
        includeAdjusted: state.adjustedIncluded,
        month: (state.date ?? new Date()).getMonth(),
      })

      // Update raw view
      if (rawRef.current) {
        rawRef.current.innerHTML = JSON.stringify(
          state.selected,
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
      }
    }
  }, [state])

  async function setSelected(value: string) {
    let raw = null
    try {
      raw = (await get_query(queries.ratePlanDetail(value))).toArray()
      const selected = RatePlan.parse(raw[0])

      updateState((draft) => {
        draft.selected = selected
      })

      await replaceSlot(selected.supersedes)
    } catch (e) {
      console.debug('Failed to parse', raw)
      console.error(e)
    }
  }

  async function replaceSlot(label?: string | null) {
    if (label) {
      const ratePlanInData = await get_query(queries.ratePlanInData(label))
      if (ratePlanInData.toArray()[0]) {
        setSupersedesContent(`Supersedes `)
        // Note: You might want to handle the link click differently in React
      } else {
        setSupersedesContent(`Supersedes rate plan not in data set (${label})`)
      }
    } else {
      setSupersedesContent('Latest plan')
    }
  }

  const handleRatePlanChange = async (
    e: React.ChangeEvent<HTMLSelectElement>
  ) => {
    const value = e.target.value
    if (value) {
      await setSelected(value)
      setSearchParams({ [RATE_QUERY_PARAM]: value })
    }
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

  const selectedValue =
    searchParams.get(RATE_QUERY_PARAM) || ratePlans[0]?.label || ''

  return (
    <div>
      <main>
        <h1>Visualizing Dynamic Electricity Pricing</h1>
      </main>

      <div>
        <label>
          Rate Plan Chooser
          <select
            id="rate-plan-chooser"
            value={selectedValue}
            onChange={handleRatePlanChange}
          >
            {ratePlans.map((plan) => (
              <option key={plan.label} value={plan.label}>
                {`${plan.utility}/${plan.name}/${plan.label}`}
              </option>
            ))}
          </select>
        </label>
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

      <div>{supersedesContent}</div>

      <div id="my-div" ref={chartRef}></div>

      <pre id="raw-view" ref={rawRef}></pre>
    </div>
  )
}
