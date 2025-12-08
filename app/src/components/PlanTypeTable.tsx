import { Link } from "react-router-dom";
import { Input, Table } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import {
  getPlansByType,
  type PlanType,
  type PlanTypeSummary,
} from "../data/plan-type-queries";
import { countFormatter, list } from "../formatters";
import s from "./PlanTypeTable.module.css";

interface PlanTypeTableProps {
  planType: PlanType;
  /** Date to filter active plans */
  date?: dayjs.Dayjs;
}

export function PlanTypeTable({
  planType,
  date = dayjs(),
}: PlanTypeTableProps) {
  const dateStr = date.format("YYYY-MM-DD");

  const [utilityFilter, setUtilityFilter] = useState("");
  const [rateFilter, setRateFilter] = useState("");
  const [stateFilter, setStateFilter] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["plansByType", planType, dateStr],
    queryFn: async () => {
      const result = await getPlansByType(planType, date);
      return result;
    },
  });

  const buildTextFilter = (
    placeholder: string,
    value: string,
    onChange: (next: string) => void,
  ) =>
    ({ setSelectedKeys, selectedKeys, confirm, clearFilters }: any) => (
      <div style={{ padding: 8 }}>
        <Input
          placeholder={placeholder}
          value={selectedKeys[0] as string | undefined ?? value}
          onChange={(e) => {
            const next = e.target.value;
            setSelectedKeys(next ? [next] : []);
            onChange(next);
            confirm({ closeDropdown: false });
          }}
          onPressEnter={() => confirm()}
          allowClear
          style={{ marginBottom: 8, display: "block" }}
          autoFocus
        />
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <a
            onClick={() => {
              onChange("");
              setSelectedKeys([]);
              clearFilters?.();
              confirm({ closeDropdown: false });
            }}
          >
            Reset
          </a>
          <a onClick={() => confirm({ closeDropdown: true })}>Apply</a>
        </div>
      </div>
    );

  const textFilterIcon = (filtered: boolean) => (
    <SearchOutlined style={{ color: filtered ? "#1677ff" : undefined }} />
  );

  const matches = (value: string | undefined | null, query: string) =>
    (value ?? "").toLowerCase().includes(query.toLowerCase());

  const columns: ColumnsType<PlanTypeSummary> = [
    {
      title: "State(s)",
      dataIndex: "states",
      key: "states",
      width: 78,
      filterDropdown: buildTextFilter("Search states", stateFilter, setStateFilter),
      filterIcon: textFilterIcon,
      filteredValue: stateFilter ? [stateFilter] : null,
      onFilter: (value, record) =>
        (record.states ?? []).some((st) => matches(st, value as string)),
      render: (_, record) => {
        return list.format(record.states ?? []);
      },
    },
    {
      title: "Utility",
      dataIndex: "utilityName",
      key: "utilityName",
      ellipsis: true,
      filterDropdown: buildTextFilter(
        "Search utility",
        utilityFilter,
        setUtilityFilter,
      ),
      filterIcon: textFilterIcon,
      filteredValue: utilityFilter ? [utilityFilter] : null,
      onFilter: (value, record) => matches(record.utilityName, value as string),
    },
    {
      title: "Rate Name",
      dataIndex: "rateName",
      key: "rateName",
      filterDropdown: buildTextFilter("Search rate name", rateFilter, setRateFilter),
      filterIcon: textFilterIcon,
      filteredValue: rateFilter ? [rateFilter] : null,
      onFilter: (value, record) => matches(record.rateName, value as string),
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

  const count = data?.length ?? 0;

  return (
    <>
      <h3>
        Other Examples
        {!isLoading && (
          <span className={s.count}>
            &nbsp;({countFormatter.format(count)})
          </span>
        )}
      </h3>
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
