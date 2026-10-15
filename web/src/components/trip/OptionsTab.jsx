import React from 'react'
import { GanttTimeline } from '../GanttTimeline'
import { formatDateTimeRange } from '../../utils/format'
import { checkOptionDateConflict, isOptionLocked } from '../../services/options'

export function OptionsTab({
  categories = ['Accommodation', 'Flights', 'Activities', 'Food', 'Transport', 'Other'],
  activeTab = 'Accommodation',
  onTabChange,
  viewMode = 'grid',
  onViewModeChange,
  options = [],
  optionsLoading = false,
  activePoll = null,
  allTripOptions = [],
  allActivePollsMap = {},
  trip,
  roster = [],
  activeUser,
  expenses = [],
  onVoteToggle,
  onLockToggle,
  onOpenPitchModal,
  onOpenPollRecapModal,
  onOpenExpenseModal,
  onRefresh
}) {
  const isOptionLogged = (option) => {
    if (!expenses || !option) return false
    const optionTitle = (option.option_text || option.text || '').toLowerCase().trim()
    return expenses.some((e) => {
      const desc = (e.description || '').toLowerCase()
      return (
        (desc.includes('[locked option]') && desc.includes(optionTitle)) ||
        (e.option_id && String(e.option_id) === String(option.id))
      )
    })
  }

  return (
    <div className="glass-card animate-fade-in" style={{ padding: '2rem', border: '1px solid var(--border-light)' }}>
      {/* Top Header Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1.5rem',
          borderBottom: '1px solid var(--border-light)',
          paddingBottom: '0.75rem',
          flexWrap: 'wrap',
          gap: '1rem'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>🗳️ Pitched Options</span>
          </h2>

          <div
            style={{
              display: 'flex',
              background: 'rgba(255, 255, 255, 0.03)',
              borderRadius: '20px',
              padding: '3px',
              border: '1px solid var(--border-light)'
            }}
          >
            <button
              onClick={() => onViewModeChange('grid')}
              type="button"
              style={{
                padding: '4px 12px',
                fontSize: '0.8rem',
                borderRadius: '16px',
                background: viewMode === 'grid' ? 'var(--primary-light)' : 'transparent',
                color: viewMode === 'grid' ? 'black' : 'var(--text-muted)',
                border: 'none',
                cursor: 'pointer',
                fontWeight: '600'
              }}
            >
              📋 Grid
            </button>
            <button
              onClick={() => onViewModeChange('gantt')}
              type="button"
              style={{
                padding: '4px 12px',
                fontSize: '0.8rem',
                borderRadius: '16px',
                background: viewMode === 'gantt' ? 'var(--primary-light)' : 'transparent',
                color: viewMode === 'gantt' ? 'black' : 'var(--text-muted)',
                border: 'none',
                cursor: 'pointer',
                fontWeight: '600'
              }}
            >
              📊 Gantt Timeline
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            onClick={onRefresh}
            className="btn btn-secondary"
            style={{ padding: '6px 12px', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
            title="Refresh Votes & Options"
          >
            🔄 Refresh
          </button>
          <button
            onClick={onOpenPollRecapModal}
            className="btn btn-secondary"
            style={{ padding: '6px 12px', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
            title="View Poll Breakdown & Voter Recap"
          >
            📊 Poll Recap
          </button>
          <button onClick={() => onOpenPitchModal(activeTab)} className="btn">
            Pitch Option
          </button>
        </div>
      </div>

      {viewMode === 'gantt' ? (
        <GanttTimeline
          trip={trip}
          options={allTripOptions.length > 0 ? allTripOptions : options}
          activePolls={allActivePollsMap}
          roster={roster}
          onPitchForSlot={(dayDate) => {
            const dStr = dayDate.toISOString().slice(0, 10)
            const nextDay = new Date(dayDate)
            nextDay.setDate(nextDay.getDate() + 1)
            const nextDStr = nextDay.toISOString().slice(0, 10)
            onOpenPitchModal(activeTab, `${dStr}T16:00`, `${nextDStr}T11:00`)
          }}
        />
      ) : (
        <>
          {/* Horizontal Tabs */}
          <div
            className="tabs-container"
            style={{
              display: 'flex',
              gap: '8px',
              overflowX: 'auto',
              marginBottom: '1.5rem',
              paddingBottom: '4px'
            }}
          >
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => onTabChange(cat)}
                className={`tab-btn ${activeTab === cat ? 'active' : ''}`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Options List */}
          {optionsLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1rem' }}>
              <div className="skeleton skeleton-title" style={{ width: '40%' }} />
              <div className="skeleton skeleton-text" style={{ width: '80%' }} />
              <div className="skeleton skeleton-text" style={{ width: '60%' }} />
            </div>
          ) : options.length === 0 ? (
            <div style={{ padding: '2.5rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <h3 style={{ marginBottom: '0.5rem', color: 'var(--text-main)' }}>
                No options pitched for this category yet.
              </h3>
              <p style={{ fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                Got an idea for this part of the trip? Pitch it to start the vote!
              </p>
              <button onClick={() => onOpenPitchModal(activeTab)} className="btn btn-secondary">
                Pitch the First Option
              </button>
            </div>
          ) : (
            <div
              className="options-grid"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: '1.5rem'
              }}
            >
              {options.map((opt) => {
                const optIdStr = String(opt.id)
                const votesCount = activePoll?.votes_by_option?.[optIdStr] || 0
                const userVotes = activePoll?.voter_selections?.[activeUser?.id] || []
                const hasVoted = userVotes.map(String).includes(optIdStr)
                const isDateConflicting = checkOptionDateConflict(opt, trip?.start_date, trip?.end_date)
                const isLockedChoice = isOptionLocked(opt, activePoll)

                const votersForOpt = Object.entries(activePoll?.voter_selections || {})
                  .filter(([_, opts]) => Array.isArray(opts) && opts.map(String).includes(optIdStr))
                  .map(([uId]) => {
                    const member = roster.find(
                      (m) => String(m.user_id) === String(uId) || String(m.users?.id) === String(uId)
                    )
                    return member?.users?.first_name || member?.username || 'Traveler'
                  })

                return (
                  <div
                    key={opt.id}
                    className={`option-card ${hasVoted ? 'voted' : ''}`}
                    style={{
                      padding: '1.25rem',
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: isLockedChoice
                        ? '2px solid #eab308'
                        : hasVoted
                        ? '2px solid var(--accent)'
                        : '1px solid var(--border-light)',
                      borderRadius: 'var(--border-radius-md)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      transition: 'var(--transition-smooth)',
                      boxShadow: 'var(--shadow-premium)'
                    }}
                  >
                    <div style={{ marginBottom: '1rem' }}>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                          gap: '8px',
                          marginBottom: '8px'
                        }}
                      >
                        <h4 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-main)' }}>
                          {opt.option_text}
                        </h4>
                        <span
                          style={{
                            background: 'rgba(255, 255, 255, 0.05)',
                            padding: '2px 8px',
                            borderRadius: '12px',
                            fontSize: '0.8rem',
                            fontWeight: '600',
                            color: 'var(--text-muted)',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {votesCount} vote{votesCount !== 1 ? 's' : ''}
                        </span>
                      </div>

                      {/* Locked Choice / Logged in Ledger Badges */}
                      {isLockedChoice && (
                        <div
                          style={{
                            marginTop: '4px',
                            marginBottom: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            flexWrap: 'wrap'
                          }}
                        >
                          <span
                            style={{
                              background: 'rgba(234, 179, 8, 0.15)',
                              color: '#eab308',
                              border: '1px solid rgba(234, 179, 8, 0.4)',
                              padding: '2px 8px',
                              borderRadius: '12px',
                              fontSize: '0.75rem',
                              fontWeight: '700',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            🏆 Locked Choice
                          </span>
                          {isOptionLogged(opt) ? (
                            <span
                              style={{
                                background: 'rgba(52, 211, 153, 0.15)',
                                color: '#34d399',
                                border: '1px solid rgba(52, 211, 153, 0.4)',
                                padding: '2px 8px',
                                borderRadius: '12px',
                                fontSize: '0.75rem',
                                fontWeight: '700',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                            >
                              ✓ Logged in Ledger
                            </span>
                          ) : (
                            <button
                              onClick={() => onOpenExpenseModal(opt)}
                              className="btn btn-secondary"
                              style={{
                                padding: '2px 8px',
                                fontSize: '0.75rem',
                                color: '#38bdf8',
                                borderColor: 'rgba(56, 189, 248, 0.4)',
                                background: 'rgba(56, 189, 248, 0.1)',
                                fontWeight: '600'
                              }}
                              title="Convert locked option to a logged expense"
                            >
                              💸 Log as Expense
                            </button>
                          )}
                        </div>
                      )}

                      {isDateConflicting && (
                        <div style={{ marginTop: '4px', marginBottom: '8px' }}>
                          <span
                            style={{
                              background: 'rgba(245, 158, 11, 0.15)',
                              color: '#f59e0b',
                              border: '1px solid rgba(245, 158, 11, 0.3)',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '0.75rem',
                              fontWeight: '600',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                            title="Option dates fall outside trip start/end dates"
                          >
                            ⚠️ Outside Trip Dates
                          </span>
                        </div>
                      )}

                      {(opt.start_date || opt.end_date) && (
                        <div
                          style={{
                            fontSize: '0.85rem',
                            color: '#60a5fa',
                            fontWeight: '600',
                            marginBottom: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <span>📅</span>
                          <span>{formatDateTimeRange(opt.start_date, opt.end_date)}</span>
                        </div>
                      )}

                      {opt.estimated_cost && (
                        <div
                          style={{
                            fontSize: '0.9rem',
                            color: 'var(--primary-light)',
                            fontWeight: '600',
                            marginBottom: '8px'
                          }}
                        >
                          Cost: {opt.estimated_cost} {opt.currency || 'USD'}
                        </div>
                      )}

                      {opt.description && (
                        <p
                          style={{
                            margin: '0 0 12px 0',
                            fontSize: '0.85rem',
                            color: 'var(--text-muted)',
                            lineBreak: 'anywhere'
                          }}
                        >
                          {opt.description}
                        </p>
                      )}

                      {opt.link && (
                        <a
                          href={opt.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            fontSize: '0.8rem',
                            color: 'var(--primary-light)',
                            textDecoration: 'none',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            wordBreak: 'break-all'
                          }}
                        >
                          <span>🔗</span> Link
                        </a>
                      )}

                      {/* Stacked Voter Badges */}
                      {votersForOpt.length > 0 && (
                        <div
                          onClick={onOpenPollRecapModal}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            marginTop: '10px',
                            cursor: 'pointer',
                            flexWrap: 'wrap'
                          }}
                          title="Click to view full poll breakdown"
                        >
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600' }}>
                            Voted by:
                          </span>
                          {votersForOpt.map((name, idx) => (
                            <span
                              key={idx}
                              style={{
                                background: 'rgba(59, 130, 246, 0.15)',
                                color: 'var(--primary-light)',
                                border: '1px solid rgba(59, 130, 246, 0.3)',
                                padding: '1px 7px',
                                borderRadius: '12px',
                                fontSize: '0.75rem',
                                fontWeight: '600'
                              }}
                            >
                              👤 {name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Action Buttons: Vote & Multi-Lock */}
                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                      <button
                        onClick={() => onVoteToggle(opt.id, hasVoted)}
                        className={`btn ${hasVoted ? 'btn-secondary' : ''}`}
                        style={{
                          flex: 1,
                          borderColor: hasVoted ? 'var(--accent)' : 'var(--border-light)',
                          color: hasVoted ? 'var(--accent-light)' : 'var(--text-main)',
                          background: hasVoted ? 'rgba(16, 185, 129, 0.05)' : ''
                        }}
                      >
                        {hasVoted ? '✓ Voted' : 'Vote'}
                      </button>
                      <button
                        onClick={() => onLockToggle(opt.id)}
                        className="btn btn-secondary"
                        style={{
                          padding: '6px 10px',
                          fontSize: '0.8rem',
                          borderColor: isLockedChoice ? '#eab308' : 'var(--border-light)',
                          color: isLockedChoice ? '#eab308' : 'var(--text-muted)'
                        }}
                        title={isLockedChoice ? 'Unlock this choice' : 'Lock as winning choice'}
                      >
                        {isLockedChoice ? '🔓 Unlock' : '🔒 Lock'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
