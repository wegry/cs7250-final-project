import marimo

__generated_with = "0.16.5"
app = marimo.App()


@app.cell
def _():
    import marimo as mo
    import polars as pl
    return mo, pl


@app.cell
def _(mo):
    mo.md(
        r"""
    Since our project is focusing on retail electricity pricing systems across the US, I started with the 2024 _EIA 861_ report. Specifically Dynamic Pricing 2024. There are five program types:

    - Time of Use Pricing
    - Real Time Pricing
    - Variable Peak Pricing
    - Critical Peak Pricing
    - Critical Peak Rebate

    We want rows where there is a Y in residential for one of these 5 program types.
    """
    )
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
    ).filter(
        pl.any_horizontal(cs.ends_with("Residential") == "Y")
        & (pl.col("Utility Characteristics->BA Code") == "PJM")
    )

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
            pl.col("startdate").str.to_datetime("%Y-%m-%d %H:%M:%S"),
            pl.col("enddate").str.to_datetime("%Y-%m-%d %H:%M:%S"),
            pl.col("latest_update").str.to_datetime("%Y-%m-%d %H:%M:%S"),
            pl.col("eiaid").cast(pl.Int64),
            pl.col("demandweekdayschedule").str.json_decode(
                pl.List(pl.List(pl.Int64))
            ),
            pl.col("demandweekendschedule").str.json_decode(
                pl.List(pl.List(pl.Int64))
            ),
            pl.col("energyweekdayschedule").str.json_decode(
                pl.List(pl.List(pl.Int64))
            ),
            pl.col("energyweekendschedule").str.json_decode(
                pl.List(pl.List(pl.Int64))
            ),
        )
    )

    rates
    return (rates,)


@app.cell
def _(mo):
    mo.md(
        r"""There is a some overlap between the various plans in USURDB. The `supersedes` field seems to show which of the plans should take precedence. There are also multiple plans that could be in effect in our target years."""
    )
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
    mo.md(
        r"""We want to only pull those utilities with Residential dynamic pricing programs based on the EIA 861 Dynamic Pricing form."""
    )
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
    return (eiads,)


@app.cell
def _(mo):
    mo.md(
        r"""
    Our project is interested in data for 2024 onward. Filtering out 

    - `enddate`s that are null or end prior to 2024
    - columns where every value is empty (~725 columns down to 368)

    narrows things down. Questions:

    - How do know what state to which each plan applies? USURDB doesn't seem to have this information. EIA 861's _Utility Data_ form has which states the utility operates in (which might be all we have to go on)
    - How can we filter down the matching `eiaid`s to just dynamic pricing plans?
    """
    )
    return


@app.cell
def _(eiads, pl, rates):
    ends_after_start_of_2024 = (
        rates.filter(pl.col("eiaid").is_in(eiads))
        .filter(
            pl.col("enddate").is_null()
            | (pl.col("enddate") >= pl.lit("2024-01-01").str.to_date())
        )
        # Remove totally empty columns as well
        .select(
            [col for col in rates.columns if rates[col].null_count() < len(rates)]
        )
    )
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
    return


if __name__ == "__main__":
    app.run()
