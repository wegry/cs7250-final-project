import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Alert, Card, Col, Form, Input, Row, Spin, Table } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
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
import { preprocessVector } from "../data/schema";
import { countyMapTooltip, zipCodeSearchTooltip } from "../copy";
import { InternalLink } from "../components/InternalLink";
import { useBodyResizeObserver } from "../hooks/useBodyResizeObserver";

// Zod schema for utility results
const UtilityResultSchema = z.object({
  utilityName: z.string().nullable(),
  utilityNumber: z.bigint(),
  usurdb_id: z.string().nullable(),
  states: preprocessVector(z.array(z.string())),
  counties: preprocessVector(z.array(z.string())),
  zipcodes: preprocessVector(z.array(z.string())),
});

const UtilityResultsSchema = z.array(UtilityResultSchema);

type UtilityResult = z.infer<typeof UtilityResultSchema>;

// Table columns configuration
const columns: ColumnsType<UtilityResult> = [
  {
    title: "Utility Name",
    dataIndex: "utilityName",
    key: "utilityName",
    render: (value: string | null, record) =>
      record.usurdb_id ? (
        <InternalLink mode="table" to={`/detail/${record.usurdb_id}`}>
          {value ?? "Unknown"}
        </InternalLink>
      ) : (
        (value ?? "Unknown")
      ),
  },
  {
    title: "States",
    dataIndex: "states",
    key: "states",
    width: 100,
    render: (states: string[]) => states.join(", "),
  },
  {
    title: "Counties",
    dataIndex: "counties",
    key: "counties",
    render: (counties: string[]) => (
      <span title={counties.join(", ")}>
        {counties.length <= 3
          ? counties.join(", ")
          : `${counties.slice(0, 3).join(", ")} +${counties.length - 3} more`}
      </span>
    ),
  },
  {
    title: "Zip Codes",
    dataIndex: "zipcodes",
    key: "zipcodes",
    render: (zips: string[]) => (
      <span title={zips.join(", ")}>
        {zips.length <= 3
          ? zips.join(", ")
          : `${zips.slice(0, 3).join(", ")} +${zips.length - 3} more`}
      </span>
    ),
  },
];

// Query function
async function fetchUtilitiesByZip(zipCode: string): Promise<UtilityResult[]> {
  const stmt = await (await conn).prepare(`
    WITH
    -- Find all rate plans that have been superseded by another
    superseded_ids AS (
      SELECT DISTINCT supercedes AS superseded_id
      FROM flattened.usurdb
      WHERE supercedes IS NOT NULL
    ),
    -- Get the default (or most recent) active plan per utility for linking
    default_plans AS (
      SELECT _id, eiaId
      FROM flattened.usurdb
      WHERE _id NOT IN (SELECT superseded_id FROM superseded_ids)
        AND endDate IS NULL
      QUALIFY ROW_NUMBER() OVER (
        PARTITION BY eiaId
        ORDER BY is_default DESC, effectiveDate DESC
      ) = 1
    ),
    -- Match county id with county name from geojson
    feats AS (
        SELECT unnest(features) as features
        FROM read_json('county-data.geojson')
    ),
    counties AS (
        SELECT
            features.properties.Name as county_name,
            features.properties.geoid as fips,
            features.properties.stusps as stusps
        FROM feats
    ),
    crosswalk_zip_map AS (
        SELECT *
        FROM read_csv('COUNTY_ZIP_122023.csv')
    ),
    -- Match zip codes to counties and utilities
    zip_matches AS (
      SELECT
        est."Utility Name" AS utilityName,
        est."Utility Number" AS utilityNumber,
        dp._id AS usurdb_id,
        est.State AS state,
        est.County AS county,
        map.ZIP AS zipcode
      FROM flattened.eia861_service_territory AS est
      INNER JOIN counties c
        ON c.county_name = est.County AND c.stusps = est.State
      LEFT JOIN crosswalk_zip_map AS map
        ON c.fips = map.COUNTY
      INNER JOIN default_plans dp
        ON dp.eiaId = est."Utility Number"
      WHERE starts_with(map.ZIP, $1)
    )
    -- Group by utility, aggregating states, counties, and zip codes
    SELECT
      utilityName,
      utilityNumber,
      usurdb_id,
      list(DISTINCT state ORDER BY state) AS states,
      list(DISTINCT county ORDER BY county) AS counties,
      list(DISTINCT zipcode ORDER BY zipcode) AS zipcodes
    FROM zip_matches
    GROUP BY utilityName, utilityNumber, usurdb_id
    ORDER BY utilityName
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
    placeholderData: zipCode === "" ? undefined : keepPreviousData,
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
      r.states.forEach((s) => states.add(s));
      r.counties.forEach((c, i) => {
        const state =
          r.states.length === 1 ? r.states[0] : (r.states[i] ?? r.states[0]);
        const key = `${state}:${normalizeCountyName(c)}`;
        counties.add(key);
      });
    });
    return { highlightedCounties: counties, relevantStates: states };
  }, [results]);

  // Compute bbox and features using shared utility
  const { bbox, featuresByState } = useMemo(
    () => computeBBoxAndFeaturesByState(geojson, relevantStates),
    [geojson, relevantStates],
  );
  const { width: bodyWidth } = useBodyResizeObserver();

  const width = Math.min(600, bodyWidth - 64);
  const height = width / 1.61;

  // Summary stats
  const uniqueCounties = useMemo(() => {
    const set = new Set<string>();
    results.forEach((r) => r.counties.forEach((c) => set.add(c)));
    return set.size;
  }, [results]);

  const uniqueZipCodes = useMemo(() => {
    const set = new Set<string>();
    results.forEach((r) => r.zipcodes.forEach((z) => set.add(z)));
    return set.size;
  }, [results]);

  const states = Array.from(relevantStates).sort();

  const getTooltip = (
    countyName: string,
    state: string,
    isHighlighted: boolean,
  ) => `${countyName}, ${state}${isHighlighted ? " (Matched)" : ""}`;

  return (
    <PageBody title="Search Rate Plans by Zip Code">
      <Row>
        <Form className={s.searchSection} style={{ marginBottom: 0 }}>
          <Form.Item required label="Zip Code" tooltip={zipCodeSearchTooltip}>
            <Input
              placeholder="Enter Zip Code..."
              value={zipCode}
              onChange={(e) =>
                setParams(
                  (params) => {
                    const { value } = e.target;
                    if (value !== params.get(ZIP)) {
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
          </Form.Item>
        </Form>
      </Row>
      {isError && (
        <Alert
          type="error"
          description={
            error instanceof Error ? error.message : "Failed to fetch utilities"
          }
          style={{ marginBottom: 16 }}
        />
      )}
      {debouncedZipCode.length >= 1 && results.length > 0 && (
        <Card size="small" style={{ width: "fit-content", marginBottom: 16 }}>
          <Row gutter={16}>
            <Col>
              <strong>{countFormatter.format(uniqueZipCodes)}</strong> zip code
              {uniqueZipCodes !== 1 ? "s" : ""}
            </Col>
            <Col>
              <strong>{countFormatter.format(uniqueCounties)}</strong>{" "}
              {uniqueCounties === 1 ? "county" : "counties"}
            </Col>
            <Col>
              <strong>{countFormatter.format(results.length)}</strong>{" "}
              {results.length === 1 ? "utility" : "utilities"}
            </Col>
          </Row>
        </Card>
      )}

      <Row gutter={[24, 24]}>
        <Col>
          <Card
            style={{ width: "fit-content" }}
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
                <p
                  style={{
                    margin: "8px 0 0 0",
                    color: "#666",
                    fontSize: 12,
                    maxWidth: "40ch",
                  }}
                >
                  {countyMapTooltip}
                </p>
              </>
            )}
          </Card>
        </Col>
        <Col>
          <Table
            columns={columns}
            dataSource={results}
            rowKey={(r) => r.utilityNumber.toString()}
            tableLayout="fixed"
            loading={isLoading}
            pagination={{
              pageSize: 5,
              showSizeChanger: true,
              pageSizeOptions: ["10", "20", "50", "100"],
              showTotal: (total, range) =>
                `${countFormatter.format(range[0])}-${countFormatter.format(range[1])} of ${countFormatter.format(total)} utilities`,
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
      </Row>
    </PageBody>
  );
}
