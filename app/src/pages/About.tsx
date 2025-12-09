import { Typography, Card } from "antd";
import s from "./About.module.css";
import { InternalLink } from "../components/InternalLink";
import { ExternalLink } from "../components/ExternalLink";

const { Paragraph, Title } = Typography;

const sections = [
  { id: "related-work", title: "Related Work" },
  { id: "expert-interviews", title: "Expert Interviews" },
  { id: "task-analysis", title: "Task Analysis" },
  { id: "data", title: "Data" },
  { id: "data-analysis", title: "Data Analysis" },
  { id: "design-process", title: "Design Process" },
  { id: "final-visualization", title: "Final Visualization" },
  { id: "conclusion", title: "Conclusion" },
] as const;

function About() {
  return (
    <div className={s.clipper}>
      <main className={s.main}>
        <Title level={1}>Visualizing Dynamic Electricity Pricing</Title>

        <Paragraph>
          America's electricity grids face unprecedented challenges—extreme
          weather events, aging infrastructure, and surging demand from data
          centers and electrification initiatives. Variable peak pricing and
          other demand response programs are critical tools for managing grid
          stability, yet their implementation varies dramatically across
          regions. This creates real disparities in both grid resilience and
          what consumers actually pay.
        </Paragraph>
        <Paragraph>
          We built this tool to help answer some fundamental questions: How can
          we make dynamic electricity pricing more transparent? What patterns
          exist across different utilities and regions? And how do different
          pricing mechanisms actually impact your costs under various usage
          scenarios?
        </Paragraph>

        <section id="pages">
          <Title level={2}>Pages in This App</Title>
          <Paragraph>
            This app consists of several interconnected pages designed to help
            you explore electricity pricing data: The{" "}
            <InternalLink to="/categories">Categories</InternalLink> page
            provides an overview of different pricing mechanisms used across the
            country, with examples of each type.{" "}
            <InternalLink to="/zip-search">Zip Search</InternalLink> allows you
            to discover utilities and rate plans available in your area by
            entering a zip code.{" "}
            <InternalLink to="/detail">Detail View</InternalLink> lets you
            examine specific utilities and rate plans in depth, including
            pricing schedules and tier structures.{" "}
            <InternalLink to="/compare">Compare Plans</InternalLink> enables
            side-by-side comparison of two rate plans to understand how costs
            differ under various usage scenarios. Finally, the{" "}
            <InternalLink to="/map">Map</InternalLink> provides geographic
            exploration of utilities and balancing authorities across the United
            States.
          </Paragraph>
        </section>

        <Card className={s.toc}>
          <strong>Table of Contents:</strong>
          <ul>
            {sections.map(({ id, title }) => (
              <li key={id}>
                <a href={`#${id}`}>{title}</a>
              </li>
            ))}
          </ul>
        </Card>

        <section id="related-work">
          <Title level={2}>Related Work</Title>
          <Paragraph>
            Commercial platforms like{" "}
            <ExternalLink href="https://www.gridstatus.io">
              GridStatus.io
            </ExternalLink>{" "}
            and{" "}
            <ExternalLink href="https://app.electricitymaps.com">
              Electricity Maps
            </ExternalLink>{" "}
            provide real-time grid monitoring and carbon intensity visualization
            - but they focus on wholesale markets rather than what residential
            customers actually experience. Individual ISO dashboards from{" "}
            <ExternalLink href="https://www.caiso.com">CAISO</ExternalLink>,{" "}
            <ExternalLink href="https://www.ercot.com">ERCOT</ExternalLink>, and{" "}
            <ExternalLink href="https://www.iso-ne.com">ISO-NE</ExternalLink>{" "}
            remain siloed, making cross-regional comparison difficult.
          </Paragraph>
          <Paragraph>
            Research on demand response documents substantial variation in how
            programs are implemented across different regulatory contexts. Our
            platform addresses these gaps by combining EIA datasets with
            utility-level pricing data, enabling cross-regional comparison while
            linking technical grid operations to consumer impacts.
          </Paragraph>
        </section>

        <section id="data">
          <Title level={2}>Data</Title>
          <Paragraph>
            Our primary datasets are the US Energy Information Agency (EIA) Form
            861 and the US Utility Rate Database (USURDB) from OpenEI. EIA 861
            includes utility-level reporting on dynamic pricing enrollment and
            states/counties served. The data is well structured and doesn't
            require much cleaning.
          </Paragraph>
          <Paragraph>
            USURDB contains 20 years of electric utility pricing
            data&mdash;around 768 columns and 159,000 rows. After filtering for
            residential plans active during 2024, we ended up with 5,572 rows
            and 313 columns. Most columns describe electricity prices at
            specific tiers, with specific pricing logic, during specific time
            periods. Since there are numerous periods, tiers, and logic
            types&mdash;and most plans use only a few of them&mdash;our data
            frame is very sparse.
          </Paragraph>
          <Paragraph>
            For geographic data, we use Census shapefiles to map the counties
            served by each utility. This enables county-level analysis and
            geographic linking of utilities to the regions they serve. We also
            use a zip code to county mapping from{" "}
            <ExternalLink href="https://github.com/scpike/us-state-county-zip">
              scpike's us-state-county-zip repository
            </ExternalLink>{" "}
            to support our zip code search functionality, allowing users to
            quickly find utilities and rate plans available in their area.
          </Paragraph>
          <Paragraph>
            Finally, we use balancing authority boundary data from the{" "}
            <ExternalLink href="https://github.com/electricitymaps/electricitymaps-contrib">
              Electricity Maps
            </ExternalLink>{" "}
            to visualize the geographic distribution of grid operators and
            utilities across the country. This allows us to show how pricing and
            grid operations vary by balancing authority.
          </Paragraph>
        </section>

        <section id="task-analysis">
          <Title level={2}>Task Analysis</Title>
          <Paragraph>
            Based on our interviews and literature review, we identified key
            user tasks using Munzner's task abstraction framework.
          </Paragraph>
          <Paragraph>
            Our priority tasks include: viewing rate plan schedules and tiers,
            explore rate plans exhibiting different pricing mechanisms,
            comparing pricing between utilities, filtering by ZIP code or state,
            viewing geographical distribution of utilities within balancing
            authorities, and identifying trends in pricing across time. We
            deprioritized comparing wholesale costs with retail costs based on
            the data actually available to us.
          </Paragraph>
        </section>

        <section id="data-analysis">
          <Title level={2}>Data Analysis</Title>
          <Paragraph>
            Our analysis of the 5,572 residential rate plans confirmed the
            diversity of pricing mechanisms described in detail in our{" "}
            <InternalLink to="/categories">Categories</InternalLink> page. We
            found all major pricing structures represented across US utilities,
            from simple flat rates to complex combinations of multiple
            mechanisms. This diversity reflects different regional priorities:
            some utilities emphasize conservation through tiered pricing, while
            others focus on demand management through peak-hour charges or
            demand-based fees.
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
            specific utilities and their rate plans. Since the geographical
            mappings for utilities were unavailable, we show the utilities
            belonging to a balancing authority in a table view. We implemented
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
            Ant Design for UI components, DuckDB-WASM for client-side querying,
            and Vega-Lite for chart visualizations. GeoJSON data powers our
            mapping of balancing authority boundaries.
          </Paragraph>
          <Paragraph>
            The app features multiple coordinated views: a storytelling homepage
            with categorized rate plan examples, a zip code search for
            location-based discovery, a detailed rate plan viewer, a comparison
            tool for side-by-side analysis, and an interactive map for
            geographic exploration per balancing authority.
          </Paragraph>
        </section>

        <section id="conclusion">
          <Title level={2}>Conclusion</Title>
          <Paragraph>
            This project created an interactive tool for exploring variable
            electricity pricing across the United States. By combining
            comprehensive data with visualization design informed by expert
            interviews, we've made complex rate structures more transparent and
            comparable.
          </Paragraph>
          <Paragraph>
            Future work could expand to commercial and industrial rates,
            incorporate real-time pricing data, and integrate solar and battery
            storage scenarios to help users understand the economics of
            distributed energy resources. Additional priorities include building
            a personalized bill calculator based on usage patterns, analyzing
            historical trends in pricing changes across utilities over time, and
            integrating wholesale market pricing data to show how grid-level
            costs translate into what consumers actually pay.
          </Paragraph>
        </section>
      </main>
    </div>
  );
}

export default About;
