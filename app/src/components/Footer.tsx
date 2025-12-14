import { ExternalLink } from "./ExternalLink";
import styles from "./Footer.module.css";

const dataSources = [
  {
    name: "EIA 861 Annual (2024)",
    url: "https://www.eia.gov/electricity/data/eia861/",
    note: "Service Territory table",
  },
  {
    name: "US Utility Rate DB (USURDB)",
    url: "https://openei.org/apps/USURDB/",
    note: "OpenEI",
  },
  {
    name: "Census TIGER/Line (2020)",
    url: "https://www.census.gov/geographies/mapping-files/time-series/geo/cartographic-boundary.html",
    note: "State & county boundaries",
  },
  {
    name: "Electricity Maps",
    url: "https://github.com/electricitymaps/electricitymaps-contrib",
    note: "Balancing authority geometries",
  },
  {
    name: "EIA Wholesale Pricing",
    url: "https://www.eia.gov/electricity/wholesale/",
    note: "2020–2024 data",
  },
  {
    name: "HUD Crosswalk",
    url: "https://www.huduser.gov/apps/public/uspscrosswalk/home",
    note: "County zip code mapping (2020)",
  },
];

export function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.content}>
        <div className={styles.course}>
          <span className={styles.courseCode}>CS7250</span>
          <span className={styles.courseTitle}>
            Information Visualization: Theory and Application
          </span>
          <span className={styles.school}>Northeastern University</span>
        </div>

        <div className={styles.sources}>
          <h4 className={styles.sourcesHeading}>Data Sources</h4>
          <ul className={styles.sourcesList}>
            {dataSources.map((source) => (
              <li key={source.name} className={styles.sourceItem}>
                <ExternalLink
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.sourceLink}
                >
                  {source.name}
                </ExternalLink>
                {source.note && (
                  <span className={styles.sourceNote}>{source.note}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
}
