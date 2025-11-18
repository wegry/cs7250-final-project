import * as z from 'zod'
import { useQuery } from '@tanstack/react-query'
import * as queries from '../data/queries'
async function fetchRatePlanInData(label?: string | null) {
  const ratePlanInData = await queries.ratePlanInData(label ?? '')

  const { data, error } = z
    .preprocess(
      (arg: unknown) =>
        arg != null &&
        typeof arg == 'object' &&
        'toArray' in arg &&
        arg.toArray instanceof Function
          ? arg.toArray()
          : arg,
      z.array(z.unknown())
    )
    .safeParse(ratePlanInData)

  if (error) {
    console.error(error)
  }

  return Boolean(data?.[0])
}

async function fetchSupercededBy(label?: string | null) {
  const superceders = await queries.supercededBy(label ?? 'fake')

  const { data, error } = z
    .preprocess(
      (arg: unknown) =>
        arg != null &&
        typeof arg == 'object' &&
        'toArray' in arg &&
        arg.toArray instanceof Function
          ? arg.toArray()
          : arg,
      z.array(z.object({ _id: z.string() }))
    )
    .safeParse(superceders)

  if (error) {
    console.error(error)
  }

  return data
}

export function useRatePlanInData(label?: string | null) {
  return useQuery({
    queryKey: ['ratePlan', 'exists', label ?? null],
    queryFn: () => fetchRatePlanInData(label),
  })
}

export function useRateSupercededBy(label?: string | null) {
  return useQuery({
    queryKey: ['ratePlan', 'supercededBy', label ?? null],
    queryFn: () => fetchSupercededBy(label),
  })
}
