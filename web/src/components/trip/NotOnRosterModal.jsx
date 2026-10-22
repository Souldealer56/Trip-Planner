import React from 'react'

/**
 * NotOnRosterModal sub-component.
 * Displays a blocking modal dialog when an authenticated traveler is viewing a trip
 * they have not yet joined.
 */
export function NotOnRosterModal({
  isOpen,
  activeUser,
  onJoinRoster,
  onLogout,
  reconcileLoading = false,
  reconcileError = ''
}) {
  if (!isOpen) return null

  return (
    <div className="modal-overlay">
      <div className="modal-content glass-card animate-fade-in" style={{ textAlign: 'center', maxWidth: '400px' }}>
        <h2 style={{ color: 'var(--primary-light)', marginBottom: '0.5rem' }}>Not on the Roster</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
          You are signed in as <strong>{activeUser?.first_name || activeUser?.username || 'Traveler'}</strong>, but you are not registered on this trip.
        </p>
        {reconcileError && (
          <p style={{ color: 'hsl(0, 85%, 65%)', fontSize: '0.85rem', marginBottom: '1rem' }}>
            {reconcileError}
          </p>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <button onClick={onJoinRoster} className="btn" disabled={reconcileLoading} style={{ width: '100%' }}>
            {reconcileLoading ? 'Joining...' : 'Join Trip'}
          </button>
          <button onClick={onLogout} className="btn btn-secondary" style={{ width: '100%' }}>
            Switch Profile / Sign Out
          </button>
        </div>
      </div>
    </div>
  )
}
