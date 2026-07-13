import React, { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useTripDetails } from '../hooks/useTripDetails'
import { useRsvpRoster } from '../hooks/useRsvpRoster'
import { useAddParticipant } from '../hooks/useAddParticipant'
import { formatDateRange } from '../utils/format'
import { updateRsvpNote } from '../services/rsvps'

function TripDetails({ activeUser, onLogin, onLogout }) {
  const { id } = useParams()

  const {
    data: trip,
    loading: tripLoading,
    error: tripError,
    refresh: refreshTrip
  } = useTripDetails(id)

  const {
    data: roster,
    loading: rosterLoading,
    error: rosterError,
    refresh: refreshRoster
  } = useRsvpRoster(id)

  const {
    addParticipant,
    loading: joinLoading,
    error: joinError
  } = useAddParticipant()

  const [showJoinForm, setShowJoinForm] = useState(false)
  const [firstName, setFirstName] = useState('')
  const [username, setUsername] = useState('')

  const [userNote, setUserNote] = useState('')
  const [savingNote, setSavingNote] = useState(false)

  const loading = tripLoading || rosterLoading
  const error = tripError || rosterError

  React.useEffect(() => {
    if (activeUser && roster.length > 0) {
      const activeMember = roster.find(m => m.user_id === activeUser.id)
      if (activeMember) {
        setUserNote(activeMember.notes || '')
      }
    }
  }, [activeUser, roster])

  const handleRefresh = () => {
    refreshTrip()
    refreshRoster()
  }

  const handleNoteBlur = async () => {
    if (!activeUser) return
    const activeMember = roster.find(m => m.user_id === activeUser.id)
    const oldNote = activeMember ? (activeMember.notes || '') : ''
    if (userNote.trim() === oldNote.trim()) return

    setSavingNote(true)
    try {
      await updateRsvpNote(id, activeUser.id, userNote.trim() || null)
      refreshRoster()
    } catch (err) {
      console.error('Failed to update note:', err)
    } finally {
      setSavingNote(false)
    }
  }

  const handleJoinSubmit = async (e) => {
    e.preventDefault()
    if (!firstName.trim()) return
    try {
      const user = await addParticipant(id, username.trim() || null, firstName.trim())
      onLogin(user)
      refreshRoster()
      setFirstName('')
      setUsername('')
      setShowJoinForm(false)
    } catch (err) {
      // Handled by hook error state
    }
  }

  // Determine if the modal should show the join form pane
  const displayJoinForm = showJoinForm || roster.length === 0

  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto', width: '100%' }} className="animate-fade-in">
      {/* Page Header */}
      <div className="page-header" style={{ borderBottom: 'none', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <Link to="/trips" className="btn btn-secondary">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            Back to Trips
          </Link>
          <button onClick={handleRefresh} className="btn btn-secondary" title="Refresh details">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
            </svg>
            Refresh
          </button>
        </div>

        {/* User Session Bar */}
        {activeUser && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(255, 255, 255, 0.03)', padding: '6px 12px', borderRadius: 'var(--border-radius-sm)', border: '1px solid var(--border-light)' }}>
            <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
              Signed in as: <strong style={{ color: 'var(--primary-light)' }}>{activeUser.first_name}</strong>
            </span>
            <button onClick={onLogout} className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '0.8rem' }}>
              Switch Profile
            </button>
          </div>
        )}
      </div>

      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <div className="glass-card" style={{ padding: '2rem' }}>
            <div className="skeleton skeleton-title" style={{ width: '40%' }} />
            <div className="skeleton skeleton-text" style={{ width: '70%' }} />
            <div className="skeleton skeleton-text" style={{ width: '50%' }} />
          </div>
          <div className="glass-card" style={{ padding: '2rem' }}>
            <div className="skeleton skeleton-title" style={{ width: '30%', height: '20px' }} />
            <div className="skeleton skeleton-text" style={{ width: '90%' }} />
            <div className="skeleton skeleton-text" style={{ width: '85%' }} />
          </div>
        </div>
      )}

      {error && (
        <div className="glass-card error-card animate-fade-in" style={{ padding: '2rem', textAlign: 'center' }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'hsl(0, 85%, 65%)', marginBottom: '1rem' }}>
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <h2 style={{ marginBottom: '0.5rem' }}>Failed to Load Trip Details</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>{error}</p>
          <button onClick={handleRefresh} className="btn">
            Try Again
          </button>
        </div>
      )}

      {/* Blocking Profile Selection Modal */}
      {!loading && !error && !activeUser && (
        <div className="modal-overlay">
          <div className="modal-content glass-card animate-fade-in">
            {!displayJoinForm ? (
              // Pane 1: select existing profile
              <div>
                <h2 style={{ color: 'var(--primary-light)', marginBottom: '0.5rem', textAlign: 'center' }}>Who Are You?</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem', textAlign: 'center' }}>
                  Select your profile to collaborate on this trip, pitch options, and log expenses.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '240px', overflowY: 'auto', paddingRight: '4px', marginBottom: '1.5rem' }}>
                  {roster.map((member) => {
                    const u = member.users || {}
                    return (
                      <button
                        key={member.user_id}
                        onClick={() => onLogin(u)}
                        className="btn btn-secondary"
                        style={{ justifyContent: 'space-between', padding: '0.75rem 1rem', width: '100%' }}
                      >
                        <span style={{ fontWeight: '600' }}>{u.first_name}</span>
                        {u.username && <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>@{u.username}</span>}
                      </button>
                    )
                  })}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <button onClick={() => setShowJoinForm(true)} className="btn" style={{ width: '100%' }}>
                    I'm Not on This List (Join Trip)
                  </button>
                </div>
              </div>
            ) : (
              // Pane 2: Join Form
              <div>
                <h2 style={{ color: 'var(--primary-light)', marginBottom: '0.5rem', textAlign: 'center' }}>Join Trip</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem', textAlign: 'center' }}>
                  Register as a participant to join the planning roster and auto-sign in.
                </p>

                <form onSubmit={handleJoinSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-muted)' }}>First Name *</label>
                    <input
                      type="text"
                      placeholder="e.g. Alex"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      required
                      style={{
                        padding: '0.75rem',
                        borderRadius: 'var(--border-radius-sm)',
                        border: '1px solid var(--border-light)',
                        background: 'rgba(255, 255, 255, 0.02)',
                        color: 'var(--text-main)',
                        fontFamily: 'inherit',
                        outline: 'none'
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-muted)' }}>Telegram Username (Optional)</label>
                    <div style={{ position: 'relative' }}>
                      <span style={{ position: 'absolute', left: '12px', top: '10px', color: 'var(--text-muted)' }}>@</span>
                      <input
                        type="text"
                        placeholder="username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        style={{
                          padding: '0.75rem 0.75rem 0.75rem 1.75rem',
                          borderRadius: 'var(--border-radius-sm)',
                          border: '1px solid var(--border-light)',
                          background: 'rgba(255, 255, 255, 0.02)',
                          color: 'var(--text-main)',
                          fontFamily: 'inherit',
                          width: '100%',
                          outline: 'none'
                        }}
                      />
                    </div>
                  </div>

                  {joinError && (
                    <div style={{ color: 'hsl(0, 85%, 65%)', fontSize: '0.85rem', textAlign: 'center' }}>
                      ⚠️ {joinError}
                    </div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
                    <button type="submit" disabled={joinLoading} className="btn" style={{ width: '100%' }}>
                      {joinLoading ? 'Joining...' : 'Join & Sign In'}
                    </button>
                    {roster.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowJoinForm(false)}
                        className="btn btn-secondary"
                        style={{ width: '100%' }}
                      >
                        Back to List
                      </button>
                    )}
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Detail view content */}
      {!loading && !error && trip && activeUser && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {/* Trip Info Header Card */}
          <div className="glass-card" style={{ padding: '2rem', border: '1px solid var(--border-light)' }}>
            <h1 style={{ color: 'var(--primary-light)', marginBottom: '0.5rem', fontSize: '2.25rem' }}>{trip.title}</h1>
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
            {trip.vibe && (
              <p style={{ marginTop: '1.5rem', fontStyle: 'italic', color: 'var(--text-muted)', borderLeft: '3px solid var(--primary)', paddingLeft: '1rem' }}>
                "{trip.vibe}"
              </p>
            )}
          </div>

          {/* Roster & Participants Card */}
          <div className="glass-card" style={{ padding: '2rem', border: '1px solid var(--border-light)' }}>
            <h2 style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>👥 RSVP Roster</span>
              <span style={{ fontSize: '1rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>
                {roster.length} participant{roster.length !== 1 ? 's' : ''}
              </span>
            </h2>

            {roster.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '1.5rem 0' }}>
                No participants have RSVPed to this trip yet.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {roster.map((member) => {
                  const user = member.users || {}
                  const isCommitted = member.status?.toLowerCase() === 'committed'
                  const isCurrentUser = user.id === activeUser.id

                  return (
                    <div
                      key={member.user_id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '1rem',
                        background: isCurrentUser ? 'rgba(56, 122, 255, 0.05)' : 'rgba(255, 255, 255, 0.02)',
                        border: isCurrentUser ? '1px solid var(--primary-light)' : '1px solid var(--border-light)',
                        borderRadius: 'var(--border-radius-sm)',
                        transition: 'var(--transition-fast)'
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: '600', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {user.first_name || 'Anonymous User'}
                          {isCurrentUser && <span style={{ fontSize: '0.8rem', background: 'var(--primary)', color: 'white', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>You</span>}
                        </div>
                        {user.username && (
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                            @{user.username}
                          </div>
                        )}
                        {isCurrentUser ? (
                          <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <input
                              type="text"
                              value={userNote}
                              placeholder="Add RSVP details/notes..."
                              onChange={(e) => setUserNote(e.target.value)}
                              onBlur={handleNoteBlur}
                              style={{
                                padding: '4px 8px',
                                fontSize: '0.85rem',
                                borderRadius: '4px',
                                border: '1px solid var(--border-light)',
                                background: 'rgba(255, 255, 255, 0.03)',
                                color: 'var(--text-main)',
                                outline: 'none',
                                width: '220px'
                              }}
                            />
                            {savingNote && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Saving...</span>}
                          </div>
                        ) : (
                          member.notes && (
                            <div style={{ fontSize: '0.9rem', fontStyle: 'italic', color: 'var(--text-muted)', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <span>📝</span> <span>{member.notes}</span>
                            </div>
                          )
                        )}
                      </div>
                      <span className={`badge ${isCommitted ? 'badge-committed' : 'badge-interested'}`}>
                        {member.status || 'Interested'}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default TripDetails
