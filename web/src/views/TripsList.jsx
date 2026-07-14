import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTrips } from '../hooks/useTrips'
import { formatDateRange } from '../utils/format'
import { createTrip } from '../services/trips'
import { createRsvp } from '../services/rsvps'
import { useUserSession } from '../hooks/useUserSession'
import { fetchAllUsers, checkUsernameAvailable, createUser } from '../services/users'

// Helper to extract initials from name
const getInitials = (name) => {
  if (!name) return ''
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }
  return name.slice(0, 2).toUpperCase()
}

// Helper to generate a consistent background color based on name/id
const getAvatarColor = (id) => {
  const colors = [
    'hsl(210, 70%, 50%)', // Blue
    'hsl(160, 60%, 43%)', // Teal
    'hsl(280, 60%, 55%)', // Purple
    'hsl(340, 65%, 55%)', // Pink
    'hsl(20, 75%, 50%)',  // Orange
    'hsl(120, 50%, 40%)',  // Green
    'hsl(45, 80%, 45%)',   // Amber
    'hsl(185, 75%, 40%)'   // Cyan
  ]
  const seed = typeof id === 'number' ? id : (id ? id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) : 0)
  return colors[Math.abs(seed) % colors.length]
}

function TripsList() {
  const { activeUser, login, logout } = useUserSession()
  const { data: trips, loading, error, refresh } = useTrips(activeUser?.id)
  const navigate = useNavigate()

  // Trips Form Modal States
  const [showModal, setShowModal] = useState(false)
  const [title, setTitle] = useState('')
  const [destination, setDestination] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [baseCurrency, setBaseCurrency] = useState('USD')
  const [submitting, setSubmitting] = useState(false)
  const [validationError, setValidationError] = useState('')

  // Traveler Profile Splash States
  const [users, setUsers] = useState([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [usersError, setUsersError] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  
  // Registration States
  const [showRegisterModal, setShowRegisterModal] = useState(false)
  const [newFirstName, setNewFirstName] = useState('')
  const [newUsername, setNewUsername] = useState('')
  const [usernameChecking, setUsernameChecking] = useState(false)
  const [usernameAvailable, setUsernameAvailable] = useState(true)
  const [usernameError, setUsernameError] = useState('')
  const [registerSubmitting, setRegisterSubmitting] = useState(false)
  const [registerError, setRegisterError] = useState('')

  // Load all traveler profiles if user is not signed in
  useEffect(() => {
    if (!activeUser) {
      let active = true
      const loadUsers = async () => {
        setLoadingUsers(true)
        try {
          const data = await fetchAllUsers()
          if (active) {
            setUsers(data)
            setUsersError(null)
          }
        } catch (err) {
          console.error('Failed to load users:', err)
          if (active) setUsersError('Failed to fetch travelers. Please refresh the page.')
        } finally {
          if (active) setLoadingUsers(false)
        }
      }
      loadUsers()
      return () => { active = false }
    }
  }, [activeUser])

  // Debounced/Real-time check for username availability
  useEffect(() => {
    const trimmed = newUsername.trim()
    if (!trimmed) {
      setUsernameError('')
      setUsernameAvailable(true)
      return
    }

    const cleanUsername = trimmed.replace(/^@/, '')
    setUsernameChecking(true)
    const timer = setTimeout(async () => {
      try {
        const isAvailable = await checkUsernameAvailable(cleanUsername)
        setUsernameAvailable(isAvailable)
        if (isAvailable) {
          setUsernameError('')
        } else {
          setUsernameError('This Telegram username is already registered. Please sign in as them or use another username.')
        }
      } catch (err) {
        console.error('Failed to validate username uniqueness:', err)
      } finally {
        setUsernameChecking(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [newUsername])

  const handleCreateTrip = async (e) => {
    e.preventDefault()
    setValidationError('')

    if (!title.trim() || !destination.trim() || !startDate || !endDate) {
      setValidationError('All fields are required.')
      return
    }

    const start = new Date(startDate)
    const end = new Date(endDate)
    if (end < start) {
      setValidationError('End date cannot be before start date.')
      return
    }

    setSubmitting(true)
    try {
      const newTrip = await createTrip(
        title.trim(),
        destination.trim(),
        startDate,
        endDate,
        baseCurrency
      )

      // Auto-RSVP the creator as Committed
      if (activeUser?.id) {
        await createRsvp(newTrip.id, activeUser.id, 'Committed')
      }

      // Reset form states
      setTitle('')
      setDestination('')
      setStartDate('')
      setEndDate('')
      setBaseCurrency('USD')
      setShowModal(false)

      // Redirect to newly created trip
      navigate(`/trips/${newTrip.id}`)
    } catch (err) {
      console.error('Failed to create trip:', err)
      setValidationError(err.message || 'Failed to create trip. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleRegister = async (e) => {
    e.preventDefault()
    if (!newFirstName.trim()) {
      setRegisterError('First name is required.')
      return
    }

    const cleanUsername = newUsername.trim().replace(/^@/, '')
    setRegisterSubmitting(true)
    setRegisterError('')

    try {
      if (cleanUsername) {
        const isAvailable = await checkUsernameAvailable(cleanUsername)
        if (!isAvailable) {
          setRegisterError('This Telegram username is already registered. Please sign in as them or use another username.')
          setRegisterSubmitting(false)
          return
        }
      }

      const newUser = await createUser(cleanUsername || null, newFirstName.trim())
      login(newUser)
      setNewFirstName('')
      setNewUsername('')
      setShowRegisterModal(false)
    } catch (err) {
      console.error('Failed to register traveler:', err)
      setRegisterError(err.message || 'Failed to register traveler. Please try again.')
    } finally {
      setRegisterSubmitting(false)
    }
  }

  // Filter travelers based on search query
  const filteredUsers = users.filter(user => {
    const query = searchQuery.toLowerCase()
    const nameMatch = user.first_name.toLowerCase().includes(query)
    const userMatch = user.username && user.username.toLowerCase().includes(query)
    return nameMatch || userMatch
  })

  // If no traveler is signed in, render the splash selection grid overlay
  if (!activeUser) {
    return (
      <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto', width: '100%', minHeight: '80vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }} className="animate-fade-in">
        <style>{`
          .profile-card {
            display: flex;
            flex-direction: column;
            align-items: center;
            cursor: pointer;
            transition: var(--transition-smooth);
            user-select: none;
          }
          .profile-card:hover .profile-avatar {
            transform: scale(1.08);
            border-color: var(--primary-light) !important;
            box-shadow: var(--shadow-hover) !important;
          }
          .profile-card:hover .profile-name {
            color: var(--primary-light) !important;
          }
          .profile-avatar-add {
            width: 100px;
            height: 100px;
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.03);
            border: 3px dashed var(--border-light);
            color: var(--text-muted);
            display: flex;
            align-items: center;
            justifyContent: center;
            font-size: 2.5rem;
            margin-bottom: 0.75rem;
            box-shadow: none;
            transition: var(--transition-smooth);
          }
          .profile-card:hover .profile-avatar-add {
            transform: scale(1.08);
            border-color: var(--primary-light) !important;
            color: var(--primary-light) !important;
            background: rgba(255, 255, 255, 0.06) !important;
          }
        `}</style>
        
        <h1 style={{ color: 'var(--text-main)', fontSize: '2.5rem', marginBottom: '0.5rem', fontWeight: '800', textAlign: 'center' }}>Who is traveling?</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem', marginBottom: '2.5rem', textAlign: 'center' }}>Select a traveler profile to view trips, manage RSVPs, and split expenses.</p>

        {loadingUsers ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', margin: '2rem 0' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', border: '3px solid var(--border-light)', borderTopColor: 'var(--primary)', animation: 'spin 1s linear infinite' }} />
            <span style={{ color: 'var(--text-muted)' }}>Loading profiles...</span>
          </div>
        ) : usersError ? (
          <div className="glass-card error-card" style={{ padding: '2rem', textAlign: 'center', maxWidth: '400px' }}>
            <p style={{ color: 'hsl(0, 85%, 65%)', marginBottom: '1rem' }}>{usersError}</p>
            <button onClick={() => window.location.reload()} className="btn">Retry</button>
          </div>
        ) : (
          <>
            {/* Real-time search bar */}
            <div style={{ position: 'relative', width: '100%', maxWidth: '450px', marginBottom: '2.5rem' }}>
              <input
                type="text"
                placeholder="Search traveler by name or @username..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input-field"
                style={{
                  paddingLeft: '2.75rem',
                  borderRadius: '50px',
                  background: 'var(--bg-surface-elevated)',
                  border: '1px solid var(--border-light)',
                  height: '46px',
                  fontSize: '1rem'
                }}
              />
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', left: '1.1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>

            {/* Profiles Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 120px))', gap: '2rem', width: '100%', maxWidth: '650px', justifyContent: 'center', marginBottom: '3rem' }}>
              {filteredUsers.map((user) => {
                const initials = getInitials(user.first_name)
                const avatarColor = getAvatarColor(user.id || user.first_name)
                return (
                  <div key={user.id} onClick={() => login(user)} className="profile-card">
                    <div style={{
                      width: '100px',
                      height: '100px',
                      borderRadius: '50%',
                      backgroundColor: avatarColor,
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '2rem',
                      fontWeight: 'bold',
                      marginBottom: '0.75rem',
                      border: '3px solid transparent',
                      boxShadow: 'var(--shadow-premium)',
                      transition: 'var(--transition-smooth)'
                    }} className="profile-avatar">
                      {initials}
                    </div>
                    <span style={{ color: 'var(--text-main)', fontWeight: '600', fontSize: '0.95rem', textAlign: 'center', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', width: '100%' }} className="profile-name">
                      {user.first_name}
                    </span>
                    {user.username ? (
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', width: '100%', textAlign: 'center' }}>
                        @{user.username}
                      </span>
                    ) : (
                      <span style={{ color: 'transparent', fontSize: '0.75rem' }}>-</span>
                    )}
                  </div>
                )
              })}

              {/* Add traveler card */}
              <div onClick={() => setShowRegisterModal(true)} className="profile-card">
                <div className="profile-avatar-add">
                  +
                </div>
                <span style={{ color: 'var(--text-muted)', fontWeight: '600', fontSize: '0.95rem' }} className="profile-name">
                  Add Traveler
                </span>
                <span style={{ color: 'transparent', fontSize: '0.75rem' }}>-</span>
              </div>
            </div>

            {filteredUsers.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', margin: '1rem 0' }}>
                <p style={{ marginBottom: '1rem' }}>No profiles match "{searchQuery}".</p>
                <button
                  onClick={() => {
                    setNewFirstName(searchQuery)
                    setShowRegisterModal(true)
                  }}
                  className="btn btn-secondary"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
                >
                  Create Traveler "{searchQuery}"
                </button>
              </div>
            )}
          </>
        )}

        {/* Traveler Registration Modal */}
        {showRegisterModal && (
          <div className="modal-overlay" onClick={() => setShowRegisterModal(false)}>
            <div className="modal-content glass-card animate-fade-in" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px' }}>
              <h2 style={{ color: 'var(--primary-light)', marginBottom: '0.5rem', fontSize: '1.4rem' }}>Create Traveler Profile</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>Set up your traveler identity to log expenses and confirm RSVPs.</p>
              
              {registerError && (
                <div style={{ color: 'hsl(0, 85%, 65%)', fontSize: '0.85rem', marginBottom: '1rem', background: 'rgba(239, 68, 68, 0.1)', padding: '8px', borderRadius: 'var(--border-radius-sm)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                  ⚠️ {registerError}
                </div>
              )}
              
              <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-muted)' }}>First Name *</label>
                  <input
                    type="text"
                    className="input-field"
                    value={newFirstName}
                    onChange={(e) => setNewFirstName(e.target.value)}
                    placeholder="e.g. Alex"
                    required
                    disabled={registerSubmitting}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-muted)' }}>Telegram Username (Optional)</label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontWeight: '600', pointerEvents: 'none' }}>@</span>
                    <input
                      type="text"
                      className="input-field"
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value)}
                      placeholder="username"
                      style={{ paddingLeft: '1.75rem' }}
                      disabled={registerSubmitting}
                    />
                  </div>
                  {usernameChecking && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Checking username availability...</span>
                  )}
                  {usernameError && (
                    <span style={{ fontSize: '0.75rem', color: 'hsl(0, 85%, 65%)', lineHeight: '1.2' }}>{usernameError}</span>
                  )}
                  {!usernameChecking && !usernameError && newUsername.trim() && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--accent-light)' }}>✓ Username is available</span>
                  )}
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                  <button type="button" onClick={() => setShowRegisterModal(false)} className="btn btn-secondary" disabled={registerSubmitting}>
                    Cancel
                  </button>
                  <button type="submit" className="btn" disabled={registerSubmitting || !usernameAvailable || usernameChecking}>
                    {registerSubmitting ? 'Registering...' : 'Create & Sign In'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    )
  }

  // Signed in trips dashboard list
  return (
    <div style={{ padding: '2rem', maxWidth: '1000px', margin: '0 auto', width: '100%' }} className="animate-fade-in">
      {/* Session user info bar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '0.65rem 1rem',
        borderRadius: 'var(--border-radius-md)',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-light)',
        marginBottom: '2rem',
        fontSize: '0.9rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <div style={{
            width: '26px',
            height: '26px',
            borderRadius: '50%',
            backgroundColor: getAvatarColor(activeUser.id),
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 'bold',
            fontSize: '0.75rem'
          }}>
            {getInitials(activeUser.first_name)}
          </div>
          <span style={{ color: 'var(--text-main)' }}>
            Signed in as <strong>{activeUser.first_name}</strong>
            {activeUser.username ? ` (@${activeUser.username})` : ''}
          </span>
        </div>
        <button onClick={logout} className="btn btn-secondary" style={{ padding: '0.25rem 0.65rem', fontSize: '0.75rem' }}>
          Change Traveler
        </button>
      </div>

      <div className="page-header">
        <div>
          <h1 style={{ color: 'var(--primary-light)', fontSize: '2rem' }}>TripSync Planner</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Collaborative group trips synced with Telegram</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button onClick={() => setShowModal(true)} className="btn" title="Create new trip">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New Trip
          </button>
          <button onClick={refresh} className="btn btn-secondary" title="Refresh trips list">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {loading && (
        <div className="grid-layout">
          {[1, 2, 3].map((n) => (
            <div key={n} className="glass-card" style={{ padding: 'var(--spacing-lg)', minHeight: '160px', opacity: 0.8 }}>
              <div className="skeleton skeleton-title" />
              <div className="skeleton skeleton-text" style={{ width: '80%' }} />
              <div className="skeleton skeleton-text" style={{ width: '50%', marginTop: '1rem' }} />
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="glass-card error-card animate-fade-in" style={{ padding: '2rem', textAlign: 'center' }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'hsl(0, 85%, 65%)', marginBottom: '1rem' }}>
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <h2 style={{ marginBottom: '0.5rem' }}>Failed to Load Trips</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>{error}</p>
          <button onClick={refresh} className="btn">
            Try Again
          </button>
        </div>
      )}

      {!loading && !error && trips.length === 0 && (
        <div className="glass-card animate-fade-in" style={{ padding: '3rem 2rem', textAlign: 'center', background: 'rgba(22, 28, 45, 0.4)' }}>
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
            <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
          </svg>
          <h2 style={{ marginBottom: '0.5rem', color: 'var(--text-main)' }}>No Trips Found</h2>
          <p style={{ color: 'var(--text-muted)', maxWidth: '400px', margin: '0 auto 1.5rem' }}>
            There are no collaborative trip plans synced to the database yet. Click the "New Trip" button to get started!
          </p>
          <button onClick={() => setShowModal(true)} className="btn">
            Create a Trip
          </button>
        </div>
      )}

      {!loading && !error && trips.length > 0 && (
        <div className="grid-layout">
          {trips.map((trip) => (
            <Link key={trip.id} to={`/trips/${trip.id}`} style={{ color: 'inherit' }}>
              <div className="trip-card">
                <h3>{trip.title}</h3>
                <div className="destination" style={{ color: 'var(--text-muted)' }}>
                  📍 {trip.destination}
                </div>
                <div className="dates">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                  {formatDateRange(trip.start_date, trip.end_date)}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* New Trip Creation Modal Overlay */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content glass-card animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ color: 'var(--primary-light)', marginBottom: '1rem', fontSize: '1.5rem' }}>Create New Trip</h2>
            {validationError && (
              <div style={{ color: 'hsl(0, 85%, 65%)', fontSize: '0.85rem', marginBottom: '1rem', background: 'rgba(239, 68, 68, 0.1)', padding: '8px', borderRadius: 'var(--border-radius-sm)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                ⚠️ {validationError}
              </div>
            )}
            <form onSubmit={handleCreateTrip} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-muted)' }}>Trip Title *</label>
                <input
                  type="text"
                  className="input-field"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Summer Vacation 2026"
                  required
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-muted)' }}>Destination *</label>
                <input
                  type="text"
                  className="input-field"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  placeholder="e.g. Hawaii, USA"
                  required
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-muted)' }}>Start Date *</label>
                  <input
                    type="date"
                    className="input-field"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    required
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-muted)' }}>End Date *</label>
                  <input
                    type="date"
                    className="input-field"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-muted)' }}>Base Currency *</label>
                <select
                  className="input-field select-field"
                  value={baseCurrency}
                  onChange={(e) => setBaseCurrency(e.target.value)}
                  required
                >
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                  <option value="JPY">JPY (¥)</option>
                  <option value="CAD">CAD ($)</option>
                  <option value="AUD">AUD ($)</option>
                </select>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary" disabled={submitting}>
                  Cancel
                </button>
                <button type="submit" className="btn" disabled={submitting}>
                  {submitting ? 'Creating...' : 'Create Trip'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default TripsList
