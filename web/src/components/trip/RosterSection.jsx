import React, { useState } from 'react'

export const DIETARY_OPTIONS = [
  '🌱 Vegetarian',
  '🌿 Vegan',
  '🌾 Gluten-Free',
  '🥩 Halal',
  '🥜 Allergy',
  '🥛 Dairy-Free'
]

function getAvatarColor(nameOrId) {
  if (!nameOrId) return 'hsl(215, 60%, 45%)'
  let hash = 0
  const str = String(nameOrId)
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  const h = Math.abs(hash % 360)
  return `hsl(${h}, 65%, 45%)`
}

function getInitials(name) {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function formatStayDates(arrivalStr, departureStr) {
  if (!arrivalStr && !departureStr) return null

  const parseDate = (dStr) => {
    if (!dStr) return null
    const parts = String(dStr).slice(0, 10).split('-')
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10)
      const month = parseInt(parts[1], 10) - 1
      const day = parseInt(parts[2], 10)
      return new Date(year, month, day)
    }
    return new Date(dStr)
  }

  const arr = parseDate(arrivalStr)
  const dep = parseDate(departureStr)
  const opt = { month: 'short', day: 'numeric' }

  if (arr && dep) {
    return `${arr.toLocaleDateString('en-US', opt)} – ${dep.toLocaleDateString('en-US', opt)}`
  }
  if (arr) return `Arrives ${arr.toLocaleDateString('en-US', opt)}`
  if (dep) return `Departs ${dep.toLocaleDateString('en-US', opt)}`
  return null
}

export function RosterSection({
  roster = [],
  activeUser,
  trip,
  isAdmin = false,
  userNote = '',
  setUserNote,
  savingNote = false,
  onNoteBlur,
  onStatusChange,
  onPromoteMember,
  onDemoteMember,
  onCopyInviteLink,
  showCopiedToast = false,
  onUpdateRsvpDetails
}) {
  const activeMember = roster.find(m => String(m.user_id) === String(activeUser?.id))
  const otherMembers = roster.filter(m => String(m.user_id) !== String(activeUser?.id))
  const [editingMemberId, setEditingMemberId] = useState(null)

  // Local state for active user travel dates to avoid jitter
  const [myArrival, setMyArrival] = useState('')
  const [myDeparture, setMyDeparture] = useState('')

  // Sync initial arrival/departure from active member or trip
  const activeArrival = activeMember?.arrival_date || trip?.start_date || ''
  const activeDeparture = activeMember?.departure_date || trip?.end_date || ''
  const activeDietary = Array.isArray(activeMember?.dietary_tags) ? activeMember.dietary_tags : []

  const handleToggleDietaryTag = async (targetUserId, currentTags, tagToToggle) => {
    const list = Array.isArray(currentTags) ? [...currentTags] : []
    const nextTags = list.includes(tagToToggle)
      ? list.filter(t => t !== tagToToggle)
      : [...list, tagToToggle]

    if (onUpdateRsvpDetails) {
      await onUpdateRsvpDetails(targetUserId, { dietary_tags: nextTags })
    }
  }

  const handleDatesBlur = async (targetUserId, arrDate, depDate) => {
    if (onUpdateRsvpDetails) {
      await onUpdateRsvpDetails(targetUserId, {
        arrival_date: arrDate || null,
        departure_date: depDate || null
      })
    }
  }

  const handleStatusSelect = (statusVal) => {
    if (onStatusChange) {
      onStatusChange({ target: { value: statusVal } })
    }
  }

  return (
    <div className="glass-card" style={{ padding: '2rem', border: '1px solid var(--border-light)' }}>
      {/* Top Header Bar without redundant share button */}
      <h2
        style={{
          marginBottom: '1.5rem',
          borderBottom: '1px solid var(--border-light)',
          paddingBottom: '0.75rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.5rem'
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span>👥 RSVP Roster</span>
        </span>
        <span style={{ fontSize: '0.95rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>
          {roster.length} participant{roster.length !== 1 ? 's' : ''}
        </span>
      </h2>

      {/* 1. Unified Active User Card ("My RSVP") — Redesign Proposal D */}
      {activeMember && (() => {
        const activeName = activeMember.users?.first_name || activeUser?.name || activeUser?.first_name || 'Alexis'
        const activeHandle = activeMember.users?.username || activeUser?.username || activeMember.username
        const isOrganizer = trip?.organizer_id && String(trip.organizer_id) === String(activeMember.user_id)
        const isCoOrganizer = !isOrganizer && (activeMember.role === 'co_organizer' || activeMember.is_admin === true)
        const myStayDatesStr = formatStayDates(activeMember.arrival_date, activeMember.departure_date)
        const currentStatus = activeMember.status || 'Committed'

        return (
          <div
            className="glass-card animate-fade-in"
            style={{
              background: 'linear-gradient(135deg, rgba(56, 122, 255, 0.08) 0%, rgba(255, 255, 255, 0.02) 100%)',
              border: '1px solid var(--primary-light)',
              borderRadius: 'var(--border-radius-sm)',
              padding: '1.5rem',
              marginBottom: '2rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem'
            }}
          >
            {/* Card Sub-Header Label */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: '700',
                  color: 'var(--primary-light)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.75px'
                }}
              >
                My RSVP
              </span>
              {myStayDatesStr && (
                <span
                  style={{
                    fontSize: '0.75rem',
                    background: 'rgba(59, 130, 246, 0.15)',
                    color: '#60a5fa',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    fontWeight: '600',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  📅 {myStayDatesStr}
                </span>
              )}
            </div>

            {/* Header: User Avatar, Name, "You" Badge, Handle, Role, and 3-State Status Segmented Control */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '1rem'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                <div
                  style={{
                    width: '46px',
                    height: '46px',
                    borderRadius: '50%',
                    backgroundColor: getAvatarColor(activeUser?.id || activeMember.user_id),
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 'bold',
                    fontSize: '1.1rem',
                    border: '2px solid rgba(255, 255, 255, 0.25)',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
                    flexShrink: 0
                  }}
                >
                  {getInitials(activeName)}
                </div>

                <div>
                  <div style={{ fontWeight: '700', fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span>{activeName}</span>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        background: 'var(--primary)',
                        color: 'white',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontWeight: 'bold'
                      }}
                    >
                      You
                    </span>
                    {isOrganizer && (
                      <span
                        style={{
                          fontSize: '0.75rem',
                          background: 'rgba(234, 179, 8, 0.15)',
                          color: '#eab308',
                          border: '1px solid rgba(234, 179, 8, 0.3)',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          fontWeight: 'bold'
                        }}
                      >
                        👑 Organizer
                      </span>
                    )}
                    {isCoOrganizer && (
                      <span
                        style={{
                          fontSize: '0.75rem',
                          background: 'rgba(168, 85, 247, 0.15)',
                          color: '#c084fc',
                          border: '1px solid rgba(168, 85, 247, 0.3)',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          fontWeight: 'bold'
                        }}
                      >
                        ⭐ Co-Organizer
                      </span>
                    )}
                  </div>
                  {activeHandle && (
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      @{activeHandle}
                    </div>
                  )}
                </div>
              </div>

              {/* Status Selector: 3-state segmented control */}
              <div
                style={{
                  display: 'flex',
                  background: 'rgba(0, 0, 0, 0.25)',
                  padding: '3px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-light)',
                  gap: '3px'
                }}
              >
                <button
                  type="button"
                  onClick={() => handleStatusSelect('Committed')}
                  style={{
                    padding: '6px 14px',
                    fontSize: '0.85rem',
                    borderRadius: '8px',
                    border: currentStatus.toLowerCase() === 'committed' ? '1px solid #10b981' : '1px solid transparent',
                    background: currentStatus.toLowerCase() === 'committed' ? 'rgba(16, 185, 129, 0.2)' : 'transparent',
                    color: currentStatus.toLowerCase() === 'committed' ? '#10b981' : 'var(--text-muted)',
                    fontWeight: currentStatus.toLowerCase() === 'committed' ? '700' : '500',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  ✓ Committed
                </button>
                <button
                  type="button"
                  onClick={() => handleStatusSelect('Tentative')}
                  style={{
                    padding: '6px 14px',
                    fontSize: '0.85rem',
                    borderRadius: '8px',
                    border: currentStatus.toLowerCase() === 'tentative' ? '1px solid #f59e0b' : '1px solid transparent',
                    background: currentStatus.toLowerCase() === 'tentative' ? 'rgba(245, 158, 11, 0.2)' : 'transparent',
                    color: currentStatus.toLowerCase() === 'tentative' ? '#f59e0b' : 'var(--text-muted)',
                    fontWeight: currentStatus.toLowerCase() === 'tentative' ? '700' : '500',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  ? Tentative
                </button>
                <button
                  type="button"
                  onClick={() => handleStatusSelect('Declined')}
                  style={{
                    padding: '6px 14px',
                    fontSize: '0.85rem',
                    borderRadius: '8px',
                    border: currentStatus.toLowerCase() === 'declined' ? '1px solid #ef4444' : '1px solid transparent',
                    background: currentStatus.toLowerCase() === 'declined' ? 'rgba(239, 68, 68, 0.2)' : 'transparent',
                    color: currentStatus.toLowerCase() === 'declined' ? '#f87171' : 'var(--text-muted)',
                    fontWeight: currentStatus.toLowerCase() === 'declined' ? '700' : '500',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  ✕ Declined
                </button>
              </div>
            </div>

            {/* Dates: 2-column responsive row */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '1rem',
                borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                paddingTop: '1rem'
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '600' }}>
                  🛫 Arrival Date
                </label>
                <input
                  type="date"
                  defaultValue={activeArrival}
                  onChange={(e) => setMyArrival(e.target.value)}
                  onBlur={(e) => handleDatesBlur(activeMember.user_id, e.target.value || activeArrival, myDeparture || activeDeparture)}
                  className="input-field"
                  style={{ padding: '0.45rem 0.65rem', fontSize: '0.85rem' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '600' }}>
                  🛬 Departure Date
                </label>
                <input
                  type="date"
                  defaultValue={activeDeparture}
                  onChange={(e) => setMyDeparture(e.target.value)}
                  onBlur={(e) => handleDatesBlur(activeMember.user_id, myArrival || activeArrival, e.target.value || activeDeparture)}
                  className="input-field"
                  style={{ padding: '0.45rem 0.65rem', fontSize: '0.85rem' }}
                />
              </div>
            </div>

            {(activeMember.arrival_date || activeMember.departure_date) && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '-0.25rem' }}>
                <button
                  type="button"
                  onClick={() => handleDatesBlur(activeMember.user_id, trip?.start_date || null, trip?.end_date || null)}
                  style={{
                    background: 'transparent',
                    border: '1px solid var(--border-light)',
                    color: 'var(--text-muted)',
                    fontSize: '0.75rem',
                    padding: '0.25rem 0.6rem',
                    borderRadius: '6px',
                    cursor: 'pointer'
                  }}
                  title="Reset arrival and departure to entire trip duration"
                >
                  Reset to Full Trip
                </button>
              </div>
            )}

            {/* Dietary & Notes: Dietary toggle pills + Notes input */}
            <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '1rem' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '600', display: 'block', marginBottom: '0.5rem' }}>
                🥗 Dietary Preferences & Allergies
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1.25rem' }}>
                {DIETARY_OPTIONS.map((tag) => {
                  const isSelected = activeDietary.includes(tag)
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => handleToggleDietaryTag(activeMember.user_id, activeDietary, tag)}
                      style={{
                        padding: '0.35rem 0.75rem',
                        borderRadius: '16px',
                        fontSize: '0.8rem',
                        fontWeight: isSelected ? '700' : '500',
                        cursor: 'pointer',
                        border: isSelected ? '1px solid #10b981' : '1px solid var(--border-light)',
                        backgroundColor: isSelected ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.03)',
                        color: isSelected ? '#10b981' : 'var(--text-main)',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {tag} {isSelected ? '✓' : ''}
                    </button>
                  )
                })}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '600' }}>
                  📝 Notes & Details
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="text"
                    value={userNote}
                    placeholder="Add RSVP details/notes..."
                    onChange={(e) => setUserNote && setUserNote(e.target.value)}
                    onBlur={onNoteBlur}
                    className="input-field"
                    style={{
                      padding: '0.45rem 0.75rem',
                      fontSize: '0.85rem',
                      borderRadius: '6px',
                      border: '1px solid var(--border-light)',
                      background: 'rgba(255, 255, 255, 0.03)',
                      color: 'var(--text-main)',
                      outline: 'none',
                      flex: 1
                    }}
                  />
                  {savingNote && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      Saving...
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      {/* 2. Other Travelers Section */}
      <div>
        <div
          style={{
            fontSize: '0.85rem',
            fontWeight: '700',
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            marginBottom: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid var(--border-light)',
            paddingBottom: '0.5rem'
          }}
        >
          <span>OTHER TRAVELERS</span>
          <span style={{ fontSize: '0.8rem', fontWeight: '500' }}>
            {otherMembers.length} traveler{otherMembers.length !== 1 ? 's' : ''}
          </span>
        </div>

        {otherMembers.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '1.5rem 0' }}>
            {roster.length === 0 ? 'No participants have RSVPed to this trip yet.' : 'No other travelers have joined yet.'}
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {otherMembers.map((member) => {
              const user = member.users || {}
              const isCommitted = member.status?.toLowerCase() === 'committed'
              const isDeclined = member.status?.toLowerCase() === 'declined'
              const isOrganizer = trip?.organizer_id && String(trip.organizer_id) === String(member.user_id)
              const isCoOrganizer = !isOrganizer && (member.role === 'co_organizer' || member.is_admin === true)
              const stayDatesStr = formatStayDates(member.arrival_date, member.departure_date)
              const dietaryTags = Array.isArray(member.dietary_tags) ? member.dietary_tags : []
              const isEditing = editingMemberId === member.user_id

              let badgeClass = 'badge-interested'
              if (isCommitted) badgeClass = 'badge-committed'
              else if (isDeclined) badgeClass = 'badge-declined'

              const memberName = user.first_name || 'Anonymous User'

              return (
                <div
                  key={member.user_id}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                    padding: '1.25rem',
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid var(--border-light)',
                    borderRadius: 'var(--border-radius-sm)',
                    transition: 'var(--transition-fast)'
                  }}
                >
                  {/* Header Row: User Info, Role, Status Badges */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div
                        style={{
                          width: '38px',
                          height: '38px',
                          borderRadius: '50%',
                          backgroundColor: getAvatarColor(user.id || member.user_id || memberName),
                          color: '#ffffff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 'bold',
                          fontSize: '0.95rem',
                          border: '1px solid rgba(255, 255, 255, 0.2)',
                          flexShrink: 0
                        }}
                      >
                        {getInitials(memberName)}
                      </div>

                      <div>
                        <div style={{ fontWeight: '600', fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span>{memberName}</span>
                          {isOrganizer && (
                            <span style={{ fontSize: '0.75rem', background: 'rgba(234, 179, 8, 0.15)', color: '#eab308', border: '1px solid rgba(234, 179, 8, 0.3)', padding: '2px 8px', borderRadius: '12px', fontWeight: 'bold' }}>
                              👑 Organizer
                            </span>
                          )}
                          {isCoOrganizer && (
                            <span style={{ fontSize: '0.75rem', background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc', border: '1px solid rgba(168, 85, 247, 0.3)', padding: '2px 8px', borderRadius: '12px', fontWeight: 'bold' }}>
                              ⭐ Co-Organizer
                            </span>
                          )}
                          {stayDatesStr && (
                            <span
                              style={{
                                fontSize: '0.75rem',
                                background: 'rgba(59, 130, 246, 0.12)',
                                color: '#60a5fa',
                                border: '1px solid rgba(59, 130, 246, 0.3)',
                                padding: '2px 8px',
                                borderRadius: '12px',
                                fontWeight: '600',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                              title="Traveler stay dates"
                            >
                              📅 {stayDatesStr}
                            </span>
                          )}
                        </div>
                        {user.username && (
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                            @{user.username}
                          </div>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => setEditingMemberId(isEditing ? null : member.user_id)}
                          className="btn btn-secondary"
                          style={{ padding: '2px 8px', fontSize: '0.75rem' }}
                          title="Edit member dates and preferences"
                        >
                          {isEditing ? 'Done' : '⚙️ Stay/Diet'}
                        </button>
                      )}
                      {isAdmin && !isOrganizer && (
                        isCoOrganizer ? (
                          <button
                            onClick={() => onDemoteMember(member.user_id)}
                            className="btn btn-secondary"
                            style={{ padding: '2px 8px', fontSize: '0.75rem', color: '#f87171', borderColor: 'rgba(248, 113, 113, 0.3)' }}
                            title="Remove Co-Organizer permissions"
                          >
                            Demote
                          </button>
                        ) : (
                          <button
                            onClick={() => onPromoteMember(member.user_id)}
                            className="btn btn-secondary"
                            style={{ padding: '2px 8px', fontSize: '0.75rem', color: '#c084fc', borderColor: 'rgba(192, 132, 252, 0.3)' }}
                            title="Grant Co-Organizer permissions"
                          >
                            + Co-Organizer
                          </button>
                        )
                      )}
                      <span className={`badge ${badgeClass}`}>
                        {member.status || 'Interested'}
                      </span>
                    </div>
                  </div>

                  {/* Dietary Tags Display Pills */}
                  {dietaryTags.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
                      {dietaryTags.map(tag => (
                        <span
                          key={tag}
                          style={{
                            fontSize: '0.75rem',
                            background: 'rgba(16, 185, 129, 0.12)',
                            color: '#10b981',
                            border: '1px solid rgba(16, 185, 129, 0.3)',
                            padding: '2px 8px',
                            borderRadius: '12px',
                            fontWeight: '600'
                          }}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Admin Inline Editor for a Member */}
                  {isEditing && (
                    <div
                      style={{
                        background: 'rgba(0, 0, 0, 0.2)',
                        padding: '0.75rem',
                        borderRadius: '6px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.5rem',
                        border: '1px dashed var(--border-light)'
                      }}
                    >
                      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                        <div style={{ flex: 1, minWidth: '140px' }}>
                          <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Arrival:</label>
                          <input
                            type="date"
                            defaultValue={member.arrival_date || trip?.start_date || ''}
                            onBlur={(e) => handleDatesBlur(member.user_id, e.target.value, member.departure_date || trip?.end_date)}
                            className="input-field"
                            style={{ padding: '2px 6px', fontSize: '0.8rem' }}
                          />
                        </div>
                        <div style={{ flex: 1, minWidth: '140px' }}>
                          <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Departure:</label>
                          <input
                            type="date"
                            defaultValue={member.departure_date || trip?.end_date || ''}
                            onBlur={(e) => handleDatesBlur(member.user_id, member.arrival_date || trip?.start_date, e.target.value)}
                            className="input-field"
                            style={{ padding: '2px 6px', fontSize: '0.8rem' }}
                          />
                        </div>
                      </div>
                      <div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                          Toggle Dietary Tags:
                        </span>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                          {DIETARY_OPTIONS.map(tag => {
                            const hasTag = dietaryTags.includes(tag)
                            return (
                              <button
                                key={tag}
                                type="button"
                                onClick={() => handleToggleDietaryTag(member.user_id, dietaryTags, tag)}
                                style={{
                                  fontSize: '0.7rem',
                                  padding: '1px 6px',
                                  borderRadius: '10px',
                                  cursor: 'pointer',
                                  border: hasTag ? '1px solid #10b981' : '1px solid var(--border-light)',
                                  background: hasTag ? 'rgba(16, 185, 129, 0.2)' : 'transparent',
                                  color: hasTag ? '#10b981' : 'var(--text-main)'
                                }}
                              >
                                {tag}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Notes Display */}
                  {member.notes && (
                    <div style={{ fontSize: '0.9rem', fontStyle: 'italic', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span>📝</span> <span>{member.notes}</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
