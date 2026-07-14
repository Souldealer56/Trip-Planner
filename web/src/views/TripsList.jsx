import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTrips } from '../hooks/useTrips'
import { formatDateRange } from '../utils/format'
import { createTrip } from '../services/trips'

function TripsList() {
  const { data: trips, loading, error, refresh } = useTrips()
  const navigate = useNavigate()

  // Form Modal States
  const [showModal, setShowModal] = useState(false)
  const [title, setTitle] = useState('')
  const [destination, setDestination] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [baseCurrency, setBaseCurrency] = useState('USD')
  const [submitting, setSubmitting] = useState(false)
  const [validationError, setValidationError] = useState('')

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

  return (
    <div style={{ padding: '2rem', maxWidth: '1000px', margin: '0 auto', width: '100%' }} className="animate-fade-in">
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
