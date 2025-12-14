-- duckdb -init create-zip-county-mapping.sql -no-stdin ../app/public/flattened.duckdb
CREATE OR REPLACE TABLE zip_county_map AS
WITH feats AS (
  SELECT unnest(features) as features
  FROM read_json('../app/public/geodata/county-data.geojson')
),
  fips_map AS (
  SELECT
    features.properties.Name as county_name,
    features.properties.geoid as fips,
    features.properties.stusps as stusps,
    features.properties.NAMELSAD as long_name
  FROM feats
  WHERE stusps NOT IN ('PR', 'VI', 'MP', 'AS')
),
  HUD AS (
  select COUNTY as county_fips, ZIP
  from read_csv('./raw/hud-crosswalk/COUNTY_ZIP_122020.csv')
),
  NEW_MAPPING AS (
  -- same columns as zip_county_map
  select county_name as county, long_name, stusps as state, h.zip as zipcode
  FROM fips_map fm
  INNER JOIN HUD h ON fm.fips = h.county_fips
)
SELECT * from NEW_MAPPING;
