import { useRef, useEffect, useState } from "react";
import { Spin, Alert, Card, Typography, Table } from "antd";
import { createLeafletMap, destroyLeafletMap } from "../charts/baMapSimple";
import type L from "leaflet";
import { Link } from "react-router-dom";
import { conn } from "../data/duckdb";
import * as s from "./DetailView.module.css";

const { Title, Paragraph } = Typography;

export default function BAMap() {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<L.Map | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [utilities, setUtilities] = useState<any[]>([]);
  const [selectedBA, setSelectedBA] = useState<string | null>(null);
  const [utilsLoading, setUtilsLoading] = useState(false);

  useEffect(() => {
    if (!mapRef.current) return;

    setLoading(true);

    createLeafletMap(mapRef.current, {
      center: [39.8283, -98.5795],
      zoom: 4,
      geojsonUrl: "/geodata/ba-data.geojson", // Your GeoJSON file path
      baSummaryUrl: "/ba-summary.json",
      style: {
        fillColor: "#3388ff",
        fillOpacity: 0.3,
        color: "#2c3e50",
        weight: 2,
        opacity: 0.8,
      },
      hoverStyle: {
        fillOpacity: 0.6,
        weight: 3,
      },
      // Tooltip receives merged properties. If BA summary was found it's available at `props.baSummary`.
      tooltipFormatter: (props) => {
        const ba = props.baSummary;
        const name =
          props.name || props.BA_NAME || props.zoneName || "Unknown BA";
        const code = props.code || props.BA_CODE || "";

        const summaryLines = [];
        if (ba && typeof ba.totalPlans !== "undefined")
          summaryLines.push(`Plans: ${ba.totalPlans}`);
        if (ba && typeof ba.numUtilities !== "undefined")
          summaryLines.push(`Utilities: ${ba.numUtilities}`);

        return `
          <div style="padding:8px;">
            <strong>${name}</strong>
            ${code ? `<br/>Code: ${code}` : ""}
            ${summaryLines.length ? `<br/>${summaryLines.join("<br/>")}` : ""}
          </div>
        `;
      },
      onFeatureClick: (props) => {
        // Prefer short BA code from baSummary.name (e.g., 'ISONE', 'PJM').
        // Fallback to the last segment of zoneName (e.g., 'US-NE-ISNE' -> 'ISNE').
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

        // Display a friendly name (prefer full zoneName or name)
        const baDisplay =
          props?.baSummary?.zoneName ||
          props?.zoneName ||
          props?.name ||
          "Unknown BA";

        setSelectedBA(baDisplay);
        // Pass the short code (or fallback) to the DB matcher which expects short codes like 'ISONE'
        fetchUtilitiesForBA(baShort);
      },
    })
      .then((map) => {
        leafletMapRef.current = map;
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error creating map:", err);
        setError(err);
        setLoading(false);
      });

    return () => {
      if (leafletMapRef.current) {
        destroyLeafletMap(leafletMapRef.current);
        leafletMapRef.current = null;
      }
    };
  }, []);

  async function fetchUtilitiesForBA(baKey: string | null) {
    if (!baKey) {
      setUtilities([]);
      return;
    }

    setUtilsLoading(true);
    try {
      const c = await conn;

      // Join to utility_data where BA assignments are stored and match ba key.
      // utility_data.ba may be an ARRAY or a string; cast to VARCHAR and use LIKE for robustness.
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
      <Title level={2}>U.S. Balancing Authorities</Title>

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
        <div
          ref={mapRef}
          style={{
            width: "100%",
            height: "600px",
            position: "relative",
            zIndex: 0,
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
