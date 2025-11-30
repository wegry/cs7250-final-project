import { Link } from "react-router-dom";
import { Table } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import {
  getPlansByType,
  type PlanType,
  type PlanTypeSummary,
} from "../data/plan-type-queries";
import { list } from "../formatters";
import s from "./PlanTypeTable.module.css";

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
      title: "State(s)",
      dataIndex: "states",
      key: "states",
      width: 78,
      render: (_, record) => {
        return list.format(record.states ?? []);
      },
    },
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
      width: 100,
      render: (_, record) => record.effectiveDate?.format("L") ?? "—",
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
    <>
      <h3>Other Examples</h3>
      <div className={s.expandable}>
        <Table<PlanTypeSummary>
          columns={columns}
          dataSource={data}
          rowKey="_id"
          loading={isLoading}
          pagination={{ pageSize: 100 }}
          size="small"
          bordered
          style={{ marginTop: "1rem" }}
          locale={{ emptyText: "No matching plans found" }}
          scroll={{ y: 55 * 3 }}
        />
      </div>
    </>
  );
}
