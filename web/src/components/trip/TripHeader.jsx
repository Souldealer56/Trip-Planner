import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { formatDateRange } from '../../utils/format'

export function TripHeader({
  trip,
  activeUser,
  isOffline = false,
  unreadCount = 0,
  realtimeStatus = null,
  onRefresh,
  onOpenEditModal,
  onToggleArchive,
  onExportICal,
  onOpenPrintModal,
  onToggleActivityDrawer,
  onLogout
}) {
  const [showCopiedToast, setShowCopiedToast] = useState(false)

  const handleCopyInviteLink = () => {
    if (!trip?.id) return
    const inviteUrl = `${window.location.origin}/join/${trip.id}`
    navigator.clipboard.writeText(inviteUrl)
      .then(() => {
        setShowCopiedToast(true)
        setTimeout(() => setShowCopiedToast(false), 2000)
      })
      .catch((err) => {
        console.error('Failed to copy invite link:', err)
        alert('Could not copy link automatically. Here is the link: ' + inviteUrl)
      })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
      {/* Top Navigation & Action Controls */}
      <div className="page-header" style={{ borderBottom: 'none', marginBottom: 0, flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <Link to="/trips" className="btn btn-secondary">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            Back to Trips
          </Link>

          <button onClick={onRefresh} className="btn btn-secondary" title="Refresh details">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
            </svg>
            Refresh
          </button>

          {realtimeStatus && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 10px',
                borderRadius: '9999px',
                fontSize: '0.8rem',
                fontWeight: '600',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--border-light, rgba(255, 255, 255, 0.1))',
                color: 'var(--text-muted, #94a3b8)',
                letterSpacing: '0.02em',
                userSelect: 'none'
              }}
              title={`Real-time sync status: ${realtimeStatus}`}
            >
              {realtimeStatus === 'connected' && '🟢 Live'}
              {realtimeStatus === 'connecting' && '🟡 Syncing...'}
              {(realtimeStatus === 'disconnected' || realtimeStatus === 'error') && '⚪ Offline / Manual Sync'}
            </span>
          )}

          <button
            onClick={onToggleActivityDrawer}
            className="btn btn-secondary"
            style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            title="Activity Feed & Updates"
          >
            <span>🔔 Feed</span>
            {unreadCount > 0 && (
              <span
                style={{
                  background: 'var(--accent, #10b981)',
                  color: '#fff',
                  borderRadius: '10px',
                  padding: '1px 6px',
                  fontSize: '0.75rem',
                  fontWeight: 'bold',
                  lineHeight: '1'
                }}
              >
                {unreadCount}
              </span>
            )}
          </button>
        </div>

        {/* User Session Bar */}
        {activeUser && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Signed in as <strong style={{ color: 'var(--text-main)' }}>{activeUser.first_name}</strong>
            </span>
            <button
              onClick={onLogout}
              className="btn btn-secondary"
              style={{ padding: '4px 10px', fontSize: '0.8rem' }}
            >
              Switch Profile
            </button>
          </div>
        )}
      </div>

      {/* Offline Mode Banner */}
      {isOffline && (
        <div
          style={{
            background: 'rgba(245, 158, 11, 0.15)',
            border: '1px solid rgba(245, 158, 11, 0.35)',
            color: '#f59e0b',
            padding: '0.75rem 1.25rem',
            borderRadius: 'var(--border-radius-md)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.9rem',
            fontWeight: '600'
          }}
          className="animate-fade-in"
        >
          <span style={{ fontSize: '1.1rem' }}>📡</span>
          <span>Offline Mode — Showing last synced trip itinerary</span>
        </div>
      )}

      {/* Archived Banner */}
      {trip?.is_archived && (
        <div
          style={{
            background: 'rgba(234, 179, 8, 0.15)',
            border: '1px solid rgba(234, 179, 8, 0.3)',
            color: '#eab308',
            padding: '0.85rem 1.25rem',
            borderRadius: 'var(--border-radius-md)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.5rem'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.25rem' }}>📦</span>
            <div>
              <strong>This trip is archived.</strong>
              <span style={{ fontSize: '0.85rem', marginLeft: '6px', color: 'var(--text-muted)' }}>
                It is hidden from the default active dashboard view.
              </span>
            </div>
          </div>
          <button
            onClick={onToggleArchive}
            className="btn btn-secondary"
            style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', borderColor: '#eab308', color: '#eab308' }}
          >
            Unarchive Trip
          </button>
        </div>
      )}

      {/* Trip Info Glass Card */}
      {trip && (
        <div className="glass-card" style={{ padding: '2rem', border: '1px solid var(--border-light)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h1 style={{ color: 'var(--primary-light)', marginBottom: '0.5rem', fontSize: '2.25rem' }}>
                {trip.title}
              </h1>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', marginTop: '1rem', fontSize: '1rem', color: 'var(--text-muted)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>📍</span>
                  <strong style={{ color: 'var(--text-main)' }}>{trip.destination}</strong>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>📅</span>
                  <span>{formatDateRange(trip.start_date, trip.end_date)}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>💱</span>
                  <span>Currency: <strong style={{ color: 'var(--text-main)' }}>{trip.base_currency}</strong></span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                onClick={handleCopyInviteLink}
                className="btn btn-secondary"
                style={{
                  position: 'relative',
                  padding: '6px 12px',
                  fontSize: '0.85rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
                title="Copy shareable invite link"
              >
                🔗 Share Invite
                {showCopiedToast && (
                  <span
                    style={{
                      position: 'absolute',
                      bottom: '125%',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      backgroundColor: '#1e293b',
                      color: '#f8fafc',
                      padding: '0.3rem 0.6rem',
                      borderRadius: '6px',
                      fontSize: '0.7rem',
                      whiteSpace: 'nowrap',
                      border: '1px solid var(--border-light, #334155)',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                      zIndex: 10,
                      animation: 'fadeInOut 2s ease forwards'
                    }}
                  >
                    Copied!
                  </span>
                )}
              </button>

              <button
                onClick={onExportICal}
                className="btn btn-secondary"
                style={{ padding: '6px 12px', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                title="Download .ics calendar file for Google/Apple Calendar"
              >
                📅 Export iCal
              </button>

              <button
                onClick={onOpenPrintModal}
                className="btn btn-secondary"
                style={{ padding: '6px 12px', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                title="View clean printable itinerary summary"
              >
                🖨️ Print Itinerary
              </button>

              <button
                onClick={onOpenEditModal}
                className="btn btn-secondary"
                style={{ padding: '6px 14px', fontSize: '0.9rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                ✏️ Edit Trip
              </button>
            </div>
          </div>

          {trip.vibe && (
            <p style={{ marginTop: '1.5rem', fontStyle: 'italic', color: 'var(--text-muted)', borderLeft: '3px solid var(--primary)', paddingLeft: '1rem' }}>
              "{trip.vibe}"
            </p>
          )}
        </div>
      )}
    </div>
  )
}
