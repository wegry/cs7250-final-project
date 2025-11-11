import { orderBy } from 'es-toolkit'
import { useMemo } from 'react'
import type { RatePlan } from '../data/schema'
import { Timeline } from 'antd'

export function RatePlanTimeline({ ratePlan }: { ratePlan?: RatePlan | null }) {
  const timelineEntries = useMemo(() => {
    const values = Object.entries({
      'Plan End': { date: ratePlan?.endDate, color: 'red' },
      'Effective Date': { date: ratePlan?.effectiveDate, color: 'green' },
      'Last Update': { date: ratePlan?.latest_update, color: 'gray' },
    }).concat(
      ratePlan?.revisions?.map((x, i) => [
        `Revision ${i + 1}`,
        { color: 'gray', ...x },
      ]) ?? []
    )
    return orderBy(values, [([k, v]) => v.date], ['desc']).flatMap(([k, v]) => {
      if (v.date == null) {
        return []
      }
      return {
        label: k,
        children: v.date.format('ll'),
        color: v.color,
      }
    })
  }, [ratePlan])

  return (
    timelineEntries.length > 0 && (
      <>
        <h4>Timeline</h4>
        <Timeline mode="left" items={timelineEntries} />
      </>
    )
  )
}
