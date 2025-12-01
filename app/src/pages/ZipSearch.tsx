import { useState, useEffect } from "react";
import { get_query } from "../data/duckdb";
import * as s from "./ZipSearch.module.css";

interface UtilityResult {
  "Utility Name": string;
  "Utility Number": number;
  State: string;
  County: string;
  zipcode: string;
}

export function ZipSearch() {
  const [zipCode, setZipCode] = useState("");
  const [results, setResults] = useState<UtilityResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const searchUtilities = async () => {
      if (zipCode.length < 3) {
        setResults([]);
        return;
      }

      setLoading(true);
      try {
        // We use a LIKE query for partial matching if the user is typing, 
        // or exact match if they entered a full zip. 
        // The user said "When someone starts entering their zipcode", so partial match might be nice.
        // But usually zip search is exact or prefix. Let's do prefix.
        
        const query = `
          SELECT DISTINCT
            est."Utility Name",
            est."Utility Number",
            est.State,
            est.County,
            z.zipcode
          FROM flattened.zip_county_map z
          JOIN flattened.eia861_service_territory est 
            ON z.county = est.County AND z.state_abbr = est.State
          WHERE z.zipcode LIKE '${zipCode}%'
          LIMIT 100
        `;

        const arrowResult = await get_query(query);
        const rows = arrowResult.toArray().map((row) => row.toJSON());
        setResults(rows);
      } catch (error) {
        console.error("Error searching utilities:", error);
      } finally {
        setLoading(false);
      }
    };

    const timeoutId = setTimeout(() => {
      searchUtilities();
    }, 300); // Debounce

    return () => clearTimeout(timeoutId);
  }, [zipCode]);

  return (
    <div className={s.container}>
      <h1>Search Utilities by Zip Code</h1>
      <div className={s.searchSection}>
        <input
          type="text"
          className={s.searchInput}
          placeholder="Enter Zip Code..."
          value={zipCode}
          onChange={(e) => setZipCode(e.target.value)}
        />
      </div>

      {loading && <div>Loading...</div>}

      {!loading && results.length > 0 && (
        <table className={s.resultsTable}>
          <thead>
            <tr>
              <th>Zip Code</th>
              <th>Utility Name</th>
              <th>Utility Number</th>
              <th>State</th>
              <th>County</th>
            </tr>
          </thead>
          <tbody>
            {results.map((row, index) => (
              <tr key={`${row["Utility Number"]}-${row.zipcode}-${index}`}>
                <td>{row.zipcode}</td>
                <td>{row["Utility Name"]}</td>
                <td>{row["Utility Number"]}</td>
                <td>{row.State}</td>
                <td>{row.County}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      
      {!loading && zipCode.length >= 3 && results.length === 0 && (
        <div>No utilities found for this zip code.</div>
      )}
    </div>
  );
}
