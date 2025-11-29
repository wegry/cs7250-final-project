import { useCallback, useRef, useEffect } from 'react'
import { Card } from 'antd'
import { VegaEmbed } from 'react-vega'
import type { Result } from 'vega-embed'
import type { TopLevelSpec } from 'vega-lite'
import { interpolateViridis } from 'd3-scale-chromatic'
import { RatePlan } from '../data/schema'
import dayjs, { type Dayjs } from 'dayjs'

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

// Find the first weekday (Mon-Fri) or weekend day (Sat-Sun) of a given month
function getFirstDayOfType(
  year: number,
  month: number, // 0-indexed
  type: 'weekday' | 'weekend'
): Dayjs {
  const firstOfMonth = dayjs().year(year).month(month).date(1)
  const dayOfWeek = firstOfMonth.day() // 0 = Sunday, 6 = Saturday

  if (type === 'weekend') {
    // Find first Saturday (6) or Sunday (0)
    if (dayOfWeek === 0 || dayOfWeek === 6) return firstOfMonth
    // Days until Saturday
    const daysUntilSat = 6 - dayOfWeek
    return firstOfMonth.add(daysUntilSat, 'day')
  } else {
    // Find first weekday (Mon-Fri, i.e., 1-5)
    if (dayOfWeek >= 1 && dayOfWeek <= 5) return firstOfMonth
    // Sunday -> add 1 day to get Monday
    if (dayOfWeek === 0) return firstOfMonth.add(1, 'day')
    // Saturday -> add 2 days to get Monday
    return firstOfMonth.add(2, 'day')
  }
}

// Transform schedule array to Vega-Lite data format
function transformScheduleForVega(schedule: number[][] | null): {
  data: Array<{
    month: string
    monthIndex: number
    hour?: number
    period: string
  }>
  hasHourlyVariation: boolean
} {
  if (!schedule) return { data: [], hasHourlyVariation: false }

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

  // Check if any month has variation across hours
  const hasHourlyVariation = schedule.some((monthData) => {
    if (!monthData || monthData.length === 0) return false
    const firstValue = monthData[0]
    return monthData.some((v) => v !== firstValue)
  })

  const data: Array<{
    month: string
    monthIndex: number
    hour?: number
    period: string
  }> = []

  if (hasHourlyVariation) {
    for (let m = 0; m < schedule.length; m++) {
      for (let h = 0; h < (schedule[m]?.length || 0); h++) {
        data.push({
          month: months[m]!,
          monthIndex: m,
          hour: h,
          period: String(schedule[m]?.[h]),
        })
      }
    }
  } else {
    // Collapse to one entry per month
    for (let m = 0; m < schedule.length; m++) {
      if (schedule[m] && schedule[m]?.length) {
        data.push({
          month: months[m]!,
          monthIndex: m,
          period: String(schedule[m]?.[0]),
        })
      }
    }
  }

  return { data, hasHourlyVariation }
}

// Create Vega-Lite spec for schedule heatmap
function createScheduleSpec(
  title: string,
  data: ReturnType<typeof transformScheduleForVega>['data'],
  colorScale: { domain: string[]; range: string[] },
  interactive: boolean,
  hasHourlyVariation: boolean
): TopLevelSpec {
  const monthSort = [
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

  const spec: TopLevelSpec = {
    $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
    title,
    width: hasHourlyVariation ? 400 : 40,
    height: 200,
    data: { values: data },
    params: interactive
      ? [
          {
            name: 'cellClick',
            select: { type: 'point', on: 'click', fields: ['monthIndex'] },
          },
        ]
      : [],
    mark: {
      type: 'rect',
      stroke: 'white',
      cursor: interactive ? 'pointer' : 'default',
    },
    encoding: {
      y: {
        field: 'month',
        type: 'ordinal',
        title: null,
        sort: monthSort,
      },
      color: {
        field: 'period',
        type: 'ordinal',
        title: 'Period',
        scale: colorScale,
      },
      tooltip: hasHourlyVariation
        ? [
            { field: 'month', title: 'Month' },
            { field: 'hour', title: 'Hour' },
            { field: 'period', title: 'Period' },
          ]
        : [
            { field: 'month', title: 'Month' },
            { field: 'period', title: 'Period' },
          ],
      ...(hasHourlyVariation
        ? {
            x: {
              field: 'hour',
              type: 'ordinal',
              title: 'Hour of Day',
              axis: { labelAngle: 0, bandPosition: 0 },
              sort: Array.from({ length: 24 }, (_, i) => i),
            },
          }
        : {}),
    },
    config: {
      axis: { grid: false },
      view: { stroke: null },
    },
  }

  return spec
}

interface HeatmapProps {
  schedule: number[][] | null
  title?: string
  colorScale: { domain: string[]; range: string[] }
  onCellClick?: (monthIndex: number) => void
}

function Heatmap({
  schedule,
  title = 'Schedule',
  colorScale,
  onCellClick,
}: HeatmapProps) {
  const { data, hasHourlyVariation } = transformScheduleForVega(schedule)
  const periodsInData = new Set(data.map((d) => d.period))
  const filteredColorScale = {
    domain: colorScale.domain.filter((p) => periodsInData.has(p)),
    range: colorScale.domain.flatMap((p, i) => {
      const color = colorScale.range[i]
      if (periodsInData.has(p) && color) {
        return [color]
      }

      return []
    }),
  }
  const spec = createScheduleSpec(
    title,
    data,
    filteredColorScale,
    !!onCellClick,
    hasHourlyVariation
  )
  const resultRef = useRef<Result | null>(null)
  const callbackRef = useRef(onCellClick)

  // Keep callback ref up to date
  useEffect(() => {
    callbackRef.current = onCellClick
  }, [onCellClick])

  const handleEmbed = useCallback((result: Result) => {
    resultRef.current = result
    if (!callbackRef.current) return

    result.view.addSignalListener('cellClick', (_name, value) => {
      const monthIndex = value?.monthIndex?.[0]
      if (monthIndex !== undefined && callbackRef.current) {
        callbackRef.current(monthIndex)
      }
    })
  }, [])

  return (
    <Card>
      <VegaEmbed
        spec={spec}
        options={{ actions: false }}
        onEmbed={handleEmbed}
      />
    </Card>
  )
}

export function ScheduleHeatmap({
  selectedPlan,
  date,
  type,
  onDateChange,
}: {
  selectedPlan?: RatePlan | null
  date: Dayjs
  type: 'energy' | 'demand'
  onDateChange?: (newDate: Dayjs) => void
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

  const handleCellClick = (
    monthIndex: number,
    dayType: 'weekday' | 'weekend'
  ) => {
    if (!onDateChange) return
    const newDate = getFirstDayOfType(date.year(), monthIndex, dayType)
    onDateChange(newDate)
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
        onCellClick={
          onDateChange ? (m) => handleCellClick(m, 'weekday') : undefined
        }
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
          onCellClick={
            onDateChange
              ? (m) => handleCellClick(m, i === 0 ? 'weekday' : 'weekend')
              : undefined
          }
        />
      ))}
    </>
  )
}
