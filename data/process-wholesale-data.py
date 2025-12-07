import polars as pl
from pathlib import Path

df = pl.read_excel(
    [
        Path("raw") / "wholesale" / f"ice_electric-202{year}final.xlsx"
        for year in range(0, 6)
    ]
)
df = df.rename({"Delivery \r\nend date": "Delivery end date"})

import duckdb

con = duckdb.connect("../app/public/flattened.duckdb")

# Or use DuckDB's register method for zero-copy
con.register("raw_wholesale", df)
con.execute("CREATE OR REPLACE TABLE wholesale AS SELECT * FROM raw_wholesale")
