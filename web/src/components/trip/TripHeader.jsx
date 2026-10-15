import React, { useState, useEffect, useRef } from 'react'
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
  onOpenPollRecapModal,
  onToggleActivityDrawer,
  onLogout
}) {
  const [showCopiedToast, setShowCopiedToast] = useState(false)
  const [actionsOpen, setActionsOpen] = useState(false)
  const actionsRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (actionsRef.current && !actionsRef.current.contains(e.target)) {
        setActionsOpen(false)
      }
    }
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setActionsOpen(false)
    }
    document.addEventListener('pointerdown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

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
    <div className="trip-header-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
      {/* Offline Mode Banner */}
      {isOffline && (
        <div className="trip-banner banner-offline animate-fade-in">
          <span style={{ fontSize: '1.1rem' }}>📡</span>
          <span>Offline Mode — Showing last synced trip itinerary</span>
        </div>
      )}

      {/* Archived Banner */}
      {trip?.is_archived && (
        <div className="trip-banner banner-archived animate-fade-in">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.25rem' }}>📦</span>
            <div>
              <strong>This trip is archived.</strong>
              <span style={{ fontSize: '0.85rem', marginLeft: '6px', color: 'var(--text-muted)' }}>
                Hidden from default active dashboard view.
              </span>
            </div>
          </div>
          {onToggleArchive && (
            <button
              onClick={onToggleArchive}
              className="btn btn-secondary"
              style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', borderColor: '#eab308', color: '#eab308' }}
            >
              Unarchive Trip
            </button>
          )}
        </div>
      )}

      {/* Compact Main Trip Header Glass Card */}
      <div className="trip-header-card glass-card">
        {/* Top Control Bar: Back button on Left, Primary Actions on Right */}
        <div className="trip-header-top-bar">
          <div className="trip-header-left-nav">
            <Link to="/trips" className="btn btn-secondary back-trips-btn" title="Back to Trips">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="19" y1="12" x2="5" y2="12" />
                <polyline points="12 19 5 12 12 5" />
              </svg>
              <span>Trips</span>
            </Link>

            {realtimeStatus && (
              <span
                className="realtime-status-pill"
                title={`Real-time sync status: ${realtimeStatus}`}
              >
                {realtimeStatus === 'connected' && '🟢 Live'}
                {realtimeStatus === 'connecting' && '🟡 Syncing...'}
                {(realtimeStatus === 'disconnected' || realtimeStatus === 'error') && '⚪ Offline'}
              </span>
            )}
          </div>

          <div className="trip-header-right-nav">
            {/* Primary CTA */}
            <button
              onClick={handleCopyInviteLink}
              className="btn btn-secondary share-invite-btn"
              style={{ position: 'relative' }}
              title="Copy shareable invite link"
            >
              <span>🔗 Share Invite</span>
              {showCopiedToast && (
                <span className="copied-toast-tooltip">
                  Copied!
                </span>
              )}
            </button>

            {/* Notification Bell Feed */}
            <button
              onClick={onToggleActivityDrawer}
              className="btn btn-secondary feed-bell-btn"
              title="Activity Feed & Updates"
            >
              <span>🔔 Feed</span>
              {unreadCount > 0 && (
                <span className="feed-unread-badge">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Clean Dropdown / Popover Menu: Actions ▾ */}
            <div className="actions-dropdown-container" ref={actionsRef}>
              <button
                type="button"
                onClick={() => setActionsOpen((prev) => !prev)}
                className="btn btn-secondary actions-menu-trigger"
                aria-haspopup="true"
                aria-expanded={actionsOpen}
                title="Trip actions & options menu"
              >
                <span>⚙️ Actions {actionsOpen ? '▴' : '▾'}</span>
              </button>

              {actionsOpen && (
                <div className="actions-dropdown-menu glass-card animate-fade-in" role="menu">
                  {onOpenEditModal && (
                    <button
                      type="button"
                      onClick={() => {
                        setActionsOpen(false)
                        onOpenEditModal()
                      }}
                      className="actions-dropdown-item"
                      role="menuitem"
                    >
                      <span>✏️</span>
                      <span>Edit Trip</span>
                    </button>
                  )}

                  {onExportICal && (
                    <button
                      type="button"
                      onClick={() => {
                        setActionsOpen(false)
                        onExportICal()
                      }}
                      className="actions-dropdown-item"
                      role="menuitem"
                    >
                      <span>📅</span>
                      <span>Export iCal</span>
                    </button>
                  )}

                  {onOpenPrintModal && (
                    <button
                      type="button"
                      onClick={() => {
                        setActionsOpen(false)
                        onOpenPrintModal()
                      }}
                      className="actions-dropdown-item"
                      role="menuitem"
                    >
                      <span>🖨️</span>
                      <span>Print Itinerary</span>
                    </button>
                  )}

                  {onOpenPollRecapModal && (
                    <button
                      type="button"
                      onClick={() => {
                        setActionsOpen(false)
                        onOpenPollRecapModal()
                      }}
                      className="actions-dropdown-item"
                      role="menuitem"
                    >
                      <span>📊</span>
                      <span>Poll Recap</span>
                    </button>
                  )}

                  <div className="actions-dropdown-divider" />

                  {onRefresh && (
                    <button
                      type="button"
                      onClick={() => {
                        setActionsOpen(false)
                        onRefresh()
                      }}
                      className="actions-dropdown-item"
                      role="menuitem"
                    >
                      <span>🔄</span>
                      <span>Refresh Data</span>
                    </button>
                  )}

                  {trip && onToggleArchive && (
                    <button
                      type="button"
                      onClick={() => {
                        setActionsOpen(false)
                        onToggleArchive()
                      }}
                      className="actions-dropdown-item"
                      role="menuitem"
                    >
                      <span>📦</span>
                      <span>{trip.is_archived ? 'Unarchive Trip' : 'Archive Trip'}</span>
                    </button>
                  )}

                  {activeUser && onLogout && (
                    <>
                      <div className="actions-dropdown-divider" />
                      <button
                        type="button"
                        onClick={() => {
                          setActionsOpen(false)
                          onLogout()
                        }}
                        className="actions-dropdown-item text-destructive"
                        role="menuitem"
                      >
                        <span>👤</span>
                        <span>Switch Profile / Log Out</span>
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Trip Title & Metadata */}
        {trip && (
          <div className="trip-info-content">
            <h1 className="trip-main-title">{trip.title}</h1>
            <div className="trip-meta-row">
              <div className="trip-meta-pill">
                <span>📍</span>
                <strong>{trip.destination}</strong>
              </div>
              <div className="trip-meta-pill date-badge">
                <span>📅</span>
                <span>{formatDateRange(trip.start_date, trip.end_date)}</span>
              </div>
              <div className="trip-meta-pill currency-badge">
                <span>💱</span>
                <span>Currency: <strong>{trip.base_currency}</strong></span>
              </div>
            </div>
            {trip.vibe && (
              <p className="trip-vibe-quote">
                "{trip.vibe}"
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
