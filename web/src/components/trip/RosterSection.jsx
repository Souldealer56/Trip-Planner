import React, { useState } from 'react'

export const DIETARY_OPTIONS = [
  '🌱 Vegetarian',
  '🌿 Vegan',
  '🌾 Gluten-Free',
  '🥩 Halal',
  '🥜 Allergy',
  '🥛 Dairy-Free'
]

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

  return (
    <div className="glass-card" style={{ padding: '2rem', border: '1px solid var(--border-light)' }}>
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
          <button
            onClick={onCopyInviteLink}
            style={{
              position: 'relative',
              padding: '0.35rem 0.75rem',
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
              color: 'var(--primary-light, #60a5fa)',
              border: '1px solid rgba(59, 130, 246, 0.25)',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '0.8rem',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              transition: 'all 0.15s ease'
            }}
            className="join-btn"
            title="Copy Invite Link"
          >
            🔗 Share
            {showCopiedToast && (
              <span
                style={{
                  position: 'absolute',
                  bottom: '125%',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  backgroundColor: '#1e293b',
                  color: '#f8fafc',
                  padding: '0.3rem 0.6rem',
                  borderRadius: '6px',
                  fontSize: '0.7rem',
                  whiteSpace: 'nowrap',
                  border: '1px solid var(--border-light, #334155)',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                  zIndex: 10,
                  animation: 'fadeInOut 2s ease forwards'
                }}
              >
                Copied!
              </span>
            )}
          </button>
        </span>
        <span style={{ fontSize: '1rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>
          {roster.length} participant{roster.length !== 1 ? 's' : ''}
        </span>
      </h2>

      {/* Active User Preference & Presence Controls */}
      {activeMember && (
        <div
          style={{
            background: 'rgba(59, 130, 246, 0.05)',
            border: '1px solid rgba(59, 130, 246, 0.2)',
            padding: '1.25rem',
            borderRadius: 'var(--border-radius-sm)',
            marginBottom: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem'
          }}
        >
          {/* Top Row: RSVP Status & Change Selector */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Your RSVP Status:</span>
              <div style={{ fontWeight: 'bold', fontSize: '1.1rem', color: 'var(--primary-light)' }}>
                {activeMember.status || 'Committed'}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Change Status:</span>
              <select
                value={activeMember.status || 'Committed'}
                onChange={onStatusChange}
                className="input-field select-field"
                style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
              >
                <option value="Committed">Committed</option>
                <option value="Tentative">Tentative</option>
                <option value="Declined">Declined</option>
              </select>
            </div>
          </div>

          {/* Middle Row: Arrival and Departure Dates */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              flexWrap: 'wrap',
              borderTop: '1px solid rgba(59, 130, 246, 0.15)',
              paddingTop: '0.75rem'
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', flex: 1, minWidth: '160px' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '600' }}>
                🛫 Arrival Date
              </label>
              <input
                type="date"
                defaultValue={activeArrival}
                onChange={(e) => setMyArrival(e.target.value)}
                onBlur={(e) => handleDatesBlur(activeMember.user_id, e.target.value || activeArrival, myDeparture || activeDeparture)}
                className="input-field"
                style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem' }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', flex: 1, minWidth: '160px' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '600' }}>
                🛬 Departure Date
              </label>
              <input
                type="date"
                defaultValue={activeDeparture}
                onChange={(e) => setMyDeparture(e.target.value)}
                onBlur={(e) => handleDatesBlur(activeMember.user_id, myArrival || activeArrival, e.target.value || activeDeparture)}
                className="input-field"
                style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem' }}
              />
            </div>

            {(activeMember.arrival_date || activeMember.departure_date) && (
              <button
                type="button"
                onClick={() => handleDatesBlur(activeMember.user_id, trip?.start_date || null, trip?.end_date || null)}
                style={{
                  alignSelf: 'flex-end',
                  background: 'transparent',
                  border: '1px solid var(--border-light)',
                  color: 'var(--text-muted)',
                  fontSize: '0.75rem',
                  padding: '0.4rem 0.6rem',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
                title="Reset arrival and departure to entire trip duration"
              >
                Reset to Full Trip
              </button>
            )}
          </div>

          {/* Bottom Row: Dietary Tags Pills */}
          <div style={{ borderTop: '1px solid rgba(59, 130, 246, 0.15)', paddingTop: '0.75rem' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '600', display: 'block', marginBottom: '0.4rem' }}>
              🥗 Dietary Preferences & Allergies (Click to toggle):
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {DIETARY_OPTIONS.map((tag) => {
                const isSelected = activeDietary.includes(tag)
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => handleToggleDietaryTag(activeMember.user_id, activeDietary, tag)}
                    style={{
                      padding: '0.3rem 0.75rem',
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
          </div>
        </div>
      )}

      {roster.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '1.5rem 0' }}>
          No participants have RSVPed to this trip yet.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {roster.map((member) => {
            const user = member.users || {}
            const isCommitted = member.status?.toLowerCase() === 'committed'
            const isDeclined = member.status?.toLowerCase() === 'declined'
            const isCurrentUser = String(user.id || member.user_id) === String(activeUser?.id)
            const isOrganizer = trip?.organizer_id && String(trip.organizer_id) === String(member.user_id)
            const isCoOrganizer = !isOrganizer && (member.role === 'co_organizer' || member.is_admin === true)
            const stayDatesStr = formatStayDates(member.arrival_date, member.departure_date)
            const dietaryTags = Array.isArray(member.dietary_tags) ? member.dietary_tags : []
            const isEditing = editingMemberId === member.user_id

            let badgeClass = 'badge-interested'
            if (isCommitted) badgeClass = 'badge-committed'
            else if (isDeclined) badgeClass = 'badge-declined'

            return (
              <div
                key={member.user_id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                  padding: '1.25rem',
                  background: isCurrentUser ? 'rgba(56, 122, 255, 0.05)' : 'rgba(255, 255, 255, 0.02)',
                  border: isCurrentUser ? '1px solid var(--primary-light)' : '1px solid var(--border-light)',
                  borderRadius: 'var(--border-radius-sm)',
                  transition: 'var(--transition-fast)'
                }}
              >
                {/* Header Row: User Info, Role, Status Badges */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <div>
                    <div style={{ fontWeight: '600', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      {user.first_name || 'Anonymous User'}
                      {isCurrentUser && (
                        <span style={{ fontSize: '0.8rem', background: 'var(--primary)', color: 'white', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
                          You
                        </span>
                      )}
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

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {isAdmin && !isCurrentUser && (
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
                    {isAdmin && !isOrganizer && !isCurrentUser && (
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

                {/* Notes Input / Display */}
                {isCurrentUser ? (
                  <div style={{ marginTop: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="text"
                      value={userNote}
                      placeholder="Add RSVP details/notes..."
                      onChange={(e) => setUserNote(e.target.value)}
                      onBlur={onNoteBlur}
                      style={{
                        padding: '4px 8px',
                        fontSize: '0.85rem',
                        borderRadius: '4px',
                        border: '1px solid var(--border-light)',
                        background: 'rgba(255, 255, 255, 0.03)',
                        color: 'var(--text-main)',
                        outline: 'none',
                        width: '260px'
                      }}
                    />
                    {savingNote && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Saving...</span>}
                  </div>
                ) : (
                  member.notes && (
                    <div style={{ fontSize: '0.9rem', fontStyle: 'italic', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span>📝</span> <span>{member.notes}</span>
                    </div>
                  )
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
