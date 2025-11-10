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
            return obj["$date"]
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

conn = duckdb.connect("json.duckdb")
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

conn.execute("ALTER TABLE usurdb ALTER eiaid SET DATA TYPE UHUGEINT")
conn.execute("ALTER TABLE usurdb ALTER flatdemandmonths SET DATA TYPE UTINYINT[12]")
