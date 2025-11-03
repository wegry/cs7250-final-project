import { USURDB_NAME } from './duckdb'
import type { SynthData } from './schema'

const usurdbName = `${USURDB_NAME}.usurdb`
/** For select list */
export const selectList = `
  SELECT
    label, name, utility
  FROM ${usurdbName}
  ORDER BY
    utility ASC
    , name ASC
    , startdate DESC NULLS LAST
    , enddate DESC NULLS FIRST
`

export const ratePlanInData = (label: string) => `SELECT 1 FROM ${usurdbName}
 WHERE label = '${label}'
 LIMIT 1`

export const ratePlanDetail = (label: string) => `select * from ${usurdbName}
  WHERE label = '${label}'`

export const all = `select * from ${usurdbName}`

type SynthItem = SynthData[number]

export const synthUsage = (
  season: SynthItem['season'],
  region: SynthItem['region']
) => `SELECT season, hour, region, usage_kw
          FROM flattened.synthetic_usage
          WHERE
            season = '${season}' AND
            region = '${region}'
          ORDER BY season, hour, region`
