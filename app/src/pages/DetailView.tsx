import {
  Button,
  Card,
  Col,
  Collapse,
  DatePicker,
  Descriptions,
  type DescriptionsProps,
  Form,
  Popover,
  Row,
} from 'antd'
import clsx from 'clsx'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { RatePlanSelector } from '../components/RatePlanSelector'
import { useRateSupercededBy } from '../hooks/useRateInPlanData'
import { useRatePlan } from '../hooks/useRatePlan'
import * as s from './DetailView.module.css'

import dayjs from 'dayjs'
import { EnergyRateChart, TiersChart } from '../charts/energyRateStructure'
import {
  CoincidentRateChart,
  DemandRateChart,
  DemandTierRateChart,
  FlatDemandChart,
} from '../charts/otherRateStructures'
import { RatePlanTimeline } from '../components/RatePlanTimeline'
import { useMemo } from 'react'
import { ScheduleHeatmap } from '../components/Schedule'

const DATE_PARAM = 'date'

export default function DetailView() {
  const { id: ratePlanParam } = useParams()
  const [params, setParams] = useSearchParams()
  const date = dayjs(params.get(DATE_PARAM) || '2025-10-01')
  const { data: selectedPlan, isLoading: selectedPlanLoading } =
    useRatePlan(ratePlanParam)

  const { data: supercededBy } = useRateSupercededBy(ratePlanParam)

  const nav = useNavigate()

  const handleRatePlanChange = async (value: string) => {
    nav(`/detail/${value}`)
  }

  const descriptions = useMemo(() => {
    return [
      { label: 'Utility Name', children: selectedPlan?.utilityName },
      {
        label: 'Rate Name',
        children: selectedPlan?.rateName,
        span: { md: 3, lg: 2 },
      },

      {
        label: 'Supercedes',
        children: selectedPlan?.supercedes ? (
          <Link
            className={s.supercedes}
            to={`/detail/${selectedPlan?.supercedes}`}
          >
            {selectedPlan?.supercedes}
          </Link>
        ) : (
          <>&mdash;</>
        ),
      },
      {
        label: 'Superceded By',
        children: supercededBy?.[0]?._id ? (
          <Link className={s.supercedes} to={`/detail/${supercededBy[0]._id}`}>
            {supercededBy[0]._id}
          </Link>
        ) : (
          <>&mdash;</>
        ),
      },
      {
        label: 'Is Default?',
        children: selectedPlan?.is_default === true ? 'Yes' : 'No',
      },
      {
        label: 'Source',
        children: selectedPlan?.sourceReference ? (
          <a
            href={selectedPlan?.sourceReference!}
            style={{ whiteSpace: 'nowrap' }}
          >
            Link
          </a>
        ) : (
          <>&mdash;</>
        ),
      },
      {
        label: 'Source Parent',
        children: selectedPlan?.sourceParent ? (
          <a href={selectedPlan.sourceParent} style={{ whiteSpace: 'nowrap' }}>
            Link
          </a>
        ) : (
          <>&mdash;</>
        ),
      },
      {
        label: 'Description',
        children: selectedPlan?.description ? (
          <Popover
            content={
              <div className={s.copy}>
                <p>{selectedPlan.description}</p>
              </div>
            }
            trigger="click"
          >
            <Button>Click me</Button>
          </Popover>
        ) : (
          <>&mdash;</>
        ),
      },
    ] satisfies DescriptionsProps['items']
  }, [selectedPlan, supercededBy])

  return (
    <main className={s.main}>
      <Form layout="horizontal" className={s.form}>
        <Row gutter={16} className={s.header}>
          <Col>
            <h1>Details</h1>
          </Col>
          <Col span={15}>
            <Form.Item label="Rate Plan" className={s.noMargin}>
              <RatePlanSelector
                value={ratePlanParam}
                onChange={handleRatePlanChange}
              />
            </Form.Item>
          </Col>
          <Col>
            <Button
              href={`https://apps.openei.org/USURDB/rate/view/${selectedPlan?._id}`}
            >
              View on USURDB
            </Button>
          </Col>
        </Row>
        <Row>
          <Col>
            <Collapse
              className={s.meta}
              defaultActiveKey={1}
              items={[
                {
                  key: 1,
                  label: 'Rate Plan Metadata',
                  children: <Descriptions items={descriptions} size="small" />,
                },
              ]}
            />
          </Col>
        </Row>
        <Row gutter={24}>
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
        <ScheduleHeatmap
          selectedPlan={selectedPlan}
          date={date}
          type="energy"
          onDateChange={(newDate) => {
            setParams((params) => {
              params.set(DATE_PARAM, newDate.format('YYYY-MM-DD'))
              return params
            })
          }}
        />
        <EnergyRateChart selectedPlan={selectedPlan} date={date} />
        <TiersChart selectedPlan={selectedPlan} date={date} />
        <CoincidentRateChart selectedPlan={selectedPlan} date={date} />
        <ScheduleHeatmap
          selectedPlan={selectedPlan}
          date={date}
          type={'demand'}
          onDateChange={(newDate) => {
            setParams((params) => {
              params.set(DATE_PARAM, newDate.format('YYYY-MM-DD'))
              return params
            })
          }}
        />
        <DemandRateChart selectedPlan={selectedPlan} date={date} />
        <DemandTierRateChart selectedPlan={selectedPlan} date={date} />
        <FlatDemandChart selectedPlan={selectedPlan} date={date} />
        <Card>
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
        </Card>
      </div>
      <Col sm={10} md={10} lg={6}>
        <RatePlanTimeline ratePlan={selectedPlan} />
      </Col>
    </main>
  )
}
