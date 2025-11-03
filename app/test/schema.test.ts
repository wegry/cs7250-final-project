import { beforeAll, expect, test } from 'vitest'
import { RatePlanArray } from '../src/data/schema'
import * as duckdb from '@duckdb/node-api'

let instance,
  ratePlans = Promise.withResolvers()

// Helper to convert DuckDB Node timestamps to Dates
function normalizeDuckDBRow(row: any) {
  const normalized = { ...row }
  for (const [key, value] of Object.entries(normalized)) {
    if (
      key.endsWith('date') &&
      value != null &&
      typeof value === 'object' &&
      'micros' in value &&
      typeof value?.micros === 'bigint'
    ) {
      // Convert microseconds to Date
      normalized[key] = new Date(Number(value?.micros / 1000n))
    }
  }
  return normalized
}

beforeAll(async () => {
  instance = await duckdb.DuckDBInstance.create('../data/flattened.duckdb')
  const conn = await instance.connect()
  const result = await conn.runAndReadAll(`SELECT * FROM flattened.usurdb`)
  const rows = result.getRowObjects()
  ratePlans.resolve(rows.map(normalizeDuckDBRow))
})

test('Schema parses on all USURDB records', async () => {
  const plans = await ratePlans.promise
  expect(plans.length).toBe(1577)
  expect(RatePlanArray.parse(plans)).toBeDefined()
})
