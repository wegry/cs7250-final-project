import { Link } from "react-router-dom";
import { Table } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import {
  getPlansByType,
  getPlanTypeCounts,
  type PlanType,
  type PlanTypeSummary,
} from "../data/plan-type-queries";

interface PlanTypeTableProps {
  planType: PlanType;
  /** Date to filter active plans */
  date?: dayjs.Dayjs;
  /** Max rows to display */
  limit?: number;
}

export function PlanTypeTable({
  planType,
  date = dayjs(),
}: PlanTypeTableProps) {
  const dateStr = date.format("YYYY-MM-DD");

  const { data, isLoading, error } = useQuery({
    queryKey: ["plansByType", planType, dateStr],
    queryFn: async () => {
      const result = await getPlansByType(planType, date);
      return result;
    },
  });

  const columns: ColumnsType<PlanTypeSummary> = [
    {
      title: "Utility",
      dataIndex: "utilityName",
      key: "utilityName",
      ellipsis: true,
    },
    {
      title: "Rate Name",
      dataIndex: "rateName",
      key: "rateName",
      render: (text, record) => (
        <Link to={`/detail/${record._id}?date=${dateStr}`}>{text}</Link>
      ),
    },
    {
      title: "Effective",
      dataIndex: "effectiveDate",
      key: "effectiveDate",
      width: 120,
      render: (text) => text ?? "—",
    },
  ];

  if (error) {
    return (
      <div style={{ color: "#e53e3e", padding: "1rem" }}>
        Error: {error instanceof Error ? error.message : "Failed to load plans"}
      </div>
    );
  }

  return (
    <Table<PlanTypeSummary>
      columns={columns}
      dataSource={data}
      rowKey="_id"
      loading={isLoading}
      pagination={{ pageSize: 100 }}
      size="small"
      style={{ marginTop: "1rem" }}
      locale={{ emptyText: "No matching plans found" }}
      scroll={{ y: 55 * 3 }}
    />
  );
}

// Hook for getting plan type counts
export function usePlanTypeCounts(date: dayjs.Dayjs = dayjs()) {
  const dateStr = date.format("YYYY-MM-DD");

  return useQuery({
    queryKey: ["planTypeCounts", dateStr],
    queryFn: () => getPlanTypeCounts(date),
  });
}
