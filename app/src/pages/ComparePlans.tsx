import { useEffect, useRef, useState } from 'react'
import { useVegaEmbed, type VegaEmbedProps } from 'react-vega'
import { get_query } from '../data/duckdb'
import { synthUsage } from '../data/queries'
import { useImmer } from 'use-immer'
import { SynthData } from '../data/schema'

type State = {
  showRegions: SynthData[number]['region']
  season: 'winter' | 'summer'
}

const RegionalElectricityPatterns = () => {
  // Vega mutates data in place.
  const [data, setData] = useState<SynthData>([])
  const [state, updateState] = useImmer<State>({
    showRegions: 'New England',
    season: 'winter',
  })

  // Try to load from DuckDB file on mount
  useEffect(() => {
    const loadFromDuckDB = async () => {
      try {
        // Query the synthetic_usage table
        const result = await get_query(
          synthUsage(state.season, state.showRegions)
        )

        const rows = SynthData.parse(result.toArray())

        setData(rows)
      } catch (error: unknown) {
        if (error instanceof Error) {
          console.log(error.message)
        }
      }
    }

    loadFromDuckDB()
  }, [state.season, state.showRegions])

  const toggleRegion = (region: State['showRegions']) => {
    updateState((state) => {
      state.showRegions = region
    })
  }

  // Vega-Lite specification
  const spec: VegaEmbedProps['spec'] = {
    $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
    width: 'container',
    height: 400,
    data: { values: data },
    mark: { type: 'line', point: false, strokeWidth: 3 },
    encoding: {
      x: {
        field: 'hour',
        type: 'quantitative',
        title: 'Hour of Day',
        axis: {
          values: [0, 3, 6, 9, 12, 15, 18, 21],
          labelExpr:
            "datum.value == 0 ? '12am' : datum.value < 12 ? datum.value + 'am' : datum.value == 12 ? '12pm' : (datum.value - 12) + 'pm'",
        },
        scale: {
          domain: [0, 24],
          // range: ['#3b82f6', '#ef4444', '#f59e0b'],
        },
      },
      y: {
        field: 'usage_kw',
        type: 'quantitative',
        title: 'Electricity Usage (kW)',
        scale: { zero: true },
      },
      tooltip: [
        { field: 'hour', type: 'quantitative', title: 'Hour' },
        { field: 'region', type: 'nominal', title: 'Region' },
        {
          field: 'usage_kw',
          type: 'quantitative',
          title: 'Usage (kW)',
          format: '.2f',
        },
      ],
    },
    config: {
      view: { stroke: null },
      axis: { grid: true, gridOpacity: 0.2 },
    },
  }

  const chartRef = useRef<HTMLDivElement>(null)
  useVegaEmbed({ ref: chartRef, spec, options: { mode: 'vega-lite' } })

  return (
    <div className="w-full max-w-6xl mx-auto p-6 bg-gradient-to-br from-slate-50 to-blue-50 rounded-xl shadow-lg">
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-slate-800 mb-2">
          Regional Electricity Usage Patterns
        </h2>
        <p className="text-slate-600 mb-2">
          Compare heating vs. cooling loads across regions and seasons
        </p>

        <div className="mb-4 flex gap-2">
          <button
            onClick={() =>
              updateState((state) => {
                state.season = 'winter'
              })
            }
            className={`px-6 py-2 rounded-lg font-medium transition-all ${
              state.season === 'winter'
                ? 'bg-cyan-500 text-white shadow-md'
                : 'bg-white text-slate-400 border-2 border-slate-200'
            }`}
          >
            ❄️ Winter (January)
          </button>
          <button
            onClick={() =>
              updateState((state) => {
                state.season = 'summer'
              })
            }
            className={`px-6 py-2 rounded-lg font-medium transition-all ${
              state.season === 'summer'
                ? 'bg-orange-500 text-white shadow-md'
                : 'bg-white text-slate-400 border-2 border-slate-200'
            }`}
          >
            ☀️ Summer (July)
          </button>
        </div>

        <div className="flex flex-wrap gap-3 mb-4">
          <button
            onClick={() => toggleRegion('New England')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              state.showRegions === 'New England'
                ? 'bg-blue-500 text-white shadow-md'
                : 'bg-white text-slate-400 border-2 border-slate-200'
            }`}
          >
            New England
          </button>
          <button
            onClick={() => toggleRegion('Texas')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              state.showRegions === 'Texas'
                ? 'bg-red-500 text-white shadow-md'
                : 'bg-white text-slate-400 border-2 border-slate-200'
            }`}
          >
            Texas
          </button>
          <button
            onClick={() => toggleRegion('Southern California')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              state.showRegions === 'Southern California'
                ? 'bg-amber-500 text-white shadow-md'
                : 'bg-white text-slate-400 border-2 border-slate-200'
            }`}
          >
            Southern California
          </button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg shadow-lg">
        <div ref={chartRef} style={{ width: 600, height: 200 }} />
      </div>

      {state.season === 'winter' ? (
        <>
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-lg border-l-4 border-blue-500 shadow">
              <h3 className="font-bold text-blue-700 mb-2">
                New England (Gas Heat)
              </h3>
              <p className="text-sm text-slate-600">
                Two distinct peaks for cooking and activities. No heating load
                on electric grid since homes use natural gas or oil furnaces.
              </p>
            </div>
            <div className="bg-white p-4 rounded-lg border-l-4 border-red-500 shadow">
              <h3 className="font-bold text-red-700 mb-2">
                Texas (Electric Heat)
              </h3>
              <p className="text-sm text-slate-600">
                Higher overall usage with elevated morning and evening peaks.
                Many homes use electric heat pumps or resistance heating.
              </p>
            </div>
            <div className="bg-white p-4 rounded-lg border-l-4 border-amber-500 shadow">
              <h3 className="font-bold text-amber-700 mb-2">
                Southern California + EV
              </h3>
              <p className="text-sm text-slate-600">
                Minimal heating needs create flat daytime profile. Large
                overnight spike from EV charging (7.2 kW Level 2 charger).
              </p>
            </div>
          </div>

          <div className="mt-6 bg-white p-4 rounded-lg shadow">
            <h3 className="font-bold text-slate-700 mb-2">Winter Insights</h3>
            <ul className="text-sm text-slate-600 space-y-1">
              <li>
                • <strong>Peak Usage:</strong> Texas shows 50-75% higher peak
                demand than New England due to electric heating
              </li>
              <li>
                • <strong>EV Impact:</strong> California's overnight charging
                adds 6-7 kW but occurs during off-peak hours
              </li>
              <li>
                • <strong>Grid Impact:</strong> Electric heating creates
                sustained evening loads that challenge grid capacity
              </li>
              <li>
                • <strong>Cost Advantage:</strong> California EV charging
                happens when rates are lowest (overnight)
              </li>
            </ul>
          </div>
        </>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-lg border-l-4 border-blue-500 shadow">
              <h3 className="font-bold text-blue-700 mb-2">
                New England (Moderate AC)
              </h3>
              <p className="text-sm text-slate-600">
                Afternoon AC load creates new peak (1-8pm). Less extreme than
                heating season since gas furnaces don't help in summer.
              </p>
            </div>
            <div className="bg-white p-4 rounded-lg border-l-4 border-red-500 shadow">
              <h3 className="font-bold text-red-700 mb-2">
                Texas (Extreme Cooling)
              </h3>
              <p className="text-sm text-slate-600">
                Massive cooling loads dominate. Peak usage 2-3x higher than
                winter as AC runs continuously during brutal heat.
              </p>
            </div>
            <div className="bg-white p-4 rounded-lg border-l-4 border-amber-500 shadow">
              <h3 className="font-bold text-amber-700 mb-2">
                Southern California + EV
              </h3>
              <p className="text-sm text-slate-600">
                Moderate afternoon AC peak plus overnight EV charging. Mild
                climate keeps cooling needs reasonable.
              </p>
            </div>
          </div>

          <div className="mt-6 bg-white p-4 rounded-lg shadow">
            <h3 className="font-bold text-slate-700 mb-2">Summer Insights</h3>
            <ul className="text-sm text-slate-600 space-y-1">
              <li>
                • <strong>Texas Crisis:</strong> Summer peaks can reach 12+ kW
                per home during heat waves—higher than winter
              </li>
              <li>
                • <strong>Peak Timing:</strong> AC loads peak 2-8pm, exactly
                when solar production drops and grid stress is highest
              </li>
              <li>
                • <strong>New England Flip:</strong> Now shows electric load for
                cooling, but still moderate vs. Texas extremes
              </li>
              <li>
                • <strong>California Strategy:</strong> EV owners can use TOU
                rates effectively—charge at night, minimize AC during peak
              </li>
            </ul>
          </div>
        </>
      )}
    </div>
  )
}

export default RegionalElectricityPatterns
