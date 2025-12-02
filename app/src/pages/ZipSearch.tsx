import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Alert, Card, Col, Input, Row, Spin, Table } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { conn } from "../data/duckdb";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import {
  useCountyGeoJSON,
  computeBBoxAndFeaturesByState,
  normalizeCountyName,
} from "../hooks/useCountyGeojson";
import { CountyMapSvg } from "../charts/CountyMapSvg";
import * as s from "./ZipSearch.module.css";
import { countFormatter } from "../formatters";
import { PageBody } from "../components/PageBody";

// Zod schema for utility results
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

// Table columns configuration
const columns: ColumnsType<UtilityResult> = [
  { title: "Zip Code", dataIndex: "zipcode", key: "zipcode" },
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
  { title: "State", dataIndex: "State", key: "state" },
  { title: "County", dataIndex: "County", key: "county" },
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

  // Use shared GeoJSON hook
  const {
    data: geojson,
    isLoading: geoLoading,
    error: geoError,
  } = useCountyGeoJSON();

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

  // Compute bbox and features using shared utility
  const { bbox, featuresByState } = useMemo(
    () => computeBBoxAndFeaturesByState(geojson, relevantStates),
    [geojson, relevantStates],
  );

  const width = 500;
  const height = width / 1.61;

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

  const getTooltip = (
    countyName: string,
    state: string,
    isHighlighted: boolean,
  ) => `${countyName}, ${state}${isHighlighted ? " (Matched)" : ""}`;

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
                <CountyMapSvg
                  width={width}
                  height={height}
                  bbox={bbox}
                  featuresByState={featuresByState}
                  highlightedCounties={highlightedCounties}
                  getTooltip={getTooltip}
                />
                <p style={{ margin: "8px 0 0 0", color: "#666", fontSize: 12 }}>
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
