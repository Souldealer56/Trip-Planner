import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTrips } from '../hooks/useTrips'
import { useUserSession } from '../hooks/useUserSession'
import { formatDateRange } from '../utils/format'
import { createTrip } from '../services/trips'
import { createRsvp } from '../services/rsvps'
import { fetchAllUsers, checkUsernameAvailable, createUser } from '../services/users'
import { requestLoginLink } from '../services/auth'

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

function SplashLogin() {
  const [emailInput, setEmailInput] = React.useState('');
  const [loginLoading, setLoginLoading] = React.useState(false);
  const [loginSuccess, setLoginSuccess] = React.useState(false);
  const [loginError, setLoginError] = React.useState('');
  const [debugToken, setDebugToken] = React.useState('');

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    if (!emailInput.trim()) return;

    setLoginLoading(true);
    setLoginError('');
    setLoginSuccess(false);
    setDebugToken('');

    try {
      const token = await requestLoginLink(emailInput);
      setLoginSuccess(true);
      setDebugToken(token);
    } catch (err) {
      console.error(err);
      setLoginError(err.message || 'Failed to send login link. Please try again.');
    } finally {
      setLoginLoading(false);
    }
  };

  return (
    <div style={{
      padding: '2rem',
      maxWidth: '450px',
      margin: '0 auto',
      width: '100%',
      minHeight: '80vh',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center'
    }} className="animate-fade-in">
      <div className="glass-card" style={{
        width: '100%',
        padding: '2.5rem',
        borderRadius: '16px',
        border: '1px solid var(--border-light)',
        background: 'rgba(30, 41, 59, 0.7)',
        boxShadow: 'var(--shadow-premium)',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem'
      }}>
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ color: 'var(--primary-light)', fontSize: '2.2rem', marginBottom: '0.5rem', fontWeight: '800' }}>TripSync Planner</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>Collaborative group trips synced with Telegram</p>
        </div>

        {loginSuccess ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
            alignItems: 'center',
            textAlign: 'center'
          }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              backgroundColor: 'rgba(34, 197, 94, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#22c55e',
              fontSize: '1.8rem',
              fontWeight: 'bold'
            }}>
              ✓
            </div>
            <div>
              <h3 style={{ color: 'var(--text-main)', fontSize: '1.2rem', marginBottom: '0.5rem', fontWeight: '600' }}>Check your email</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: '1.5' }}>
                We've sent a magic login link to <strong>{emailInput}</strong>. Click it to log in instantly.
              </p>
            </div>

            {debugToken && (
              <div style={{
                marginTop: '1rem',
                padding: '1rem',
                backgroundColor: 'rgba(56, 189, 248, 0.1)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                borderRadius: '8px',
                width: '100%',
                textAlign: 'center'
              }}>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.75rem', lineHeight: '1.4' }}>
                  Or click below to log in directly:
                </p>
                <a 
                  href={`/verify?token=${debugToken}`}
                  className="btn"
                  style={{
                    fontSize: '0.9rem',
                    textDecoration: 'none',
                    display: 'block',
                    width: '100%',
                    textAlign: 'center'
                  }}
                >
                  🚀 Log In Instantly
                </a>
              </div>
            )}

            <button 
              onClick={() => {
                setLoginSuccess(false);
                setEmailInput('');
              }}
              className="btn btn-secondary"
              style={{ width: '100%', marginTop: '0.5rem' }}
            >
              Back to Sign In
            </button>
          </div>
        ) : (
          <form onSubmit={handleEmailSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <h2 style={{ fontSize: '1.3rem', fontWeight: '700', color: 'var(--text-main)', margin: '0' }}>Sign In</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '0', lineHeight: '1.4' }}>
              Enter your email address to receive a secure, passwordless magic link to access your trips.
            </p>

            {loginError && (
              <div style={{
                color: 'hsl(0, 85%, 65%)',
                fontSize: '0.85rem',
                background: 'rgba(239, 68, 68, 0.1)',
                padding: '10px',
                borderRadius: '8px',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                lineHeight: '1.4'
              }}>
                ⚠️ {loginError}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-muted)' }}>Email Address</label>
              <input
                type="email"
                className="input-field"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="you@example.com"
                required
                disabled={loginLoading}
                style={{ fontSize: '0.95rem', height: '42px' }}
              />
            </div>

            <button
              type="submit"
              className="btn"
              disabled={loginLoading}
              style={{
                height: '42px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: '600',
                fontSize: '0.95rem'
              }}
            >
              {loginLoading ? 'Sending link...' : 'Send Magic Link'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
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

  // If no traveler is signed in, render the splash login overlay
  if (!activeUser) {
    return (
      <SplashLogin />
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
