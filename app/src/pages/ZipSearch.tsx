import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Alert, Card, Col, Input, Row, Spin, Table, Tooltip } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { conn } from "../data/duckdb";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import * as s from "./ZipSearch.module.css";
import { countFormatter } from "../formatters";
import { PageBody } from "../components/PageBody";

// --- Zod Schemas for GeoJSON (same as CountyMap.tsx) ---
const PositionSchema = z.tuple([z.number(), z.number()]).rest(z.number());
const LinearRingSchema = z.array(PositionSchema);
const PolygonCoordinatesSchema = z.array(LinearRingSchema);

const PolygonGeometrySchema = z.object({
  type: z.literal("Polygon"),
  coordinates: PolygonCoordinatesSchema,
});

const MultiPolygonGeometrySchema = z.object({
  type: z.literal("MultiPolygon"),
  coordinates: z.array(PolygonCoordinatesSchema),
});

const CountyPropertiesSchema = z
  .object({
    name: z.string(),
    stusps: z.string(),
  })
  .loose();

const CountyFeatureSchema = z.object({
  type: z.literal("Feature"),
  properties: CountyPropertiesSchema.nullable(),
  geometry: z.union([PolygonGeometrySchema, MultiPolygonGeometrySchema]),
});

const CountyGeoJSONSchema = z.object({
  type: z.literal("FeatureCollection"),
  features: z.array(CountyFeatureSchema),
});

const RawGeoJSONSchema = z.object({
  type: z.literal("FeatureCollection"),
  features: z.array(z.unknown()),
});

type CountyGeoJSON = z.infer<typeof CountyGeoJSONSchema>;
type CountyFeature = z.infer<typeof CountyFeatureSchema>;
type Geometry = CountyFeature["geometry"];
type Position = z.infer<typeof PositionSchema>;
type BBox = { minX: number; maxX: number; minY: number; maxY: number };

// Zod schema for validation
const UtilityResultSchema = z.object({
  "Utility Name": z.string(),
  "Utility Number": z.bigint(),
  State: z.string(),
  County: z.string(),
  zipcode: z.string(),
  usurdb_id: z.string().nullable(),
});

const UtilityResultsSchema = z.array(UtilityResultSchema);

type UtilityResult = z.infer<typeof UtilityResultSchema>;

// --- Projection functions (same as CountyMap.tsx) ---
function albersProject(lon: number, lat: number): Position {
  const toRad = Math.PI / 180;
  const λ = lon * toRad;
  const φ = lat * toRad;
  const λ0 = -96 * toRad;
  const φ0 = 23 * toRad;
  const φ1 = 29.5 * toRad;
  const φ2 = 45.5 * toRad;

  const n = (Math.sin(φ1) + Math.sin(φ2)) / 2;
  const C = Math.cos(φ1) ** 2 + 2 * n * Math.sin(φ1);
  const ρ0 = Math.sqrt(C - 2 * n * Math.sin(φ0)) / n;
  const ρ = Math.sqrt(C - 2 * n * Math.sin(φ)) / n;
  const θ = n * (λ - λ0);

  const x = ρ * Math.sin(θ);
  const y = ρ0 - ρ * Math.cos(θ);

  return [x, y];
}

function projectToSvg(
  lon: number,
  lat: number,
  bbox: BBox,
  width: number,
  height: number,
  pad = 10,
): Position {
  const [px, py] = albersProject(lon, lat);
  const { minX, maxX, minY, maxY } = bbox;
  const xRange = maxX - minX || 1;
  const yRange = maxY - minY || 1;

  const scale = Math.min(
    (width - pad * 2) / xRange,
    (height - pad * 2) / yRange,
  );
  const offsetX = (width - xRange * scale) / 2;
  const offsetY = (height - yRange * scale) / 2;

  const x = (px - minX) * scale + offsetX;
  const y = (maxY - py) * scale + offsetY;

  return [x, y];
}

function getPolygons(geometry: Geometry): Position[][][] {
  return geometry.type === "Polygon"
    ? [geometry.coordinates]
    : geometry.coordinates;
}

function normalizeCountyName(name: string): string {
  return name
    ?.toLowerCase()
    .replace(/\s*county\s*$/i, "")
    .trim();
}

async function fetchGeoJSON(): Promise<CountyGeoJSON> {
  const res = await fetch("/geodata/county-data.geojson");
  if (!res.ok) throw new Error(`Failed to fetch GeoJSON: ${res.status}`);
  const data: unknown = await res.json();

  const raw = RawGeoJSONSchema.parse(data);
  const validFeatures: CountyFeature[] = [];

  for (const feature of raw.features) {
    const result = CountyFeatureSchema.safeParse(feature);
    if (result.success) {
      validFeatures.push(result.data);
    }
  }

  return { type: "FeatureCollection", features: validFeatures };
}

// Table columns configuration
const columns: ColumnsType<UtilityResult> = [
  {
    title: "Zip Code",
    dataIndex: "zipcode",
    key: "zipcode",
  },
  {
    title: "Utility Name",
    dataIndex: "Utility Name",
    key: "utilityName",
    render: (value: string, record) =>
      record.usurdb_id ? (
        <Link to={`/detail/${record.usurdb_id}`}>{value}</Link>
      ) : (
        value
      ),
  },
  {
    title: "Utility Number",
    dataIndex: "Utility Number",
    key: "utilityNumber",
    render: (value: bigint) => value.toString(),
  },
  {
    title: "State",
    dataIndex: "State",
    key: "state",
  },
  {
    title: "County",
    dataIndex: "County",
    key: "county",
  },
];

// Query function
async function fetchUtilitiesByZip(zipCode: string): Promise<UtilityResult[]> {
  const stmt = (await conn).prepare(`
    WITH latest_usurdb AS (
      SELECT _id, eiaId
      FROM flattened.usurdb
      QUALIFY ROW_NUMBER() OVER (PARTITION BY eiaId ORDER BY is_default DESC, effectiveDate DESC) = 1
    )
    SELECT DISTINCT
      est."Utility Name",
      est."Utility Number",
      est.State,
      est.County,
      z.zipcode,
      lu._id as usurdb_id
    FROM flattened.zip_county_map z
    JOIN flattened.eia861_service_territory est
      ON z.county = est.County AND z.state_abbr = est.State
    LEFT JOIN latest_usurdb lu
      ON lu.eiaId = est."Utility Number"
    WHERE starts_with(z.zipcode, $1)
    ORDER BY z.zipcode
  `);

  const arrowResult = await (await stmt).query(`${zipCode}`);
  const rows = arrowResult.toArray();

  return UtilityResultsSchema.parse(rows);
}

const ZIP = "search";

export function ZipSearch() {
  const [params, setParams] = useSearchParams();
  const zipCode = params.get(ZIP) ?? "";
  const debouncedZipCode = useDebouncedValue(zipCode, 300);
  const [hovered, setHovered] = useState<string | null>(null);

  const {
    data: results = [],
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["utilities", debouncedZipCode],
    queryFn: () => fetchUtilitiesByZip(debouncedZipCode),
    enabled: debouncedZipCode.length >= 1,
    placeholderData: keepPreviousData,
  });

  // Fetch GeoJSON for county map
  const {
    data: geojson,
    isLoading: geoLoading,
    error: geoError,
  } = useQuery({
    queryKey: ["county-geojson"],
    queryFn: fetchGeoJSON,
    staleTime: Infinity,
  });

  // Extract unique counties and states from results for highlighting
  const { highlightedCounties, relevantStates } = useMemo(() => {
    const counties = new Set<string>();
    const states = new Set<string>();
    results.forEach((r) => {
      const key = `${r.State}:${normalizeCountyName(r.County)}`;
      counties.add(key);
      states.add(r.State);
    });
    return { highlightedCounties: counties, relevantStates: states };
  }, [results]);

  // Compute bbox and features for relevant states
  const { bbox, featuresByState } = useMemo(() => {
    if (!geojson?.features || relevantStates.size === 0) {
      return {
        bbox: null,
        featuresByState: {} as Record<string, CountyFeature[]>,
      };
    }

    const relevantFeatures = geojson.features.filter((f) =>
      relevantStates.has(f.properties?.stusps ?? ""),
    );

    const byState: Record<string, CountyFeature[]> = {};
    for (const f of relevantFeatures) {
      const st = f.properties?.stusps ?? "";
      if (!byState[st]) byState[st] = [];
      byState[st].push(f);
    }

    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity;

    for (const f of relevantFeatures) {
      for (const poly of getPolygons(f.geometry)) {
        for (const ring of poly) {
          for (const [lon, lat] of ring) {
            const [px, py] = albersProject(lon, lat);
            if (px < minX) minX = px;
            if (px > maxX) maxX = px;
            if (py < minY) minY = py;
            if (py > maxY) maxY = py;
          }
        }
      }
    }

    return {
      bbox: minX === Infinity ? null : { minX, maxX, minY, maxY },
      featuresByState: byState,
    };
  }, [geojson, relevantStates]);

  const width = 500;
  const height = width / 1.61;

  const buildPath = (f: CountyFeature, bboxData: BBox) => {
    return getPolygons(f.geometry)
      .flatMap((poly) =>
        poly.map(
          (ring) =>
            ring
              .map((pt, i) => {
                const [x, y] = projectToSvg(
                  pt[0],
                  pt[1],
                  bboxData,
                  width,
                  height,
                  15,
                );
                return `${i === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
              })
              .join(" ") + " Z",
        ),
      )
      .join(" ");
  };

  // Summary stats
  const uniqueCounties = useMemo(() => {
    const set = new Set<string>();
    results.forEach((r) => set.add(`${r.State}:${r.County}`));
    return set.size;
  }, [results]);

  const uniqueUtilities = useMemo(() => {
    const set = new Set<string>();
    results.forEach((r) => set.add(r["Utility Name"]));
    return set.size;
  }, [results]);

  const uniqueZipCodes = useMemo(() => {
    const set = new Set<string>();
    results.forEach((r) => set.add(r.zipcode));
    return set.size;
  }, [results]);

  const states = Array.from(relevantStates).sort();

  return (
    <PageBody title="Search Utilities by Zip Code">
      <Row gutter={[24, 24]}>
        <Col xs={24} lg={14}>
          <div className={s.searchSection}>
            <Input
              placeholder="Enter Zip Code..."
              value={zipCode}
              onChange={(e) =>
                setParams(
                  (params) => {
                    const { value } = e.target;

                    if (value != params.get(ZIP)) {
                      params.set(ZIP, value);
                    }

                    return params;
                  },
                  { replace: true },
                )
              }
              style={{ maxWidth: 300 }}
              size="large"
            />
          </div>

          {isError && (
            <Alert
              type="error"
              description={
                error instanceof Error
                  ? error.message
                  : "Failed to fetch utilities"
              }
              style={{ marginBottom: 16 }}
            />
          )}

          {debouncedZipCode.length >= 1 && results.length > 0 && (
            <Card size="small" style={{ marginBottom: 16 }}>
              <Row gutter={16}>
                <Col>
                  <strong>{countFormatter.format(uniqueZipCodes)}</strong> zip
                  code
                  {uniqueZipCodes !== 1 ? "s" : ""}
                </Col>
                <Col>
                  <strong>{countFormatter.format(uniqueCounties)}</strong>{" "}
                  {uniqueCounties === 1 ? "county" : "counties"}
                </Col>
                <Col>
                  <strong>{countFormatter.format(uniqueUtilities)}</strong>{" "}
                  {uniqueUtilities === 1 ? "utility" : "utilities"}
                </Col>
              </Row>
            </Card>
          )}

          <Table
            columns={columns}
            dataSource={results}
            rowKey={(r) => `${r.zipcode}-${r["Utility Number"]}`}
            tableLayout="fixed"
            loading={isLoading}
            pagination={{
              pageSize: 20,
              showSizeChanger: true,
              pageSizeOptions: ["10", "20", "50", "100"],
              showTotal: (total, range) =>
                `${countFormatter.format(range[0])}-${countFormatter.format(range[1])} of ${countFormatter.format(total)} utility/zip code pairs`,
            }}
            locale={{
              emptyText:
                debouncedZipCode.length >= 1
                  ? isLoading
                    ? ""
                    : "No utilities found for this zip code."
                  : "Enter at least 1 digit to search.",
            }}
          />
        </Col>

        <Col xs={24} lg={10}>
          <Card
            title="Service Territory Map"
            extra={
              highlightedCounties.size > 0 && (
                <span style={{ color: "#666", fontSize: 12 }}>
                  {states.join(", ")} · {highlightedCounties.size}{" "}
                  {highlightedCounties.size === 1 ? "county" : "counties"}
                </span>
              )
            }
          >
            {geoLoading ? (
              <div
                style={{
                  width,
                  height,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Spin size="large" />
              </div>
            ) : geoError ? (
              <div
                style={{
                  width,
                  height,
                  backgroundColor: "#fff0f0",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <span style={{ color: "#c00" }}>Failed to load map data</span>
              </div>
            ) : states.length === 0 ? (
              <div
                style={{
                  width,
                  height,
                  backgroundColor: "#f5f5f5",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <span style={{ color: "#999" }}>
                  Search for a zip code to see counties on the map
                </span>
              </div>
            ) : (
              <>
                <svg width={width} height={height}>
                  {Object.entries(featuresByState).map(([st, stFeatures]) => (
                    <g key={`state-group-${st}`}>
                      {/* State outline */}
                      {stFeatures.map((f, idx) => (
                        <path
                          key={`outline-${idx}`}
                          d={bbox ? buildPath(f, bbox) : ""}
                          fill="none"
                          stroke="#333"
                          strokeWidth={3}
                        />
                      ))}
                      {/* County fills */}
                      {stFeatures.map((f, idx) => {
                        const countyName = f.properties?.name ?? "";
                        const key = `${st}:${normalizeCountyName(countyName)}`;
                        const isHighlighted = highlightedCounties.has(key);
                        const isHovered = hovered === `${st}:${countyName}`;
                        const fillColor = isHighlighted ? "#b03a2e" : "#f5f5f5";

                        return (
                          <Tooltip
                            key={`fill-${idx}`}
                            title={`${countyName}, ${st}${isHighlighted ? " (Matched)" : ""}`}
                            placement="top"
                          >
                            <path
                              d={bbox ? buildPath(f, bbox) : ""}
                              fill={
                                isHovered
                                  ? isHighlighted
                                    ? "#8b2e24"
                                    : "#e0e0e0"
                                  : fillColor
                              }
                              stroke="#999"
                              strokeWidth={0.5}
                              onMouseEnter={() =>
                                setHovered(`${st}:${countyName}`)
                              }
                              onMouseLeave={() => setHovered(null)}
                              style={{ cursor: "pointer" }}
                            />
                          </Tooltip>
                        );
                      })}
                    </g>
                  ))}
                </svg>
                <p
                  style={{
                    margin: "8px 0 0 0",
                    color: "#666",
                    fontSize: 12,
                  }}
                >
                  Counties in red are served by utilities matching your search.
                  Projection: Albers Equal Area Conic (CONUS).
                </p>
              </>
            )}
          </Card>
        </Col>
      </Row>
    </PageBody>
  );
}
