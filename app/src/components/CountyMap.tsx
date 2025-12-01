import { useEffect, useMemo, useState } from "react";
import { Card, Tooltip } from "antd";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import * as queries from "../data/queries";
import type { RatePlan } from "../data/schema";

// --- Zod Schemas for GeoJSON ---

// GeoJSON positions can have 2 (lon, lat) or 3 (lon, lat, alt) elements
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
    name: z.string().optional(),
    stusps: z.string().optional(),
  })
  .passthrough(); // Allow additional properties

const CountyFeatureSchema = z.object({
  type: z.literal("Feature"),
  properties: CountyPropertiesSchema.nullable(),
  geometry: z.union([PolygonGeometrySchema, MultiPolygonGeometrySchema]),
});

const CountyGeoJSONSchema = z.object({
  type: z.literal("FeatureCollection"),
  features: z.array(CountyFeatureSchema),
});

// Looser schema that filters to only polygon features
const RawGeoJSONSchema = z.object({
  type: z.literal("FeatureCollection"),
  features: z.array(z.unknown()),
});

type CountyGeoJSON = z.infer<typeof CountyGeoJSONSchema>;
type CountyFeature = z.infer<typeof CountyFeatureSchema>;
type Geometry = CountyFeature["geometry"];
type Position = z.infer<typeof PositionSchema>;

type TerritoryRow = { county: string; state: string };

type BBox = { minX: number; maxX: number; minY: number; maxY: number };

function normalizeCountyName(n: string) {
  return n
    ?.toLowerCase()
    .replace(/\s*county\s*$/i, "")
    .trim();
}

// CONUS Albers Equal Area Conic projection
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

function NorthArrow({
  x,
  y,
  size = 30,
}: {
  x: number;
  y: number;
  size?: number;
}) {
  return (
    <g transform={`translate(${x}, ${y})`}>
      <polygon
        points={`0,${-size / 2} ${size / 6},${size / 3} 0,${size / 6} ${-size / 6},${size / 3}`}
        fill="#333"
        stroke="#333"
        strokeWidth={0.5}
      />
      <text
        y={-size / 2 - 4}
        textAnchor="middle"
        fontSize={10}
        fontWeight="bold"
        fill="#333"
      >
        N
      </text>
    </g>
  );
}

async function fetchGeoJSON(): Promise<CountyGeoJSON> {
  const res = await fetch("/geodata/county-data.geojson");
  if (!res.ok) throw new Error(`Failed to fetch GeoJSON: ${res.status}`);
  const data: unknown = await res.json();

  // Parse loosely first, then filter to valid polygon features
  const raw = RawGeoJSONSchema.parse(data);
  const validFeatures: CountyFeature[] = [];

  for (const feature of raw.features) {
    const result = CountyFeatureSchema.safeParse(feature);
    if (result.success) {
      validFeatures.push(result.data);
    } else {
      // Debug: log first few failures
      if (validFeatures.length === 0) {
        console.log("Sample feature:", JSON.stringify(feature).slice(0, 500));
        console.log("Parse error:", result.error.issues);
      }
    }
  }

  return { type: "FeatureCollection", features: validFeatures };
}

function getPolygons(geometry: Geometry): Position[][][] {
  return geometry.type === "Polygon"
    ? [geometry.coordinates]
    : geometry.coordinates;
}

export function CountyMap({
  selectedPlan,
}: {
  selectedPlan?: RatePlan | null;
}) {
  const [territories, setTerritories] = useState<TerritoryRow[]>([]);
  const [hovered, setHovered] = useState<string | null>(null);

  const {
    data: geojson,
    isLoading: isLoadingGeo,
    error: geoError,
  } = useQuery({
    queryKey: ["county-geojson"],
    queryFn: fetchGeoJSON,
    staleTime: Infinity,
  });

  // Debug logging
  useEffect(() => {
    if (geoError) console.error("GeoJSON fetch error:", geoError);
    if (geojson)
      console.log("GeoJSON loaded:", geojson.features.length, "features");
  }, [geojson, geoError]);

  useEffect(() => {
    async function load() {
      if (!selectedPlan) return setTerritories([]);

      try {
        if (selectedPlan.eiaId != null) {
          const res = await queries.serviceTerritoryByEiaId(selectedPlan.eiaId);
          setTerritories(
            res.toArray().map((r) => ({ county: r.county, state: r.state })),
          );
          return;
        }

        if (selectedPlan.utilityName) {
          const res = await queries.serviceTerritoryByUtilityName(
            selectedPlan.utilityName,
          );
          setTerritories(
            res.toArray().map((r) => ({ county: r.county, state: r.state })),
          );
          return;
        }
      } catch (e) {
        console.error("Error loading service territory", e);
        setTerritories([]);
      }
    }
    load();
  }, [selectedPlan]);

  const states = useMemo(() => {
    return Array.from(new Set(territories.map((t) => t.state))).sort();
  }, [territories]);

  const { bbox, featuresByState } = useMemo(() => {
    if (!geojson?.features || states.length === 0) {
      return {
        bbox: null,
        featuresByState: {} as Record<string, CountyFeature[]>,
      };
    }

    const relevantFeatures = geojson.features.filter((f) =>
      states.includes(f.properties?.stusps ?? ""),
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
  }, [geojson, states]);

  const countiesSet = useMemo(() => {
    return new Set(
      territories.map((t) => `${t.state}:${normalizeCountyName(t.county)}`),
    );
  }, [territories]);

  const width = 400;
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

  if (!selectedPlan) return null;

  if (isLoadingGeo) {
    return (
      <Card>
        <div
          style={{
            width,
            height,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span style={{ color: "#999" }}>Loading map...</span>
        </div>
      </Card>
    );
  }

  if (geoError) {
    return (
      <Card>
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
      </Card>
    );
  }

  return (
    <Card>
      {states.length === 0 ? (
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
            No counties found for this utility
          </span>
        </div>
      ) : (
        <>
          <div style={{ marginBottom: 8 }}>
            <strong>Utility Service Territory</strong>
            <span style={{ marginLeft: 12, color: "#666", fontSize: 13 }}>
              {states.join(", ")} · {territories.length}{" "}
              {territories.length === 1 ? "county" : "counties"}
            </span>
          </div>
          <svg width={width} height={height}>
            {Object.entries(featuresByState).map(([st, stFeatures]) => (
              <g key={`state-group-${st}`}>
                {stFeatures.map((f, idx) => (
                  <path
                    key={`outline-${idx}`}
                    d={bbox ? buildPath(f, bbox) : ""}
                    fill="none"
                    stroke="#333"
                    strokeWidth={3}
                  />
                ))}
                {stFeatures.map((f, idx) => {
                  const countyName = f.properties?.name ?? "";
                  const key = `${st}:${normalizeCountyName(countyName)}`;
                  const isHighlighted = countiesSet.has(key);
                  const isHovered = hovered === `${st}:${countyName}`;
                  const fillColor = isHighlighted ? "#b03a2e" : "#f5f5f5";

                  return (
                    <Tooltip
                      key={`fill-${idx}`}
                      title={`${countyName}, ${st}`}
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
                        onMouseEnter={() => setHovered(`${st}:${countyName}`)}
                        onMouseLeave={() => setHovered(null)}
                        style={{ cursor: "pointer" }}
                      />
                    </Tooltip>
                  );
                })}
              </g>
            ))}
            <NorthArrow x={width - 25} y={30} size={28} />
          </svg>
        </>
      )}
      <p
        style={{
          margin: "8px 0 0 0",
          color: "#666",
          fontSize: 12,
          maxWidth: "40ch",
        }}
      >
        Counties in red are served by the utility. Projection: Albers Equal Area
        Conic (CONUS).
      </p>
    </Card>
  );
}

export default CountyMap;
