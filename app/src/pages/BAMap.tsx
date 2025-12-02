import { useRef, useEffect, useState } from "react";
import { Spin, Alert, Card, Typography, Table } from "antd";
import { Link } from "react-router-dom";
import { conn } from "../data/duckdb";
import * as d3 from "d3";
import type { FeatureCollection } from "geojson";
import * as s from "./DetailView.module.css";

const { Title, Paragraph } = Typography;

interface BASummary {
  name: string;
  zoneName: string;
  totalPlans: number;
  numUtilities: number;
}

interface BAProperties {
  name?: string;
  BA_NAME?: string;
  BA_CODE?: string;
  zoneName?: string;
  zone_name?: string;
  code?: string;
  baSummary?: BASummary;
}

export default function BAMap() {
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [utilities, setUtilities] = useState<any[]>([]);
  const [selectedBA, setSelectedBA] = useState<string | null>(null);
  const [utilsLoading, setUtilsLoading] = useState(false);

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    const width = svgRef.current.clientWidth || 900;
    const height = 600;

    svg.attr("viewBox", `0 0 ${width} ${height}`);

    // CONUS Albers projection with fixed parameters
    const projection = d3
      .geoAlbers()
      .rotate([96, 0])
      .center([0, 38.5])
      .parallels([29.5, 45.5])
      .scale(1100)
      .translate([width / 2, height / 2]);

    const path = d3.geoPath().projection(projection);

    // Tooltip
    const tooltip = d3.select(tooltipRef.current);

    async function loadMap() {
      setLoading(true);
      try {
        // Load GeoJSON and BA summary in parallel
        const [geojson, baSummaryData] = await Promise.all([
          d3.json<FeatureCollection>("/geodata/ba-data.geojson"),
          d3
            .json<BASummary[]>("/ba-summary.json")
            .catch(() => [] as BASummary[]),
        ]);

        if (!geojson) throw new Error("Failed to load GeoJSON");

        // Create lookup map for BA summaries
        const baSummaryMap = new Map<string, BASummary>();
        if (baSummaryData) {
          baSummaryData.forEach((ba) => {
            baSummaryMap.set(ba.name, ba);
            if (ba.zoneName) baSummaryMap.set(ba.zoneName, ba);
          });
        }

        // Rewind polygon coordinates to correct winding order for D3
        // D3 expects counterclockwise exterior rings (RFC 7946)
        function rewindRing(ring: number[][]) {
          // Calculate signed area to determine winding
          let area = 0;
          const n = ring.length;
          for (let i = 0; i < n; i++) {
            const j = (i + 1) % n;
            const pi = ring[i];
            const pj = ring[j];
            if (pi && pj) {
              area += (pi[0] ?? 0) * (pj[1] ?? 0);
              area -= (pj[0] ?? 0) * (pi[1] ?? 0);
            }
          }
          // If area > 0, ring is clockwise - reverse it for exterior
          if (area > 0) {
            ring.reverse();
          }
          return ring;
        }

        function rewindPolygon(coords: number[][][]) {
          // First ring is exterior (should be counterclockwise)
          if (coords[0]) rewindRing(coords[0]);
          // Subsequent rings are holes (should be clockwise - opposite)
          for (let i = 1; i < coords.length; i++) {
            const ring = coords[i];
            if (!ring) continue;
            let area = 0;
            const n = ring.length;
            for (let j = 0; j < n; j++) {
              const k = (j + 1) % n;
              const pj = ring[j];
              const pk = ring[k];
              if (pj && pk) {
                area += (pj[0] ?? 0) * (pk[1] ?? 0);
                area -= (pk[0] ?? 0) * (pj[1] ?? 0);
              }
            }
            // Holes should be clockwise (area < 0 after standard calc means CCW, so reverse)
            if (area < 0) {
              ring.reverse();
            }
          }
          return coords;
        }

        function rewindGeometry(geometry: any) {
          if (!geometry) return geometry;
          if (geometry.type === "Polygon") {
            rewindPolygon(geometry.coordinates);
          } else if (geometry.type === "MultiPolygon") {
            geometry.coordinates.forEach((poly: number[][][]) =>
              rewindPolygon(poly),
            );
          }
          return geometry;
        }

        // Filter out Alaska and Hawaii by zone name pattern
        let conusFeatures = geojson.features.filter((f) => {
          if (!f.geometry) return false;
          const props = f.properties as BAProperties;
          const zoneName = props?.zoneName || props?.zone_name || "";
          if (zoneName.startsWith("US-AK-") || zoneName.startsWith("US-HI-")) {
            return false;
          }
          return true;
        });

        // Rewind all geometries to fix winding order
        conusFeatures.forEach((f) => {
          rewindGeometry(f.geometry);
        });

        // Sort by area descending so smaller features render on top
        conusFeatures.sort((a, b) => {
          const areaA = path.area(a as any) || 0;
          const areaB = path.area(b as any) || 0;
          return areaB - areaA;
        });

        // Merge BA summary into properties
        conusFeatures.forEach((f) => {
          const props = f.properties as BAProperties;
          const zoneName = props?.zoneName || props?.zone_name;
          const baCode = props?.code || props?.BA_CODE;
          const summary =
            baSummaryMap.get(zoneName || "") || baSummaryMap.get(baCode || "");
          if (summary) {
            (f.properties as any).baSummary = summary;
          }
        });

        console.log(`Rendering ${conusFeatures.length} features`);

        // Clear previous content
        svg.selectAll("*").remove();

        // Draw features
        svg
          .append("g")
          .selectAll("path")
          .data(conusFeatures)
          .join("path")
          .attr("d", (d) => path(d as any) || "")
          .attr("fill", "#3388ff")
          .attr("fill-opacity", 0.3)
          .attr("stroke", "#2c3e50")
          .attr("stroke-width", 2)
          .attr("stroke-opacity", 0.8)
          .attr("cursor", "pointer")
          .on("mouseenter", function (event, d) {
            d3.select(this).attr("fill-opacity", 0.6).attr("stroke-width", 3);

            const props = d.properties as BAProperties;
            const ba = props.baSummary;
            const name =
              props.name || props.BA_NAME || props.zoneName || "Unknown BA";
            const code = props.code || props.BA_CODE || "";

            const summaryLines: string[] = [];
            if (ba?.totalPlans !== undefined)
              summaryLines.push(`Plans: ${ba.totalPlans}`);
            if (ba?.numUtilities !== undefined)
              summaryLines.push(`Utilities: ${ba.numUtilities}`);

            tooltip
              .style("opacity", 1)
              .style("left", `${event.pageX + 10}px`)
              .style("top", `${event.pageY + 10}px`).html(`
                <strong>${name}</strong>
                ${code ? `<br/>Code: ${code}` : ""}
                ${summaryLines.length ? `<br/>${summaryLines.join("<br/>")}` : ""}
              `);
          })
          .on("mousemove", (event) => {
            tooltip
              .style("left", `${event.clientX + 10}px`)
              .style("top", `${event.clientY + 10}px`);
          })
          .on("mouseleave", function () {
            d3.select(this).attr("fill-opacity", 0.3).attr("stroke-width", 2);
            tooltip.style("opacity", 0);
          })
          .on("click", (_event, d) => {
            const props = d.properties as BAProperties;
            const baShortFromSummary = props?.baSummary?.name;
            const baShortFromZone = props?.zoneName
              ? String(props.zoneName).split("-").slice(-1)[0]
              : null;
            const baShort =
              baShortFromSummary ||
              baShortFromZone ||
              props.name ||
              props.BA_NAME ||
              props.BA_CODE ||
              props.zone_name ||
              null;

            const baDisplay =
              props?.baSummary?.zoneName ||
              props?.zoneName ||
              props?.name ||
              "Unknown BA";

            setSelectedBA(baDisplay);
            fetchUtilitiesForBA(baShort);
          });

        setLoading(false);
      } catch (err) {
        console.error("Error creating map:", err);
        setError(err as Error);
        setLoading(false);
      }
    }

    loadMap();
  }, []);

  async function fetchUtilitiesForBA(baKey: string | null) {
    if (!baKey) {
      setUtilities([]);
      return;
    }

    setUtilsLoading(true);
    try {
      const c = await conn;

      const q = `
        SELECT
          u.utilityName,
          MIN(u._id) AS sample_id,
          COUNT(*) AS plans,
          MIN(u.eiaId) AS eiaId
        FROM flattened.usurdb u
        LEFT JOIN flattened.utility_data ud ON ud.eiaId = u.eiaId
        WHERE ud.eiaId IS NOT NULL
          AND lower(CAST(ud.ba AS VARCHAR)) LIKE '%' || lower(?) || '%'
        GROUP BY u.utilityName
        ORDER BY u.utilityName
      `;

      const stmt = await c.prepare(q);
      const result = await stmt.query(baKey);
      const rows = result.toArray();

      setUtilities(rows);
    } catch (err) {
      console.error("Error fetching utilities for BA:", err);
      setUtilities([]);
    } finally {
      setUtilsLoading(false);
    }
  }

  return (
    <main
      className={s.main}
      style={{ padding: "24px", maxWidth: "1400px", margin: "0 auto" }}
    >
      <h1>U.S. Balancing Authorities</h1>

      {error && (
        <Alert
          message="Error Loading Map"
          description={error.message}
          type="error"
          showIcon
          style={{ marginBottom: "24px" }}
        />
      )}

      <Card style={{ marginBottom: "24px", position: "relative" }}>
        {loading && (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(255, 255, 255, 0.9)",
              zIndex: 10,
            }}
          >
            <Spin size="large" />
          </div>
        )}
        <svg
          ref={svgRef}
          style={{
            width: "100%",
            height: "600px",
            display: "block",
          }}
        />
        {/* Tooltip element */}
        <div
          ref={tooltipRef}
          style={{
            position: "fixed",
            opacity: 0,
            background: "white",
            border: "1px solid #ccc",
            borderRadius: "4px",
            padding: "8px",
            pointerEvents: "none",
            boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
            zIndex: 1000,
            fontSize: "14px",
          }}
        />
      </Card>

      <Card
        title={selectedBA ? `Utilities in ${selectedBA}` : "Utilities"}
        style={{ marginBottom: "24px" }}
      >
        <Table
          columns={[
            { title: "Utility", dataIndex: "utilityName", key: "utilityName" },
            { title: "Plans", dataIndex: "plans", key: "plans" },
            { title: "EIA ID", dataIndex: "eiaId", key: "eiaId" },
            {
              title: "Details",
              key: "detail",
              render: (_: any, record: any) =>
                record.sample_id ? (
                  <Link to={`/detail/${record.sample_id}`}>View</Link>
                ) : (
                  <>—</>
                ),
            },
          ]}
          dataSource={utilities}
          rowKey={(r) => r.utilityName}
          loading={utilsLoading}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      <Card title="About This Map">
        <Paragraph>
          This map displays the geographic boundaries of U.S. balancing
          authorities (BAs) operating in the continental United States.
          Balancing authorities are entities responsible for maintaining
          real-time balance between electricity supply and demand within their
          respective control areas.
        </Paragraph>
      </Card>
    </main>
  );
}
