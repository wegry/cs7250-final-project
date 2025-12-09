import * as duckdb from "@duckdb/duckdb-wasm";
import duckdb_wasm from "@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url";
import mvp_worker from "@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url";
import duckdb_wasm_eh from "@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url";
import eh_worker from "@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url";

const MANUAL_BUNDLES: duckdb.DuckDBBundles = {
  mvp: {
    mainModule: duckdb_wasm,
    mainWorker: mvp_worker,
  },
  eh: {
    mainModule: duckdb_wasm_eh,
    mainWorker: eh_worker,
  },
};
let c = Promise.withResolvers<duckdb.AsyncDuckDBConnection>();
let dbInstance: duckdb.AsyncDuckDB;

export const conn = c.promise;

async function init() {
  const bundle = await duckdb.selectBundle(MANUAL_BUNDLES);
  // Instantiate the asynchronous version of DuckDB-wasm
  const worker = new Worker(bundle.mainWorker!);
  const logger = new duckdb.ConsoleLogger(duckdb.LogLevel.WARNING);
  // Initialize database
  const db = new duckdb.AsyncDuckDB(logger, worker);
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker);

  dbInstance = db; 

  try {
    const conn = await db.connect();
    await db.registerFileURL(
      "flattened",
      window.location.origin + "/flattened.duckdb",
      duckdb.DuckDBDataProtocol.HTTP,
      true,
    );
    await db.registerFileURL(
      "county-data.geojson",
      window.location.origin + "/geodata/county-data.geojson",
      duckdb.DuckDBDataProtocol.HTTP,
      false,
    );
    await db.registerFileURL(
      "COUNTY_ZIP_122023.csv",
      window.location.origin + "/COUNTY_ZIP_122023.csv",
      duckdb.DuckDBDataProtocol.HTTP,
      false,
    );
    await conn.query(`ATTACH 'flattened' AS flattened (READ_ONLY)`);

    c.resolve(conn);
  } catch (e) {
    c.reject(e);
  }
}
init();

export async function get_query(q: string) {
  console.debug(q);
  const results = await (await conn).query(q);
  return results;
}
