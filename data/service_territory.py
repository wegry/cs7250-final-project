"""Script to add balancingAuthority column to existing DuckDB database."""

import polars as pl

import duckdb
from pathlib import Path
from tempfile import NamedTemporaryFile


def load_ba_assignments() -> pl.DataFrame:
    """Load BA assignments from EIA-861 Utility Data file."""
    UTILITY_DATA = Path("raw") / "eia-861-2024" / "Service_Territory_2024.xlsx"

    df = pl.read_excel(UTILITY_DATA)

    print(df)

    return df


if __name__ == "__main__":
    print("Adding balancingAuthority column to existing database...")

    # Load BA assignments
    df = load_ba_assignments()

    # Connect to database
    con = duckdb.connect("../app/public/flattened.duckdb")

    f = NamedTemporaryFile("w")
    # Clean and write each document

    df.write_json(f.name)

    con.execute(
        f"""
    CREATE OR REPLACE TABLE eia861_service_territory AS
    SELECT * FROM read_json('{f.name}')"""
    )

    con.close()
    print("\n✅ Done!")
