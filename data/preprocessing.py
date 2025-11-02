import marimo

__generated_with = "0.17.6"
app = marimo.App()


@app.cell
def _():
    import marimo as mo
    import polars as pl
    return mo, pl


@app.cell
def _(mo):
    mo.md(r"""
    Since our project is focusing on retail electricity pricing systems across the US, I started with the 2024 _EIA 861_ report. Specifically Dynamic Pricing 2024. There are five program types:

    - Time of Use Pricing
    - Real Time Pricing
    - Variable Peak Pricing
    - Critical Peak Pricing
    - Critical Peak Rebate

    We want rows where there is a Y in residential for one of these 5 program types.
    """)
    return


@app.cell
def _(pl):
    def get_dynamic_pricing():
        DYNAMIC_PRICING = "data/raw/eia-861-2024/Dynamic_Pricing_2024.xlsx"

        df = pl.read_excel(
            DYNAMIC_PRICING,
            has_header=False,
            read_options={"skip_rows": 0, "n_rows": 3},
        )

        # Get the three header rows and squish them into 1
        row0 = df.row(
            0
        )  # Main groups: "Utility Characteristics", "Number of Customers Enrolled", etc.
        row1 = df.row(1)  # Sub-groups: "Residential", "Commercial", etc.
        row2 = df.row(2)  # Leaf headers: "Date", "Utility Name", etc.

        # Build combined column names
        combined_headers = []
        current_main = ""
        current_sub = ""

        for i in range(len(row0)):
            # Update main category if present
            if row0[i] and str(row0[i]).strip():
                current_main = str(row0[i]).strip()

            # Update sub-category if present
            if row1[i] and str(row1[i]).strip():
                current_sub = str(row1[i]).strip()

            # Build the column name
            leaf = str(row2[i]).strip() if row2[i] else ""

            parts = []
            if current_main and current_main != leaf:
                parts.append(current_main)
            if current_sub and current_sub != leaf:
                parts.append(current_sub)
            if leaf:
                parts.append(leaf)

            combined_headers.append("->".join(parts) if parts else f"col_{i}")

        combined_headers

        df = pl.read_excel(
            DYNAMIC_PRICING, has_header=False, read_options={"skip_rows": 3}
        )

        df.columns = combined_headers

        return df


    dynamic_pricing = get_dynamic_pricing()
    return (dynamic_pricing,)


@app.cell
def _(dynamic_pricing):
    dynamic_pricing
    return


@app.cell
def _(dynamic_pricing, pl):
    import polars.selectors as cs

    utilities = dynamic_pricing.select(
        cs.starts_with("Utility"), cs.ends_with("Residential")
    ).filter(pl.any_horizontal(cs.ends_with("Residential") == "Y"))

    utilities.select(
        "Utility Characteristics->Utility Name",
        "Utility Characteristics->Utility Number",
    ).write_json("data/dynamically-priced-eiads.json")

    utilities
    return


@app.cell
def _(pl):
    rates = (
        pl.read_csv("data/raw/usurdb.csv", infer_schema_length=10000)
        .filter((pl.col("sector") == "Residential"))
        .with_columns(
            # These columns are being inferred as str
            pl.col("startdate").str.to_datetime(
                "%Y-%m-%d %H:%M:%S", time_unit="us", time_zone="UTC"
            ),
            pl.col("enddate").str.to_datetime(
                "%Y-%m-%d %H:%M:%S", time_unit="us", time_zone="UTC"
            ),
            pl.col("latest_update").str.to_datetime(
                "%Y-%m-%d %H:%M:%S", time_unit="us", time_zone="UTC"
            ),
            pl.col("eiaid").cast(pl.Int64),
            pl.col("demandweekdayschedule")
            .str.json_decode(pl.List(pl.List(pl.Int64)))
            .cast(pl.Array(pl.Int8, shape=(12, 24))),
            pl.col("demandweekendschedule")
            .str.json_decode(pl.List(pl.List(pl.Int64)))
            .cast(pl.Array(pl.Int8, shape=(12, 24))),
            pl.col("energyweekdayschedule")
            .str.json_decode(pl.List(pl.List(pl.Int64)))
            .cast(pl.Array(pl.Int8, shape=(12, 24))),
            pl.col("energyweekendschedule")
            .str.json_decode(pl.List(pl.List(pl.Int64)))
            .cast(pl.Array(pl.Int8, shape=(12, 24))),
        )
    )

    rates
    return (rates,)


@app.cell
def _(mo):
    mo.md(r"""
    There is a some overlap between the various plans in USURDB. The `supersedes` field seems to show which of the plans should take precedence. There are also multiple plans that could be in effect in our target years.
    """)
    return


@app.cell
def _(pl, rates):
    from deepdiff import diff

    ipco = rates.filter(
        pl.col("utility").str.contains("Idaho Power")
        & pl.col("name").str.contains("Time-of-Day")
        & pl.col("enddate").is_null()
    )

    print(ipco)

    diff.DeepDiff(ipco.row(1, named=True), ipco.row(2, named=True))
    return


@app.cell
def _(mo):
    mo.md(r"""
    We want to only pull those utilities with Residential dynamic pricing programs based on the EIA 861 Dynamic Pricing form.
    """)
    return


@app.cell
def _(pl):
    dynamic_priced_utilities = pl.read_json("data/dynamically-priced-eiads.json")

    eiads = set(
        dynamic_priced_utilities[
            "Utility Characteristics->Utility Number"
        ].to_list()
    )

    pl.DataFrame(dynamic_priced_utilities)
    return


@app.cell
def _(mo):
    mo.md(r"""
    Our project is interested in data for 2024 onward. Filtering out

    - `enddate`s that are null or end prior to 2024
    - columns where every value is empty (~725 columns down to 368)

    narrows things down. Questions:

    - How do know what state to which each plan applies? USURDB doesn't seem to have this information. EIA 861's _Utility Data_ form has which states the utility operates in (which might be all we have to go on)
    - How can we filter down the matching `eiaid`s to just dynamic pricing plans?
    """)
    return


@app.cell
def _(pl, rates):
    ends_after_start_of_2024 = (
        rates
        # filter out utilities without Dynamic Pricing
        # .filter(pl.col("eiaid").is_in(eiads))
        .filter(
            (
                pl.col("enddate").is_null()
                | (pl.col("enddate") >= pl.lit("2024-01-01").str.to_date())
            )
            & (
                (pl.col("startdate") >= pl.lit("2024-01-01").str.to_date())
                | (pl.col("startdate").is_null())
            )
        )
    )

    ends_after_start_of_2024 = (
        ends_after_start_of_2024
        # Remove totally empty columns as well
        .select(
            [
                col
                for col in ends_after_start_of_2024.columns
                if ends_after_start_of_2024[col].null_count()
                < len(ends_after_start_of_2024)
            ]
        )
    )

    ## Save USURDB in sqlite format.
    ends_after_start_of_2024.write_parquet("data/data.parquet")

    ends_after_start_of_2024
    return (ends_after_start_of_2024,)


@app.cell
def _(ends_after_start_of_2024, pl):
    import json
    import numpy as np

    ends_after_start_of_2024.select(
        "name",
        "utility",
        "startdate",
        "enddate",
        "latest_update",
        "energyweekdayschedule",
    ).filter(pl.col("energyweekdayschedule").is_not_null())
    return (json,)


@app.cell
def _(ends_after_start_of_2024):
    import re

    pattern = (
        r"(energyrate|demandrate|flatdemand)structure/period(\d+)/tier(\d+)(.*)"
    )

    data_structure = {}
    for col in ends_after_start_of_2024.columns:
        match = re.match(pattern, col)
        if match:
            kind, period, tier, _unit = match.groups()
            kind_key = kind
            period_key = f"period{period}"
            tier_key = f"tier{tier}"
            if kind_key not in data_structure:
                data_structure[kind_key] = {}

            if period_key not in data_structure[kind_key]:
                data_structure[kind_key][period_key] = {}
            if tier_key not in data_structure[kind_key][period_key]:
                data_structure[kind_key][period_key][tier_key] = {}

            data_structure[kind_key][period_key][tier_key][_unit] = col
    return data_structure, re


@app.cell
def _(data_structure, ends_after_start_of_2024, json, pl, re):
    import pyarrow as pa


    def row_to_nested_map(row, data_structure):
        """Convert row to nested dict, excluding nulls"""
        result = {}
        for kind_name, kinds in data_structure.items():
            kind_data = {}
            for period_name, tiers in kinds.items():
                period_data = {}
                for tier_name, units in tiers.items():
                    tier_data = {}
                    for unit, col_name in units.items():
                        val = row[col_name]
                        if val is not None:
                            # Some floats are encoded as strings for whatever reason
                            if (
                                unit in ["adj", "rate"]
                                and isinstance(val, str)
                                and re.match("^(\d+\.\d+)$", val)
                            ):
                                tier_data[unit.lstrip("/")] = float(val)
                            else:
                                tier_data[unit.lstrip("/")] = val
                    if tier_data:  # Only include tier if it has data
                        period_data[tier_name] = tier_data
                if period_data:
                    kind_data[period_name] = period_data
            if kind_data:
                result[kind_name] = kind_data
                # if len(kind_data.keys()) >= 2:
                #     print(kind_data)
                #     print(row["label"])

        return result


    # Convert to nested dicts
    nested_data = [
        json.dumps(row_to_nested_map(row, data_structure))
        for row in ends_after_start_of_2024.iter_rows(named=True)
    ]

    cols_to_drop = []
    for kind_name, kinds in data_structure.items():
        for period_name, tiers in kinds.items():
            for tier_name, units in tiers.items():
                for unit, col_name in units.items():
                    cols_to_drop.append(col_name)

    # Remove duplicates
    cols_to_drop = set(cols_to_drop)

    # Add new column and drop the source columns
    df_final = ends_after_start_of_2024.with_columns(
        pl.Series("ratestructure", nested_data)
    ).drop(cols_to_drop)

    # df_final.write_parquet("data/flattened_rates.parquet")

    import duckdb

    con = duckdb.connect("data/flattened.duckdb")

    # Or use DuckDB's register method for zero-copy
    con.register("usurdb", df_final)
    con.execute("CREATE OR REPLACE TABLE usurdb AS SELECT * FROM usurdb")

    con.close()

    df_final
    return


if __name__ == "__main__":
    app.run()
