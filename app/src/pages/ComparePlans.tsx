import { useMemo } from "react";
import { useImmer } from "use-immer";
import {
  Form,
  DatePicker,
  Row,
  Col,
  Select,
  Switch,
  Card,
  Statistic,
} from "antd";
import dayjs, { Dayjs } from "dayjs";
import { useRatePlan } from "../hooks/useRatePlan";
import { RatePlanSelector } from "../components/RatePlanSelector";
import { calculateMonthlyBill, type PriceBreakdown } from "../prices";
import { Link, useSearchParams } from "react-router-dom";
import {
  type DwellingType,
  type Region,
  type DwellingProfile,
  estimateHourlyUsage,
  estimateMonthlyKwh,
} from "../data/usage-estimator";
import s from "./ComparePlans.module.css";

const DATE_MIN = dayjs("2024-01-01");
const DATE_DEFAULT = dayjs().clone().set("year", 2024).set("month", 0);
const DATE_MAX = dayjs("2024-12-31");

export const RATE_PLAN_QUERY_PARAM = "rate-plan";
const RATE_PLAN_2_QUERY_PARAM = "other-rate-plan";

type State = {
  dwellingType: DwellingType;
  region: Region;
  hasGasHeat: boolean;
  hasGasAppliances: boolean;
  hasEV: boolean;
  date: Dayjs;
};

const DWELLING_OPTIONS = [
  { value: "house", label: "🏠 Single Family Home" },
  { value: "townhouse", label: "🏘️ Townhouse / Duplex" },
  { value: "apartment", label: "🏢 Apartment / Condo" },
];

const REGION_OPTIONS = [
  { value: "northeast", label: "Northeast" },
  { value: "midwest", label: "Midwest" },
  { value: "south", label: "South" },
  { value: "west", label: "West" },
];

function ComparePlans() {
  const [searchParams, setSearchParams] = useSearchParams();
  const ratePlanSelected = searchParams.get(RATE_PLAN_QUERY_PARAM);
  const ratePlan2Selected = searchParams.get(RATE_PLAN_2_QUERY_PARAM);

  const [state, updateState] = useImmer<State>({
    dwellingType: "house",
    region: "northeast",
    hasGasHeat: true,
    hasGasAppliances: false,
    hasEV: false,
    date: DATE_DEFAULT,
  });

  const season = useMemo(() => {
    const month = state.date.month();
    return month >= 4 && month <= 9 ? "summer" : "winter";
  }, [state.date]);

  const dwellingProfile: DwellingProfile = useMemo(
    () => ({
      dwellingType: state.dwellingType,
      region: state.region,
      hasGasHeat: state.hasGasHeat,
      hasGasAppliances: state.hasGasAppliances,
      hasEV: state.hasEV,
    }),
    [state],
  );

  const synthData = useMemo(
    () => estimateHourlyUsage(dwellingProfile, season),
    [dwellingProfile, season],
  );

  const estimatedMonthlyKwh = useMemo(
    () => estimateMonthlyKwh(dwellingProfile, season),
    [dwellingProfile, season],
  );

  const { data: ratePlan } = useRatePlan(ratePlanSelected);
  const { data: ratePlan2 } = useRatePlan(ratePlan2Selected);

  const bill1 = calculateMonthlyBill({
    ratePlan,
    synthData,
    monthStarting: state.date,
  });

  const bill2 = calculateMonthlyBill({
    ratePlan: ratePlan2,
    synthData,
    monthStarting: state.date,
  });

  return (
    <div className={s.main}>
      <div>
        <h1>Compare Rate Plans</h1>
        <p>
          See how different rate plans affect your bill based on your home and
          usage patterns
        </p>
      </div>

      <Card title="Your Home Profile" style={{ marginBottom: 24 }}>
        <Form layout="vertical">
          <Row gutter={24}>
            <Col>
              <Form.Item label="Dwelling Type">
                <Select
                  value={state.dwellingType}
                  options={DWELLING_OPTIONS}
                  onChange={(value) =>
                    updateState((s) => {
                      s.dwellingType = value;
                    })
                  }
                />
              </Form.Item>
            </Col>
            <Col>
              <Form.Item label="Region">
                <Select
                  value={state.region}
                  options={REGION_OPTIONS}
                  onChange={(value) =>
                    updateState((s) => {
                      s.region = value;
                    })
                  }
                />
              </Form.Item>
            </Col>
            <Col>
              <Form.Item label="Billing Month">
                <DatePicker
                  picker="month"
                  allowClear={false}
                  minDate={DATE_MIN}
                  maxDate={DATE_MAX}
                  value={state.date}
                  onChange={(value) =>
                    updateState((s) => {
                      s.date = value;
                    })
                  }
                />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={48}>
            <Col>
              <Form.Item
                label="Gas Heating"
                tooltip="Furnace or boiler uses natural gas"
              >
                <Switch
                  checked={state.hasGasHeat}
                  onChange={(checked) =>
                    updateState((s) => {
                      s.hasGasHeat = checked;
                    })
                  }
                />
                <span style={{ marginLeft: 8 }}>
                  {state.hasGasHeat ? "Yes" : "No (Electric)"}
                </span>
              </Form.Item>
            </Col>
            <Col>
              <Form.Item
                label="Gas Appliances"
                tooltip="Gas stove, water heater, or dryer"
              >
                <Switch
                  checked={state.hasGasAppliances}
                  onChange={(checked) =>
                    updateState((s) => {
                      s.hasGasAppliances = checked;
                    })
                  }
                />
                <span style={{ marginLeft: 8 }}>
                  {state.hasGasAppliances ? "Yes" : "No"}
                </span>
              </Form.Item>
            </Col>
            <Col>
              <Form.Item
                label="EV Charging at Home"
                tooltip="Tesla Model Y or similar (~7.6kW Level 2)"
              >
                <Switch
                  checked={state.hasEV}
                  onChange={(checked) =>
                    updateState((s) => {
                      s.hasEV = checked;
                    })
                  }
                />
                <span style={{ marginLeft: 8 }}>
                  {state.hasEV ? "Model Y" : "No EV"}
                </span>
              </Form.Item>
            </Col>
          </Row>
        </Form>

        <Row gutter={16} style={{ marginTop: 16 }}>
          <Col>
            <Statistic
              title="Est. Monthly Usage"
              value={estimatedMonthlyKwh}
              suffix="kWh"
              precision={0}
            />
          </Col>
          <Col>
            <Statistic
              title="Season"
              value={season === "winter" ? "❄️ Winter" : "☀️ Summer"}
            />
          </Col>
        </Row>
      </Card>

      <Card title="Select Rate Plans" style={{ marginBottom: 24 }}>
        <Form layout="vertical">
          <Row gutter={24}>
            <Col span={12}>
              <Form.Item label="Rate Plan 1">
                <RatePlanSelector
                  byDate={state.date}
                  value={ratePlanSelected}
                  onChange={(e) =>
                    setSearchParams((prev) => {
                      prev.set(RATE_PLAN_QUERY_PARAM, e);
                      return prev;
                    })
                  }
                />
                {ratePlanSelected && (
                  <Link
                    to={`/detail/${ratePlanSelected}`}
                    style={{ marginLeft: 8 }}
                  >
                    View Details →
                  </Link>
                )}
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Rate Plan 2 (Optional)">
                <RatePlanSelector
                  byDate={state.date}
                  value={ratePlan2Selected}
                  onChange={(e) =>
                    setSearchParams((prev) => {
                      prev.set(RATE_PLAN_2_QUERY_PARAM, e);
                      return prev;
                    })
                  }
                />
                {ratePlan2Selected && (
                  <Link
                    to={`/detail/${ratePlan2Selected}`}
                    style={{ marginLeft: 8 }}
                  >
                    View Details →
                  </Link>
                )}
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Card>

      <Row gutter={24}>
        {ratePlan && "total" in bill1 && (
          <Col span={12}>
            <BillBreakdown
              rateName={ratePlan.rateName}
              utilityName={ratePlan.utilityName}
              effectiveDate={ratePlan.effectiveDate?.format("YYYY-MM-DD")}
              endDate={ratePlan.endDate?.format("YYYY-MM-DD")}
              breakdown={bill1}
            />
          </Col>
        )}
        {ratePlan2 && "total" in bill2 && (
          <Col span={12}>
            <BillBreakdown
              rateName={ratePlan2.rateName}
              utilityName={ratePlan2.utilityName}
              effectiveDate={ratePlan2.effectiveDate?.format("YYYY-MM-DD")}
              endDate={ratePlan2.endDate?.format("YYYY-MM-DD")}
              breakdown={bill2 as PriceBreakdown}
              comparison={
                ratePlan && "total" in bill1 ? bill1.total : undefined
              }
            />
          </Col>
        )}
      </Row>
    </div>
  );
}

function formatCurrency(val: number) {
  return val.toLocaleString([], { style: "currency", currency: "USD" });
}

function BillBreakdown({
  rateName,
  utilityName,
  effectiveDate,
  endDate,
  breakdown,
  comparison,
}: {
  rateName: string;
  utilityName: string;
  effectiveDate?: string;
  endDate?: string;
  breakdown: PriceBreakdown;
  comparison?: number;
}) {
  const {
    total,
    fixedCharge,
    energyCharge,
    demandCharge,
    flatDemandCharge,
    coincidentDemandCharge,
    minChargeAdjustment,
    kWh,
    peakDemand_kW,
  } = breakdown;

  const rows = [
    { label: "Fixed Charge", value: fixedCharge, color: "#64748b" },
    { label: "Energy Charge", value: energyCharge, color: "#2563eb" },
    { label: "TOU Demand", value: demandCharge, color: "#f97316" },
    { label: "Flat Demand", value: flatDemandCharge, color: "#f59e0b" },
    {
      label: "Coincident Demand",
      value: coincidentDemandCharge,
      color: "#a855f7",
    },
    { label: "Min Charge Adj.", value: minChargeAdjustment, color: "#22c55e" },
  ].filter((row) => row.value > 0);

  const formatDate = (d?: string) => (d ? dayjs(d).format("MMM YYYY") : null);
  const dateRange = [formatDate(effectiveDate), formatDate(endDate)]
    .filter(Boolean)
    .join(" – ");

  const diff = comparison !== undefined ? total - comparison : undefined;

  return (
    <div
      style={{
        border: "2px solid #000",
        background: "#fff",
        padding: 16,
        fontFamily: "system-ui",
      }}
    >
      <div
        style={{
          borderBottom: "8px solid #000",
          paddingBottom: 4,
          marginBottom: 8,
        }}
      >
        <h2 style={{ fontSize: 24, fontWeight: 900, margin: 0 }}>Bill Facts</h2>
        <p style={{ fontSize: 14, color: "#666", margin: 0 }}>{rateName}</p>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span style={{ fontSize: 12, color: "#999" }}>{utilityName}</span>
          {dateRange && (
            <span style={{ fontSize: 11, color: "#999", fontStyle: "italic" }}>
              {dateRange}
            </span>
          )}
        </div>
      </div>

      <div
        style={{
          borderBottom: "1px solid #000",
          padding: "8px 0",
          fontSize: 14,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Total Usage</span>
          <strong>{kWh.toLocaleString()} kWh</strong>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Peak Demand</span>
          <strong>{peakDemand_kW.toFixed(1)} kW</strong>
        </div>
      </div>

      <div style={{ borderBottom: "4px solid #000", padding: "8px 0" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
          }}
        >
          <span style={{ fontSize: 18, fontWeight: 900 }}>Total Due</span>
          <span style={{ fontSize: 32, fontWeight: 900 }}>
            {formatCurrency(total)}
          </span>
        </div>
        {diff !== undefined && (
          <div
            style={{
              textAlign: "right",
              fontSize: 14,
              color: diff > 0 ? "#dc2626" : "#16a34a",
            }}
          >
            {diff > 0
              ? `+${formatCurrency(diff)} more`
              : `${formatCurrency(Math.abs(diff))} savings`}
          </div>
        )}
      </div>

      <div style={{ borderBottom: "1px solid #000", padding: "4px 0" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          <span>Charge Type</span>
          <span>Amount</span>
        </div>
      </div>

      <div style={{ borderBottom: "4px solid #000" }}>
        {rows.map((row, idx) => (
          <div
            key={row.label}
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "6px 0",
              fontSize: 14,
              borderBottom: idx < rows.length - 1 ? "1px solid #eee" : "none",
            }}
          >
            <span>{row.label}</span>
            <span>{formatCurrency(row.value)}</span>
          </div>
        ))}
      </div>

      <div style={{ paddingTop: 8 }}>
        <p style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>
          % of Total Bill
        </p>
        <div
          style={{
            display: "flex",
            height: 24,
            borderRadius: 4,
            overflow: "hidden",
          }}
        >
          {rows.map((row) => {
            const pct = (row.value / total) * 100;
            if (pct < 2) return null;
            return (
              <div
                key={row.label}
                style={{
                  width: `${pct}%`,
                  backgroundColor: row.color,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                  fontSize: 11,
                }}
                title={`${row.label}: ${pct.toFixed(1)}%`}
              >
                {pct > 12 ? `${pct.toFixed(0)}%` : ""}
              </div>
            );
          })}
        </div>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "4px 12px",
            marginTop: 8,
            fontSize: 11,
          }}
        >
          {rows.map((row) => (
            <div
              key={row.label}
              style={{ display: "flex", alignItems: "center", gap: 4 }}
            >
              <div
                style={{ width: 8, height: 8, backgroundColor: row.color }}
              />
              <span>{row.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div
        style={{
          marginTop: 12,
          paddingTop: 8,
          borderTop: "1px solid #ccc",
          fontSize: 12,
          color: "#666",
        }}
      >
        Avg. rate: {((total / kWh) * 100).toFixed(2)}¢/kWh
      </div>
    </div>
  );
}

export default ComparePlans;
