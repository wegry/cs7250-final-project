"""Script to update utility names in DuckDB for specific EIA IDs."""

import duckdb
from pathlib import Path

# Map of EIA ID to display name
UTILITY_NAME_OVERRIDES = {
    11804: "National Grid",
    54913: "Eversource",
}

def update_utility_names():
    """Update utility names in the DuckDB database."""
    db_path = Path("app/public/flattened.duckdb")
    
    if not db_path.exists():
        print(f"❌ Database not found: {db_path}")
        return
    
    conn = duckdb.connect(str(db_path), read_only=False)
    
    try:
        for eia_id, new_name in UTILITY_NAME_OVERRIDES.items():
            print(f"\n📝 Updating EIA ID {eia_id} to '{new_name}'...")
            
            # Check current name
            result = conn.execute(
                "SELECT DISTINCT utilityName FROM flattened.usurdb WHERE eiaId = ?",
                [eia_id]
            ).fetchall()
            
            if result:
                old_name = result[0][0]
                print(f"  Old name: {old_name}")
                
                # Update the usurdb table
                conn.execute(
                    "UPDATE flattened.usurdb SET utilityName = ? WHERE eiaId = ?",
                    [new_name, eia_id]
                )
                
                # Update the eia861_service_territory table if it exists
                try:
                    conn.execute(
                        "UPDATE flattened.eia861_service_territory SET \"Utility Name\" = ? WHERE \"Utility Number\" = ?",
                        [new_name, eia_id]
                    )
                except:
                    pass  # Table might not exist or column might not exist
                
                print(f"  ✅ Updated {eia_id} to '{new_name}'")
            else:
                print(f"  ⚠️  No records found for EIA ID {eia_id}")
        
        print("\n✅ All utility names updated successfully!")
    
    except Exception as e:
        print(f"❌ Error updating utility names: {e}")
        raise
    
    finally:
        conn.close()


if __name__ == "__main__":
    update_utility_names()
