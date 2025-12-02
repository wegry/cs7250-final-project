import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

// --- Zod Schemas for GeoJSON ---
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

const CountyPropertiesSchema = z.object({
  Name: z.string(),
  STUSPS: z.string(),
});
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
  features: z.array(CountyFeatureSchema),
});

// --- Type Exports ---
export type CountyGeoJSON = z.infer<typeof CountyGeoJSONSchema>;
export type CountyFeature = z.infer<typeof CountyFeatureSchema>;
export type Geometry = CountyFeature["geometry"];
export type Position = z.infer<typeof PositionSchema>;
export type BBox = { minX: number; maxX: number; minY: number; maxY: number };

// --- Helper Functions ---
export function normalizeCountyName(name: string): string {
  return name
    ?.toLowerCase()
    .replace(/\s*county\s*$/i, "")
    .trim();
}

export function getPolygons(geometry: Geometry): Position[][][] {
  return geometry.type === "Polygon"
    ? [geometry.coordinates]
    : geometry.coordinates;
}

// --- Projection Functions ---
export function albersProject(lon: number, lat: number): Position {
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

export function projectToSvg(
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

// --- Fetch Function ---
async function fetchGeoJSON(): Promise<CountyGeoJSON> {
  const res = await fetch("/geodata/county-data.geojson");
  if (!res.ok) throw new Error(`Failed to fetch GeoJSON: ${res.status}`);
  const raw: unknown = await res.json();

  const { data, error } = await RawGeoJSONSchema.safeParseAsync(raw);

  if (error) {
    console.error(error);
    throw error;
  }

  return data;
}

// --- React Query Hook ---
export function useCountyGeoJSON() {
  return useQuery({
    queryKey: ["county-geojson"],
    queryFn: fetchGeoJSON,
  });
}

// --- Utility: Compute BBox and Features by State ---
export function computeBBoxAndFeaturesByState(
  geojson: CountyGeoJSON | undefined,
  relevantStates: Set<string> | string[],
): { bbox: BBox | null; featuresByState: Record<string, CountyFeature[]> } {
  const statesArray = Array.isArray(relevantStates)
    ? relevantStates
    : Array.from(relevantStates);

  if (!geojson?.features || statesArray.length === 0) {
    return { bbox: null, featuresByState: {} };
  }

  const statesSet = new Set(statesArray);
  const relevantFeatures = geojson.features.filter((f) =>
    statesSet.has(f.properties?.STUSPS ?? ""),
  );

  const byState: Record<string, CountyFeature[]> = {};
  for (const f of relevantFeatures) {
    const st = f.properties?.STUSPS ?? "";
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
}

// --- Utility: Build SVG Path ---
export function buildSvgPath(
  feature: CountyFeature,
  bbox: BBox,
  width: number,
  height: number,
  padding = 15,
): string {
  return getPolygons(feature.geometry)
    .flatMap((poly) =>
      poly.map(
        (ring) =>
          ring
            .map((pt, i) => {
              const [x, y] = projectToSvg(
                pt[0],
                pt[1],
                bbox,
                width,
                height,
                padding,
              );
              return `${i === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
            })
            .join(" ") + " Z",
      ),
    )
    .join(" ");
}
