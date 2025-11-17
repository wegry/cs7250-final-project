import { Col, DatePicker, Form, Row, Select } from 'antd'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useImmer } from 'use-immer'
import { RatePlanSelector } from '../components/RatePlanSelector'
import { useRatePlanInData } from '../hooks/useRateInPlanData'
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
  const { data: selectedPlan } = useRatePlan(ratePlanParam)

  const { data: supercedesExistsInData } = useRatePlanInData(
    selectedPlan?.supercedes
  )
  const [state, updateState] = useImmer<State>({
    adjustedIncluded: true,
    wholesale: 'New England',
  })
  const { data: wholesaleData } = useWholesaleData(state.wholesale, date)
  const preparedWholesale = prepareWholesaleData(wholesaleData)

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

        {supercedesExistsInData && (
          <div>
            Supercedes{' '}
            <Link to={`/detail/${selectedPlan?.supercedes}`}>
              {selectedPlan?.supercedes}{' '}
            </Link>
          </div>
        )}
      </Form>

      <EnergyRateChart
        selectedPlan={selectedPlan}
        date={date}
        wholesaleData={preparedWholesale}
      />
      <TiersChart selectedPlan={selectedPlan} date={date} />
      <CoincidentRateChart selectedPlan={selectedPlan} date={date} />
      <DemandRateChart selectedPlan={selectedPlan} date={date} />
      <FlatDemandChart selectedPlan={selectedPlan} date={date} />
      <RatePlanTimeline ratePlan={selectedPlan} />
    </main>
  )
}
