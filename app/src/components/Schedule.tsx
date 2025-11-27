import { Card } from 'antd'
import { VegaEmbed } from 'react-vega'
import type { TopLevelSpec } from 'vega-lite'
import { interpolateViridis } from 'd3-scale-chromatic'
import { RatePlan } from '../data/schema'
import type { Dayjs } from 'dayjs'

// Generate n evenly-spaced colors from viridis
function getViridisColors(n: number): string[] {
  if (n === 1) return [interpolateViridis(0.5)]
  return Array.from({ length: n }, (_, i) => interpolateViridis(i / (n - 1)))
}

// Get all unique periods from a schedule
function getUniquePeriods(schedule: number[][] | null): Set<number> {
  if (!schedule) return new Set()
  return new Set(schedule.flat())
}

// Transform schedule array to Vega-Lite data format
function transformScheduleForVega(schedule: number[][] | null): Array<{
  month: string
  monthOrder: number
  hour: number
  period: string
}> {
  if (!schedule) return []
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ]
  const data: Array<{
    month: string
    monthOrder: number
    hour: number
    period: string
  }> = []

  for (let m = 0; m < schedule.length; m++) {
    for (let h = 0; h < (schedule[m]?.length || 0); h++) {
      data.push({
        month: months[m],
        monthOrder: m,
        hour: h,
        period: String(schedule[m][h]),
      })
    }
  }
  return data
}

// Create Vega-Lite spec for schedule heatmap
function createScheduleSpec(
  title: string,
  data: ReturnType<typeof transformScheduleForVega>,
  colorScale: { domain: string[]; range: string[] }
): TopLevelSpec {
  return {
    $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
    title: title,
    width: 400,
    height: 200,
    mark: { type: 'rect', stroke: 'white' },
    data: { values: data },
    encoding: {
      x: {
        field: 'hour',
        type: 'ordinal',
        title: 'Hour of Day',
        axis: {
          labelAngle: 0,
        },
        sort: Array.from({ length: 24 }, (_, i) => i),
      },
      y: {
        field: 'month',
        type: 'ordinal',
        title: null,
        sort: [
          'Jan',
          'Feb',
          'Mar',
          'Apr',
          'May',
          'Jun',
          'Jul',
          'Aug',
          'Sep',
          'Oct',
          'Nov',
          'Dec',
        ],
      },
      color: {
        field: 'period',
        type: 'ordinal',
        title: 'Period',
        scale: colorScale,
      },
      tooltip: [
        { field: 'month', title: 'Month' },
        { field: 'hour', title: 'Hour' },
        { field: 'period', title: 'Period' },
      ],
    },
    config: {
      axis: { grid: false },
      view: { stroke: null },
    },
  }
}

interface HeatmapProps {
  schedule: number[][] | null
  title?: string
  colorScale: { domain: string[]; range: string[] }
}

function Heatmap({ schedule, title = 'Schedule', colorScale }: HeatmapProps) {
  const data = transformScheduleForVega(schedule)
  const spec = createScheduleSpec(title, data, colorScale)

  return (
    <Card>
      <VegaEmbed spec={spec} options={{ mode: 'vega-lite', actions: false }} />
    </Card>
  )
}

export function ScheduleHeatmap({
  selectedPlan,
  type,
}: {
  selectedPlan?: RatePlan | null
  date: Dayjs
  type: 'energy' | 'demand'
}) {
  if (!selectedPlan) {
    return null
  }

  const schedules = (['Weekday', 'Weekend'] as const).map(
    (weekPart) => selectedPlan[`${type}${weekPart}Sched`]
  )
  const title = type === 'energy' ? 'Energy Schedule' : 'Demand Schedule'

  if (schedules.every((s) => s == null)) {
    return null
  }

  // Compute combined unique periods across all schedules
  const allPeriods = new Set<number>()
  schedules.forEach((s) => {
    getUniquePeriods(s).forEach((p) => allPeriods.add(p))
  })
  const sortedPeriods = [...allPeriods].sort((a, b) => a - b)

  // Generate shared color scale
  const colors = getViridisColors(sortedPeriods.length)
  const colorScale = {
    domain: sortedPeriods.map(String),
    range: colors,
  }

  // Single schedule case (weekday === weekend)
  if (
    schedules[0] &&
    JSON.stringify(schedules[0]) === JSON.stringify(schedules[1])
  ) {
    if (sortedPeriods.length === 1) {
      return null
    }
    return (
      <Heatmap
        schedule={schedules[0]}
        title={'All Week ' + title}
        colorScale={colorScale}
      />
    )
  }

  // Separate weekday/weekend schedules
  return (
    <>
      {schedules.map((schedule, i) => (
        <Heatmap
          key={i}
          schedule={schedule}
          title={(i === 0 ? 'Weekday' : 'Weekend') + ' ' + title}
          colorScale={colorScale}
        />
      ))}
    </>
  )
}
