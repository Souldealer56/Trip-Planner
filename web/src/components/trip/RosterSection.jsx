import React from 'react'

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
  showCopiedToast = false
}) {
  const activeMember = roster.find(m => m.user_id === activeUser?.id)

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

      {/* Active User RSVP Status Selector */}
      {activeMember && (
        <div
          style={{
            background: 'rgba(59, 130, 246, 0.05)',
            border: '1px solid rgba(59, 130, 246, 0.2)',
            padding: '1rem',
            borderRadius: 'var(--border-radius-sm)',
            marginBottom: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem'
          }}
        >
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
            const isCurrentUser = user.id === activeUser?.id
            const isOrganizer = trip?.organizer_id && String(trip.organizer_id) === String(member.user_id)
            const isCoOrganizer = !isOrganizer && (member.role === 'co_organizer' || member.is_admin === true)

            let badgeClass = 'badge-interested'
            if (isCommitted) badgeClass = 'badge-committed'
            else if (isDeclined) badgeClass = 'badge-declined'

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
                        onBlur={onNoteBlur}
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

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
            )
          })}
        </div>
      )}
    </div>
  )
}
