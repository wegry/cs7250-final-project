import {
  Button,
  Col,
  Collapse,
  DatePicker,
  Descriptions,
  type DescriptionsProps,
  Form,
  Popover,
  Row,
} from "antd";
import clsx from "clsx";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { RatePlanSelector } from "../components/RatePlanSelector";
import { useRateSupercededBy } from "../hooks/useRateInPlanData";
import { useRatePlan } from "../hooks/useRatePlan";
import * as s from "./DetailView.module.css";

import dayjs, { Dayjs } from "dayjs";
import { useCallback, useMemo } from "react";
import { EnergyRateChart } from "../charts/energyRateStructure";
import {
  CoincidentRateChart,
  DemandRateChart,
  DemandTierRateChart,
  FlatDemandChart,
} from "../charts/otherRateStructures";
import { DetailSection } from "../components/DetailSection";
import { FixedChargesCard } from "../components/FixedCharges";
import { RatePlanTimeline } from "../components/RatePlanTimeline";
import { ScheduleHeatmap } from "../components/Schedule";
import { list } from "../formatters";
import { EnergyTiersChart } from "../charts/EnergyTiersChart";
import CountyMap from "../components/CountyMap";
const DATE_PARAM = "date";

const DESCRIPTIONS = {
  energy:
    "Total electricity used over time—like buying gallons of gas. The more you use, the more you pay. Rates often vary by time of day.",
  demand:
    "Your peak usage rate at any instant, not the total. Utilities charge for this because they must build infrastructure to handle everyone's maximum draw at once. Common for businesses, rare for homes.",
  coincidentDemand:
    "Charges based on your usage during the grid's system-wide peak—typically hot summer afternoons. Customers contributing most to collective stress pay more.",
  flatDemand:
    "A simpler demand charge that applies the same rate regardless of when your peak occurs.",
  fixedCharges:
    "Fixed monthly costs that appear on your bill regardless of how much electricity you use. These cover metering, billing, and basic infrastructure costs. Minimum charges ensure a baseline payment even with very low usage.",
} as const;

export default function DetailView() {
  const { id: ratePlanParam } = useParams();
  const [params, setParams] = useSearchParams();
  const date = dayjs(params.get(DATE_PARAM) || "2025-10-01");
  const { data: selectedPlan, isLoading: selectedPlanLoading } =
    useRatePlan(ratePlanParam);

  const { data: supercededBy } = useRateSupercededBy(ratePlanParam);

  const nav = useNavigate();

  const handleRatePlanChange = async (value: string) => {
    nav(`/detail/${value}`);
  };

  const hasFixedCharges = useMemo(() => {
    if (!selectedPlan) return false;
    return (
      selectedPlan.fixedChargeFirstMeter != null ||
      selectedPlan.fixedChargeEaAddl != null ||
      selectedPlan.minCharge != null ||
      (selectedPlan.fixedKeyVals?.length ?? 0) > 0
    );
  }, [selectedPlan]);

  const descriptions = useMemo(() => {
    return [
      { label: "Utility Name", children: selectedPlan?.utilityName },
      {
        label: "Rate Name",
        children: selectedPlan?.rateName,
        span: { md: 3, lg: 2 },
      },
      { label: "States", children: list.format(selectedPlan?.states ?? []) },
      {
        label: "Supercedes",
        children: selectedPlan?.supercedes ? (
          <Link
            className={s.supercedes}
            to={`/detail/${selectedPlan?.supercedes}`}
          >
            {selectedPlan?.supercedes}
          </Link>
        ) : (
          <>&mdash;</>
        ),
      },
      {
        label: "Superceded By",
        children: supercededBy?.[0]?._id ? (
          <Link className={s.supercedes} to={`/detail/${supercededBy[0]._id}`}>
            {supercededBy[0]._id}
          </Link>
        ) : (
          <>&mdash;</>
        ),
      },
      {
        label: "Is Default?",
        children: selectedPlan?.is_default === true ? "Yes" : "No",
      },
      {
        label: "Source",
        children: selectedPlan?.sourceReference ? (
          <a
            href={selectedPlan?.sourceReference!}
            style={{ whiteSpace: "nowrap" }}
          >
            Link
          </a>
        ) : (
          <>&mdash;</>
        ),
      },
      {
        label: "Source Parent",
        children: selectedPlan?.sourceParent ? (
          <a href={selectedPlan.sourceParent} style={{ whiteSpace: "nowrap" }}>
            Link
          </a>
        ) : (
          <>&mdash;</>
        ),
      },
      {
        label: "Description",
        children: selectedPlan?.description ? (
          <Popover
            content={
              <div className={s.copy}>
                <p>{selectedPlan.description}</p>
              </div>
            }
            trigger="click"
          >
            <Button>Click me</Button>
          </Popover>
        ) : (
          <>&mdash;</>
        ),
      },
    ] satisfies DescriptionsProps["items"];
  }, [selectedPlan, supercededBy]);

  const onDateChange = useCallback(
    (newDate: Dayjs) => {
      setParams((params) => {
        const next = newDate.format("YYYY-MM-DD");
        if (params.get(DATE_PARAM) != next) {
          params.set(DATE_PARAM, next);
        }
        return params;
      });
    },
    [setParams]
  );

  return (
    <main className={s.main}>
      <Form layout="horizontal" className={s.form}>
        <Row gutter={16} className={s.header}>
          <Col>
            <h1>Details</h1>
          </Col>
          <Col span={15}>
            <Form.Item label="Rate Plan" className={s.noMargin}>
              <RatePlanSelector
                value={ratePlanParam}
                onChange={handleRatePlanChange}
              />
            </Form.Item>
          </Col>
          <Col>
            <Button
              href={`https://apps.openei.org/USURDB/rate/view/${selectedPlan?._id}`}
            >
              View on USURDB
            </Button>
          </Col>
        </Row>
        <Row>
          <Col>
            <Collapse
              className={s.meta}
              defaultActiveKey={1}
              items={[
                {
                  key: 1,
                  label: "Rate Plan Metadata",
                  children: <Descriptions items={descriptions} size="small" />,
                },
              ]}
            />
          </Col>
        </Row>
        <Row gutter={24}>
          <Col>
            <Form.Item label="For Date">
              <DatePicker
                allowClear={false}
                value={date}
                onChange={onDateChange}
              />
            </Form.Item>
          </Col>
        </Row>
      </Form>

      <div
        className={clsx(s.charts, { [s.chartLoading]: selectedPlanLoading })}
      >
        <DetailSection
          description={DESCRIPTIONS.fixedCharges}
          hide={!hasFixedCharges}
          title="Fixed & Minimum Charges"
        >
          <FixedChargesCard selectedPlan={selectedPlan} />
        </DetailSection>

        <DetailSection
          description={DESCRIPTIONS.energy}
          hide={selectedPlan?.energyWeekdaySched == null}
          title="Energy"
        >
          <ScheduleHeatmap
            selectedPlan={selectedPlan}
            date={date}
            type="energy"
            onDateChange={onDateChange}
          />
          <EnergyRateChart selectedPlan={selectedPlan} date={date} />
          <EnergyTiersChart selectedPlan={selectedPlan} date={date} />
        </DetailSection>
        <DetailSection
          description={DESCRIPTIONS.coincidentDemand}
          hide={selectedPlan?.coincidentSched == null}
          title="Coincident Demand"
        >
          <CoincidentRateChart selectedPlan={selectedPlan} date={date} />
        </DetailSection>
        <DetailSection
          description={DESCRIPTIONS.demand}
          title="Demand"
          hide={selectedPlan?.demandWeekdaySched == null}
        >
          <ScheduleHeatmap
            selectedPlan={selectedPlan}
            date={date}
            type={"demand"}
            onDateChange={onDateChange}
          />
          <DemandRateChart selectedPlan={selectedPlan} date={date} />
          <DemandTierRateChart selectedPlan={selectedPlan} date={date} />
        </DetailSection>
        <DetailSection
          description={DESCRIPTIONS.flatDemand}
          title="Flat Demand"
          hide={selectedPlan?.flatDemandMonths == null}
        >
          <FlatDemandChart
            selectedPlan={selectedPlan}
            date={date}
            onDateChange={onDateChange}
          />
        </DetailSection>
        <CountyMap selectedPlan={selectedPlan} />
      </div>
      <Col sm={10} md={10} lg={6}>
        <RatePlanTimeline ratePlan={selectedPlan} />
      </Col>
    </main>
  );
}
