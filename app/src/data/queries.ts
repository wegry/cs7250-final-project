import { USURDB_NAME } from './duckdb'

const tableName = `${USURDB_NAME}.usurdb`
/** For select list */
export const selectList = `
  SELECT
    label, name, utility
  FROM ${tableName}
  ORDER BY
    utility ASC
    , name ASC
    , startdate DESC NULLS LAST
    , enddate DESC NULLS FIRST
`

export const ratePlanDetail = (label: string) => `select * from ${tableName}
  WHERE label = '${label}'`

export const all = `select * from ${tableName}`
