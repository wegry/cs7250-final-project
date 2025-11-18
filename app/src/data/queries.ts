import type { Dayjs } from 'dayjs'
import { conn } from './duckdb'
import { WholesalePrice, type SynthData } from './schema'

/** For select list */
export const selectList = `
  SELECT
    _id as value
    , concat_ws('/', utilityName, rateName, _id) as label
  FROM flattened.usurdb
  ORDER BY
    utilityName ASC
    , rateName ASC
    , effectiveDate DESC NULLS LAST
    , enddate DESC NULLS FIRST
`
export async function selectListForDate(date: Dayjs) {
  const stmt = await (
    await conn
  ).prepare(`
  SELECT
    _id as value
    , concat_ws('/', utilityName, rateName, _id) as label
  FROM flattened.usurdb
  WHERE
    (enddate IS NULL OR
      (enddate IS NOT NULL AND enddate >= ?)
    ) AND
    (effectiveDate IS NULL OR
      (effectiveDate IS NOT NULL AND effectiveDate <= ?)
    )
  ORDER BY
    utilityName ASC
    , rateName ASC
    , effectiveDate DESC NULLS LAST
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

export async function supercededBy(label: string) {
  const stmt = await (
    await conn
  ).prepare(`SELECT _id FROM flattened.usurdb
 WHERE supercedes = ?
 ORDER BY effectiveDate DESC
 LIMIT 1`)
  const result = await stmt.query(label)
  return result
}

export async function ratePlanInData(label: string) {
  const stmt = await (
    await conn
  ).prepare(`SELECT true FROM flattened.usurdb
 WHERE _id = ?
 LIMIT 1`)
  const result = await stmt.query(label)
  return result
}

export async function ratePlanDetail(label: string) {
  const stmt = await (
    await conn
  ).prepare(`select * from flattened.usurdb
  WHERE _id = ?`)

  const result = await stmt.query(label)
  return result
}

export async function synthUsage(
  season: SynthData['season'],
  region: SynthData['region'],
  targetUsage?: number
) {
  const stmt = await (
    await conn
  ).prepare(`
    WITH monthly_totals AS (
        SELECT
            season,
            region,
            SUM(usage_kw) * 30 as month_total_kwh
        FROM flattened.synthetic_usage
        WHERE season = $1 AND region = $2
        GROUP BY season, region
    )
    SELECT
        s.season,
        s.hour,
        s.region,
        (s.usage_kw / mt.month_total_kwh) * COALESCE($3, mt.month_total_kwh) as usage_kw
    FROM flattened.synthetic_usage s
    JOIN monthly_totals mt ON s.season = mt.season AND s.region = mt.region
    WHERE s.season = $1 AND s.region = $2
    ORDER BY s.season, s.hour, s.region
`)

  return await stmt.query(season, region, targetUsage)
}

// Hub mapping constant
export const HUB_DICT = {
  Midwest: 'Indiana Hub RT Peak',
  Northwest: 'Mid C Peak',
  'New England': 'Nepool MH DA LMP Peak',
  'Northern California': 'NP15 EZ Gen DA LMP Peak',
  'Southwest (Excluding Cali)': 'Palo Verde Peak',
  'PJM/Mid-Atlantic': 'PJM WH Real Time Peak',
  'Southern California': 'SP15 EZ Gen DA LMP Peak',
} as const

// Sample DuckDB query for wholesale data
const WHOLESALE_QUERY = `
  SELECT
    "Price hub",
    "Trade date",
    "High price $/MWh",
    "Low price $/MWh",
    "Wtd avg price $/MWh"
  FROM flattened.wholesale
  WHERE "Price hub" = ?
    AND "Trade date" = ?
  ORDER BY "Trade date" DESC
  LIMIT 1
`

// Example usage with DuckDB-WASM
export async function getWholesalePrices(
  hub: keyof typeof HUB_DICT,
  targetDate: string
): Promise<WholesalePrice | null> {
  const hubName = HUB_DICT[hub]

  try {
    const c = await conn
    const stmt = await c.prepare(WHOLESALE_QUERY)
    const result = await stmt.query(hubName, targetDate)
    const rows = result.toArray()

    if (rows.length === 0) {
      // Try to get next available date
      const futureQuery = `
        SELECT
          "Price hub",
          "Trade date",
          "High price $/MWh",
          "Low price $/MWh",
          "Wtd avg price $/MWh"
        FROM flattened.wholesale
        WHERE "Price hub" = ?
          AND "Trade date" > ?
        ORDER BY "Trade date" ASC
        LIMIT 1
      `
      const futureResult = await (
        await c.prepare(futureQuery)
      ).query(hubName, targetDate)
      const futureRows = futureResult.toArray()

      if (futureRows.length === 0) return null
      return WholesalePrice.parse(futureRows[0])
    }

    return WholesalePrice.parse(rows[0])
  } catch (error) {
    console.error('Error querying wholesale prices:', error)
    return null
  }
}
