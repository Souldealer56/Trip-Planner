import React, { useState, useEffect } from 'react'

export function PitchOptionModal({
  isOpen,
  onClose,
  onSubmit,
  loading = false,
  error = '',
  categories = ['Accommodation', 'Flights', 'Activities', 'Food', 'Transport', 'Other'],
  initialCategory = 'Accommodation',
  initialStartDate = '',
  initialEndDate = '',
  baseCurrency = 'USD'
}) {
  const [pitchCategory, setPitchCategory] = useState(initialCategory)
  const [pitchName, setPitchName] = useState('')
  const [pitchCost, setPitchCost] = useState('')
  const [pitchCurrency, setPitchCurrency] = useState(baseCurrency)
  const [pitchLink, setPitchLink] = useState('')
  const [pitchDesc, setPitchDesc] = useState('')
  const [pitchStartDate, setPitchStartDate] = useState(initialStartDate)
  const [pitchEndDate, setPitchEndDate] = useState(initialEndDate)
  const [validationError, setValidationError] = useState('')

  useEffect(() => {
    if (isOpen) {
      setPitchCategory(initialCategory || 'Accommodation')
      setPitchStartDate(initialStartDate || '')
      setPitchEndDate(initialEndDate || '')
      setPitchCurrency(baseCurrency || 'USD')
      setPitchName('')
      setPitchCost('')
      setPitchLink('')
      setPitchDesc('')
      setValidationError('')
    }
  }, [isOpen, initialCategory, initialStartDate, initialEndDate, baseCurrency])

  if (!isOpen) return null

  const handleSubmit = (e) => {
    e.preventDefault()
    setValidationError('')

    if (!pitchName.trim()) {
      setValidationError('Option name is required.')
      return
    }
    if (pitchCost && (isNaN(pitchCost) || parseFloat(pitchCost) < 0)) {
      setValidationError('Estimated cost must be a positive number.')
      return
    }
    if (pitchStartDate && pitchEndDate && new Date(pitchStartDate) > new Date(pitchEndDate)) {
      setValidationError('Start date must be before or equal to end date.')
      return
    }

    onSubmit({
      category: pitchCategory,
      name: pitchName.trim(),
      cost: pitchCost ? parseFloat(pitchCost) : null,
      currency: pitchCost ? (pitchCurrency || baseCurrency || 'USD') : null,
      link: pitchLink.trim() || null,
      description: pitchDesc.trim() || null,
      startDate: pitchStartDate || null,
      endDate: pitchEndDate || null
    })
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content glass-card animate-fade-in" onClick={(e) => e.stopPropagation()}>
        <div>
          <h2 style={{ color: 'var(--primary-light)', marginBottom: '0.5rem', textAlign: 'center' }}>
            Pitch New Option
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem', textAlign: 'center' }}>
            Suggest a new option for the group to vote on.
          </p>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-muted)' }}>Category *</label>
              <select
                value={pitchCategory}
                onChange={(e) => setPitchCategory(e.target.value)}
                className="input-field select-field"
                required
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-muted)' }}>Option Name / Title *</label>
              <input
                type="text"
                placeholder="e.g. Ocean View Cabin"
                value={pitchName}
                onChange={(e) => setPitchName(e.target.value)}
                required
                className="input-field"
              />
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
                <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-muted)' }}>Estimated Cost (Optional)</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="e.g. 450.00"
                  value={pitchCost}
                  onChange={(e) => setPitchCost(e.target.value)}
                  className="input-field"
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-muted)' }}>Currency</label>
                <select
                  value={pitchCurrency}
                  onChange={(e) => setPitchCurrency(e.target.value)}
                  className="input-field select-field"
                  style={{ padding: '0.75rem var(--spacing-md) 0.75rem 0.5rem' }}
                >
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                  <option value="CAD">CAD ($)</option>
                  <option value="AUD">AUD ($)</option>
                  <option value="JPY">JPY (¥)</option>
                  <option value="CHF">CHF (Fr)</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1, minWidth: '180px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-muted)' }}>Start Date & Time (Optional)</label>
                <input
                  type="datetime-local"
                  value={pitchStartDate}
                  onChange={(e) => {
                    const val = e.target.value
                    if (val && val.length === 10) {
                      setPitchStartDate(`${val}T16:00`)
                    } else {
                      setPitchStartDate(val)
                    }
                  }}
                  className="input-field"
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1, minWidth: '180px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-muted)' }}>End Date & Time (Optional)</label>
                <input
                  type="datetime-local"
                  value={pitchEndDate}
                  onChange={(e) => {
                    const val = e.target.value
                    if (val && val.length === 10) {
                      setPitchEndDate(`${val}T11:00`)
                    } else {
                      setPitchEndDate(val)
                    }
                  }}
                  className="input-field"
                />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-muted)' }}>URL Link (Optional)</label>
              <input
                type="url"
                placeholder="e.g. https://airbnb.com/rooms/..."
                value={pitchLink}
                onChange={(e) => setPitchLink(e.target.value)}
                className="input-field"
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-muted)' }}>Description (Optional)</label>
              <textarea
                placeholder="Provide details about this option..."
                value={pitchDesc}
                onChange={(e) => setPitchDesc(e.target.value)}
                rows="3"
                className="input-field"
                style={{ resize: 'vertical', fontFamily: 'inherit' }}
              />
            </div>

            {(validationError || error) && (
              <div style={{ color: 'hsl(0, 85%, 65%)', fontSize: '0.85rem', textAlign: 'center' }}>
                ⚠️ {validationError || error}
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button type="submit" disabled={loading} className="btn" style={{ flex: 1 }}>
                {loading ? 'Pitching...' : 'Pitch Option'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="btn btn-secondary"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
