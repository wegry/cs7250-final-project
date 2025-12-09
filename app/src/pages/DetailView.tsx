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
  Tag,
} from "antd";
import clsx from "clsx";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { RatePlanSelector } from "../components/RatePlanSelector";
import { useRateSupercededBy } from "../hooks/useRateInPlanData";
import { useRatePlan } from "../hooks/useRatePlan";
import * as s from "./DetailView.module.css";

import dayjs, { Dayjs } from "dayjs";
import { useCallback, useMemo, type ReactNode } from "react";
import { EnergyRateChart } from "../charts/energyRateStructure";
import { EnergyTiersChart } from "../charts/EnergyTiersChart";
import {
  CoincidentRateChart,
  DemandRateChart,
  DemandTierRateChart,
  FlatDemandChart,
} from "../charts/otherRateStructures";
import CountyMap from "../components/CountyMap";
import { DetailSection } from "../components/DetailSection";
import { FixedChargesCard } from "../components/FixedCharges";
import { PageBody } from "../components/PageBody";
import { RatePlanTimeline } from "../components/RatePlanTimeline";
import { ScheduleHeatmap } from "../components/Schedule";
import { list } from "../formatters";
import { RATE_PLAN_QUERY_PARAM } from "./ComparePlans";
import { InternalLink } from "../components/InternalLink";
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

function DashIfEmpty({
  children,
  empty,
}: {
  children: ReactNode;
  empty: boolean;
}) {
  if (!empty) {
    return children;
  }

  return <>&mdash;</>;
}

function Copy({ val }: { val: string | null | undefined }) {
  return (
    <DashIfEmpty empty={!val}>
      <Popover
        content={
          <div className={s.copy}>
            <p>{val}</p>
          </div>
        }
        trigger="click"
      >
        <Button size="small">Show</Button>
      </Popover>
    </DashIfEmpty>
  );
}

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
      {
        label: "Utility Service Territory",
        children: list.format(selectedPlan?.states ?? []),
      },
      {
        label: "Supercedes",
        children: selectedPlan?.supercedes ? (
          <InternalLink
            mode="table"
            className={s.supercedes}
            to={`/detail/${selectedPlan?.supercedes}`}
          >
            {selectedPlan?.supercedes}
          </InternalLink>
        ) : (
          <>&mdash;</>
        ),
      },
      {
        label: "Superceded By",
        children: supercededBy?.[0]?._id ? (
          <InternalLink
            mode="table"
            className={s.supercedes}
            to={`/detail/${supercededBy[0]._id}`}
          >
            {supercededBy[0]._id}
          </InternalLink>
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
        children: <Copy val={selectedPlan?.description} />,
      },
      {
        label: "Basic comments",
        children: <Copy val={selectedPlan?.basicComments} />,
      },
      {
        label: "Demand comments",
        children: <Copy val={selectedPlan?.demandComments} />,
      },
      {
        label: "Energy comments",
        children: <Copy val={selectedPlan?.energyComments} />,
      },
      {
        label: "Rate features",
        children: (() => {
          // Time-sensitive (orange)
          const tags = [
            {
              key: "Energy time-of-use",
              active: selectedPlan?.energyWeekdaySched
                ?.map((month) => new Set(month).size ?? 0)
                ?.some((x) => x > 1),
              color: "orange",
            },
            {
              key: "Demand charges",
              active: selectedPlan?.demandWeekdaySched != null,
              color: "orange",
            },
            {
              key: "Coincident demand",
              active: selectedPlan?.coincidentSched != null,
              color: "orange",
            },

            // Volume-sensitive (purple)
            {
              key: "Energy tiers",
              active: selectedPlan?.energyRate_tiers?.some((periodTiers) => {
                const rates = periodTiers.map(
                  (t) => (t.rate ?? 0) + (t.adj ?? 0),
                );
                return new Set(rates).size > 1;
              }),
              color: "purple",
            },
            // Fixed/predictable (cyan)
            {
              key: "Flat energy rate",
              active: selectedPlan?.energyWeekdaySched
                ?.map((month) => new Set(month).size ?? 0)
                ?.every((x) => x === 1),
              color: "cyan",
            },
            {
              key: "Flat demand",
              active: selectedPlan?.flatDemandMonths != null,
              color: "cyan",
            },
          ].flatMap((f) =>
            f.active ? (
              <Tag key={f.key} color={f.color}>
                {f.key}
              </Tag>
            ) : (
              []
            ),
          );

          return <div className={s.tags}>{tags}</div>;
        })(),
      },
    ] satisfies DescriptionsProps["items"];
  }, [selectedPlan, supercededBy]);

  const onDateChange = useCallback(
    (newDate: Dayjs) => {
      setParams(
        (params) => {
          const next = newDate.format("YYYY-MM-DD");
          if (params.get(DATE_PARAM) != next) {
            params.set(DATE_PARAM, next);
          }
          return params;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  return (
    <PageBody className={s.main}>
      <Form layout="horizontal" className={s.form}>
        <Row gutter={[16, 8]} className={s.header}>
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
              href={`/compare?${RATE_PLAN_QUERY_PARAM}=${selectedPlan?._id ?? ""}`}
              type="primary"
              disabled={selectedPlan?._id == null}
            >
              Compare
            </Button>
          </Col>
          <Col>
            <Button
              href={`https://apps.openei.org/USURDB/rate/view/${selectedPlan?._id}`}
              disabled={selectedPlan?._id == null}
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
        <CountyMap selectedPlan={selectedPlan} />
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
        <DetailSection
          description={DESCRIPTIONS.fixedCharges}
          hide={!hasFixedCharges}
          title="Fixed & Minimum Charges"
        >
          <FixedChargesCard selectedPlan={selectedPlan} />
        </DetailSection>
        <RatePlanTimeline ratePlan={selectedPlan} />
      </div>
    </PageBody>
  );
}
