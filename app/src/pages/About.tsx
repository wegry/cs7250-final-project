import { Typography, Card } from "antd";
import s from "./About.module.css";

const { Paragraph, Title } = Typography;

const sections = [
  { id: "motivation", title: "Motivation" },
  { id: "related-work", title: "Related Work" },
  { id: "expert-interviews", title: "Expert Interviews" },
  { id: "task-analysis", title: "Task Analysis" },
  { id: "data", title: "Data" },
  { id: "design-process", title: "Design Process" },
  { id: "final-visualization", title: "Final Visualization" },
  { id: "conclusion", title: "Conclusion" },
] as const;

function About() {
  return (
    <div className={s.clipper}>
      <main className={s.main}>
        <Title level={1}>About This Project</Title>

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

        <section id="motivation">
          <Title level={2}>Motivation</Title>
          <Paragraph>
            America's electricity grids face unprecedented challenges—extreme
            weather events, aging infrastructure, and surging demand from data
            centers and electrification initiatives. Variable peak pricing and
            demand response programs are critical tools for managing grid
            stability, yet their implementation varies dramatically across
            regions. This creates real disparities in both grid resilience and
            what consumers actually pay.
          </Paragraph>
          <Paragraph>
            We built this tool to help answer some fundamental questions: How
            can we make variable electricity pricing more transparent? What
            patterns exist across different utilities and regions? And how do
            different pricing mechanisms actually impact your costs under
            various usage scenarios?
          </Paragraph>
        </section>

        <section id="related-work">
          <Title level={2}>Related Work</Title>
          <Paragraph>
            Commercial platforms like{" "}
            <a href="https://www.gridstatus.io">GridStatus.io</a> and{" "}
            <a href="https://app.electricitymaps.com">Electricity Maps</a>{" "}
            provide real-time grid monitoring and carbon intensity
            visualization—but they focus on wholesale markets rather than what
            residential customers actually experience. Individual ISO dashboards
            from{" "}
            <a href="https://www.caiso.com">CAISO</a>,{" "}
            <a href="https://www.ercot.com">ERCOT</a>, and{" "}
            <a href="https://www.iso-ne.com">ISO-NE</a>{" "}
            remain siloed, making cross-regional comparison difficult.
          </Paragraph>
          <Paragraph>
            Research on demand response documents substantial variation in how
            programs are implemented across different regulatory contexts.
            Energy affordability research identifies critical gaps in
            visualizing energy justice issues—particularly for frontline
            communities. Our platform addresses these gaps by combining EIA
            datasets with utility-level pricing data, enabling cross-regional
            comparison while linking technical grid operations to consumer
            impacts.
          </Paragraph>
        </section>

        <section id="expert-interviews">
          <Title level={2}>Expert Interviews</Title>
          <Paragraph>
            We conducted two expert interviews to inform our design. First, we
            spoke with ISO New England External Affairs representatives Marissa
            Ribeiro Dahan and Eric Johnson about wholesale electricity market
            operations and demand response mechanisms. Second, we interviewed
            Professor Fang Fang from Northeastern University's College of
            Engineering for technical guidance on visualization approaches.
          </Paragraph>
          <Paragraph>
            The ISO-NE interview revealed something fundamental: wholesale and
            retail electricity markets operate with surprising independence.
            Johnson characterized the relationship as "relatively
            inelastic"—State Public Utilities Commissions, not ISOs, control
            retail pricing. This creates institutional barriers to unified
            demand response programs. Despite ISO-NE's sophisticated locational
            marginal pricing (three zones in Massachusetts alone), these
            wholesale signals rarely translate to what you actually pay.
            Time-of-use pricing remains a "blunt instrument" for residential
            demand response.
          </Paragraph>
          <Paragraph>
            Professor Fang helped us refine our geographic visualization
            approach, suggesting that task-driven design with tabs and
            context-appropriate encodings would serve users better than focusing
            solely on map-based representations.
          </Paragraph>
        </section>

        <section id="task-analysis">
          <Title level={2}>Task Analysis</Title>
          <Paragraph>
            Based on our interviews and literature review, we identified key
            user tasks using Munzner's task abstraction framework. The
            wholesale-retail disconnect we learned about from ISO-NE
            fundamentally reshaped our priorities—rather than visualizing market
            efficiency, we focused on helping users navigate existing
            institutional complexity.
          </Paragraph>
          <Paragraph>
            Our priority tasks include: viewing rate plan schedules and tiers,
            comparing pricing between utilities, filtering by ZIP code or state,
            viewing geographical distribution of utilities within balancing
            authorities, and identifying trends in pricing across time. We
            deprioritized comparing wholesale costs with retail costs based on
            the data actually available to us.
          </Paragraph>
        </section>

        <section id="data">
          <Title level={2}>Data</Title>
          <Paragraph>
            Our primary datasets are the US Energy Information Agency (EIA) Form
            861 and the{" "}
            <a href="https://openei.org/wiki/Utility_Rate_Database">
              US Utility Rate Database
            </a>{" "}
            from OpenEI. EIA 861 includes utility-level reporting on dynamic
            pricing enrollment and states/counties served. The data is well
            structured and doesn't require much cleaning.
          </Paragraph>
          <Paragraph>
            USURDB contains 20 years of electric utility pricing data—around 768
            columns and 159,000 rows. After filtering for residential plans
            active during 2024, we ended up with 5,572 rows and 313 columns.
            Most columns describe electricity prices at specific tiers, with
            specific pricing logic, during specific time periods. Since there
            are numerous periods, tiers, and logic types—and most plans use only
            a few of them—our data frame is very sparse.
          </Paragraph>
          <Paragraph>
            The mix of structured rate data with semi-structured JSON schedules
            and unstructured text comments makes this dataset challenging but
            information-rich for analyzing pricing patterns. Our data is
            available on GitHub at{" "}
            <a href="https://github.com/wegry/cs7250-final-project">
              github.com/wegry/cs7250-final-project
            </a>
            .
          </Paragraph>
        </section>

        <section id="design-process">
          <Title level={2}>Design Process</Title>
          <Paragraph>
            We started with pen-and-paper sketches to explore different ways of
            showing electricity pricing data. The challenge was figuring out how
            to display pricing mechanisms, grid operations, and affordability
            impacts without overwhelming users. After several brainstorming
            sessions, we found decent overlap between our individual designs.
          </Paragraph>
          <Paragraph>
            Our consensus: use a map as the centerpiece of exploration, with the
            ability to drill down from the overview to detailed views of
            specific utilities and their rate plans. We implemented brushing and
            linking on time series graphs of rate/demand schedules and
            daily/yearly trends. Comparison views between utilities are handled
            by a selection mechanism to display multiple utilities on the same
            graph.
          </Paragraph>
        </section>

        <section id="final-visualization">
          <Title level={2}>Final Visualization</Title>
          <Paragraph>
            The final visualization is an interactive web application built with
            React, TypeScript, and Vite. We used React Router for navigation,
            Ant Design for UI components, TanStack Query for data management,
            DuckDB-WASM for client-side querying, and Vega-Lite for chart
            visualizations. GeoJSON data powers our mapping of balancing
            authority boundaries.
          </Paragraph>
          <Paragraph>
            The app features multiple coordinated views: a storytelling homepage
            with categorized rate plan examples, a zip code search for
            location-based discovery, a detailed rate plan viewer, a comparison
            tool for side-by-side analysis, and an interactive map for
            geographic exploration. Users can navigate between views seamlessly,
            with state preserved across navigation.
          </Paragraph>
        </section>

        <section id="conclusion">
          <Title level={2}>Conclusion</Title>
          <Paragraph>
            This project created an accessible, interactive tool for exploring
            variable electricity pricing across the United States. By combining
            comprehensive data with visualization design informed by expert
            interviews, we've made complex rate structures more transparent and
            comparable.
          </Paragraph>
          <Paragraph>
            Our interviews revealed a key insight: the separation between
            wholesale and retail electricity markets is institutional rather
            than technical—a deliberate design choice, not a limitation to
            overcome. This shifted our focus from visualizing idealized market
            mechanisms to creating tools that work within existing regulatory
            frameworks.
          </Paragraph>
          <Paragraph>
            Future work could expand to commercial and industrial rates,
            incorporate real-time pricing data, add personalized cost
            projections based on usage patterns, and integrate solar and battery
            storage scenarios to help users understand the economics of
            distributed energy resources.
          </Paragraph>
        </section>
      </main>
    </div>
  );
}

export default About;