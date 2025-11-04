import * as duckdb from '@duckdb/duckdb-wasm'
import duckdb_wasm from '@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url'
import mvp_worker from '@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url'
import duckdb_wasm_eh from '@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url'
import eh_worker from '@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url'

const MANUAL_BUNDLES: duckdb.DuckDBBundles = {
  mvp: {
    mainModule: duckdb_wasm,
    mainWorker: mvp_worker,
  },
  eh: {
    mainModule: duckdb_wasm_eh,
    mainWorker: eh_worker,
  },
}
// Select a bundle based on browser checks
const bundle = await duckdb.selectBundle(MANUAL_BUNDLES)
// Instantiate the asynchronous version of DuckDB-wasm
const worker = new Worker(bundle.mainWorker!)
const logger = new duckdb.ConsoleLogger(duckdb.LogLevel.WARNING)
const db = new duckdb.AsyncDuckDB(logger, worker)
await db.instantiate(bundle.mainModule, bundle.pthreadWorker)

export const USURDB_NAME = 'flattened'

// Setup and connect to the database
// Initialize database
const conn = Promise.withResolvers<duckdb.AsyncDuckDBConnection>()

async function init() {
  try {
    const c = await db.connect()
    await c.query(
      `ATTACH '${window.location.origin + '/flattened.duckdb'}' AS flattened (READ_ONLY)`
    )
    conn.resolve(c)
  } catch (e) {
    conn.reject(e)
  }
}
init()

export async function get_query(q: string) {
  console.debug(q)
  const results = (await conn.promise).query(q)
  return results
}
