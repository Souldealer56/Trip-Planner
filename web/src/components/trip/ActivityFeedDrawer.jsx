import React from 'react'
import { formatRelativeTime } from '../../utils/format'

export function ActivityFeedDrawer({
  isOpen,
  onClose,
  activityLogs = [],
  lastReadTimestamp = null
}) {
  if (!isOpen) return null

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      style={{ justifyContent: 'flex-end', padding: 0, zIndex: 1100 }}
    >
      <div
        className="glass-card animate-fade-in"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '380px',
          maxWidth: '90vw',
          height: '100vh',
          borderRadius: 0,
          borderLeft: '1px solid var(--border-light)',
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
          boxShadow: '-4px 0 24px rgba(0,0,0,0.5)',
          background: 'var(--bg-main, #0f172a)'
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1.5rem',
            borderBottom: '1px solid var(--border-light)',
            paddingBottom: '0.75rem'
          }}
        >
          <h2 style={{ fontSize: '1.25rem', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>🔔 Activity Feed</span>
          </h2>
          <button
            onClick={onClose}
            className="btn btn-secondary"
            style={{ padding: '4px 10px', fontSize: '0.8rem' }}
          >
            Close
          </button>
        </div>

        {activityLogs.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '2rem' }}>
            No activity recorded yet for this trip.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {activityLogs.map((log) => {
              const isNew =
                !lastReadTimestamp ||
                new Date(log.created_at).getTime() > new Date(lastReadTimestamp).getTime()
              let icon = '📝'
              if (log.action_type === 'update_rsvp') icon = '🎒'
              else if (log.action_type === 'pitch_option') icon = '💡'
              else if (log.action_type === 'vote_option' || log.action_type === 'vote_poll') icon = '🗳️'
              else if (log.action_type === 'lock_option') icon = '🔒'
              else if (log.action_type === 'add_expense') icon = '💸'
              else if (log.action_type === 'update_trip') icon = '✏️'

              return (
                <div
                  key={log.id}
                  style={{
                    padding: '0.85rem 1rem',
                    background: isNew ? 'rgba(59, 130, 246, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                    border: isNew ? '1px solid var(--primary-light)' : '1px solid var(--border-light)',
                    borderRadius: 'var(--border-radius-sm)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                    <span
                      style={{
                        fontSize: '0.9rem',
                        fontWeight: '500',
                        color: 'var(--text-main)',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '6px'
                      }}
                    >
                      <span>{icon}</span>
                      <span>{log.description}</span>
                    </span>
                    {isNew && (
                      <span
                        style={{
                          fontSize: '0.65rem',
                          background: 'var(--accent, #10b981)',
                          color: '#fff',
                          padding: '1px 5px',
                          borderRadius: '4px',
                          fontWeight: 'bold',
                          flexShrink: 0
                        }}
                      >
                        NEW
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'right', marginTop: '2px' }}>
                    {formatRelativeTime(log.created_at)}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
