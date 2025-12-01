import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Alert, Input, Table } from "antd";
import type { ColumnsType } from "antd/es/table";
import { Link, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { conn } from "../data/duckdb";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import * as s from "./ZipSearch.module.css";

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

  return (
    <div className={s.container}>
      <h1>Search Utilities by Zip Code</h1>
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
        />
      </div>

      {isError && (
        <Alert
          type="error"
          description={
            error instanceof Error ? error.message : "Failed to fetch utilities"
          }
          style={{ marginBottom: 16 }}
        />
      )}

      <Table
        columns={columns}
        dataSource={results}
        tableLayout="fixed"
        pagination={{
          pageSize: 100,
          showSizeChanger: true,
          pageSizeOptions: ["10", "20", "50", "100"],
          showTotal: (total, range) =>
            `${range[0]}-${range[1]} of ${total} utility/zip code pairs`,
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
    </div>
  );
}
