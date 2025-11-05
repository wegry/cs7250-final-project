import { useMemo, useRef } from 'react'
import { useVegaEmbed, type VegaEmbedProps } from 'react-vega'
import { synthUsage } from '../data/queries'
import { useImmer } from 'use-immer'
import { SynthData, SynthDataArray } from '../data/schema'
import { useQuery } from '@tanstack/react-query'
import { Form, Radio, DatePicker } from 'antd'
import dayjs, { Dayjs } from 'dayjs'
import { useRatePlan } from '../hooks/useRatePlan'
import { RatePlanSelector } from '../components/RatePlanSelector'

const DATE_MIN = dayjs('2024-01-01')
const DATE_DEFAULT = dayjs().clone().set('year', 2024)
const DATE_MAX = dayjs('2024-12-31')

type State = {
  region: SynthData['region']
  date: Dayjs
  ratePlanSelected?: string
}

async function getSynthdata(
  season: SynthData['season'],
  region: SynthData['region']
) {
  const result = await synthUsage(season, region)

  const { data, error } = SynthDataArray.safeParse(result.toArray())

  if (error) {
    console.error(error)
  }

  return data
}

const RegionalElectricityPatterns = () => {
  // Vega mutates data in place.
  const [state, updateState] = useImmer<State>({
    region: 'New England',
    date: DATE_DEFAULT,
  })

  const season = useMemo(() => {
    if (state.date.isAfter('2024-10-01') || state.date.isBefore('2024-03-01')) {
      return 'winter'
    }

    return 'summer'
  }, [state.date])

  const { data: synthdata } = useQuery({
    queryFn: () => getSynthdata(season, state.region),
    queryKey: ['synthusage', season, state.region],
  })

  // Vega-Lite specification
  const spec: VegaEmbedProps['spec'] = {
    $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
    width: 'container',
    height: 400,
    data: { values: synthdata ?? [] },
    transform: [
      {
        calculate: 'datetime(0, 0, 1,datum.hour, 0, 0, 0)',
        as: 'datetime',
      },
    ],
    mark: {
      type: 'line',
      point: false,
      strokeWidth: 3,
      interpolate: 'natural',
    },
    encoding: {
      x: {
        field: 'datetime',
        type: 'temporal',
        timeUnit: 'hours',
        title: 'Hour of Day',
        axis: {
          format: '%H',
          tickCount: 8,
        },
        scale: {
          domain: [0, 24],
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
      axis: { grid: true },
    },
  }

  const chartRef = useRef<HTMLDivElement>(null)
  useVegaEmbed({ ref: chartRef, spec, options: { mode: 'vega-lite' } })

  const { data: ratePlan } = useRatePlan(state.ratePlanSelected)

  console.log(ratePlan)

  return (
    <div>
      <div>
        <h2>Regional Electricity Usage Patterns</h2>
        <p>Compare heating vs. cooling loads across regions and seasons</p>

        <Form layout="horizontal">
          <Form.Item label="Date">
            <DatePicker
              minDate={DATE_MIN}
              maxDate={DATE_MAX}
              value={state.date}
              onChange={(value) => {
                updateState((state) => {
                  state.date = value
                })
              }}
            />
          </Form.Item>
          <Form.Item label="Rate Plan">
            <RatePlanSelector
              byDate={state.date}
              value={state.ratePlanSelected}
              onChange={(e) =>
                updateState((state) => {
                  state.ratePlanSelected = e
                })
              }
            />
          </Form.Item>

          <Form.Item label="Season">
            <Radio.Group value={season}>
              <Radio.Button value="winter">❄️ Winter (January)</Radio.Button>
              <Radio.Button value="summer">☀️ Summer (July)</Radio.Button>
            </Radio.Group>
          </Form.Item>

          <Form.Item label="Region">
            <Radio.Group
              value={state.region}
              onChange={(e) =>
                updateState((state) => {
                  state.region = e.target.value
                })
              }
            >
              <Radio.Button value="New England">New England</Radio.Button>
              <Radio.Button value="Texas">Texas</Radio.Button>
              <Radio.Button value="Southern California">
                Southern California
              </Radio.Button>
            </Radio.Group>
          </Form.Item>
        </Form>
      </div>

      <div>
        <div ref={chartRef} style={{ width: 600, height: 200 }} />
      </div>

      {season === 'winter' ? (
        <>
          <div>
            <div>
              <h3>New England (Gas Heat)</h3>
              <p>
                Two distinct peaks for cooking and activities. No heating load
                on electric grid since homes use natural gas or oil furnaces.
              </p>
            </div>
            <div>
              <h3>Texas (Electric Heat)</h3>
              <p>
                Higher overall usage with elevated morning and evening peaks.
                Many homes use electric heat pumps or resistance heating.
              </p>
            </div>
            <div>
              <h3>Southern California + EV</h3>
              <p>
                Minimal heating needs create flat daytime profile. Large
                overnight spike from EV charging (7.2 kW Level 2 charger).
              </p>
            </div>
          </div>

          <div>
            <h3>Winter Insights</h3>
            <ul>
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
          <div>
            <div>
              <h3>New England (Moderate AC)</h3>
              <p>
                Afternoon AC load creates new peak (1-8pm). Less extreme than
                heating season since gas furnaces don't help in summer.
              </p>
            </div>
            <div>
              <h3>Texas (Extreme Cooling)</h3>
              <p>
                Massive cooling loads dominate. Peak usage 2-3x higher than
                winter as AC runs continuously during brutal heat.
              </p>
            </div>
            <div>
              <h3>Southern California + EV</h3>
              <p>
                Moderate afternoon AC peak plus overnight EV charging. Mild
                climate keeps cooling needs reasonable.
              </p>
            </div>
          </div>

          <div>
            <h3>Summer Insights</h3>
            <ul>
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
