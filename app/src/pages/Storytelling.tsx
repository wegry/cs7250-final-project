import { Card, Typography } from "antd";
import dayjs from "dayjs";
import { InternalLink } from "../components/InternalLink";
import { PlanTypeTable } from "../components/PlanTypeTable";
import s from "./Storytelling.module.css";
import { ExternalLink } from "../components/ExternalLink";

// Use current date for filtering active plans
const TODAY = dayjs();

const { Paragraph } = Typography;

const sections = [
  { id: "flat", title: "Flat Rate Plans" },
  { id: "tiered", title: "Flat Rate Plans with Lots of Tiers" },
  { id: "tou", title: "Time of Day" },
  { id: "coincident", title: "Coincident Demand" },
  { id: "demand", title: "Demand" },
  { id: "flat-demand", title: "Flat Demand" },
  { id: "complex", title: "All of the Above" },
] as const;

function Storytelling() {
  const body = (
    <main className={s.main}>
      <h1>How is electricity usage priced in the US?</h1>
      <Paragraph>
        Electricity rates in the United States vary widely by utility and
        region. Below are the main categories of pricing mechanisms used across
        the country.
      </Paragraph>
      <h2 id="plan-survey">Different Categories of Utility Rate Plans</h2>
      <Card className={s.toc}>
        <strong>Jump to:</strong>
        <ul>
          {sections.map(({ id, title }) => (
            <li key={id}>
              <a href={`#${id}`}>{title}</a>
            </li>
          ))}
        </ul>
      </Card>
      <section id="flat">
        <div className={`${s.imageContainer} ${s.leftImage}`}>
          <img
            src="/images/flat_rate.png"
            alt="Flat Rate Plan Example"
            className={s.sectionImage}
          />
        </div>
        <h3>Flat Rate Plans</h3>
        <Paragraph>
          Flat rate plans are the simplest form of electricity pricing—you pay
          the same price per kilowatt-hour no matter when you use power or how
          much you consume. This predictability makes budgeting easy, but it
          also means there's no financial incentive to shift your usage to
          off-peak hours. Utilities like{" "}
          <InternalLink to="/detail/5cd3415b5457a3fc7154e9d2?date=2024-12-01">
            Eversource
          </InternalLink>{" "}
          offer these straightforward plans that work well for households with
          consistent energy habits.
        </Paragraph>
        <PlanTypeTable planType="flat" date={TODAY} />
      </section>
      <section id="tiered">
        <div className={`${s.imageContainer} ${s.rightImage}`}>
          <img
            src="/images/flat_rate_with_tiers.png"
            alt="Tiered Rate Plan Example"
            className={s.sectionImage}
          />
        </div>
        <h3>Flat Rate Plans with Lots of Tiers</h3>
        <Paragraph>
          Tiered rate plans charge different prices depending on how much
          electricity you use each month. The first block of kilowatt-hours
          might be relatively cheap, but as your consumption climbs into higher
          tiers, the price per kWh increases—sometimes dramatically. This
          structure encourages conservation by making heavy usage progressively
          more expensive, as seen in plans from utilities like the{" "}
          <InternalLink to="/detail/539fb70dec4f024bc1dc0749?date=2025-10-28">
            City of Kosciusko, Mississippi
          </InternalLink>
          .
        </Paragraph>
        <PlanTypeTable planType="tiered" date={TODAY} />
      </section>
      <section id="tou">
        <div className={`${s.imageContainer} ${s.leftImage}`}>
          <img
            src="/images/time_of_use.png"
            alt="Time of Use Plan Example"
            className={s.sectionImage}
          />
        </div>
        <h3>Time of Day</h3>
        <Paragraph>
          Time-of-use (TOU) plans charge different rates depending on when you
          consume electricity. Peak hours—typically late afternoon and early
          evening when demand is highest—cost significantly more than off-peak
          periods like late night or early morning. These plans reward customers
          who can shift activities like laundry, dishwashing, or EV charging to
          cheaper hours, as offered by{" "}
          <InternalLink to="/detail/677ec1cf74180cdbbe08888c?date=2025-06-11">
            Virginia Electric & Power Co
          </InternalLink>
          .
        </Paragraph>
        <PlanTypeTable planType="tou" date={TODAY} />
      </section>
      <section id="coincident">
        <div className={`${s.imageContainer} ${s.rightImage}`}>
          <img
            src="/images/coincident_demand.png"
            alt="Coincident Demand Plan Example"
            className={s.sectionImage}
          />
        </div>
        <h3>Coincident Demand</h3>
        <Paragraph>
          Coincident demand plans charge based on your usage during the single
          peak hour each month—a window chosen by the utility based on
          system-wide demand. This means your bill depends heavily on whether
          you happened to be running appliances during that critical hour. If
          you can avoid heavy usage when the grid is most stressed, you can see
          significant savings with plans like those from{" "}
          <InternalLink to="/detail/539f6bceec4f024411eca1eb?date=2025-08-21">
            Oklahoma Electric Coop Inc
          </InternalLink>
          .
        </Paragraph>
        <PlanTypeTable planType="coincident" date={TODAY} />
      </section>
      <section id="demand">
        <div className={`${s.imageContainer} ${s.rightImage}`}>
          <img
            src="/images/demand.png"
            alt="Demand Plan Example"
            className={s.sectionImage}
          />
        </div>
        <h3>Demand</h3>
        <Paragraph>
          Demand-based plans charge not just for total energy consumed, but also
          for your peak power draw measured in kilowatts. Think of it like
          paying for the size of the pipe, not just the water that flows through
          it—if you run many appliances simultaneously, you'll face higher
          demand charges even if your total consumption is modest. Utilities
          like{" "}
          <InternalLink to="/detail/67d48dcb050f9354dc00a80e?date=2024-08-13">
            Denton County Electric Co-op
          </InternalLink>{" "}
          use this model to encourage customers to spread their usage more
          evenly.
        </Paragraph>
        <PlanTypeTable planType="demand" date={TODAY} />
      </section>
      <section id="flat-demand">
        <div className={`${s.imageContainer} ${s.leftImage}`}>
          <img
            src="/images/flat_demand_1.png"
            alt="Flat Demand Plan Example 1"
            className={s.sectionImage}
          />
        </div>
        <div className={`${s.imageContainer} ${s.rightImage}`}>
          <img
            src="/images/flat_demand_2.png"
            alt="Flat Demand Plan Example 2"
            className={s.sectionImage}
          />
        </div>
        <h3>Flat Demand</h3>
        <Paragraph>
          Flat demand plans include a fixed monthly charge based on a
          predetermined demand threshold, regardless of your actual peak usage.
          This provides cost certainty for customers while still accounting for
          the infrastructure needed to serve their maximum power needs. Plans
          from{" "}
          <InternalLink to="/detail/67cf29554def754a900b5f79?date=2025-06-11">
            Puget Sound Energy Inc
          </InternalLink>{" "}
          demonstrate how utilities balance simplicity with demand-based cost
          recovery.
        </Paragraph>
        <PlanTypeTable planType="flatDemand" date={TODAY} />
      </section>
      <section id="complex">
        <div className={`${s.imageContainer} ${s.leftImage}`}>
          <img
            src="/images/all_1.png"
            alt="Complex Plan Example 1"
            className={s.sectionImage}
          />
        </div>
        <div className={`${s.imageContainer} ${s.rightImage}`}>
          <img
            src="/images/all_2.png"
            alt="Complex Plan Example 2"
            className={s.sectionImage}
          />
        </div>
        <h3>All of the Above</h3>
        <Paragraph>
          Some rate structures combine multiple pricing mechanisms into a single
          plan—tiered energy rates, time-of-use pricing, coincident demand
          charges, and flat demand fees all layered together. These complex
          structures attempt to capture the true cost of electricity delivery
          across different dimensions of usage. Plans like those from{" "}
          <InternalLink to="/detail/5da604f35457a3624a6dbecf?date=2025-11-18">
            Jacksonville Electric Authority
          </InternalLink>{" "}
          show how intricate electricity pricing can become, making tools like
          this one essential for understanding your bill.
        </Paragraph>
        <PlanTypeTable planType="complex" date={TODAY} />
      </section>
      <section>
        <h2>Footnotes</h2>
        <Paragraph id="footnote-1">
          [1] This app uses{" "}
          <ExternalLink href="https://openei.org/wiki/Utility_Rate_Database">
            OpenEI data
          </ExternalLink>{" "}
          to show what rates are in use across the country.{" "}
          <i>
            Note: these rates and prices are Residential and mostly generation
            charges and do not include distribution charges.
          </i>
        </Paragraph>
      </section>
    </main>
  );

  return <div className={s.clipper}>{body}</div>;
}

export default Storytelling;
