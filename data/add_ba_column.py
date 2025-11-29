"""Script to add balancingAuthority column to existing DuckDB database."""
import polars as pl
import duckdb

def load_ba_assignments():
    """Load BA assignments from EIA-861 Utility Data file."""
    UTILITY_DATA = "raw/eia-861-2024/Utility_Data_2024.xlsx"
    
    df = pl.read_excel(
        UTILITY_DATA,
        has_header=False,
        read_options={"skip_rows": 2}
    )
    
    ba_map = {}
    
    for row in df.iter_rows(named=False):
        utility_num = row[1]
        if utility_num is None:
            continue
            
        try:
            utility_id = int(utility_num)
        except (ValueError, TypeError):
            continue
        
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
            ba_map[utility_id] = ba
    
    print(f"✅ Loaded {len(ba_map)} BA assignments from EIA-861 data")
    return ba_map

if __name__ == "__main__":
    print("Adding balancingAuthority column to existing database...")
    
    # Load BA assignments
    ba_assignments = load_ba_assignments()
    
    # Connect to database
    con = duckdb.connect('flattened.duckdb')
    
    # Check if column already exists
    columns_query = "PRAGMA table_info(usurdb)"
    columns = con.execute(columns_query).fetchall()
    column_names = [col[1] for col in columns]
    
    if 'balancingAuthority' in column_names:
        print("⚠️  balancingAuthority column already exists, dropping it first...")
        con.execute("ALTER TABLE usurdb DROP COLUMN balancingAuthority")
    
    # Add the column
    print("Adding balancingAuthority column...")
    con.execute("ALTER TABLE usurdb ADD COLUMN balancingAuthority VARCHAR")
    
    # Update the column with BA assignments
    print("Updating BA assignments...")
    for eia_id, ba in ba_assignments.items():
        con.execute(
            "UPDATE usurdb SET balancingAuthority = ? WHERE eiaId = ?",
            [ba, eia_id]
        )
    
    # Get statistics
    stats_query = """
    SELECT 
        COUNT(DISTINCT eiaId) as total_utilities,
        COUNT(DISTINCT CASE WHEN balancingAuthority IS NOT NULL THEN eiaId END) as mapped_utilities,
        COUNT(DISTINCT balancingAuthority) as num_bas
    FROM usurdb
    WHERE eiaId IS NOT NULL
    """
    total, mapped, num_bas = con.execute(stats_query).fetchone()
    
    print(f"\n✅ Database updated successfully")
    print(f"   Total utilities: {total}")
    print(f"   Mapped to BAs: {mapped}")
    print(f"   Coverage: {(mapped/total*100):.1f}%")
    print(f"   Number of BAs: {num_bas}")
    
    # Show sample data
    print("\nSample records with BA assignments:")
    sample_query = """
    SELECT eiaId, utilityName, balancingAuthority 
    FROM usurdb 
    WHERE balancingAuthority IS NOT NULL 
    LIMIT 10
    """
    results = con.execute(sample_query).fetchall()
    for eia_id, utility, ba in results:
        print(f"  {utility} (EIA ID: {eia_id}) -> {ba}")
    
    con.close()
    print("\n✅ Done!")
