import json
from datetime import datetime
from pathlib import Path
import duckdb
import pyarrow as pyarrow
from tempfile import NamedTemporaryFile


def clean_mongo_json(obj):
    """Recursively clean MongoDB Extended JSON"""
    if isinstance(obj, dict):
        # Handle MongoDB ObjectId
        if "$oid" in obj:
            return obj["$oid"]
        # Handle MongoDB Date
        elif "$date" in obj:
            date_val = obj["$date"]
            # Handle nested $numberLong in $date
            if isinstance(date_val, dict) and "$numberLong" in date_val:
                ms = int(date_val["$numberLong"])
                return datetime.utcfromtimestamp(ms / 1000).isoformat()
            elif isinstance(date_val, str):
                return date_val  # Already an ISO string
            return date_val
        # Handle other MongoDB types as needed
        elif "$numberLong" in obj:
            return int(obj["$numberLong"])
        else:
            return {k: clean_mongo_json(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [clean_mongo_json(item) for item in obj]
    return obj


# Load and clean the data
with open(Path("raw") / "usurdb.json", "r") as f:
    data = json.load(f)

f = NamedTemporaryFile("w")
for doc in data:
    # Clean and write each document
    cleaned = clean_mongo_json(doc)
    f.write(json.dumps(cleaned) + "\n")

conn = duckdb.connect("../app/public/flattened.duckdb")
# DuckDB can handle nested JSON structures
conn.execute(
    f"""
    CREATE OR REPLACE TABLE usurdb AS
    SELECT * FROM read_ndjson_auto('{f.name}',
    -- union_by_name=true,
    sample_size=-1
    ) WHERE sector = 'Residential'
"""
)

for col in [
    "energyWeekdaySched",
    "energyWeekendSched",
    "demandWeekdaySched",
    "demandWeekendSched",
    "coincidentSched",
]:
    conn.execute(
        f"ALTER TABLE usurdb ALTER {col} SET DATA TYPE UTINYINT[24][12];",
    )

conn.execute("ALTER TABLE usurdb ALTER eiaid SET DATA TYPE BIGINT")
conn.execute("ALTER TABLE usurdb ALTER flatdemandmonths SET DATA TYPE UTINYINT[12]")
for col in ["effectiveDate", "endDate", "endDate_1"]:
    try:
        conn.execute(f"ALTER TABLE usurdb ALTER {col} SET DATA TYPE datetime")
    except Exception as e:
        print(f"Failed on {col}")
        raise e


rate_columns = {
    "coincidentRateStrux": "coincidentRateTiers",
    "demandRateStrux": "demandRateTiers",
    "flatDemandStrux": "flatDemandTiers",
    "energyRateStrux": "energyRateTiers",
}

# Build the SELECT clause with flattened columns
flatten_clauses = [
    f"list_transform({strux_col}, x -> x.{tier_col}) as {strux_col.replace('Strux', '_tiers')}"
    for strux_col, tier_col in rate_columns.items()
]

query = f"""
CREATE OR REPLACE TABLE usurdb AS
SELECT
    *,
    {''',
    '''.join(flatten_clauses)}
FROM usurdb
"""

conn.execute(query)

conn.execute(
    """
ALTER TABLE usurdb
ALTER COLUMN flatDemand_tiers
TYPE STRUCT(rate DOUBLE, max DOUBLE, adj DOUBLE)[][]
             """
)
