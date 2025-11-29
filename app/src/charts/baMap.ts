import type { TopLevelSpec } from "vega-lite";

export function createBAMapSpec(): TopLevelSpec {
  return {
    $schema: "https://vega.github.io/schema/vega-lite/v6.json",
    width: "container",
    height: 550,
    background: "#ffffff",
    title: {
      text: "U.S. Balancing Authorities",
      fontSize: 18,
    },
    projection: {
      type: "albers",
      rotate: [96, 0],
      center: [0, 38],
      scale: 1100,
    },

    layer: [
      // US states outline
      {
        data: {
          url: "/geodata/us-states.geojson",
          format: { type: "json", property: "features" },
        },
        transform: [
          {
            filter:
              "datum.properties.NAME !== 'Alaska' && datum.properties.NAME !== 'Hawaii'",
          },
        ],
        mark: {
          type: "geoshape",
          fill: "#f8f9fa",
          stroke: "#6b7280",
          strokeWidth: 1,
          opacity: 0.1,
        },
      },

      // BA boundaries
      {
        data: {
          url: "/geodata/ba-data.geojson",
          format: { type: "json", property: "features" },
        },
        transform: [
          {
            filter: "!test(/US-AK|US-HI/, datum.properties.zoneName)",
          },
        ],
        mark: {
          type: "geoshape",
          fill: "transparent",
          stroke: "#374151",
          strokeWidth: 1.5,
        },
      },
      // BA labels
      // {
      //   data: {
      //     url: '/geodata/ba-data.geojson',
      //     format: { type: 'json', property: 'features' },
      //   },
      //   transform: [
      //     {
      //       filter: "!test(/US-AK|US-HI/, datum.properties.zoneName)"
      //     },
      //     { calculate: "geoCentroid(null, datum)", as: 'centroid' },
      //     { calculate: 'datum.centroid[0]', as: 'lon' },
      //     { calculate: 'datum.centroid[1]', as: 'lat' }
      //   ],
      //   mark: {
      //     type: 'text',
      //     fontSize: 10,
      //     fontWeight: 'bold',
      //     fill: '#1f2937',
      //   },
      //   encoding: {
      //     longitude: { field: 'lon', type: 'quantitative' },
      //     latitude: { field: 'lat', type: 'quantitative' },
      //     text: { field: 'properties.zoneName', type: 'nominal' }
      //   }
      // },
    ],
  };
}
