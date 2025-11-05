import type { Dayjs } from 'dayjs'
import { conn } from './duckdb'
import type { SynthData } from './schema'

/** For select list */
export const selectList = `
  SELECT
    label as value
    , concat_ws('/', utility, name, label) as label
  FROM flattened.usurdb
  ORDER BY
    utility ASC
    , name ASC
    , startdate DESC NULLS LAST
    , enddate DESC NULLS FIRST
`
export async function selectListForDate(date: Dayjs) {
  const stmt = await (
    await conn
  ).prepare(`
  SELECT
    label as value
    , concat_ws('/', utility, name, label) as label
  FROM flattened.usurdb
  WHERE
    (enddate IS NULL OR
      (enddate IS NOT NULL AND enddate >= ?)
    ) AND
    (startdate IS NULL OR
      (startdate IS NOT NULL AND startdate <= ?)
    )
  ORDER BY
    utility ASC
    , name ASC
    , startdate DESC NULLS LAST
    , enddate DESC NULLS FIRST
  `)

  const formattedDate = date.format()

  /**
   * `@duckdb/wasm` doesn't support named prepared statements.
   * https://github.com/duckdb/duckdb/discussions/11782
   */
  const result = await stmt.query(formattedDate, formattedDate)
  return result
}

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

export async function synthUsage(
  season: SynthData['season'],
  region: SynthData['region']
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
