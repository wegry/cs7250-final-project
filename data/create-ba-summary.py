"""Get data for each balancing authority."""
import json
import openpyxl
import duckdb

# Map short BA codes to full zone names from GeoJSON
BA_ZONE_MAPPING = {
    "CISO": "US-CAL-CISO",
    "ISONE": "US-NE-ISNE", 
    "BPAT": "US-NW-BPAT",
    "MISO": "US-MIDW-MISO",
    "NYISO": "US-NY-NYIS",
    "PJM": "US-MIDA-PJM",
    "SOCO": "US-SE-SOCO",
    "TVA": "US-TEN-TVA",
    "ERCOT": "US-TEX-ERCO",
    "SPP": "US-CENT-SWPP",
    "DUK": "US-CAR-DUK",
    "SCEG": "US-CAR-SCEG",
    "FPL": "US-FLA-FPL",
    "PACW": "US-NW-PACW",
    "AZPS": "US-SW-AZPS",
    "SRP": "US-SW-SRP",
}

# Read Excel file to get utility to BA mapping
wb = openpyxl.load_workbook('raw/eia-861-2024/Utility_Data_2024.xlsx')
ws = wb.active

utility_ba_map = {}
for row in ws.iter_rows(min_row=3, values_only=True):  # Skip header rows
    if row[1]:  # Utility Number
        utility_num = row[1]
        # Columns: 14=CAISO, 15=ERCOT, 16=PJM, 17=NYISO, 19=MISO, 20=ISONE
        ba = None
        if row[14] == 'Y':
            ba = 'CISO'
        elif row[15] == 'Y':
            ba = 'ERCOT'
        elif row[16] == 'Y':
            ba = 'PJM'
        elif row[17] == 'Y':
            ba = 'NYISO'
        elif row[19] == 'Y':
            ba = 'MISO'
        elif row[20] == 'Y':
            ba = 'ISONE'
        
        if ba:
            utility_ba_map[int(utility_num)] = ba

print(f"Found {len(utility_ba_map)} utilities with BA mapping")

# Query utility data from DuckDB
con = duckdb.connect('flattened.duckdb')
query = """
SELECT 
    eiaId,
    utilityName,
    COUNT(*) as num_rate_plans
FROM usurdb
WHERE eiaId IS NOT NULL
GROUP BY eiaId, utilityName
"""

results = con.execute(query).fetchall()

# Group by balancing authority
ba_data = {}
for row in results:
    eia_id, utility_name, num_plans = row
    
    if eia_id in utility_ba_map:
        ba = utility_ba_map[eia_id]
        if ba not in ba_data:
            ba_data[ba] = {
                "name": ba,
                "zoneName": BA_ZONE_MAPPING.get(ba),
                "utilities": [],
                "totalPlans": 0,
            }
        ba_data[ba]["utilities"].append(utility_name)
        ba_data[ba]["totalPlans"] += num_plans

for ba in ba_data.values():
    ba["numUtilities"] = len(ba["utilities"])

# Create summary with all BAs
ba_summary = []
for ba_code, zone_name in BA_ZONE_MAPPING.items():
    if ba_code in ba_data:
        ba_summary.append(ba_data[ba_code])
    else:
        ba_summary.append({
            "name": ba_code,
            "zoneName": zone_name,
            "utilities": [],
            "totalPlans": 0,
            "numUtilities": 0
        })

with open('../app/public/ba-summary.json', 'w') as f:
    json.dump(ba_summary, f, indent=2)

print(f"✅ Created ba-summary.json with {len(ba_summary)} balancing authorities")
print(f"   Found data for {len(ba_data)} BAs")
print("\nBalancing authorities with data:")
for ba in ba_summary:
    if ba["numUtilities"] > 0:
        print(f"  {ba['name']:10} -> {ba['zoneName']:20} ({ba['numUtilities']} utilities, {ba['totalPlans']} plans)")

con.close()