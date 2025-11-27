import { useMemo, useRef } from 'react'
import { useVegaEmbed, type VegaEmbedProps } from 'react-vega'
import { useImmer } from 'use-immer'
import { SynthData } from '../data/schema'
import { Form, Radio, DatePicker, Row, Col, Segmented, InputNumber } from 'antd'
import dayjs, { Dayjs } from 'dayjs'
import { useRatePlan } from '../hooks/useRatePlan'
import { RatePlanSelector } from '../components/RatePlanSelector'
import { generationPriceInAMonth } from '../prices'
import { Link, useSearchParams } from 'react-router-dom'
import { useSynthData } from '../hooks/useSynthData'
import { capitalize } from 'es-toolkit'
import { RatePlanSummary } from '../components/RatePlanSummary'
import s from './ComparePlans.module.css'

const DATE_MIN = dayjs('2024-01-01')
const DATE_DEFAULT = dayjs().clone().set('year', 2024)
const DATE_MAX = dayjs('2024-12-31')

type State = {
  region: SynthData['region']
  date: Dayjs
  targetUsage?: number
}

const RATE_PLAN_QUERY_PARAM = 'rate-plan'
const RATE_PLAN_2_QUERY_PARAM = 'other-rate-plan'
const ENERGY_USAGE_QUERY_PARAM = 'energy-usage'

function RegionalElectricityPatterns() {
  const [searchParams, setSearchParams] = useSearchParams()

  const ratePlanSelected = searchParams.get(RATE_PLAN_QUERY_PARAM)
  const ratePlan2Selected = searchParams.get(RATE_PLAN_2_QUERY_PARAM)
  const energyUsage = searchParams.get(ENERGY_USAGE_QUERY_PARAM)
  // Vega mutates data in place.
  const [state, updateState] = useImmer<State>({
    region: 'New England',
    date: DATE_DEFAULT,
    targetUsage: isFinite(energyUsage as unknown as number)
      ? parseFloat(energyUsage!)
      : undefined,
  })

  const season = useMemo(() => {
    if (state.date.isAfter('2024-10-01') || state.date.isBefore('2024-03-01')) {
      return 'winter'
    }

    return 'summer'
  }, [state.date])

  const usuageSparklines = useMemo(() => {
    return (['New England', 'Texas', 'Southern California'] as const).map(
      (name) => ({
        label: (
          <Sparkline
            region={name}
            season={season}
            selected={name == state.region}
            targetUsage={state.targetUsage}
          />
        ),
        value: name,
      })
    )
  }, [season, state.region, state.targetUsage])

  const { data: ratePlan } = useRatePlan(ratePlanSelected)
  const { data: ratePlan2 } = useRatePlan(ratePlan2Selected)
  const { data: synthData } = useSynthData({
    season: season,
    region: state.region,
    targetUsage: state.targetUsage,
  })

  const usagePlan1 = generationPriceInAMonth({
    ratePlan,
    synthData: synthData,
    monthStarting: state.date,
  })
  const usagePlan2 = generationPriceInAMonth({
    ratePlan: ratePlan2,
    synthData: synthData,
    monthStarting: state.date,
  })

  return (
    <div className={s.main}>
      <div>
        <h2>Regional Electricity Usage Patterns</h2>
        <p>Compare heating vs. cooling loads across regions and seasons</p>

        <Form layout="horizontal">
          <Row gutter={24}>
            <Col>
              <Form.Item label="Energy Usage (kWh)">
                <InputNumber
                  onChange={(value) => {
                    updateState((v) => {
                      v.targetUsage = value ?? undefined
                    })
                    setSearchParams((prev) => {
                      prev.set(
                        ENERGY_USAGE_QUERY_PARAM,
                        value! as unknown as string
                      )

                      return prev
                    })
                  }}
                  value={state.targetUsage}
                  type="number"
                  min={0.01}
                  placeholder="380"
                />
              </Form.Item>
            </Col>
            <Col>
              <Form.Item label="Date">
                <DatePicker
                  allowClear={false}
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
            </Col>
            <Col>
              <Form.Item label="Season">
                <Radio.Group
                  value={season}
                  onChange={(e) => {
                    if (
                      e.target.value === 'winter' &&
                      state.date.month() > 2 &&
                      state.date.month() < 10
                    ) {
                      updateState((state) => {
                        state.date = state.date.set('month', 0)
                      })
                    } else if (
                      e.target.value === 'summer' &&
                      !(state.date.month() <= 2 && state.date.month() > 9)
                    ) {
                      updateState((state) => {
                        state.date = state.date.set('month', 7)
                      })
                    }
                  }}
                >
                  <Radio.Button value="winter">
                    ❄️ Winter (January)
                  </Radio.Button>
                  <Radio.Button value="summer">☀️ Summer (July)</Radio.Button>
                </Radio.Group>
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="Rate Plan" required>
            <Row gutter={16} align="middle">
              <Col span={14}>
                <RatePlanSelector
                  byDate={state.date}
                  value={ratePlanSelected}
                  onChange={(e) =>
                    setSearchParams((prev) => {
                      prev.set(RATE_PLAN_QUERY_PARAM, e)
                      return prev
                    })
                  }
                />
              </Col>
              <Col>
                <Link to={`/detail/${ratePlanSelected}`}>Details</Link>
              </Col>
            </Row>
          </Form.Item>
          <Form.Item label="Other Rate Plan">
            <Row gutter={16} align="middle">
              <Col span={14}>
                <RatePlanSelector
                  byDate={state.date}
                  value={ratePlan2Selected}
                  onChange={(e) =>
                    setSearchParams((prev) => {
                      prev.set(RATE_PLAN_2_QUERY_PARAM, e)
                      return prev
                    })
                  }
                />
              </Col>
              <Col>
                <Link to={`/detail/${ratePlan2Selected}`}>Details</Link>
              </Col>
            </Row>
          </Form.Item>

          <Form.Item label="Electricity Use Pattern">
            <Segmented
              value={state.region}
              onChange={(value) =>
                updateState((state) => {
                  state.region = value
                })
              }
              options={usuageSparklines}
            />
          </Form.Item>
        </Form>
      </div>
      <SeasonBlurb region={state.region} season={season} />
      {season === 'winter' ? (
        <>
          <div>
            <h3>Winter Insights</h3>
            <ul>
              <li>
                <strong>Peak Usage:</strong> Texas shows 50-75% higher peak
                demand than New England due to electric heating
              </li>
              <li>
                <strong>EV Impact:</strong> California's overnight charging adds
                6-7 kW but occurs during off-peak hours
              </li>
              <li>
                <strong>Grid Impact:</strong> Electric heating creates sustained
                evening loads that challenge grid capacity
              </li>
              <li>
                <strong>Cost Advantage:</strong> California EV charging happens
                when rates are lowest (overnight)
              </li>
            </ul>
          </div>
        </>
      ) : (
        <>
          <div>
            <h3>Summer Insights</h3>
            <ul>
              <li>
                <strong>Texas Crisis:</strong> Summer peaks can reach 12+ kW per
                home during heat waves—higher than winter
              </li>
              <li>
                <strong>Peak Timing:</strong> AC loads peak 2-8pm, exactly when
                solar production drops and grid stress is highest
              </li>
              <li>
                <strong>New England Flip:</strong> Now shows electric load for
                cooling, but still moderate vs. Texas extremes
              </li>
              <li>
                <strong>California Strategy:</strong> EV owners can use TOU
                rates effectively—charge at night, minimize AC during peak
              </li>
            </ul>
          </div>
        </>
      )}
      <Row gutter={36}>
        {ratePlan && (
          <Col span={6}>
            <RatePlanSummary
              ratePlan={ratePlan}
              usage={usagePlan1}
              energyUsage={energyUsage}
            />
          </Col>
        )}
        {ratePlan2 && (
          <Col span={6}>
            <RatePlanSummary
              ratePlan={ratePlan2}
              usage={usagePlan2}
              energyUsage={energyUsage}
            />
          </Col>
        )}
      </Row>
    </div>
  )
}

function SeasonBlurb({
  season,
  region,
}: {
  season: SynthData['season']
  region: SynthData['region']
}) {
  const key = `${season}/${region}` as const

  const capitalSeason = capitalize(season)

  switch (key) {
    case 'winter/New England':
      return (
        <div>
          <h3>{capitalSeason} in New England (Gas Heat)</h3>
          <p>
            Two distinct peaks for cooking and activities. No heating load on
            electric grid since homes use natural gas or oil furnaces.
          </p>
        </div>
      )
    case 'winter/Texas':
      return (
        <div>
          <h3>Texas (Electric Heat)</h3>
          <p>
            Higher overall usage with elevated morning and evening peaks. Many
            homes use electric heat pumps or resistance heating.
          </p>
        </div>
      )
    case 'winter/Southern California':
      return (
        <div>
          <h3>Southern California + EV</h3>
          <p>
            Minimal heating needs create flat daytime profile. Large overnight
            spike from EV charging (7.2 kW Level 2 charger).
          </p>
        </div>
      )
    case 'summer/New England':
      return (
        <div>
          <h3>New England (Moderate AC)</h3>
          <p>
            Afternoon AC load creates new peak (1-8pm). Less extreme than
            heating season since gas furnaces don't help in summer.
          </p>
        </div>
      )
    case 'summer/Texas':
      return (
        <div>
          <h3>Texas (Extreme Cooling)</h3>
          <p>
            Massive cooling loads dominate. Peak usage 2-3x higher than winter
            as AC runs continuously during brutal heat.
          </p>
        </div>
      )
    case 'summer/Southern California':
      return (
        <div>
          <h3>Southern California + EV</h3>
          <p>
            Moderate afternoon AC peak plus overnight EV charging. Mild climate
            keeps cooling needs reasonable.
          </p>
        </div>
      )
  }
}

function Sparkline({
  season,
  region,
  selected,
  targetUsage,
}: {
  season: SynthData['season']
  region: SynthData['region']
  selected: boolean
  targetUsage?: number
}) {
  const { data: synthData } = useSynthData({ season, region, targetUsage })

  // Vega-Lite specification
  const spec: VegaEmbedProps['spec'] = {
    $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
    width: 160,
    height: 150,
    data: { values: synthData ?? [] },
    transform: [
      {
        calculate: 'datetime(0, 0, 1,datum.hour, 0, 0, 0)',
        as: 'datetime',
      },
    ],
    mark: {
      type: 'bar',
      point: false,
      strokeWidth: 3,
      interpolate: 'natural',
      color: selected ? undefined : 'lightgray',
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
  useVegaEmbed({
    ref: chartRef,
    spec,
    options: { mode: 'vega-lite', actions: false },
  })

  return (
    <div style={{ width: 200 }}>
      <div ref={chartRef} />
      <div>{region} </div>
    </div>
  )
}

export default RegionalElectricityPatterns
