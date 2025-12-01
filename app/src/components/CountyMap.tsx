import { useEffect, useMemo, useState } from "react";
import { Card, Tooltip } from "antd";
import * as queries from "../data/queries";
import type { RatePlan } from "../data/schema";

type TerritoryRow = { county: string; state: string };

function normalizeCountyName(n: string) {
  return n
    ?.toLowerCase()
    .replace(/\s*county\s*$/i, "")
    .trim();
}

// CONUS Albers Equal Area Conic projection
// Standard parallels: 29.5°N and 45.5°N
// Central meridian: -96°
// Latitude of origin: 23°N
function albersProject(lon: number, lat: number): [number, number] {
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
  bbox: { minX: number; maxX: number; minY: number; maxY: number },
  width: number,
  height: number,
  pad = 10,
): [number, number] {
  const [px, py] = albersProject(lon, lat);
  const { minX, maxX, minY, maxY } = bbox;
  const xRange = maxX - minX || 1;
  const yRange = maxY - minY || 1;

  // Fit to SVG maintaining aspect ratio
  const scale = Math.min(
    (width - pad * 2) / xRange,
    (height - pad * 2) / yRange,
  );
  const offsetX = (width - xRange * scale) / 2;
  const offsetY = (height - yRange * scale) / 2;

  const x = (px - minX) * scale + offsetX;
  const y = (maxY - py) * scale + offsetY; // flip Y for SVG coords

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
      {/* Arrow body */}
      <polygon
        points={`0,${-size / 2} ${size / 6},${size / 3} 0,${size / 6} ${-size / 6},${size / 3}`}
        fill="#333"
        stroke="#333"
        strokeWidth={0.5}
      />
      {/* N label */}
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

export function CountyMap({
  selectedPlan,
}: {
  selectedPlan?: RatePlan | null;
}) {
  const [territories, setTerritories] = useState<TerritoryRow[]>([]);
  const [geojson, setGeojson] = useState<any | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);

  useEffect(() => {
    fetch("/geodata/county-data.geojson")
      .then((r) => r.json())
      .then(setGeojson)
      .catch((e) => {
        console.error("Failed to load geojson", e);
        setGeojson(null);
      });
  }, []);

  useEffect(() => {
    async function load() {
      if (!selectedPlan) return setTerritories([]);

      try {
        if (selectedPlan.eiaId != null) {
          const id = selectedPlan.eiaId;
          const res = await queries.serviceTerritoryByEiaId(id);
          const rows = res.toArray();
          setTerritories(
            rows.map((r) => ({ county: r.county, state: r.state })),
          );
          return;
        }

        if (selectedPlan.utilityName) {
          const res = await queries.serviceTerritoryByUtilityName(
            selectedPlan.utilityName,
          );
          const rows = res.toArray();
          setTerritories(
            rows.map((r) => ({ county: r.county, state: r.state })),
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

  // Get all features for the relevant states and compute combined bbox
  const { bbox, featuresByState } = useMemo(() => {
    if (!geojson?.features || states.length === 0) {
      return { features: [], bbox: null, featuresByState: {} };
    }

    const relevantFeatures = geojson.features.filter((f: any) =>
      states.includes(f.properties?.stusps),
    );

    // Group by state
    const byState: Record<string, any[]> = {};
    for (const f of relevantFeatures) {
      const st = f.properties?.stusps;
      if (!byState[st]) byState[st] = [];
      byState[st].push(f);
    }

    // Compute projected bbox
    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity;

    for (const f of relevantFeatures) {
      const geom = f.geometry;
      const polys: any[] =
        geom.type === "Polygon" ? [geom.coordinates] : geom.coordinates;
      for (const poly of polys) {
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
      features: relevantFeatures,
      bbox: minX === Infinity ? null : { minX, maxX, minY, maxY },
      featuresByState: byState,
    };
  }, [geojson, states]);

  const countiesSet = useMemo(() => {
    return new Set(
      territories.map((t) => `${t.state}:${normalizeCountyName(t.county)}`),
    );
  }, [territories]);

  if (!selectedPlan) return null;

  const width = 400;
  const height = width / 1.61;

  // Build path string for a feature
  const buildPath = (f: any, bboxData: typeof bbox) => {
    if (!bboxData) return "";
    const geom = f.geometry;
    const polys: any[] =
      geom.type === "Polygon" ? [geom.coordinates] : geom.coordinates;

    return polys
      .flatMap((poly) =>
        poly.map(
          (ring: number[][]) =>
            ring
              .map((pt: number[], i: number) => {
                if (pt[0] == null || pt[1] == null) return "";
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
            {/* Draw each state separately: thick outline first, then fills */}
            {/* This ensures state-to-state borders remain thick while internal county borders are covered */}
            {Object.entries(featuresByState).map(([st, stFeatures]) => (
              <g key={`state-group-${st}`}>
                {/* Thick stroke layer for this state */}
                {(stFeatures as any[]).map((f: any, idx: number) => (
                  <path
                    key={`outline-${idx}`}
                    d={buildPath(f, bbox)}
                    fill="none"
                    stroke="#333"
                    strokeWidth={3}
                  />
                ))}
                {/* Fill layer for this state (covers internal thick strokes only) */}
                {(stFeatures as any[]).map((f: any, idx: number) => {
                  const countyName = f.properties?.name || "";
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
                        d={buildPath(f, bbox)}
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

            {/* North Arrow */}
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
