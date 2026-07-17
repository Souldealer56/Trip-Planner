import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../services/supabase'
import { createUser } from '../services/users'
import { createRsvp } from '../services/rsvps'
import { requestLoginLink } from '../services/auth'
import { useUserSession } from '../hooks/useUserSession'

function JoinTrip() {
  const { tripId } = useParams()
  const navigate = useNavigate()
  const { activeUser, login } = useUserSession()

  const [trip, setTrip] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Fast path inputs
  const [firstName, setFirstName] = useState('')
  const [username, setUsername] = useState('')
  
  // Secure path inputs
  const [email, setEmail] = useState('')
  const [emailSent, setEmailSent] = useState(false)
  const [sentToken, setSentToken] = useState('') // For DEV mode testing

  const [submitting, setSubmitting] = useState(false)
  const [actionMessage, setActionMessage] = useState('')

  // Fetch trip details
  useEffect(() => {
    async function loadTrip() {
      try {
        const { data, error: tripErr } = await supabase
          .from('trips')
          .select('*')
          .eq('id', tripId)
          .maybeSingle()

        if (tripErr) throw tripErr
        if (!data) {
          setError('We could not find the trip details. The invite link might be invalid.')
        } else {
          setTrip(data)
        }
      } catch (err) {
        console.error('Error loading trip details:', err)
        setError('Failed to load trip details. Please check your internet connection.')
      } finally {
        setLoading(false)
      }
    }
    loadTrip()
  }, [tripId])

  // Handle immediate auto-join for already authenticated users
  useEffect(() => {
    if (!loading && trip && activeUser) {
      async function autoJoin() {
        try {
          // Attempt to add RSVP as Tentative. Swallowing duplicate key errors.
          await createRsvp(tripId, activeUser.id, 'Tentative').catch(e => {
            // Ignore unique key constraint / existing RSVP errors
            console.log('User already has an RSVP record, redirecting directly.', e)
          })
          navigate(`/trips/${tripId}`)
        } catch (err) {
          console.error('Error during auto-join:', err)
          navigate(`/trips/${tripId}`)
        }
      }
      autoJoin()
    }
  }, [loading, trip, activeUser, tripId, navigate])

  const handleFastPathSubmit = async (e) => {
    e.preventDefault()
    if (!firstName.trim()) {
      alert('Please enter your first name.')
      return
    }

    setSubmitting(true)
    setActionMessage('Creating traveler profile...')
    try {
      // 1. Create traveler profile
      const newUser = await createUser(username.trim(), firstName.trim())
      
      // 2. Log user into session context
      login(newUser)

      // 3. Create Tentative RSVP for the trip
      setActionMessage('Joining the trip roster...')
      await createRsvp(tripId, newUser.id, 'Tentative')

      // 4. Redirect to trip details view
      navigate(`/trips/${tripId}`)
    } catch (err) {
      console.error('Fast path registration failed:', err)
      alert(err.message || 'Registration failed. Please try again.')
      setSubmitting(false)
      setActionMessage('')
    }
  }

  const handleSecurePathSubmit = async (e) => {
    e.preventDefault()
    if (!email.trim() || !email.includes('@')) {
      alert('Please enter a valid email address.')
      return
    }

    setSubmitting(true)
    setActionMessage('Requesting magic link...')
    try {
      // Generate magic link login token and queue email
      const token = await requestLoginLink(email.trim())
      
      // Cache target trip ID so /verify knows where to redirect
      localStorage.setItem('trip_planner_pending_invite_trip_id', tripId)
      
      setEmailSent(true)
      setSentToken(token) // Cache for dev helper display
    } catch (err) {
      console.error('Email request failed:', err)
      alert(err.message || 'Failed to request email login.')
    } finally {
      setSubmitting(false)
      setActionMessage('')
    }
  }

  // Format dates helper
  const formatTripDates = (start, end) => {
    if (!start || !end) return ''
    const options = { month: 'short', day: 'numeric', year: 'numeric' }
    const sDate = new Date(start).toLocaleDateString(undefined, options)
    const eDate = new Date(end).toLocaleDateString(undefined, options)
    return `${sDate} – ${eDate}`
  }

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner} />
        <h2 style={styles.loadingText}>Loading Trip Invitation...</h2>
      </div>
    )
  }

  if (error || !trip) {
    return (
      <div style={styles.container}>
        <div style={styles.errorCard}>
          <div style={styles.errorIcon}>!</div>
          <h2 style={styles.cardTitle}>Invitation Error</h2>
          <p style={styles.cardSubtitle}>{error || 'Something went wrong.'}</p>
          <button style={styles.primaryButton} onClick={() => navigate('/trips')}>
            Go to Trips List
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={styles.container}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&family=Inter:wght@400;500;600&display=swap');
        
        .join-card {
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          animation: fadeIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        .join-input:focus {
          border-color: var(--border-focus, #3b82f6) !important;
          box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.25) !important;
          outline: none;
        }

        .join-btn:hover {
          transform: translateY(-1px);
          filter: brightness(1.1);
        }

        .join-btn:active {
          transform: translateY(0);
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @media (max-width: 768px) {
          .columns-grid {
            flex-direction: column !important;
            gap: 1.5rem !important;
          }
        }
      `}</style>

      <div className="join-card" style={styles.card}>
        <div style={styles.tripHeader}>
          <span style={styles.badge}>✈️ You're Invited</span>
          <h1 style={styles.tripTitle}>{trip.title}</h1>
          <p style={styles.tripLocation}>📍 {trip.destination}</p>
          <p style={styles.tripDates}>{formatTripDates(trip.start_date, trip.end_date)}</p>
        </div>

        <div style={styles.divider} />

        {emailSent ? (
          <div style={styles.successWrapper}>
            <div style={styles.successIcon}>✉️</div>
            <h2 style={styles.cardTitle}>Verification Sent</h2>
            <p style={styles.cardSubtitle}>
              We sent a passwordless magic login link to <strong>{email}</strong>.
              Click the link inside the email to complete your registration and join this trip!
            </p>

            {/* Dev Mode Helper Banner (D-01/D-02 from Context) */}
            {import.meta.env.DEV && (
              <div style={styles.devBanner}>
                <h4 style={styles.devTitle}>🛠️ Local Dev Helper (Resend Mock)</h4>
                <p style={styles.devDesc}>Click the button below to simulate verifying the email token:</p>
                <a
                  href={`/verify?token=${sentToken}`}
                  style={styles.devLink}
                  className="join-btn"
                >
                  Simulate Email Link Click
                </a>
              </div>
            )}

            <button
              style={styles.secondaryButton}
              onClick={() => {
                setEmailSent(false)
                setEmail('')
              }}
            >
              Request a New Link
            </button>
          </div>
        ) : (
          <div>
            <p style={styles.welcomePrompt}>
              To view trip details, vote on accommodation options, and coordinate group expenses, join the trip roster:
            </p>

            <div className="columns-grid" style={styles.grid}>
              {/* Option A: Fast Path */}
              <div style={styles.panel}>
                <h3 style={styles.panelTitle}>🚀 Join Instantly</h3>
                <p style={styles.panelDesc}>Enter your name to join immediately as a guest. You can connect to Telegram later.</p>
                
                <form onSubmit={handleFastPathSubmit} style={styles.form}>
                  <div style={styles.inputGroup}>
                    <label style={styles.label}>First Name *</label>
                    <input
                      type="text"
                      className="join-input"
                      placeholder="e.g. Alex"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      required
                      disabled={submitting}
                      style={styles.input}
                    />
                  </div>
                  <div style={styles.inputGroup}>
                    <label style={styles.label}>Telegram Username (Optional)</label>
                    <div style={styles.inputWrapper}>
                      <span style={styles.inputIcon}>@</span>
                      <input
                        type="text"
                        className="join-input"
                        placeholder="username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        disabled={submitting}
                        style={{ ...styles.input, paddingLeft: '2rem' }}
                      />
                    </div>
                  </div>
                  
                  <button
                    type="submit"
                    className="join-btn"
                    disabled={submitting}
                    style={styles.primaryButton}
                  >
                    {submitting && actionMessage ? actionMessage : 'Join Trip'}
                  </button>
                </form>
              </div>

              <div style={styles.verticalDivider} />

              {/* Option B: Secure Path */}
              <div style={styles.panel}>
                <h3 style={styles.panelTitle}>🔒 Secure Join</h3>
                <p style={styles.panelDesc}>Use your email address to sign in. Keeps your travel profile safe and linkable.</p>
                
                <form onSubmit={handleSecurePathSubmit} style={styles.form}>
                  <div style={styles.inputGroup}>
                    <label style={styles.label}>Email Address</label>
                    <input
                      type="email"
                      className="join-input"
                      placeholder="alex@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      disabled={submitting}
                      style={styles.input}
                    />
                  </div>
                  
                  <button
                    type="submit"
                    className="join-btn"
                    disabled={submitting}
                    style={{ ...styles.primaryButton, backgroundColor: '#4f46e5' }}
                  >
                    {submitting && actionMessage ? actionMessage : 'Send Magic Link'}
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const styles = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    backgroundColor: 'var(--bg-main, #0b0f19)',
    color: 'var(--text-main, #f8fafc)',
    fontFamily: 'var(--font-family, sans-serif)',
    padding: '2rem',
    boxSizing: 'border-box'
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    backgroundColor: 'var(--bg-main, #0b0f19)',
    color: 'var(--text-muted, #94a3b8)',
    fontFamily: 'var(--font-family, sans-serif)'
  },
  spinner: {
    width: '48px',
    height: '48px',
    borderRadius: '50%',
    border: '4px solid var(--primary-light, #3b82f6)',
    borderTopColor: 'transparent',
    animation: 'spin 1s linear infinite'
  },
  loadingText: {
    marginTop: '1.5rem',
    fontSize: '1.2rem',
    fontWeight: '500'
  },
  card: {
    maxWidth: '800px',
    width: '100%',
    backgroundColor: 'var(--glass-bg, rgba(22, 28, 45, 0.65))',
    border: '1px solid var(--glass-border, rgba(255, 255, 255, 0.08))',
    borderRadius: 'var(--border-radius-lg, 20px)',
    padding: '2.5rem',
    boxShadow: 'var(--glass-shadow, 0 8px 32px 0 rgba(0, 0, 0, 0.37))',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    gap: '2rem'
  },
  errorCard: {
    maxWidth: '420px',
    width: '100%',
    backgroundColor: 'rgba(220, 38, 38, 0.05)',
    border: '1px solid rgba(220, 38, 38, 0.15)',
    borderRadius: 'var(--border-radius-md, 12px)',
    padding: '2.5rem',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '1rem'
  },
  errorIcon: {
    width: '56px',
    height: '56px',
    borderRadius: '50%',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#ef4444',
    fontSize: '2rem',
    fontWeight: 'bold',
    marginBottom: '1rem'
  },
  badge: {
    display: 'inline-block',
    padding: '0.25rem 0.75rem',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    color: 'var(--primary-light, #60a5fa)',
    fontSize: '0.85rem',
    fontWeight: '600',
    borderRadius: '100px',
    marginBottom: '0.75rem'
  },
  tripHeader: {
    textAlign: 'center'
  },
  tripTitle: {
    fontSize: '2.25rem',
    fontWeight: '700',
    margin: '0 0 0.5rem 0',
    fontFamily: "'Outfit', sans-serif"
  },
  tripLocation: {
    fontSize: '1.1rem',
    fontWeight: '500',
    color: 'var(--text-muted, #94a3b8)',
    margin: '0 0 0.5rem 0'
  },
  tripDates: {
    fontSize: '1rem',
    fontWeight: '500',
    color: 'var(--text-muted, #94a3b8)',
    margin: '0'
  },
  divider: {
    height: '1px',
    backgroundColor: 'var(--border-light, #1e293b)'
  },
  grid: {
    display: 'flex',
    gap: '2.5rem',
    alignItems: 'stretch'
  },
  panel: {
    flex: '1',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    gap: '1rem'
  },
  panelTitle: {
    fontSize: '1.25rem',
    fontWeight: '600',
    margin: '0',
    fontFamily: "'Outfit', sans-serif"
  },
  panelDesc: {
    fontSize: '0.9rem',
    lineHeight: '1.4',
    color: 'var(--text-muted, #94a3b8)',
    margin: '0'
  },
  welcomePrompt: {
    fontSize: '1rem',
    lineHeight: '1.5',
    textAlign: 'center',
    color: 'var(--text-muted, #cbd5e1)',
    margin: '0 0 2rem 0'
  },
  verticalDivider: {
    width: '1px',
    backgroundColor: 'var(--border-light, #1e293b)'
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
    marginTop: 'auto'
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem'
  },
  label: {
    fontSize: '0.85rem',
    fontWeight: '500',
    color: 'var(--text-muted, #94a3b8)'
  },
  inputWrapper: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center'
  },
  inputIcon: {
    position: 'absolute',
    left: '0.75rem',
    color: 'var(--text-muted, #64748b)',
    fontSize: '0.95rem',
    pointerEvents: 'none'
  },
  input: {
    width: '100%',
    padding: '0.75rem 1rem',
    backgroundColor: 'var(--bg-surface, #0f172a)',
    border: '1px solid var(--border-light, #1e293b)',
    borderRadius: 'var(--border-radius-md, 12px)',
    color: 'var(--text-main, #f8fafc)',
    fontSize: '0.95rem',
    boxSizing: 'border-box',
    transition: 'var(--transition-fast, all 0.15s ease)'
  },
  primaryButton: {
    width: '100%',
    padding: '0.85rem',
    backgroundColor: 'var(--primary, #3b82f6)',
    color: '#ffffff',
    border: 'none',
    borderRadius: 'var(--border-radius-md, 12px)',
    fontSize: '0.95rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'var(--transition-fast, all 0.15s ease)',
    boxShadow: 'var(--shadow-premium, 0 4px 20px 0 rgba(0, 0, 0, 0.25))'
  },
  secondaryButton: {
    padding: '0.75rem 1.5rem',
    backgroundColor: 'var(--bg-surface, #0f172a)',
    color: 'var(--text-main, #f8fafc)',
    border: '1px solid var(--border-light, #1e293b)',
    borderRadius: 'var(--border-radius-md, 12px)',
    fontSize: '0.95rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'var(--transition-fast, all 0.15s ease)',
    marginTop: '1rem'
  },
  successWrapper: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    gap: '1rem'
  },
  successIcon: {
    width: '64px',
    height: '64px',
    borderRadius: '50%',
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#22c55e',
    fontSize: '2.5rem',
    marginBottom: '1rem'
  },
  cardTitle: {
    fontSize: '1.5rem',
    fontWeight: '600',
    margin: '0',
    fontFamily: "'Outfit', sans-serif"
  },
  cardSubtitle: {
    fontSize: '0.95rem',
    color: 'var(--text-muted, #94a3b8)',
    lineHeight: '1.6',
    margin: '0',
    maxWidth: '480px'
  },
  devBanner: {
    marginTop: '1.5rem',
    padding: '1.25rem',
    backgroundColor: 'rgba(234, 179, 8, 0.05)',
    border: '1px dashed rgba(234, 179, 8, 0.3)',
    borderRadius: 'var(--border-radius-md, 12px)',
    textAlign: 'left',
    width: '100%',
    maxWidth: '480px',
    boxSizing: 'border-box'
  },
  devTitle: {
    margin: '0 0 0.5rem 0',
    color: '#eab308',
    fontSize: '0.95rem',
    fontWeight: '600'
  },
  devDesc: {
    margin: '0 0 0.75rem 0',
    color: 'var(--text-muted, #94a3b8)',
    fontSize: '0.85rem',
    lineHeight: '1.4'
  },
  devLink: {
    display: 'block',
    textAlign: 'center',
    padding: '0.6rem',
    backgroundColor: '#eab308',
    color: '#0f172a',
    borderRadius: '8px',
    fontWeight: '600',
    textDecoration: 'none',
    fontSize: '0.9rem',
    transition: 'var(--transition-fast, all 0.15s ease)'
  }
}

export default JoinTrip
