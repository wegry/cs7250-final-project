import { useQuery } from '@tanstack/react-query'
import { get_query } from '../data/duckdb'
import { RatePlanSelect } from '../data/schema'
import * as queries from '../data/queries'

async function fetchRatePlans() {
  const result = await get_query(queries.selectList)
  return RatePlanSelect.parse(result.toArray())
}

export function useRatePlans() {
  return useQuery({
    queryKey: ['ratePlans'],
    queryFn: fetchRatePlans,
    staleTime: Infinity,
  })
}

async function fetchRatePlanInData(label?: string | null) {
  const ratePlanInData = await get_query(queries.ratePlanInData(label ?? ''))
  return ratePlanInData.toArray()[0] ?? false
}

export function useRatePlanInData(label?: string | null) {
  return useQuery({
    queryKey: ['ratePlan', 'exists', label ?? null],
    queryFn: () => fetchRatePlanInData(label),
    staleTime: Infinity,
  })
}
