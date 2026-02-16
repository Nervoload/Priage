// HospitalApp/src/features/alerts/AlertsBanner.tsx
// Floating alert banner that shows the top unacknowledged alerts.
// Renders a collapsed badge by default; expands on click to show the list.
//
// Phase 6.1: This component is presentational — it receives alerts via props from
// useAlerts. Once SSE is connected, alert data will flow in real time without
// any changes needed here. The parent (HospitalApp) wires the data source.

import { useState } from 'react';
import type { UnifiedAlert } from '../../shared/api/useAlerts';
import type { AlertSeverity } from '../../shared/types/domain';

interface AlertsBannerProps {
  alerts: UnifiedAlert[];
  unacknowledgedCount: number;
  onAcknowledge: (alert: UnifiedAlert) => void;
  severityColors: Record<AlertSeverity, string>;
}

export function AlertsBanner({
  alerts,
  unacknowledgedCount,
  onAcknowledge,
  severityColors,
}: AlertsBannerProps) {
  const [expanded, setExpanded] = useState(false);

  if (unacknowledgedCount === 0) return null;

  const topAlerts = alerts.filter(a => !a.acknowledged).slice(0, 8);

  return (
    <div style={{ position: 'fixed', top: '1rem', right: '1rem', zIndex: 900, maxWidth: '400px' }}>
      {/* Badge button */}
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.5rem 1rem',
          backgroundColor: '#ef4444',
          color: 'white',
          border: 'none',
          borderRadius: '10px',
          cursor: 'pointer',
          fontWeight: 600,
          fontSize: '0.85rem',
          boxShadow: '0 4px 12px rgba(239,68,68,0.4)',
          marginLeft: 'auto',
        }}
      >
        <span style={{ fontSize: '1rem' }}>🔔</span>
        {unacknowledgedCount} Alert{unacknowledgedCount !== 1 ? 's' : ''}
        <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>
          {expanded ? '▲' : '▼'}
        </span>
      </button>

      {/* Expanded alert list */}
      {expanded && (
        <div
          style={{
            marginTop: '0.5rem',
            backgroundColor: 'white',
            borderRadius: '12px',
            boxShadow: '0 8px 30px rgba(0,0,0,0.15)',
            overflow: 'hidden',
            maxHeight: '400px',
            overflowY: 'auto',
          }}
        >
          {topAlerts.map(alert => (
            <div
              key={alert.id}
              style={{
                padding: '0.75rem 1rem',
                borderBottom: '1px solid #f3f4f6',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.75rem',
              }}
            >
              <div
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: severityColors[alert.severity],
                  marginTop: '0.35rem',
                  flexShrink: 0,
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#1f2937' }}>
                  {alert.patientName || `Encounter #${alert.encounterId}`}
                </div>
                <div
                  style={{
                    fontSize: '0.75rem',
                    color: '#6b7280',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {alert.message}
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onAcknowledge(alert);
                }}
                style={{
                  padding: '0.25rem 0.5rem',
                  fontSize: '0.7rem',
                  fontWeight: 500,
                  backgroundColor: '#f3f4f6',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  color: '#6b7280',
                  flexShrink: 0,
                }}
              >
                Dismiss
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
