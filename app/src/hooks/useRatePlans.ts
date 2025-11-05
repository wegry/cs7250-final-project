import { useQuery } from '@tanstack/react-query'
import { get_query } from '../data/duckdb'
import { RatePlanSelect } from '../data/schema'
import * as queries from '../data/queries'
import type { Dayjs } from 'dayjs'

async function fetchRatePlans(byDate?: Dayjs) {
  let raw
  if (!byDate) {
    raw = await get_query(queries.selectList)
  } else {
    raw = await queries.selectListForDate(byDate)
  }
  const { data, error } = RatePlanSelect.safeParse(raw.toArray())

  if (error) {
    console.error(error)
  }

  console.log(byDate?.format(), data?.length)

  return data
}

export function useRatePlans(byDate?: Dayjs) {
  return useQuery({
    queryKey: ['ratePlans', byDate],
    queryFn: () => fetchRatePlans(byDate),
  })
}
