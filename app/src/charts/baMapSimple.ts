import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

export interface LeafletMapConfig {
  center?: [number, number]
  zoom?: number
  style?: L.PathOptions
  hoverStyle?: Partial<L.PathOptions>
  tooltipFormatter?: (properties: any) => string
  geojsonUrl?: string // Add URL option
  baSummaryUrl?: string // optional BA summary JSON to enrich tooltips
  onFeatureClick?: (properties: any) => void
}

const defaultConfig: Required<LeafletMapConfig> = {
  center: [39.8283, -98.5795],
  zoom: 4,
  style: {
    fillColor: '#3388ff',
    fillOpacity: 0.3,
    color: '#2c3e50',
    weight: 2,
    opacity: 0.8,
  },
  hoverStyle: {
    fillOpacity: 0.6,
    weight: 3,
  },
  tooltipFormatter: (props: any) => `
    <div style="padding: 8px;">
      <strong>${props.zoneName || 'Unknown BA'}</strong>
    </div>
  `,
  geojsonUrl: '/geodata/ba-data.geojson', // Default URL
  baSummaryUrl: '/ba-summary.json',
  onFeatureClick: () => { },
}

export async function createLeafletMap(
  container: HTMLElement,
  config: LeafletMapConfig = {}
): Promise<L.Map> {
  const finalConfig = { ...defaultConfig, ...config }

  // Create map
  const map = L.map(container, {
    center: finalConfig.center,
    zoom: finalConfig.zoom,
    zoomControl: true,
  })

  // Use proxied tiles in development, direct in production
  const isDev = import.meta.env.DEV
  const tileUrl = isDev
    ? '/tiles/{z}/{x}/{y}.png'
    : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'

  L.tileLayer(tileUrl, {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
    subdomains: isDev ? [''] : ['a', 'b', 'c'],
  }).addTo(map)

  // Optionally fetch BA summary to enrich tooltips
  let baSummaryLookup: Map<string, any> | null = null
  if (finalConfig.baSummaryUrl) {
    try {
      const resp = await fetch(finalConfig.baSummaryUrl)
      if (!resp.ok) throw new Error(`Failed to load BA summary: ${resp.statusText}`)
      const summaryData: any[] = await resp.json()
      baSummaryLookup = new Map()
      for (const entry of summaryData) {
        if (entry.zoneName) baSummaryLookup.set(entry.zoneName, entry)
        if (entry.name) baSummaryLookup.set(entry.name, entry)
      }
    } catch (err) {
      // Non-fatal: log and continue without summary enrichment
      console.warn('Could not load BA summary:', err)
      baSummaryLookup = null
    }
  }

  // Fetch and add GeoJSON
  try {
    const response = await fetch(finalConfig.geojsonUrl)
    if (!response.ok) throw new Error(`Failed to load GeoJSON: ${response.statusText}`)

    const geojsonData = await response.json()

    const geoJsonLayer = L.geoJSON(geojsonData, {
      style: () => finalConfig.style,
      onEachFeature: (feature: { properties: any }, layer: any) => {
        // Hover effects
        layer.on({
          mouseover: (e: { target: { setStyle: (arg0: any) => void } }) => {
            e.target.setStyle(finalConfig.hoverStyle)
          },
          mouseout: (e: { target: any }) => {
            geoJsonLayer.resetStyle(e.target)
          },
        })

        // Tooltips (merge BA summary if available)
        if (feature.properties) {
          let mergedProps = { ...feature.properties }
          if (baSummaryLookup) {
            const keyCandidates = [
              feature.properties.zoneName,
              feature.properties.zone_name,
              feature.properties.BA_NAME,
              feature.properties.BA_CODE,
              feature.properties.name,
            ].filter(Boolean)

            let matched: any = null
            for (const k of keyCandidates) {
              if (baSummaryLookup.has(k)) {
                matched = baSummaryLookup.get(k)
                break
              }
            }

            if (matched) mergedProps = { ...mergedProps, baSummary: matched }
          }

          const tooltipContent = finalConfig.tooltipFormatter(mergedProps)
          layer.bindTooltip(tooltipContent, {
            sticky: true,
            className: 'ba-tooltip',
          })

          // Click handler: notify consumer with merged properties
          if (finalConfig.onFeatureClick) {
            // attach a simple click event
            // eslint-disable-next-line @typescript-eslint/no-misused-promises
            layer.on('click', () => finalConfig.onFeatureClick!(mergedProps))
          }
        }
      },
    }).addTo(map)

    // Fit bounds
    const bounds = geoJsonLayer.getBounds()
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [50, 50] })
    }
  } catch (error) {
    console.error('Error loading GeoJSON:', error)
    throw error
  }

  return map
}

export function destroyLeafletMap(map: L.Map): void {
  map.remove()
}