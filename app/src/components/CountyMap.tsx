import { useEffect, useMemo, useState } from "react";
import { Card, Tooltip } from "antd";
import * as queries from "../data/queries";
import type { RatePlan } from "../data/schema";

type TerritoryRow = { county: string; state: string };

function normalizeCountyName(n: string) {
    return n?.toLowerCase().replace(/\s*county\s*$/i, "").trim();
}


function projectPoint(
    lon: number,
    lat: number,
    bbox: { minLon: number; maxLon: number; minLat: number; maxLat: number },
    width: number,
    height: number,
    pad = 6,
): [number, number] {
    const { minLon, maxLon, minLat, maxLat } = bbox;
    const lonRange = maxLon - minLon || 1;
    const latRange = maxLat - minLat || 1;
    const x = ((lon - minLon) / lonRange) * (width - pad * 2) + pad;
    const y = ((maxLat - lat) / latRange) * (height - pad * 2) + pad;
    return [x, y];
}

export function CountyMap({ selectedPlan }: { selectedPlan?: RatePlan | null }) {
    const [territories, setTerritories] = useState<TerritoryRow[]>([]);
    const [geojson, setGeojson] = useState<any | null>(null);
    const [hovered, setHovered] = useState<string | null>(null);

    useEffect(() => {
        // load geojson from public folder
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
                    // convert bigint if present
                    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                    // @ts-ignore
                    const id = typeof selectedPlan.eiaId === "bigint" ? Number(selectedPlan.eiaId) : selectedPlan.eiaId;
                    const res = await queries.serviceTerritoryByEiaId(id);
                    const rows = res.toArray();
                    setTerritories(rows.map((r: any) => ({ county: r.county, state: r.state })));
                    return;
                }

                if (selectedPlan.utilityName) {
                    const res = await queries.serviceTerritoryByUtilityName(selectedPlan.utilityName);
                    const rows = res.toArray();
                    setTerritories(rows.map((r: any) => ({ county: r.county, state: r.state })));
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

    if (!selectedPlan) return null;

    return (
        <Card>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                {states.length === 0 ? (
                    <div
                        style={{
                            width: 384,
                            height: 250,
                            backgroundColor: "#f0f0f0",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                        }}
                    >
                        <span style={{ color: "#999" }}>No counties found for this utility</span>
                    </div>
                ) : (
                    states.map((st) => {
                        const features = geojson?.features?.filter(
                            (f: any) => f.properties?.stusps === st,
                        );

                        // collect bbox for this state's features
                        let minLon = Infinity,
                            maxLon = -Infinity,
                            minLat = Infinity,
                            maxLat = -Infinity;
                        if (features && features.length > 0) {
                            for (const f of features) {
                                const geom = f.geometry;
                                const polys: any[] =
                                    geom.type === "Polygon" ? [geom.coordinates] : geom.coordinates;
                                for (const poly of polys) {
                                    for (const ring of poly) {
                                        for (const [lon, lat] of ring) {
                                            if (lon < minLon) minLon = lon;
                                            if (lon > maxLon) maxLon = lon;
                                            if (lat < minLat) minLat = lat;
                                            if (lat > maxLat) maxLat = lat;
                                        }
                                    }
                                }
                            }
                        }

                        if (!features || features.length === 0) {
                            return (
                                <div key={st} style={{ width: 180 }}>
                                    <strong>{st}</strong>
                                    <div style={{ color: "#999" }}>No geometry for state</div>
                                </div>
                            );
                        }

                        const bbox = {
                            minLon: minLon === Infinity ? -125 : minLon,
                            maxLon: maxLon === -Infinity ? -66 : maxLon,
                            minLat: minLat === Infinity ? 24 : minLat,
                            maxLat: maxLat === -Infinity ? 49 : maxLat,
                        };

                        const width = 220;
                        const height = 160;

                        const countiesForState = territories
                            .filter((t) => t.state === st)
                            .map((t) => normalizeCountyName(t.county));

                        return (
                            <div key={st} style={{ width }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <strong>{st}</strong>
                                    <small style={{ color: "#666" }}>{countiesForState.length} {countiesForState.length === 1 ? "county" : "counties"}</small>
                                </div>
                                <svg width={width} height={height} style={{ background: "#fff", border: "1px solid #eee" }}>
                                    {features.map((f: any, idx: number) => {
                                        const geom = f.geometry;
                                        const polys: any[] = geom.type === "Polygon" ? [geom.coordinates] : geom.coordinates;
                                        return polys.map((poly, pi) =>
                                            poly.map((ring: number[][], ri: number) => {
                                                // build path for this ring
                                                const d = ring
                                                    .map((pt: number[], i: number) => {
                                                        if (pt[0] == null || pt[1] == null) return "";
                                                        const [x, y]: [number, number] = projectPoint(pt[0], pt[1], bbox, width, height, 6);
                                                        return `${i === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
                                                    })
                                                    .join(" ") + " Z";

                                                const countyName = f.properties?.name || "";
                                                const isHighlighted = countiesForState.includes(normalizeCountyName(countyName));
                                                const isHovered = hovered === countyName;

                                                const fillColor = isHighlighted ? "#b03a2e" : "#f5f5f5"; // new brick red for highlighted
                                                const strokeColor = isHighlighted ? "#000" : "#999"; // stronger borders
                                                const strokeW = isHighlighted || isHovered ? 0.9 : 0.6;

                                                return (
                                                    <Tooltip key={`${idx}-${pi}-${ri}`} title={countyName} placement="top">
                                                        <path
                                                            d={d}
                                                            fill={isHovered ? (isHighlighted ? "#8b2e24" : "#d0d0d0") : fillColor}
                                                            stroke={strokeColor}
                                                            strokeWidth={strokeW}
                                                            opacity={isHighlighted ? 1 : 0.95}
                                                            onMouseEnter={() => setHovered(countyName)}
                                                            onMouseLeave={() => setHovered(null)}
                                                            style={{ cursor: "pointer" }}
                                                        />
                                                    </Tooltip>
                                                );
                                            }),
                                        );
                                    })}
                                </svg>
                            </div>
                        );
                    })
                )}
            </div>
            <div style={{ marginTop: 8 }}>
                <p style={{ margin: "4px 0 0 0", color: "#666", fontSize: 12 }}>Counties marked in red are served by the utility.</p>
            </div>
        </Card>
    );
}

export default CountyMap;
