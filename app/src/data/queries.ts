import { conn } from './duckdb'
import type { SynthData } from './schema'

/** For select list */
export const selectList = `
  SELECT
    label, name, utility
  FROM flattened.usurdb
  ORDER BY
    utility ASC
    , name ASC
    , startdate DESC NULLS LAST
    , enddate DESC NULLS FIRST
`

export async function ratePlanInData(label: string) {
  const stmt = await (
    await conn
  ).prepare(`SELECT true FROM flattened.usurdb
 WHERE label = ?
 LIMIT 1`)
  const result = await stmt.query(label)
  return result
}

export async function ratePlanDetail(label: string) {
  const stmt = await (
    await conn
  ).prepare(`select * from flattened.usurdb
  WHERE label = ?`)

  const result = await stmt.query(label)
  return result
}

export const all = `select * from flattened.usurdb`

type SynthItem = SynthData[number]

export async function synthUsage(
  season: SynthItem['season'],
  region: SynthItem['region']
) {
  const stmt = await (
    await conn
  ).prepare(`SELECT season, hour, region, usage_kw
          FROM flattened.synthetic_usage
          WHERE
            season = ? AND
            region = ?
          ORDER BY season, hour, region`)

  return await stmt.query(season, region)
}
