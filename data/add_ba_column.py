"""Script to add balancingAuthority column to existing DuckDB database."""

import polars as pl
import json

from typing import Dict
import duckdb
from pathlib import Path
from tempfile import NamedTemporaryFile


def load_ba_assignments() -> Dict[int, str]:
    """Load BA assignments from EIA-861 Utility Data file."""
    UTILITY_DATA = "raw/eia-861-2024/Utility_Data_2024.xlsx"

    df = pl.read_excel(UTILITY_DATA, has_header=False, read_options={"skip_rows": 2})

    ba_map = {}

    for row in df.iter_rows(named=False):
        utility_num = row[1]
        if utility_num is None:
            continue

        try:
            utility_id = int(utility_num)
        except (ValueError, TypeError):
            continue

        ba = []
        if row[14] == "Y":
            ba.append("CISO")
        if row[15] == "Y":
            ba.append("ERCOT")
        if row[16] == "Y":
            ba.append("PJM")
        if row[17] == "Y":
            ba.append("NYISO")
        if row[19] == "Y":
            ba.append("MISO")
        if row[20] == "Y":
            ba.append("ISONE")

        if ba:
            ba_map[utility_id] = ba

    print(f"✅ Loaded {len(ba_map)} BA assignments from EIA-861 data")
    return ba_map


if __name__ == "__main__":
    print("Adding balancingAuthority column to existing database...")

    # Load BA assignments
    ba_assignments = load_ba_assignments()

    # Connect to database
    con = duckdb.connect("flattened.duckdb")

    f = NamedTemporaryFile("w")
    # Clean and write each document
    f.write(json.dumps([dict(eiaId=key, ba=ba) for key, ba in ba_assignments.items()]))

    con.execute(
        f"""
    CREATE OR REPLACE TABLE utility_data AS
    SELECT *, 2024 as year FROM read_json('{f.name}')"""
    )

    con.close()
    print("\n✅ Done!")
