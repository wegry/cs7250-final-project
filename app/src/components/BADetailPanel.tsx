import { useEffect, useRef } from 'react'
import { Card, Typography, Statistic, List, Button } from 'antd'
import type { BADetailPanelProps } from '../data/schema'
import styles from './BADetailPanel.module.css'

const { Title, Paragraph } = Typography

export function BADetailPanel({ baCode, data, onClose }: BADetailPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const baInfo = data.find(ba => ba.name === baCode)

  // Handle outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    // Add event listener with a small delay to avoid immediate closing
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside)
    }, 100)

    return () => {
      clearTimeout(timeoutId)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [onClose])

  // Handle escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [onClose])

  if (!baInfo) {
    return (
      <div ref={panelRef} className={styles.panel}>
        <Card
          title={
            <div className={styles.header}>
              <Title level={4} style={{ margin: 0 }}>
                {baCode}
              </Title>
              <Button
                type="text"
                onClick={onClose}
                aria-label="Close detail panel"
              >
                ✕
              </Button>
            </div>
          }
          className={styles.card}
        >
          <Paragraph>No data available for this balancing authority.</Paragraph>
        </Card>
      </div>
    )
  }

  return (
    <div ref={panelRef} className={styles.panel}>
      <Card
        title={
          <div className={styles.header}>
            <Title level={4} style={{ margin: 0 }}>
              {baInfo.name}
            </Title>
            <Button
              type="text"
              onClick={onClose}
              aria-label="Close detail panel"
            >
              ✕
            </Button>
          </div>
        }
        className={styles.card}
      >
        <Paragraph strong>Zone: {baInfo.zoneName}</Paragraph>

        <div className={styles.statistics}>
          <Statistic title="Utilities" value={baInfo.numUtilities} />
          <Statistic title="Rate Plans" value={baInfo.totalPlans} />
          {baInfo.avgEnergyRate && (
            <Statistic
              title="Avg Energy Rate"
              value={baInfo.avgEnergyRate}
              precision={3}
              suffix="$/kWh"
            />
          )}
        </div>

        {baInfo.utilities && baInfo.utilities.length > 0 && (
          <>
            <Title level={5} style={{ marginTop: '16px' }}>
              Utilities ({baInfo.utilities.length})
            </Title>
            <List
              className={styles.utilityList}
              dataSource={baInfo.utilities}
              renderItem={utility => (
                <List.Item className={styles.utilityItem}>{utility}</List.Item>
              )}
              size="small"
            />
          </>
        )}
      </Card>
    </div>
  )
}
