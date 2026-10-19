import React, { useState, useEffect, useMemo } from 'react'
import { getPresentTravelers } from '../../services/rsvps'

const EMPTY_ROSTER = []

export function PitchOptionModal({
  isOpen,
  onClose,
  onSubmit,
  loading = false,
  error = '',
  categories = ['Accommodation', 'Transport', 'Activities', 'Food', 'Other'],
  initialCategory = 'Accommodation',
  initialStartDate = '',
  initialEndDate = '',
  baseCurrency = 'USD',
  roster = EMPTY_ROSTER,
  activeUserId = ''
}) {
  const normInitCat = (initialCategory || '').toLowerCase() === 'flights' ? 'Transport' : (initialCategory || 'Accommodation')
  const [pitchCategory, setPitchCategory] = useState(normInitCat)
  const [pitchName, setPitchName] = useState('')
  const [pitchCost, setPitchCost] = useState('')
  const [pitchCurrency, setPitchCurrency] = useState(baseCurrency)
  const [pitchLink, setPitchLink] = useState('')
  const [pitchDesc, setPitchDesc] = useState('')
  const [pitchStartDate, setPitchStartDate] = useState(initialStartDate)
  const [pitchEndDate, setPitchEndDate] = useState(initialEndDate)
  const [pitchCostType, setPitchCostType] = useState('split_total')
  const [pitchAssignedUsers, setPitchAssignedUsers] = useState([])
  const [pitchMetadata, setPitchMetadata] = useState({})
  const [validationError, setValidationError] = useState('')

  // Determine intelligent default pricing model by category and transport mode
  const getDefaultCostType = (cat, mode) => {
    const c = (cat || '').toLowerCase()
    if (c === 'accommodation') return 'split_total'
    if (c === 'activities') return 'per_person'
    if (c === 'transport' || c === 'flights') return mode === 'ticket' ? 'per_person' : 'split_total'
    return 'split_total'
  }

  // Calculate committed travelers present during option dates
  const committedMembers = useMemo(
    () => (roster || EMPTY_ROSTER).filter((m) => m.status === 'Committed'),
    [roster]
  )

  const presentTravelers = useMemo(
    () => getPresentTravelers(committedMembers, pitchStartDate, pitchEndDate),
    [committedMembers, pitchStartDate, pitchEndDate]
  )

  useEffect(() => {
    if (isOpen) {
      const isInitFlight = (initialCategory || '').toLowerCase() === 'flights'
      const cat = isInitFlight ? 'Transport' : (initialCategory || 'Accommodation')
      setPitchCategory(cat)
      setPitchStartDate(initialStartDate || '')
      setPitchEndDate(initialEndDate || '')
      setPitchCurrency(baseCurrency || 'USD')

      const initialMode = isInitFlight ? 'ticket' : (cat.toLowerCase() === 'transport' ? 'vehicle' : 'vehicle')
      setPitchCostType(getDefaultCostType(cat, initialMode))

      setPitchName('')
      setPitchCost('')
      setPitchLink('')
      setPitchDesc('')
      setValidationError('')

      // Default assigned users to all present committed travelers
      const currentCommitted = (roster || EMPTY_ROSTER).filter((m) => m.status === 'Committed')
      const present = getPresentTravelers(currentCommitted, initialStartDate, initialEndDate)
      setPitchAssignedUsers(present.map((m) => String(m.user_id || m.id)))

      setPitchMetadata({
        transport_mode: initialMode,
        max_capacity: '',
        beds_summary: '',
        has_kitchen: false,
        check_in_out: '',
        seats_capacity: '',
        driver_user_id: '',
        estimated_fuel_cost: '',
        route_code: '',
        transit_times: '',
        baggage_included: true,
        max_participants: '',
        difficulty_or_duration: '',
        required_gear: ''
      })
    }
  }, [isOpen, initialCategory, initialStartDate, initialEndDate, baseCurrency, roster])

  if (!isOpen) return null

  const handleCategoryChange = (newCat) => {
    const normalized = newCat.toLowerCase() === 'flights' ? 'Transport' : newCat
    setPitchCategory(normalized)
    const mode = pitchMetadata.transport_mode || 'vehicle'
    setPitchCostType(getDefaultCostType(normalized, mode))
    setPitchMetadata(prev => ({
      ...prev,
      transport_mode: mode
    }))
  }

  const handleTransportModeChange = (mode) => {
    setPitchMetadata(prev => ({ ...prev, transport_mode: mode }))
    setPitchCostType(mode === 'ticket' ? 'per_person' : 'split_total')
  }

  const toggleParticipantPill = (userId) => {
    const idStr = String(userId)
    setPitchAssignedUsers(prev => {
      if (prev.includes(idStr)) {
        return prev.filter(id => id !== idStr)
      } else {
        return [...prev, idStr]
      }
    })
  }

  const handleSelectAllPresent = () => {
    setPitchAssignedUsers(presentTravelers.map(m => String(m.user_id || m.id)))
  }

  const handleClearAllAssigned = () => {
    setPitchAssignedUsers([])
  }

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

    const catLower = pitchCategory.toLowerCase()
    const cleanMeta = { ...pitchMetadata }

    if (catLower === 'accommodation') {
      cleanMeta.max_capacity = cleanMeta.max_capacity ? parseInt(cleanMeta.max_capacity, 10) : null
      cleanMeta.beds_summary = cleanMeta.beds_summary?.trim() || ''
      cleanMeta.has_kitchen = Boolean(cleanMeta.has_kitchen)
      cleanMeta.check_in_out = cleanMeta.check_in_out?.trim() || ''
    } else if (catLower === 'transport' || catLower === 'flights') {
      cleanMeta.transport_mode = cleanMeta.transport_mode || (catLower === 'flights' ? 'ticket' : 'vehicle')
      if (cleanMeta.transport_mode === 'vehicle') {
        cleanMeta.seats_capacity = cleanMeta.seats_capacity ? parseInt(cleanMeta.seats_capacity, 10) : null
        cleanMeta.driver_user_id = cleanMeta.driver_user_id || null
        cleanMeta.estimated_fuel_cost = cleanMeta.estimated_fuel_cost ? parseFloat(cleanMeta.estimated_fuel_cost) : null
      } else {
        cleanMeta.route_code = cleanMeta.route_code?.trim() || ''
        cleanMeta.transit_times = cleanMeta.transit_times?.trim() || ''
        cleanMeta.baggage_included = Boolean(cleanMeta.baggage_included)
      }
    } else if (catLower === 'activities') {
      cleanMeta.max_participants = cleanMeta.max_participants ? parseInt(cleanMeta.max_participants, 10) : null
      cleanMeta.difficulty_or_duration = cleanMeta.difficulty_or_duration?.trim() || ''
      cleanMeta.required_gear = cleanMeta.required_gear?.trim() || ''
    }

    onSubmit({
      category: pitchCategory,
      name: pitchName.trim(),
      cost: pitchCost ? parseFloat(pitchCost) : null,
      currency: pitchCost ? (pitchCurrency || baseCurrency || 'USD') : null,
      link: pitchLink.trim() || null,
      description: pitchDesc.trim() || null,
      startDate: pitchStartDate || null,
      endDate: pitchEndDate || null,
      costType: pitchCostType,
      assignedUsers: pitchAssignedUsers,
      metadata: cleanMeta
    })
  }

  const catLower = pitchCategory.toLowerCase()

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content glass-card animate-fade-in"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto' }}
      >
        <div>
          <h2 style={{ color: 'var(--primary-light)', marginBottom: '0.25rem', textAlign: 'center' }}>
            Pitch New Option
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.25rem', textAlign: 'center' }}>
            Propose accommodation, transport, or activities with smart pricing & participant spots.
          </p>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Category & Title */}
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', width: '160px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-muted)' }}>Category *</label>
                <select
                  value={pitchCategory}
                  onChange={(e) => handleCategoryChange(e.target.value)}
                  className="input-field select-field"
                  required
                >
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', flex: 1, minWidth: '220px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-muted)' }}>Option Name / Title *</label>
                <input
                  type="text"
                  placeholder={
                    catLower === 'accommodation' ? 'e.g. Modern Ocean View Villa' :
                    catLower === 'transport' ? 'e.g. 7-Seater Minivan or Flight SATA AZ412' :
                    catLower === 'activities' ? 'e.g. Canyon Waterfall Rappelling Tour' :
                    'e.g. Group Dinner at Seaside Bistro'
                  }
                  value={pitchName}
                  onChange={(e) => setPitchName(e.target.value)}
                  required
                  className="input-field"
                />
              </div>
            </div>

            {/* Estimated Cost, Currency & Pricing Model */}
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', flex: 1, minWidth: '150px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-muted)' }}>
                  {pitchCostType === 'per_person' ? 'Cost Per Person' : 'Estimated Total Cost'}
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder={pitchCostType === 'per_person' ? 'e.g. 45.00 / person' : 'e.g. 600.00 total'}
                  value={pitchCost}
                  onChange={(e) => setPitchCost(e.target.value)}
                  className="input-field"
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', width: '100px' }}>
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

            {/* Pricing Model Selector */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-muted)' }}>
                Pricing Model (How is this split?)
              </label>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => setPitchCostType('split_total')}
                  style={{
                    padding: '0.35rem 0.75rem',
                    borderRadius: '8px',
                    fontSize: '0.8rem',
                    fontWeight: pitchCostType === 'split_total' ? '700' : '500',
                    cursor: 'pointer',
                    border: pitchCostType === 'split_total' ? '1px solid var(--primary-light)' : '1px solid var(--border-light)',
                    background: pitchCostType === 'split_total' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255, 255, 255, 0.03)',
                    color: pitchCostType === 'split_total' ? 'var(--primary-light)' : 'var(--text-main)'
                  }}
                >
                  👥 Split Total (Default)
                </button>
                <button
                  type="button"
                  onClick={() => setPitchCostType('per_person')}
                  style={{
                    padding: '0.35rem 0.75rem',
                    borderRadius: '8px',
                    fontSize: '0.8rem',
                    fontWeight: pitchCostType === 'per_person' ? '700' : '500',
                    cursor: 'pointer',
                    border: pitchCostType === 'per_person' ? '1px solid var(--primary-light)' : '1px solid var(--border-light)',
                    background: pitchCostType === 'per_person' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255, 255, 255, 0.03)',
                    color: pitchCostType === 'per_person' ? 'var(--primary-light)' : 'var(--text-main)'
                  }}
                >
                  🎟️ Per Person / Ticket
                </button>
                <button
                  type="button"
                  onClick={() => setPitchCostType('per_night')}
                  style={{
                    padding: '0.35rem 0.75rem',
                    borderRadius: '8px',
                    fontSize: '0.8rem',
                    fontWeight: pitchCostType === 'per_night' ? '700' : '500',
                    cursor: 'pointer',
                    border: pitchCostType === 'per_night' ? '1px solid var(--primary-light)' : '1px solid var(--border-light)',
                    background: pitchCostType === 'per_night' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255, 255, 255, 0.03)',
                    color: pitchCostType === 'per_night' ? 'var(--primary-light)' : 'var(--text-main)'
                  }}
                >
                  🌙 Per Night (Prorated)
                </button>
              </div>
            </div>

            {/* Category-Specific Metadata Fields */}
            {catLower === 'accommodation' && (
              <div
                style={{
                  background: 'rgba(59, 130, 246, 0.05)',
                  border: '1px solid rgba(59, 130, 246, 0.2)',
                  borderRadius: '8px',
                  padding: '0.85rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem'
                }}
              >
                <span style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--primary-light)' }}>
                  🏨 Accommodation Details
                </span>

                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: '140px' }}>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Max Sleepers / Beds Capacity</label>
                    <input
                      type="number"
                      min="1"
                      placeholder="e.g. 8"
                      value={pitchMetadata.max_capacity || ''}
                      onChange={(e) => setPitchMetadata(prev => ({ ...prev, max_capacity: e.target.value }))}
                      className="input-field"
                      style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem' }}
                    />
                  </div>

                  <div style={{ flex: 2, minWidth: '180px' }}>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Beds Summary</label>
                    <input
                      type="text"
                      placeholder="e.g. 3 Queen beds, 2 Twin singles"
                      value={pitchMetadata.beds_summary || ''}
                      onChange={(e) => setPitchMetadata(prev => ({ ...prev, beds_summary: e.target.value }))}
                      className="input-field"
                      style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  <div style={{ flex: 1, minWidth: '200px' }}>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Check-in / Check-out Times</label>
                    <input
                      type="text"
                      placeholder="e.g. Check-in 15:00 / Check-out 11:00"
                      value={pitchMetadata.check_in_out || ''}
                      onChange={(e) => setPitchMetadata(prev => ({ ...prev, check_in_out: e.target.value }))}
                      className="input-field"
                      style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem' }}
                    />
                  </div>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-main)', marginTop: '1rem' }}>
                    <input
                      type="checkbox"
                      checked={Boolean(pitchMetadata.has_kitchen)}
                      onChange={(e) => setPitchMetadata(prev => ({ ...prev, has_kitchen: e.target.checked }))}
                    />
                    <span>🍳 Has Kitchen for group cooking</span>
                  </label>
                </div>
              </div>
            )}

            {(catLower === 'transport' || catLower === 'flights') && (
              <div
                style={{
                  background: 'rgba(59, 130, 246, 0.05)',
                  border: '1px solid rgba(59, 130, 246, 0.2)',
                  borderRadius: '8px',
                  padding: '0.85rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--primary-light)' }}>
                    🚗✈️ Transport & Transit Mode
                  </span>
                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => handleTransportModeChange('vehicle')}
                      style={{
                        padding: '0.35rem 0.65rem',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        fontWeight: pitchMetadata.transport_mode === 'vehicle' ? '700' : '500',
                        cursor: 'pointer',
                        border: pitchMetadata.transport_mode === 'vehicle' ? '1px solid #60a5fa' : '1px solid var(--border-light)',
                        background: pitchMetadata.transport_mode === 'vehicle' ? 'rgba(59, 130, 246, 0.25)' : 'transparent',
                        color: pitchMetadata.transport_mode === 'vehicle' ? '#60a5fa' : 'var(--text-muted)'
                      }}
                    >
                      🚗 Shared Vehicle (Rental Car / Van / Boat)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleTransportModeChange('ticket')}
                      style={{
                        padding: '0.35rem 0.65rem',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        fontWeight: pitchMetadata.transport_mode === 'ticket' ? '700' : '500',
                        cursor: 'pointer',
                        border: pitchMetadata.transport_mode === 'ticket' ? '1px solid #60a5fa' : '1px solid var(--border-light)',
                        background: pitchMetadata.transport_mode === 'ticket' ? 'rgba(59, 130, 246, 0.25)' : 'transparent',
                        color: pitchMetadata.transport_mode === 'ticket' ? '#60a5fa' : 'var(--text-muted)'
                      }}
                    >
                      ✈️🚆 Transit Ticket (Flight / Train / Ferry / Bus)
                    </button>
                  </div>
                </div>

                {pitchMetadata.transport_mode === 'vehicle' ? (
                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <div style={{ width: '130px' }}>
                      <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Passenger Seats</label>
                      <input
                        type="number"
                        min="1"
                        placeholder="e.g. 5"
                        value={pitchMetadata.seats_capacity || ''}
                        onChange={(e) => setPitchMetadata(prev => ({ ...prev, seats_capacity: e.target.value }))}
                        className="input-field"
                        style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem' }}
                      />
                    </div>

                    <div style={{ flex: 1, minWidth: '160px' }}>
                      <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>🚗 Designated Driver</label>
                      <select
                        value={pitchMetadata.driver_user_id || ''}
                        onChange={(e) => setPitchMetadata(prev => ({ ...prev, driver_user_id: e.target.value }))}
                        className="input-field select-field"
                        style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem' }}
                      >
                        <option value="">-- Select Driver (Optional) --</option>
                        {committedMembers.map(m => (
                          <option key={m.user_id} value={m.user_id}>
                            {m.users?.first_name || m.username || 'Traveler'} {m.user_id === activeUserId ? '(You)' : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div style={{ width: '140px' }}>
                      <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Est. Gas/Toll Cost</label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="e.g. 50.00"
                        value={pitchMetadata.estimated_fuel_cost || ''}
                        onChange={(e) => setPitchMetadata(prev => ({ ...prev, estimated_fuel_cost: e.target.value }))}
                        className="input-field"
                        style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem' }}
                      />
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    <div style={{ flex: 1, minWidth: '180px' }}>
                      <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Flight / Route Number</label>
                      <input
                        type="text"
                        placeholder="e.g. SATA AZ412 · YUL → PDL"
                        value={pitchMetadata.route_code || ''}
                        onChange={(e) => setPitchMetadata(prev => ({ ...prev, route_code: e.target.value }))}
                        className="input-field"
                        style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem' }}
                      />
                    </div>

                    <div style={{ flex: 1, minWidth: '180px' }}>
                      <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Departure / Arrival Times</label>
                      <input
                        type="text"
                        placeholder="e.g. Dep 08:30 · Arr 14:15"
                        value={pitchMetadata.transit_times || ''}
                        onChange={(e) => setPitchMetadata(prev => ({ ...prev, transit_times: e.target.value }))}
                        className="input-field"
                        style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem' }}
                      />
                    </div>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-main)', marginTop: '1rem' }}>
                      <input
                        type="checkbox"
                        checked={Boolean(pitchMetadata.baggage_included)}
                        onChange={(e) => setPitchMetadata(prev => ({ ...prev, baggage_included: e.target.checked }))}
                      />
                      <span>🧳 Baggage Included</span>
                    </label>
                  </div>
                )}
              </div>
            )}

            {catLower === 'activities' && (
              <div
                style={{
                  background: 'rgba(59, 130, 246, 0.05)',
                  border: '1px solid rgba(59, 130, 246, 0.2)',
                  borderRadius: '8px',
                  padding: '0.85rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem'
                }}
              >
                <span style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--primary-light)' }}>
                  🧗 Activity & Adventure Details
                </span>

                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <div style={{ width: '140px' }}>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Max Participants</label>
                    <input
                      type="number"
                      min="1"
                      placeholder="e.g. 10 (Quota)"
                      value={pitchMetadata.max_participants || ''}
                      onChange={(e) => setPitchMetadata(prev => ({ ...prev, max_participants: e.target.value }))}
                      className="input-field"
                      style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem' }}
                    />
                  </div>

                  <div style={{ flex: 1, minWidth: '160px' }}>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Duration / Difficulty</label>
                    <input
                      type="text"
                      placeholder="e.g. 4h · Moderate hike"
                      value={pitchMetadata.difficulty_or_duration || ''}
                      onChange={(e) => setPitchMetadata(prev => ({ ...prev, difficulty_or_duration: e.target.value }))}
                      className="input-field"
                      style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem' }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>🎒 Required Gear & Packing</label>
                  <input
                    type="text"
                    placeholder="e.g. Hiking boots, Headlamp, Swimsuit, Waterproof bag"
                    value={pitchMetadata.required_gear || ''}
                    onChange={(e) => setPitchMetadata(prev => ({ ...prev, required_gear: e.target.value }))}
                    className="input-field"
                    style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem' }}
                  />
                </div>
              </div>
            )}

            {/* Who is Participating Multi-Select Pill Bar */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-muted)' }}>
                  👥 Who’s Participating ({pitchAssignedUsers.length} selected)
                </label>
                <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.75rem' }}>
                  <button
                    type="button"
                    onClick={handleSelectAllPresent}
                    style={{ background: 'none', border: 'none', color: '#60a5fa', cursor: 'pointer', padding: 0 }}
                  >
                    Select All
                  </button>
                  <span style={{ color: 'var(--text-muted)' }}>•</span>
                  <button
                    type="button"
                    onClick={handleClearAllAssigned}
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}
                  >
                    Clear
                  </button>
                </div>
              </div>

              {committedMembers.length === 0 ? (
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  No committed participants found on trip roster yet.
                </span>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                  {committedMembers.map((member) => {
                    const uIdStr = String(member.user_id || member.id)
                    const isSelected = pitchAssignedUsers.includes(uIdStr)
                    const name = member.users?.first_name || member.username || 'Traveler'
                    return (
                      <button
                        key={uIdStr}
                        type="button"
                        onClick={() => toggleParticipantPill(uIdStr)}
                        style={{
                          padding: '0.25rem 0.6rem',
                          borderRadius: '16px',
                          fontSize: '0.75rem',
                          fontWeight: isSelected ? '700' : '500',
                          cursor: 'pointer',
                          border: isSelected ? '1px solid #10b981' : '1px solid var(--border-light)',
                          background: isSelected ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                          color: isSelected ? '#10b981' : 'var(--text-main)',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {name} {isSelected ? '✓' : '+'}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Dates & Times */}
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', flex: 1, minWidth: '180px' }}>
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', flex: 1, minWidth: '180px' }}>
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

            {/* URL Link */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-muted)' }}>URL Link (Optional)</label>
              <input
                type="url"
                placeholder="e.g. https://airbnb.com/rooms/..."
                value={pitchLink}
                onChange={(e) => setPitchLink(e.target.value)}
                className="input-field"
              />
            </div>

            {/* Description */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-muted)' }}>Notes / Pitch Pitch (Optional)</label>
              <textarea
                placeholder="Provide helpful context, amenities, or rationale for the group..."
                value={pitchDesc}
                onChange={(e) => setPitchDesc(e.target.value)}
                rows="2"
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
