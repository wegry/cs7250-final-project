import * as z from 'zod'
import { useQuery } from '@tanstack/react-query'
import { SynthDataArray, type SynthData } from '../data/schema'
import { synthUsage } from '../data/queries'

async function getSynthdata(
  season: SynthData['season'],
  region: SynthData['region'],
  targetUsage?: number
) {
  const result = await synthUsage(season, region, targetUsage)

  const { data, error } = SynthDataArray.safeParse(result.toArray())

  if (error) {
    console.error(error)
  }
  console.log(data)

  return data
}
export function useSynthData({
  season,
  region,
  targetUsage,
}: {
  season: SynthData['season']
  region: SynthData['region']
  targetUsage?: number
}) {
  return useQuery({
    queryFn: () => getSynthdata(season, region, targetUsage),
    queryKey: ['synthusage', season, region, targetUsage],
  })
}
