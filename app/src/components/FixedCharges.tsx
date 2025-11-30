import { useMemo } from "react";
import type { RatePlan } from "../data/schema";
import { price } from "../formatters";
import { Card, Table } from "antd";

interface FixedChargeTableRow {
  key: string;
  label: string;
  value: string;
  units: string | null;
}

export function FixedChargesCard({
  selectedPlan,
}: {
  selectedPlan?: RatePlan | null;
}) {
  const rows = useMemo(() => {
    if (!selectedPlan) return [];

    const data: FixedChargeTableRow[] = [];

    if (selectedPlan.fixedChargeFirstMeter != null) {
      data.push({
        key: "firstMeter",
        label: "Fixed Charge (First Meter)",
        value: price.format(selectedPlan.fixedChargeFirstMeter),
        units: selectedPlan.fixedChargeUnits ?? null,
      });
    }

    if (selectedPlan.fixedChargeEaAddl != null) {
      data.push({
        key: "eaAddl",
        label: "Fixed Charge (Each Additional Meter)",
        value: price.format(selectedPlan.fixedChargeEaAddl),
        units: selectedPlan.fixedChargeUnits ?? null,
      });
    }

    if (selectedPlan.minCharge != null) {
      data.push({
        key: "minCharge",
        label: "Minimum Charge",
        value: price.format(selectedPlan.minCharge),
        units: selectedPlan.minChargeUnits ?? null,
      });
    }

    // Include any additional fixed attributes from fixedAttrs
    if (selectedPlan.fixedKeyVals?.length) {
      selectedPlan.fixedKeyVals.forEach((attr, idx) => {
        data.push({
          key: `fixedAttr-${idx}`,
          label: attr.key,
          value: attr.val,
          units: null,
        });
      });
    }

    return data;
  }, [selectedPlan]);

  const columns = [
    { title: "Charge Type", dataIndex: "label", key: "label" },
    { title: "Amount", dataIndex: "value", key: "value" },
    {
      title: "Billing Period",
      dataIndex: "units",
      key: "units",
      render: (units: string | null) => units ?? "—",
    },
  ];

  const hasFixedCharges = rows.length > 0;

  if (!hasFixedCharges) return null;

  return (
    <Card size="small" style={{ gridColumn: "span 2" }}>
      <Table
        dataSource={rows}
        columns={columns}
        pagination={false}
        size="small"
      />
    </Card>
  );
}
