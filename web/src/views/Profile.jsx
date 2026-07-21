import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useUserSession } from '../hooks/useUserSession'
import { updateUserProfile, checkUsernameAvailable, generateTelegramLinkCode, disconnectTelegram } from '../services/users'

const COLOR_PRESETS = [
  '#38bdf8', // Cyan
  '#34d399', // Emerald
  '#818cf8', // Indigo
  '#f472b6', // Pink
  '#fbbf24', // Amber
  '#a78bfa', // Purple
  '#f87171', // Red
  '#2dd4bf'  // Teal
]

function Profile() {
  const { activeUser, logout, updateActiveUser } = useUserSession()
  const navigate = useNavigate()

  useEffect(() => {
    if (!activeUser) {
      navigate('/trips')
    }
  }, [activeUser, navigate])

  const [firstName, setFirstName] = useState('')
  const [username, setUsername] = useState('')
  const [avatarColor, setAvatarColor] = useState('#38bdf8')
  
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [successToast, setSuccessToast] = useState(false)
  const [usernameError, setUsernameError] = useState('')

  // Telegram link modal
  const [linkCode, setLinkCode] = useState('')
  const [showLinkModal, setShowLinkModal] = useState(false)
  const [linkingLoading, setLinkingLoading] = useState(false)

  useEffect(() => {
    if (activeUser) {
      setFirstName(activeUser.first_name || '')
      setUsername(activeUser.username || '')
      const savedColor = localStorage.getItem(`trip_planner_avatar_${activeUser.id}`)
      if (savedColor) {
        setAvatarColor(savedColor)
      } else if (activeUser.avatar_color) {
        setAvatarColor(activeUser.avatar_color)
      }
    }
  }, [activeUser])

  if (!activeUser) return null

  const getInitials = (name) => {
    if (!name) return '?'
    const parts = name.trim().split(/\s+/)
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase()
    }
    return parts[0].substring(0, 2).toUpperCase()
  }

  const handleUsernameBlur = async () => {
    if (!username.trim() || username.trim().toLowerCase() === (activeUser.username || '').toLowerCase()) {
      setUsernameError('')
      return
    }
    try {
      const isAvailable = await checkUsernameAvailable(username.trim())
      if (!isAvailable) {
        setUsernameError('Username is already taken.')
      } else {
        setUsernameError('')
      }
    } catch (err) {
      console.error('Failed checking username availability:', err)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setUsernameError('')

    if (!firstName.trim()) {
      setError('First name is required.')
      return
    }

    if (username.trim() && username.trim().toLowerCase() !== (activeUser.username || '').toLowerCase()) {
      const isAvailable = await checkUsernameAvailable(username.trim())
      if (!isAvailable) {
        setUsernameError('Username is already taken.')
        return
      }
    }

    setSaving(true)
    try {
      const updated = await updateUserProfile(activeUser.id, {
        first_name: firstName.trim(),
        username: username.trim() || null
      })
      localStorage.setItem(`trip_planner_avatar_${activeUser.id}`, avatarColor)
      updateActiveUser({ ...updated, avatar_color: avatarColor })
      setSuccessToast(true)
      setTimeout(() => setSuccessToast(false), 3000)
    } catch (err) {
      console.error('Failed to update profile:', err)
      setError(err.message || 'Failed to update profile.')
    } finally {
      setSaving(false)
    }
  }

  const handleLinkTelegram = async () => {
    setLinkingLoading(true)
    try {
      const code = await generateTelegramLinkCode(activeUser.id)
      setLinkCode(code)
      setShowLinkModal(true)
    } catch (err) {
      console.error('Failed to generate Telegram link code:', err)
      alert('Could not generate Telegram link code. Please try again.')
    } finally {
      setLinkingLoading(false)
    }
  }

  const handleDisconnectTelegram = async () => {
    if (!window.confirm('Are you sure you want to disconnect your Telegram account?')) return
    setLinkingLoading(true)
    try {
      const updated = await disconnectTelegram(activeUser.id)
      updateActiveUser(updated)
      alert('Telegram account disconnected.')
    } catch (err) {
      console.error('Failed to disconnect Telegram:', err)
      alert('Could not disconnect Telegram account.')
    } finally {
      setLinkingLoading(false)
    }
  }

  const isTelegramLinked = activeUser.telegram_id > 0

  return (
    <div className="container" style={{ paddingTop: '2rem', paddingBottom: '4rem', maxWidth: '720px' }}>
      {/* Top Header Navigation */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <Link to="/trips" className="btn btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          ← Back to Trips
        </Link>
        <h1 style={{ margin: 0, fontSize: '1.75rem', color: 'var(--primary-light)' }}>Traveler Profile</h1>
        <button onClick={logout} className="btn btn-secondary" style={{ fontSize: '0.85rem' }}>
          Sign Out
        </button>
      </div>

      {/* Success Toast */}
      {successToast && (
        <div 
          className="glass-card animate-fade-in" 
          style={{ 
            background: 'rgba(16, 185, 129, 0.15)', 
            border: '1px solid rgba(16, 185, 129, 0.3)', 
            color: '#34d399', 
            padding: '12px 16px', 
            borderRadius: 'var(--border-radius-sm)', 
            marginBottom: '1.5rem',
            textAlign: 'center',
            fontWeight: '600'
          }}
        >
          ✓ Profile updated successfully!
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        {/* Main Profile Info & Avatar Card */}
        <div className="glass-card animate-fade-in" style={{ padding: '2rem', border: '1px solid var(--border-light)' }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            {/* Avatar Preview & Color Picker */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', paddingBottom: '1.5rem', borderBottom: '1px solid var(--border-light)' }}>
              <div 
                style={{ 
                  width: '80px', 
                  height: '80px', 
                  borderRadius: '50%', 
                  backgroundColor: avatarColor, 
                  color: '#ffffff', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  fontSize: '2rem', 
                  fontWeight: 'bold',
                  boxShadow: '0 4px 14px rgba(0,0,0,0.3)',
                  flexShrink: 0
                }}
              >
                {getInitials(firstName)}
              </div>

              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-muted)', display: 'block', marginBottom: '0.5rem' }}>
                  Avatar Accent Color
                </label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {COLOR_PRESETS.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setAvatarColor(c)}
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        backgroundColor: c,
                        border: avatarColor === c ? '3px solid #ffffff' : '1px solid transparent',
                        cursor: 'pointer',
                        boxShadow: avatarColor === c ? '0 0 8px ' + c : 'none',
                        transition: 'transform 0.15s ease'
                      }}
                      title={c}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Profile Fields */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-muted)' }}>First Name / Display Name *</label>
              <input
                type="text"
                placeholder="e.g. Alex"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
                className="input-field"
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-muted)' }}>Username (Optional)</label>
              <input
                type="text"
                placeholder="e.g. alex_smith"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onBlur={handleUsernameBlur}
                className="input-field"
              />
              {usernameError && (
                <span style={{ fontSize: '0.8rem', color: 'hsl(0, 85%, 65%)' }}>{usernameError}</span>
              )}
            </div>

            {activeUser.email && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-muted)' }}>Email Address (Account ID)</label>
                <input
                  type="email"
                  value={activeUser.email}
                  disabled
                  className="input-field"
                  style={{ opacity: 0.7, cursor: 'not-allowed', background: 'rgba(255, 255, 255, 0.02)' }}
                />
              </div>
            )}

            {error && (
              <div style={{ color: 'hsl(0, 85%, 65%)', fontSize: '0.85rem' }}>
                {error}
              </div>
            )}

            <button type="submit" className="btn" disabled={saving} style={{ width: '100%', marginTop: '0.5rem' }}>
              {saving ? 'Saving...' : 'Save Profile Changes'}
            </button>
          </form>
        </div>

        {/* Telegram Account Management Card */}
        <div className="glass-card animate-fade-in" style={{ padding: '2rem', border: '1px solid var(--border-light)' }}>
          <h2 style={{ fontSize: '1.25rem', color: 'var(--primary-light)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>✈️ Telegram Integration</span>
          </h2>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', background: 'rgba(255, 255, 255, 0.02)', padding: '1.25rem', borderRadius: 'var(--border-radius-sm)', border: '1px solid var(--border-light)' }}>
            <div>
              <div style={{ fontWeight: '600', fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                Status: {isTelegramLinked ? (
                  <span style={{ color: '#38bdf8', fontWeight: '700' }}>Linked</span>
                ) : (
                  <span style={{ color: 'var(--text-muted)' }}>Unlinked (Web Profile)</span>
                )}
              </div>
              {isTelegramLinked ? (
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Telegram User ID: <strong style={{ color: 'var(--text-main)' }}>{activeUser.telegram_id}</strong>
                </div>
              ) : (
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Link your Telegram account to sync group chat RSVPs, option votes, and expense logs.
                </div>
              )}
            </div>

            {isTelegramLinked ? (
              <button
                onClick={handleDisconnectTelegram}
                className="btn btn-secondary"
                disabled={linkingLoading}
                style={{ borderColor: 'hsl(0, 80%, 60%)', color: 'hsl(0, 80%, 60%)', fontSize: '0.85rem' }}
              >
                {linkingLoading ? 'Disconnecting...' : 'Disconnect Telegram'}
              </button>
            ) : (
              <button
                onClick={handleLinkTelegram}
                className="btn"
                disabled={linkingLoading}
                style={{ fontSize: '0.85rem' }}
              >
                {linkingLoading ? 'Generating...' : 'Link Telegram Account'}
              </button>
            )}
          </div>
        </div>

        {/* Account Session Actions */}
        <div className="glass-card animate-fade-in" style={{ padding: '1.5rem 2rem', border: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ fontWeight: '600', color: 'var(--text-main)' }}>Active Session</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Switch to another traveler profile or sign out.</div>
          </div>
          <button onClick={logout} className="btn btn-secondary">
            Sign Out / Switch Profile
          </button>
        </div>
      </div>

      {/* Telegram Account Linking Modal */}
      {showLinkModal && (
        <div className="modal-overlay" onClick={() => setShowLinkModal(false)}>
          <div className="modal-content glass-card animate-fade-in" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px', textAlign: 'center' }}>
            <h2 style={{ color: 'var(--primary-light)', marginBottom: '0.5rem', fontSize: '1.4rem' }}>Link Telegram Account</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.25rem', lineHeight: '1.5' }}>
              This will merge all RSVP history, expenses, and votes from your Telegram profile into this email account.
            </p>
            
            <div style={{ 
              background: 'rgba(255, 255, 255, 0.05)', 
              padding: '1rem', 
              borderRadius: '8px', 
              border: '1px solid var(--border-light)', 
              marginBottom: '1.5rem' 
            }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>YOUR LINK CODE:</span>
              <strong style={{ fontSize: '1.8rem', color: 'var(--primary-light)', letterSpacing: '2px' }}>{linkCode}</strong>
            </div>

            <a 
              href={`https://t.me/TripSyncBot?start=link_${linkCode}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn"
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', textDecoration: 'none', marginBottom: '0.75rem' }}
            >
              Open Telegram Bot
            </a>

            <button onClick={() => setShowLinkModal(false)} className="btn btn-secondary" style={{ width: '100%' }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default Profile
