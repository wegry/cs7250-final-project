"""Convert GPKG state boundaries to GeoJSON for web use."""
import json
import subprocess

# Convert GPKG to GeoJSON using ogr2ogr
# Install with: brew install gdal (on macOS) or use Python geopandas

try:
    import geopandas as gpd
    
    # Read the state boundaries from GPKG
    gdf = gpd.read_file('geospatial-component.gpkg', layer='cb_2024_us_all_500k — cb_2024_us_state_500k')
    
    # Simplify geometries for web (reduce file size)
    gdf['geom'] = gdf['geom'].simplify(tolerance=0.01)
    
    # Keep only essential columns
    gdf_simple = gdf[['geom', 'name', 'stusps', 'geoid']].copy()
    gdf_simple.columns = ['geometry', 'name', 'state_abbr', 'geoid']
    
    # Convert to WGS84 (standard for web maps)
    gdf_simple = gdf_simple.to_crs(epsg=4326)
    
    # Export as GeoJSON
    gdf_simple.to_file('../app/public/us-states.json', driver='GeoJSON')
    print("✅ Created us-states.json")
    
except ImportError:
    print("⚠️  geopandas not installed. Install with: pip install geopandas")
    print("    Or use ogr2ogr command line tool")
