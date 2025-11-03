import duckdb
import math
import random

random.seed(42)


def generate_usage_data():
    """Generate synthetic hourly electricity usage data for three regions in two seasons"""

    records = []

    for season in ["winter", "summer"]:
        for hour in range(24):
            # NEW ENGLAND
            if season == "winter":
                # Gas heating - no electric heating load
                ne_usage = 1.5  # Base load
                if 6 <= hour <= 8:
                    ne_usage += 2.0 + math.sin((hour - 6) * math.pi / 2) * 1.5
                if 17 <= hour <= 22:
                    ne_usage += 2.5 + math.sin((hour - 17) * math.pi / 5) * 2.0
            else:  # summer
                # Moderate AC use
                ne_usage = 1.5  # Base load
                if 6 <= hour <= 8:
                    ne_usage += 1.5 + math.sin((hour - 6) * math.pi / 2) * 1.0
                if 13 <= hour <= 20:
                    ne_usage += 2.5 + math.sin((hour - 13) * math.pi / 7) * 2.5
                if 20 <= hour <= 22:
                    ne_usage += 1.5

            # TEXAS
            if season == "winter":
                # Electric heating
                tx_usage = 2.0  # Base load
                if 6 <= hour <= 8:
                    tx_usage += 3.0 + math.sin((hour - 6) * math.pi / 2) * 1.8
                if 17 <= hour <= 23:
                    tx_usage += 3.5 + math.sin((hour - 17) * math.pi / 6) * 2.5
                if 0 <= hour <= 6:
                    tx_usage += 1.5
            else:  # summer
                # Massive cooling loads
                tx_usage = 2.5  # Higher base load
                if 6 <= hour <= 8:
                    tx_usage += 1.5 + math.sin((hour - 6) * math.pi / 2) * 1.0
                if 13 <= hour <= 21:
                    tx_usage += 5.0 + math.sin((hour - 13) * math.pi / 8) * 4.0
                if 9 <= hour <= 13:
                    tx_usage += 2.5
                if 21 <= hour <= 23:
                    tx_usage += 2.5
                if 0 <= hour <= 6:
                    tx_usage += 1.5

            # CALIFORNIA (with EV)
            if season == "winter":
                # Minimal heating + EV charging
                ca_usage = 1.2  # Base load
                if 6 <= hour <= 8:
                    ca_usage += 1.2 + math.sin((hour - 6) * math.pi / 2) * 0.8
                if 17 <= hour <= 22:
                    ca_usage += 1.5 + math.sin((hour - 17) * math.pi / 5) * 1.0
                # EV charging overnight
                if hour >= 23 or hour <= 6:
                    ca_usage += 6.5 + random.uniform(0, 0.5)
            else:  # summer
                # Moderate AC + EV charging
                ca_usage = 1.3  # Base load
                if 6 <= hour <= 8:
                    ca_usage += 1.0 + math.sin((hour - 6) * math.pi / 2) * 0.7
                if 15 <= hour <= 20:
                    ca_usage += 2.0 + math.sin((hour - 15) * math.pi / 5) * 1.5
                if 20 <= hour <= 22:
                    ca_usage += 1.2
                # EV charging overnight
                if hour >= 23 or hour <= 6:
                    ca_usage += 6.5 + random.uniform(0, 0.5)

            # Add records for each region
            records.append(
                {
                    "season": season,
                    "hour": hour,
                    "region": "New England",
                    "usage_kw": round(ne_usage, 2),
                    "heating_type": "gas",
                    "has_ev": False,
                }
            )

            records.append(
                {
                    "season": season,
                    "hour": hour,
                    "region": "Texas",
                    "usage_kw": round(tx_usage, 2),
                    "heating_type": "electric",
                    "has_ev": False,
                }
            )

            records.append(
                {
                    "season": season,
                    "hour": hour,
                    "region": "Southern California",
                    "usage_kw": round(ca_usage, 2),
                    "heating_type": "minimal",
                    "has_ev": True,
                }
            )

    return records


def main():
    # Generate the data
    print("Generating synthetic usage data...")
    data = generate_usage_data()
    print(f"Generated {len(data)} records")

    # Connect to DuckDB
    print("Connecting to flattened.duckdb...")
    con = duckdb.connect("flattened.duckdb")

    # Drop table if it exists and create new one
    print("Creating synthetic_usage table...")
    con.execute("DROP TABLE IF EXISTS synthetic_usage")

    # Insert data
    con.execute(
        """
    CREATE TABLE synthetic_usage (
        season VARCHAR,
        hour INTEGER,
        region VARCHAR,
        usage_kw DOUBLE,
        heating_type VARCHAR,
        has_ev BOOLEAN
    )
"""
    )
    # Insert the actual data
    print("Inserting data...")
    con.executemany(
        """
        INSERT INTO synthetic_usage
        VALUES (?, ?, ?, ?, ?, ?)
    """,
        [
            (
                r["season"],
                r["hour"],
                r["region"],
                r["usage_kw"],
                r["heating_type"],
                r["has_ev"],
            )
            for r in data
        ],
    )

    # Verify
    result = con.execute("SELECT COUNT(*) as count FROM synthetic_usage").fetchone()
    print(f"Inserted {result[0]} records into synthetic_usage table")

    # Show sample data
    print("\nSample data (first 10 rows):")
    sample = con.execute(
        """
        SELECT season, hour, region, usage_kw, heating_type, has_ev
        FROM synthetic_usage
        LIMIT 10
    """
    ).fetchall()

    for row in sample:
        print(
            f"  {row[0]:6s} {row[1]:2d}:00 {row[2]:20s} {row[3]:6.2f} kW  {row[4]:8s} EV:{row[5]}"
        )

    # Show summary stats
    print("\nSummary by region and season:")
    summary = con.execute(
        """
        SELECT
            season,
            region,
            ROUND(AVG(usage_kw), 2) as avg_kw,
            ROUND(MAX(usage_kw), 2) as max_kw,
            ROUND(MIN(usage_kw), 2) as min_kw
        FROM synthetic_usage
        GROUP BY season, region
        ORDER BY season, region
    """
    ).fetchall()

    for row in summary:
        print(
            f"  {row[0]:6s} {row[1]:20s} avg:{row[2]:5.2f} max:{row[3]:5.2f} min:{row[4]:5.2f}"
        )

    con.close()
    print("\nDone! Data saved to flattened.duckdb")


if __name__ == "__main__":
    main()
