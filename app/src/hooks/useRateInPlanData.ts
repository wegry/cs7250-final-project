import * as z from 'zod'
import { useQuery } from '@tanstack/react-query'
import * as queries from '../data/queries'
async function fetchRatePlanInData(label?: string | null) {
  const ratePlanInData = await queries.ratePlanInData(label ?? '')

  const { data, error } = z
    .array(z.object())
    .optional()
    .safeParse(ratePlanInData.toArray())

  if (error) {
    console.error(error)
  }

  return Boolean(data?.[0])
}

export function useRatePlanInData(label?: string | null) {
  return useQuery({
    queryKey: ['ratePlan', 'exists', label ?? null],
    queryFn: () => fetchRatePlanInData(label),
  })
}
