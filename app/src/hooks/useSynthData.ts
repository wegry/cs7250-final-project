import { useQuery } from '@tanstack/react-query'
import { SynthDataArray, type SynthData } from '../data/schema'
import { synthUsage } from '../data/queries'

async function getSynthdata(
  season: SynthData['season'],
  region: SynthData['region']
) {
  const result = await synthUsage(season, region)

  const { data, error } = SynthDataArray.safeParse(result.toArray())

  if (error) {
    console.error(error)
  }

  return data
}
export function useSynthData({
  season,
  region,
}: {
  season: SynthData['season']
  region: SynthData['region']
}) {
  return useQuery({
    queryFn: () => getSynthdata(season, region),
    queryKey: ['synthusage', season, region],
  })
}
