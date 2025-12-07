import { useEffect, useMemo, useState } from "react";
import { Card } from "antd";
import * as queries from "../data/queries";
import type { RatePlan } from "../data/schema";
import {
  useCountyGeoJSON,
  computeBBoxAndFeaturesByState,
  normalizeCountyName,
} from "../hooks/useCountyGeojson";
import { CountyMapSvg } from "../charts/CountyMapSvg";
import { CardWithTooltip } from "./CardWithTooltip";
import { countyMapTooltip } from "../copy";

type TerritoryRow = { county: string; state: string };

export function CountyMap({
  selectedPlan,
}: {
  selectedPlan?: RatePlan | null;
}) {
  const [territories, setTerritories] = useState<TerritoryRow[]>([]);

  const {
    data: geojson,
    isLoading: isLoadingGeo,
    error: geoError,
  } = useCountyGeoJSON();

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

  const states = useMemo(
    () => Array.from(new Set(territories.map((t) => t.state))).sort(),
    [territories],
  );

  const { bbox, featuresByState } = useMemo(
    () => computeBBoxAndFeaturesByState(geojson, states),
    [geojson, states],
  );

  const countiesSet = useMemo(
    () =>
      new Set(
        territories.map((t) => `${t.state}:${normalizeCountyName(t.county)}`),
      ),
    [territories],
  );

  const width = 400;
  const height = width / 1.61;

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
    <CardWithTooltip tooltip={countyMapTooltip}>
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
          <CountyMapSvg
            width={width}
            height={height}
            bbox={bbox}
            featuresByState={featuresByState}
            highlightedCounties={countiesSet}
          />
        </>
      )}
    </CardWithTooltip>
  );
}

export default CountyMap;
