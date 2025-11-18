import { useRef, useEffect, useState } from 'react'
import vegaEmbed from 'vega-embed'
import { Spin, Alert, Card, Typography } from 'antd'
import { createBAMapSpec } from '../charts/baMap'
import * as s from './DetailView.module.css'

const { Title, Paragraph } = Typography

export default function BAMap() {
  const mapRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!mapRef.current) return

    const spec = createBAMapSpec()

    vegaEmbed(mapRef.current, spec, {
      mode: 'vega-lite',
      actions: { export: true, source: false, compiled: false, editor: false }
    })
      .then(() => setLoading(false))
      .catch(err => {
        console.error('Error rendering map:', err)
        setError(err)
        setLoading(false)
      })
  }, [])

  return (
    <main className={s.main} style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      <Title level={2}>U.S. Balancing Authorities</Title>

      {error && (
        <Alert
          message="Error Loading Map"
          description={error.message}
          type="error"
          showIcon
          style={{ marginBottom: '24px' }}
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
        <div ref={mapRef} style={{ width: '100%', minHeight: '600px' }} />
      </Card>

      <Card title="About This Map">
        <Paragraph>
          This map displays the geographic boundaries of U.S. balancing authorities (BAs) 
          operating in the continental United States. Balancing authorities are entities 
          responsible for maintaining real-time balance between electricity supply and demand 
          within their respective control areas.
        </Paragraph>
        <Paragraph>
          Each outlined region represents a distinct balancing authority jurisdiction. 
          These authorities coordinate generation, transmission, and load to ensure 
          grid stability and reliability across their territories.
        </Paragraph>
      </Card>
    </main>
  )
}