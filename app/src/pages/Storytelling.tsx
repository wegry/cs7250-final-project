import { Link } from "react-router-dom";
import dayjs from "dayjs";
import { PlanTypeTable } from "../components/PlanTypeTable";
import s from "./Storytelling.module.css";

// Use current date for filtering active plans
const TODAY = dayjs();

function Storytelling() {
  return (
    <main className={s.main}>
      <h1>How is electricity priced in the US?</h1>
      This app uses{" "}
      <a href="https://openei.org/wiki/Utility_Rate_Database">OpenEI data</a> to
      try and show what rates are in use across the country.{" "}
      <i>
        Note: these rates and prices are mostly generation charges and do not
        include distribution charges.
      </i>
      <section>
        <h2>Flat Rate Plans</h2>
        <p>
          Flat rate plans are the simplest form of electricity pricing—you pay
          the same price per kilowatt-hour no matter when you use power or how
          much you consume. This predictability makes budgeting easy, but it
          also means there's no financial incentive to shift your usage to
          off-peak hours. Utilities like{" "}
          <Link to="detail/5cd3415b5457a3fc7154e9d2?date=2024-12-01">
            Eversource
          </Link>{" "}
          offer these straightforward plans that work well for households with
          consistent energy habits.
        </p>
        <PlanTypeTable planType="flat" date={TODAY} limit={5} />
      </section>
      <section>
        <h2>Flat Rate Plans with Lots of Tiers</h2>
        <p>
          Tiered rate plans charge different prices depending on how much
          electricity you use each month. The first block of kilowatt-hours
          might be relatively cheap, but as your consumption climbs into higher
          tiers, the price per kWh increases—sometimes dramatically. This
          structure encourages conservation by making heavy usage progressively
          more expensive, as seen in plans from utilities like the{" "}
          <Link to="detail/539fb70dec4f024bc1dc0749?date=2025-10-28">
            City of Kosciusko, Mississippi
          </Link>
          .
        </p>
        <PlanTypeTable planType="tiered" date={TODAY} limit={5} />
      </section>
      <section>
        <h2>Time of Day</h2>
        <p>
          Time-of-use (TOU) plans charge different rates depending on when you
          consume electricity. Peak hours—typically late afternoon and early
          evening when demand is highest—cost significantly more than off-peak
          periods like late night or early morning. These plans reward customers
          who can shift activities like laundry, dishwashing, or EV charging to
          cheaper hours, as offered by{" "}
          <Link to="/detail/677ec1cf74180cdbbe08888c?date=2025-06-11">
            Virginia Electric & Power Co
          </Link>
          .
        </p>
        <PlanTypeTable planType="tou" date={TODAY} limit={5} />
      </section>
      <section>
        <h2>Coincident Demand</h2>
        <p>
          Coincident demand plans charge based on your usage during the single
          peak hour each month—a window chosen by the utility based on
          system-wide demand. This means your bill depends heavily on whether
          you happened to be running appliances during that critical hour. If
          you can avoid heavy usage when the grid is most stressed, you can see
          significant savings with plans like those from{" "}
          <Link to="/detail/539f6bceec4f024411eca1eb?date=2025-08-21">
            Oklahoma Electric Coop Inc
          </Link>
          .
        </p>
        <PlanTypeTable planType="coincident" date={TODAY} limit={5} />
      </section>
      <section>
        <h2>Demand</h2>
        <p>
          Demand-based plans charge not just for total energy consumed, but also
          for your peak power draw measured in kilowatts. Think of it like
          paying for the size of the pipe, not just the water that flows through
          it—if you run many appliances simultaneously, you'll face higher
          demand charges even if your total consumption is modest. Utilities
          like{" "}
          <Link to="/detail/67d48dcb050f9354dc00a80e?date=2024-08-13">
            Denton County Electric Co-op
          </Link>{" "}
          use this model to encourage customers to spread their usage more
          evenly.
        </p>
        <PlanTypeTable planType="demand" date={TODAY} limit={5} />
      </section>
      <section>
        <h2>Flat Demand</h2>
        <p>
          Flat demand plans include a fixed monthly charge based on a
          predetermined demand threshold, regardless of your actual peak usage.
          This provides cost certainty for customers while still accounting for
          the infrastructure needed to serve their maximum power needs. Plans
          from{" "}
          <Link to="/detail/67cf29554def754a900b5f79?date=2025-06-11">
            Puget Sound Energy Inc
          </Link>{" "}
          demonstrate how utilities balance simplicity with demand-based cost
          recovery.
        </p>
        <PlanTypeTable planType="flatDemand" date={TODAY} limit={5} />
      </section>
      <section>
        <h2>All of the Above</h2>
        <p>
          Some rate structures combine multiple pricing mechanisms into a single
          plan—tiered energy rates, time-of-use pricing, coincident demand
          charges, and flat demand fees all layered together. These complex
          structures attempt to capture the true cost of electricity delivery
          across different dimensions of usage. Plans like those from{" "}
          <Link to="/detail/5da604f35457a3624a6dbecf?date=2025-11-18">
            Jacksonville Electric Authority
          </Link>{" "}
          show how intricate electricity pricing can become, making tools like
          this one essential for understanding your bill.
        </p>
        <PlanTypeTable planType="complex" date={TODAY} limit={5} />
      </section>
    </main>
  );
}

export default Storytelling;
