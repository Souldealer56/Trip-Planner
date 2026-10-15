import React from 'react'
import { formatDateRange, formatDateTimeRange } from '../../utils/format'
import { isOptionLocked } from '../../services/options'

export function PrintableItineraryModal({
  isOpen,
  onClose,
  trip,
  options = []
}) {
  if (!isOpen || !trip) return null

  return (
    <div
      className="modal-overlay animate-fade-in"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '1rem'
      }}
      onClick={onClose}
    >
      <div
        className="glass-card"
        style={{
          maxWidth: '800px',
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: '2rem',
          border: '1px solid var(--border-light)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            borderBottom: '2px solid var(--border-light)',
            paddingBottom: '1rem',
            marginBottom: '1.5rem'
          }}
        >
          <div>
            <h1 style={{ margin: 0, fontSize: '1.8rem', color: 'var(--text-main)' }}>
              ✈️ {trip.title}
            </h1>
            <p style={{ margin: '4px 0 0 0', color: 'var(--text-muted)', fontSize: '0.95rem' }}>
              📍 {trip.destination} • 📅 {formatDateRange(trip.start_date, trip.end_date)}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => window.print()}
              className="btn"
              style={{ padding: '6px 14px', fontSize: '0.85rem' }}
            >
              🖨️ Print
            </button>
            <button
              onClick={onClose}
              className="btn btn-secondary"
              style={{ padding: '6px 14px', fontSize: '0.85rem' }}
            >
              ✕ Close
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <h3
            style={{
              margin: 0,
              fontSize: '1.1rem',
              color: 'var(--primary-light)',
              borderBottom: '1px solid var(--border-light)',
              paddingBottom: '0.5rem'
            }}
          >
            📋 Day-by-Day Itinerary Schedule
          </h3>

          {options.length === 0 ? (
            <p style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>
              No pitched or locked choices yet for this trip.
            </p>
          ) : (
            options.map((opt) => (
              <div
                key={opt.id}
                style={{
                  background: 'rgba(255, 255, 255, 0.02)',
                  padding: '1rem',
                  borderRadius: '8px',
                  border: '1px solid var(--border-light)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '1rem'
                }}
              >
                <div>
                  <div
                    style={{
                      fontWeight: 'bold',
                      fontSize: '1rem',
                      color: 'var(--text-main)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    <span>{opt.option_text}</span>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        background: 'rgba(255, 255, 255, 0.05)',
                        color: 'var(--text-muted)',
                        textTransform: 'capitalize'
                      }}
                    >
                      {opt.category}
                    </span>
                  </div>
                  {(opt.start_date || opt.end_date) && (
                    <div style={{ fontSize: '0.85rem', color: '#60a5fa', marginTop: '4px' }}>
                      📅 {formatDateTimeRange(opt.start_date, opt.end_date)}
                    </div>
                  )}
                  {opt.description && (
                    <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      {opt.description}
                    </p>
                  )}
                </div>
                {opt.estimated_cost && (
                  <div style={{ fontWeight: 'bold', color: 'var(--primary-light)', fontSize: '0.95rem' }}>
                    {opt.estimated_cost} {opt.currency || 'USD'}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

export function PollRecapModal({
  isOpen,
  onClose,
  activeTab = '',
  options = [],
  activePoll = null,
  roster = []
}) {
  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content glass-card animate-fade-in"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '520px' }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1.25rem',
            borderBottom: '1px solid var(--border-light)',
            paddingBottom: '0.75rem'
          }}
        >
          <h2
            style={{
              margin: 0,
              color: 'var(--primary-light)',
              fontSize: '1.25rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <span>📊 Poll Recap</span>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>
              ({activeTab})
            </span>
          </h2>
          <button onClick={onClose} className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '0.8rem' }}>
            ✕ Close
          </button>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            maxHeight: '380px',
            overflowY: 'auto',
            paddingRight: '4px'
          }}
        >
          {options.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '1.5rem 0' }}>
              No options pitched in this category yet.
            </p>
          ) : (
            options.map((opt) => {
              const optIdStr = String(opt.id)
              const count = activePoll?.votes_by_option?.[optIdStr] || 0
              const voters = Object.entries(activePoll?.voter_selections || {})
                .filter(([_, opts]) => Array.isArray(opts) && opts.map(String).includes(optIdStr))
                .map(([uId]) => {
                  const member = roster.find(
                    (m) => String(m.user_id) === String(uId) || String(m.users?.id) === String(uId)
                  )
                  return member?.users?.first_name || member?.username || 'Traveler'
                })
              const isLocked = isOptionLocked(opt, activePoll)

              return (
                <div
                  key={opt.id}
                  style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: isLocked ? '1px solid #eab308' : '1px solid var(--border-light)',
                    padding: '1rem',
                    borderRadius: '8px'
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '6px'
                    }}
                  >
                    <div
                      style={{
                        fontWeight: '600',
                        fontSize: '1rem',
                        color: 'var(--text-main)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      {opt.option_text}
                      {isLocked && (
                        <span style={{ color: '#eab308', fontSize: '0.8rem', fontWeight: 'bold' }}>
                          🏆 Locked Choice
                        </span>
                      )}
                    </div>
                    <span
                      style={{
                        fontSize: '0.85rem',
                        fontWeight: 'bold',
                        color: 'var(--primary-light)',
                        background: 'rgba(59, 130, 246, 0.1)',
                        padding: '2px 8px',
                        borderRadius: '10px'
                      }}
                    >
                      {count} vote{count !== 1 ? 's' : ''}
                    </span>
                  </div>

                  {voters.length > 0 ? (
                    <div style={{ marginTop: '8px' }}>
                      <div
                        style={{
                          fontSize: '0.75rem',
                          color: 'var(--text-muted)',
                          fontWeight: '600',
                          marginBottom: '4px'
                        }}
                      >
                        Voters:
                      </div>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {voters.map((name, i) => (
                          <span
                            key={i}
                            style={{
                              background: 'rgba(255, 255, 255, 0.06)',
                              border: '1px solid var(--border-light)',
                              padding: '2px 8px',
                              borderRadius: '12px',
                              fontSize: '0.75rem',
                              color: 'var(--text-main)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            👤 {name}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '4px' }}>
                      No votes cast yet
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
