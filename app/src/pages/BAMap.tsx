import { useRef, useEffect, useState } from 'react'
import { Spin, Alert, Card, Typography } from 'antd'
import { createLeafletMap, destroyLeafletMap } from '../charts/baMapSimple'
import type L from 'leaflet'
import * as s from './DetailView.module.css'

const { Title, Paragraph } = Typography

export default function BAMap() {
  const mapRef = useRef<HTMLDivElement>(null)
  const leafletMapRef = useRef<L.Map | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!mapRef.current) return

    setLoading(true)

    createLeafletMap(mapRef.current, {
      center: [39.8283, -98.5795],
      zoom: 4,
      geojsonUrl: '/geodata/ba-data.geojson', // Your GeoJSON file path
      baSummaryUrl: '/ba-summary.json',
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
      // Tooltip receives merged properties. If BA summary was found it's available at `props.baSummary`.
      tooltipFormatter: (props) => {
        const ba = props.baSummary
        const name = props.name || props.BA_NAME || props.zoneName || 'Unknown BA'
        const code = props.code || props.BA_CODE || ''

        const summaryLines = []
        if (ba && typeof ba.totalPlans !== 'undefined') summaryLines.push(`Plans: ${ba.totalPlans}`)
        if (ba && typeof ba.numUtilities !== 'undefined') summaryLines.push(`Utilities: ${ba.numUtilities}`)

        return `
          <div style="padding:8px;">
            <strong>${name}</strong>
            ${code ? `<br/>Code: ${code}` : ''}
            ${summaryLines.length ? `<br/>${summaryLines.join('<br/>')}` : ''}
          </div>
        `
      },
    })
      .then(map => {
        leafletMapRef.current = map
        setLoading(false)
      })
      .catch(err => {
        console.error('Error creating map:', err)
        setError(err)
        setLoading(false)
      })

    return () => {
      if (leafletMapRef.current) {
        destroyLeafletMap(leafletMapRef.current)
        leafletMapRef.current = null
      }
    }
  }, [])

  return (
    <main
      className={s.main}
      style={{ padding: "24px", maxWidth: "1400px", margin: "0 auto" }}
    >
      <Title level={2}>U.S. Balancing Authorities</Title>

      {error && (
        <Alert
          message="Error Loading Map"
          description={error.message}
          type="error"
          showIcon
          style={{ marginBottom: "24px" }}
        />
      )}

      <Card style={{ marginBottom: '24px', position: 'relative' }}>
        {loading && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(255, 255, 255, 0.9)',
            zIndex: 10
          }}>
            <Spin size="large" />
          </div>
        )}
        <div 
          ref={mapRef} 
          style={{ 
            width: "100%", 
            height: "600px",
            position: 'relative',
            zIndex: 0 
          }} 
        />
      </Card>

      <Card title="About This Map">
        <Paragraph>
          This map displays the geographic boundaries of U.S. balancing
          authorities (BAs) operating in the continental United States.
          Balancing authorities are entities responsible for maintaining
          real-time balance between electricity supply and demand within their
          respective control areas.
        </Paragraph>
      </Card>
    </main>
  )
}