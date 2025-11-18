import { Col, DatePicker, Form, Row, Select } from 'antd'
import clsx from 'clsx'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useImmer } from 'use-immer'
import { RatePlanSelector } from '../components/RatePlanSelector'
import { useRateSupercededBy } from '../hooks/useRateInPlanData'
import { useRatePlan } from '../hooks/useRatePlan'
import * as s from './DetailView.module.css'

import dayjs from 'dayjs'
import {
  EnergyRateChart,
  prepareWholesaleData,
  TiersChart,
} from '../charts/energyRateStructure'
import {
  CoincidentRateChart,
  DemandRateChart,
  DemandTierRateChart,
  FlatDemandChart,
} from '../charts/otherRateStructures'
import { RatePlanTimeline } from '../components/RatePlanTimeline'
import { HUB_DICT } from '../data/queries'
import { useWholesaleData } from '../hooks/useWholesaleData'

interface State {
  adjustedIncluded: boolean
  wholesale: keyof typeof HUB_DICT
}

const DATE_PARAM = 'date'

export default function DetailView() {
  const { id: ratePlanParam } = useParams()
  const [params, setParams] = useSearchParams()
  const date = dayjs(params.get(DATE_PARAM) || undefined)
  const { data: selectedPlan, isLoading: selectedPlanLoading } =
    useRatePlan(ratePlanParam)

  const [state, updateState] = useImmer<State>({
    adjustedIncluded: true,
    wholesale: 'New England',
  })
  const { data: wholesaleData } = useWholesaleData(state.wholesale, date)
  const preparedWholesale = prepareWholesaleData(wholesaleData)
  const { data: supercededBy } = useRateSupercededBy(ratePlanParam)

  const nav = useNavigate()

  const handleRatePlanChange = async (value: string) => {
    nav(`/detail/${value}`)
  }

  return (
    <main className={s.main}>
      <h1>Details</h1>

      <Form layout="horizontal" className={s.form}>
        <Row>
          <Col span={16}>
            <Form.Item label="Rate Plan">
              <RatePlanSelector
                value={ratePlanParam}
                onChange={handleRatePlanChange}
              />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={24}>
          <Col span={8}>
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
          </Col>
          <Col>
            <Form.Item label="For Date">
              <DatePicker
                allowClear={false}
                value={date}
                onChange={(e) =>
                  setParams((params) => {
                    params.set(DATE_PARAM, e.format('YYYY-MM-DD'))
                    return params
                  })
                }
              />
            </Form.Item>
          </Col>
        </Row>
      </Form>

      <div
        className={clsx(s.charts, { [s.chartLoading]: selectedPlanLoading })}
      >
        <EnergyRateChart
          selectedPlan={selectedPlan}
          date={date}
          wholesaleData={preparedWholesale}
        />
        <TiersChart selectedPlan={selectedPlan} date={date} />
        <CoincidentRateChart selectedPlan={selectedPlan} date={date} />
        <DemandRateChart selectedPlan={selectedPlan} date={date} />
        <DemandTierRateChart selectedPlan={selectedPlan} date={date} />
        <FlatDemandChart selectedPlan={selectedPlan} date={date} />
      </div>
      <div className={s.supercedesRow}>
        <Row gutter={16}>
          <Col className={s.supercedes}>
            Supercedes{' '}
            {selectedPlan?.supercedes ? (
              <Link to={`/detail/${selectedPlan?.supercedes}`}>
                {selectedPlan?.supercedes}
              </Link>
            ) : (
              '\u00A0'.repeat('569d8d215457a38b683910b8'.length)
            )}
          </Col>
          <Col className={s.supercedes}>
            Superceded by{' '}
            {supercededBy?.[0] ? (
              <Link to={`/detail/${supercededBy?.[0]?._id}`}>
                {supercededBy?.[0]?._id}
              </Link>
            ) : (
              '\u00A0'.repeat('569d8d215457a38b683910b8'.length)
            )}
          </Col>
        </Row>
      </div>
      <Row style={{ marginTop: '24px' }}>
        <Col>
          <div
            style={{
              border: '1px solid #d9d9d9',
              padding: '8px',
              borderRadius: '4px',
              width: '400px',
            }}
          >
            <div
              style={{
                width: '384px',
                height: '250px',
                backgroundColor: '#f0f0f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              role="img"
              aria-label="Map of United States showing counties served by this utility highlighted in color against a base map"
            >
              <span
                style={{
                  color: '#999',
                  textAlign: 'center',
                  display: 'block',
                  padding: '8px',
                  maxWidth: '92%',
                  lineHeight: 1.4,
                }}
              >
                Map of United States showing counties served by this utility
                highlighted in color against a base map
              </span>
            </div>
            <p
              style={{
                textAlign: 'center',
                marginTop: '8px',
                marginBottom: '0',
                color: '#666',
              }}
            >
              Counties covered by Utility
            </p>
          </div>
        </Col>
      </Row>
      <Col sm={10} md={10} lg={6}>
        <RatePlanTimeline ratePlan={selectedPlan} />
      </Col>
    </main>
  )
}
