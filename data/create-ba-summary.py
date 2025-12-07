"""Get data for each balancing authority.

This version reads the utility -> balancing-authority mapping from the
existing DuckDB `usurdb` table (auto-detecting a likely BA column) and
no longer relies on the Excel file. The script still writes
`app/public/ba-summary.json` and does not modify the DB.
"""

import json
import duckdb
from collections import defaultdict

# Note: this script no longer relies on a hard-coded BA -> zone mapping.
# It reads the BA(s) for each utility from the `utility_data.ba` column in
# the DuckDB `flattened.duckdb` and aggregates counts by that BA value.
import os

# Resolve duckdb path relative to this script so the script can be run from any CWD
DB_PATH = os.path.join(os.path.dirname(__file__), "../app/public/flattened.duckdb")

# Connect to DuckDB
con = duckdb.connect(DB_PATH, read_only=True)

# Build mapping info (zone list, aliases and normalization helper) so we can
# normalize BA values from `utility_data` before aggregating.
ZONE_LIST = [
    "US-CAL-CISO",
    "US-CAL-IID",
    "US-CAL-LDWP",
    "US-CAL-TIDC",
    "US-CAL-BANC",
    "US-CAR-CPLE",
    "US-CAR-CPLW",
    "US-CAR-DUK",
    "US-CAR-SC",
    "US-CAR-SCEG",
    "US-CENT-SPA",
    "US-CENT-SWPP",
    "US-FLA-FMPP",
    "US-FLA-FPC",
    "US-NW-NWMT",
    "US-FLA-GVL",
    "US-FLA-HST",
    "US-FLA-JEA",
    "US-SW-WALC",
    "US-FLA-SEC",
    "US-FLA-TAL",
    "US-FLA-TEC",
    "US-MIDA-PJM",
    "US-MIDW-AECI",
    "US-MIDW-MISO",
    "US-MIDW-LGEE",
    "US-NE-ISNE",
    "US-NW-AVA",
    "US-NW-BPAT",
    "US-NW-CHPD",
    "US-NW-DOPD",
    "US-NW-GCPD",
    "US-SW-AZPS",
    "US-NW-IPCO",
    "US-NW-NEVP",
    "US-FLA-FPL",
    "US-NW-PACE",
    "US-NW-PACW",
    "US-NW-PGE",
    "US-NW-PSCO",
    "US-NW-PSEI",
    "US-NW-TPWR",
    "US-NW-WACM",
    "US-NW-WAUW",
    "US-NY-NYIS",
    "US-SE-SOCO",
    "US-SW-EPE",
    "US-SW-SRP",
    "US-SW-PNM",
    "US-SW-TEPC",
    "US-TEN-TVA",
    "US-TEX-ERCO",
    "US-NW-SCL",
]

# Build mapping where key is the short code (last segment) and value is full id
ba_mapping = {z.split("-")[-1]: z for z in ZONE_LIST}
# Add explicit alias for BANC which may appear as a raw short code
ba_mapping["BANC"] = "US-CAL-BANC"
# Add concrete aliases for common short codes / variants we expect in the DB
ba_mapping.update(
    {
        "ISONE": "US-NE-ISNE",
        "NYISO": "US-NY-NYIS",
        "ERCOT": "US-TEX-ERCO",
    }
)

# Build reverse mapping (full zone id -> short key) for normalization
full_to_short = {v: k for k, v in ba_mapping.items()}


def normalize_ba_raw(val: str) -> str | None:
    if val is None:
        return None
    s = str(val).strip()
    if not s:
        return None
    up = s.upper()
    if up in ba_mapping:
        return up
    if s in full_to_short:
        return full_to_short[s]
    if up in full_to_short:
        return full_to_short[up]
    if "-" in s:
        seg = s.split("-")[-1].upper()
        if seg in ba_mapping:
            return seg
    if "ERCOT" in up or "TEX" in up:
        return "ERCOT"
    if "NY" in up and "ISO" in up:
        return "NYISO"
    if "ISO" in up and "NE" in up:
        return "ISONE"
    return None


rows = con.execute(
    "SELECT eiaId, ba FROM utility_data WHERE eiaId IS NOT NULL"
).fetchall()

utility_ba_map = {}
for eia_id, ba_vals in rows:
    try:
        key = int(eia_id)
    except Exception:
        key = eia_id
    if not ba_vals:
        continue
    # ba_vals may be a list/tuple (ARRAY); take first element if so
    if isinstance(ba_vals, (list, tuple)):
        ba_raw = ba_vals[0] if len(ba_vals) > 0 else None
    else:
        ba_raw = ba_vals
    if ba_raw is None:
        continue
    norm = normalize_ba_raw(ba_raw)
    if norm is None:
        # store raw as fallback (keeps original string), but normalization preferred
        utility_ba_map[key] = str(ba_raw)
    else:
        utility_ba_map[key] = norm

print(f"Found {len(utility_ba_map)} utilities with BA mapping from utility_data")

# Query utility data from DuckDB
query = """
SELECT
    eiaId,
    utilityName,
    COUNT(*) as num_rate_plans
FROM usurdb
WHERE
eiaId IS NOT NULL
AND
(
    effectiveDate <= CURRENT_DATE AND (endDate IS NULL OR endDate >= CURRENT_DATE)
)
GROUP BY eiaId, utilityName
"""

results = con.execute(query).fetchall()

# Group by balancing authority
ba_data = {}
for row in results:
    eia_id, utility_name, num_plans = row

    # coerce key the same way we built utility_ba_map
    try:
        key = int(eia_id)
    except Exception:
        key = eia_id

    if key in utility_ba_map:
        ba = utility_ba_map[key]
        if ba not in ba_data:
            ba_data[ba] = {
                "name": ba,
                "zoneName": ba_mapping.get(ba),
                "utilities": [],
                "totalPlans": 0,
            }
        ba_data[ba]["utilities"].append(utility_name)
        ba_data[ba]["totalPlans"] += num_plans

for ba in ba_data.values():
    ba["numUtilities"] = len(ba["utilities"])

# Create summary list from discovered BA values
ba_summary = []
for ba_code, v in ba_data.items():
    v["numUtilities"] = len(v["utilities"])
    ba_summary.append(v)

OUT_PATH = os.path.normpath(
    os.path.join(os.path.dirname(__file__), "..", "app", "public", "ba-summary.json")
)
os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
with open(OUT_PATH, "w") as f:
    json.dump(ba_summary, f, indent=2)

print(f"✅ Created ba-summary.json with {len(ba_summary)} balancing authorities")
print(f"   Found data for {len(ba_data)} BAs")
print("\nBalancing authorities with data:")
for ba in ba_summary:
    if ba["numUtilities"] > 0:
        print(
            f"  {ba['name']:30} ({ba['numUtilities']} utilities, {ba['totalPlans']} plans)"
        )

con.close()
