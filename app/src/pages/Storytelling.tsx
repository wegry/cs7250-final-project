import { Link } from 'react-router-dom'
import s from './Storytelling.module.css'

function Storytelling() {
  return (
    <main className={s.main}>
      <section>
        <h2>Flat Rate Plans</h2>
        Lorem Ipsum{' '}
        <Link to="detail/5cd3415b5457a3fc7154e9d2?date=2024-12-01">
          Eversource
        </Link>
      </section>
      <section>
        <h2>Flat Rate Plans with Lots of Tiers</h2>
        <Link to="detail/539fb70dec4f024bc1dc0749?date=2025-10-28">
          City of Kosciusko, Mississippi
        </Link>
      </section>
      <section>
        <h2>Time of Day</h2>
        Lorem Ipsum{' '}
        <Link to="/detail/677ec1cf74180cdbbe08888c?date=2025-06-11">
          Virginia Electric & Power Co
        </Link>
      </section>
      <section>
        <h2>Coincident Demand</h2>
        Coincident plans charge based usage during the peak hour (chosen by the
        utility) per month{' '}
        <Link to="/detail/539f6bceec4f024411eca1eb?date=2025-08-21">
          Oklahoma Electric Coop Inc
        </Link>
      </section>
      <section>
        <h2>Demand</h2>
        Some plans charge by the kW (power at an instant) like{' '}
        <Link to="/detail/67d48dcb050f9354dc00a80e?date=2024-08-13">
          Denton County Electric Co-op
        </Link>
      </section>
      <section>
        <h2>Flat Demand</h2>
        Lorem Ipsum{' '}
        <Link to="/detail/67cf29554def754a900b5f79?date=2025-06-11">
          Pudget Sound Energy Inc
        </Link>
      </section>
      <section>
        <h2>All of the Above</h2>
        Some plans use energy rates and usage tiers, coincident demand rate,
        demand rates, and flat demand rates like{' '}
        <Link to="/detail/5da604f35457a3624a6dbecf?date=2025-11-18">
          Jacksonville Electric Authority
        </Link>
      </section>
    </main>
  )
}

export default Storytelling
