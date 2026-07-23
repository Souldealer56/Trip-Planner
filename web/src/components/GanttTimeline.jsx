import React, { useState } from 'react'
import { formatDateTimeRange } from '../utils/format'
import { detectScheduleGaps, detectScheduleConflicts } from '../utils/schedule'

const CATEGORY_COLORS = {
  accommodation: { bg: 'rgba(139, 92, 246, 0.25)', border: '#8b5cf6', text: '#c4b5fd', label: 'Accommodation' },
  flights: { bg: 'rgba(56, 189, 248, 0.25)', border: '#38bdf8', text: '#7dd3fc', label: 'Flights' },
  activities: { bg: 'rgba(16, 185, 129, 0.25)', border: '#10b981', text: '#6ee7b7', label: 'Activities' },
  food: { bg: 'rgba(245, 158, 11, 0.25)', border: '#f59e0b', text: '#fcd34d', label: 'Food' },
  transport: { bg: 'rgba(244, 63, 94, 0.25)', border: '#f43f5e', text: '#fda4af', label: 'Transport' },
  other: { bg: 'rgba(148, 163, 184, 0.25)', border: '#94a3b8', text: '#cbd5e1', label: 'Other' }
}

const CATEGORIES = ['Accommodation', 'Flights', 'Activities', 'Food', 'Transport', 'Other']

export function GanttTimeline({ trip, options = [], activePolls = {}, roster = [], onOptionClick, onPitchForSlot }) {
  const [hoveredOption, setHoveredOption] = useState(null)

  // 1. Build trip days grid
  const getDaysArray = () => {
    if (!trip?.start_date || !trip?.end_date) {
      // Fallback: 7 days starting today
      const days = []
      const today = new Date()
      for (let i = 0; i < 7; i++) {
        const d = new Date(today)
        d.setDate(d.getDate() + i)
        days.push(d)
      }
      return days
    }

    const start = new Date(trip.start_date)
    const end = new Date(trip.end_date)
    const days = []
    const cur = new Date(start)

    while (cur <= end) {
      days.push(new Date(cur))
      cur.setDate(cur.getDate() + 1)
    }

    if (days.length === 0) days.push(start)
    return days
  }

  const tripDays = getDaysArray()
  const totalDays = tripDays.length
  const tripStartTime = tripDays[0].getTime()
  const tripEndTime = tripDays[tripDays.length - 1].getTime() + 86400000

  // 2. Schedule Analysis: Gaps & Conflicts
  const unbookedDays = detectScheduleGaps(trip, options)
  const unbookedDateStrs = new Set(unbookedDays.map(d => d.dateStr))
  const { conflictingOptionIds, conflictPairs } = detectScheduleConflicts(options)

  // Helper: Calculate left % and width % for an option
  const calculateBarPosition = (opt) => {
    if (!opt.start_date && !opt.end_date) {
      return { left: 0, width: 100, isUnscheduled: true }
    }

    const optStart = opt.start_date ? new Date(opt.start_date).getTime() : tripStartTime
    const optEnd = opt.end_date ? new Date(opt.end_date).getTime() : (opt.start_date ? optStart + (3600000 * 3) : tripEndTime)
    const totalDuration = Math.max(tripEndTime - tripStartTime, 86400000)

    const left = Math.max(0, Math.min(100, ((optStart - tripStartTime) / totalDuration) * 100))
    const right = Math.max(0, Math.min(100, ((optEnd - tripStartTime) / totalDuration) * 100))
    const width = Math.max(3, right - left)

    return { left, width, isUnscheduled: false }
  }

  return (
    <div className="gantt-container" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Schedule Summary Banner */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justify: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem',
        background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.9), rgba(30, 41, 59, 0.9))',
        padding: '1rem 1.5rem',
        borderRadius: '12px',
        border: '1px solid var(--border-light)'
      }}>
        <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem', color: unbookedDays.length > 0 ? '#f59e0b' : '#10b981', fontWeight: '600' }}>
            <span>{unbookedDays.length > 0 ? '⚠️' : '✓'}</span>
            <span>{unbookedDays.length > 0 ? `${unbookedDays.length} Unbooked Day${unbookedDays.length > 1 ? 's' : ''} (Holes in Plan)` : 'All Trip Days Covered!'}</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem', color: conflictingOptionIds.size > 0 ? '#f43f5e' : 'var(--text-muted)', fontWeight: '600' }}>
            <span>{conflictingOptionIds.size > 0 ? '🚨' : '🛡️'}</span>
            <span>{conflictingOptionIds.size > 0 ? `${conflictingOptionIds.size} Overlapping Schedule Conflict${conflictingOptionIds.size > 1 ? 's' : ''}` : 'No Time Conflicts'}</span>
          </div>
        </div>

        {unbookedDays.length > 0 && (
          <button
            onClick={() => onPitchForSlot && onPitchForSlot(unbookedDays[0].date)}
            className="btn"
            style={{ padding: '6px 14px', fontSize: '0.85rem' }}
          >
            ➕ Pitch for Day {unbookedDays[0].dayNum} Slot
          </button>
        )}
      </div>

      {/* Category Color Legend */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', background: 'rgba(255, 255, 255, 0.02)', padding: '0.75rem 1rem', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>Category Legend:</span>
          {CATEGORIES.map(cat => {
            const style = CATEGORY_COLORS[cat.toLowerCase()]
            return (
              <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: style.text }}>
                <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: style.border, display: 'inline-block' }} />
                <span>{cat}</span>
              </div>
            )
          })}
        </div>

        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ border: '2px solid #eab308', background: 'rgba(234, 179, 8, 0.2)', padding: '1px 6px', borderRadius: '4px', color: '#eab308', fontWeight: 'bold' }}>
              🏆 Locked
            </span>
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ border: '2px dashed #f43f5e', background: 'rgba(244, 63, 94, 0.2)', padding: '1px 6px', borderRadius: '4px', color: '#fda4af' }}>
              🚨 Overlap
            </span>
          </span>
        </div>
      </div>

      {/* Main Gantt Grid */}
      <div className="gantt-grid-card glass-card" style={{ padding: '1.5rem', overflowX: 'auto' }}>
        <div style={{ minWidth: `${Math.max(700, totalDays * 130)}px` }}>
          {/* Day Column Headers */}
          <div style={{ display: 'grid', gridTemplateColumns: `140px repeat(${totalDays}, 1fr)`, borderBottom: '2px solid var(--border-light)', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
            <div style={{ fontWeight: 'bold', color: 'var(--text-muted)', fontSize: '0.85rem', alignSelf: 'center' }}>
              Category
            </div>
            {tripDays.map((d, idx) => {
              const dStr = d.toISOString().slice(0, 10)
              const isUnbooked = unbookedDateStrs.has(dStr)

              return (
                <div 
                  key={idx} 
                  onClick={() => onPitchForSlot && onPitchForSlot(d)}
                  style={{
                    textAlign: 'center',
                    padding: '6px 4px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    background: isUnbooked ? 'rgba(245, 158, 11, 0.08)' : 'transparent',
                    border: isUnbooked ? '1px dashed rgba(245, 158, 11, 0.3)' : '1px solid transparent',
                    transition: 'all 0.15s ease'
                  }}
                  title={isUnbooked ? 'Hole in Plan! Click to pitch an activity for this day' : 'Click to pitch an option for this day'}
                >
                  <div style={{ fontSize: '0.75rem', color: isUnbooked ? '#f59e0b' : 'var(--primary-light)', fontWeight: 'bold' }}>
                    Day {idx + 1}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-main)', fontWeight: '600' }}>
                    {d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </div>

                  {isUnbooked && (
                    <div style={{ fontSize: '0.65rem', color: '#fcd34d', marginTop: '2px', fontWeight: 'bold' }}>
                      ➕ Hole in Plan
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Category Rows */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {CATEGORIES.map(cat => {
              const catKey = cat.toLowerCase()
              const catStyle = CATEGORY_COLORS[catKey]
              const catOptions = options.filter(o => o.category?.toLowerCase() === catKey)
              const activePoll = activePolls[catKey] || {}

              return (
                <div key={cat} style={{ display: 'grid', gridTemplateColumns: `140px 1fr`, alignItems: 'center', gap: '1rem', position: 'relative', minHeight: '48px', borderBottom: '1px solid rgba(255, 255, 255, 0.03)', paddingBottom: '0.75rem' }}>
                  {/* Category Label */}
                  <div style={{ fontWeight: '600', fontSize: '0.9rem', color: catStyle.text, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: catStyle.border }} />
                    <span>{cat}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>({catOptions.length})</span>
                  </div>

                  {/* Category Options Track */}
                  <div style={{ position: 'relative', width: '100%', height: '42px', background: 'rgba(255, 255, 255, 0.01)', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.03)' }}>
                    {/* Background Day Grid Dividers */}
                    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${totalDays}, 1fr)`, position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, pointerEvents: 'none' }}>
                      {tripDays.map((d, i) => {
                        const dStr = d.toISOString().slice(0, 10)
                        const isUnbooked = unbookedDateStrs.has(dStr)

                        return (
                          <div 
                            key={i} 
                            style={{ 
                              borderRight: i < totalDays - 1 ? '1px dashed rgba(255, 255, 255, 0.04)' : 'none',
                              background: isUnbooked ? 'rgba(245, 158, 11, 0.02)' : 'transparent'
                            }} 
                          />
                        )
                      })}
                    </div>

                    {/* Option Time Bars */}
                    {catOptions.length === 0 ? (
                      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', fontStyle: 'italic' }}>
                        No options pitched
                      </div>
                    ) : (
                      catOptions.map(opt => {
                        const optIdStr = String(opt.id)
                        const isLocked = String(activePoll.locked_option_id) === optIdStr || Boolean(opt.is_locked)
                        const hasConflict = conflictingOptionIds.has(opt.id)
                        const votesCount = activePoll.votes_by_option?.[optIdStr] || 0
                        const pos = calculateBarPosition(opt)

                        const isHovered = hoveredOption === opt.id

                        let borderStyle = `1.5px solid ${catStyle.border}`
                        let bgStyle = catStyle.bg
                        if (isLocked) {
                          borderStyle = '2px solid #eab308'
                          bgStyle = 'rgba(234, 179, 8, 0.25)'
                        } else if (hasConflict) {
                          borderStyle = '2px dashed #f43f5e'
                          bgStyle = 'rgba(244, 63, 94, 0.25)'
                        }

                        return (
                          <div
                            key={opt.id}
                            onMouseEnter={() => setHoveredOption(opt.id)}
                            onMouseLeave={() => setHoveredOption(null)}
                            onClick={() => onOptionClick && onOptionClick(opt)}
                            style={{
                              position: 'absolute',
                              left: `${pos.left}%`,
                              width: `${pos.width}%`,
                              top: '4px',
                              bottom: '4px',
                              background: bgStyle,
                              border: borderStyle,
                              borderRadius: '6px',
                              padding: '0 8px',
                              display: 'flex',
                              alignItems: 'center',
                              justify: 'space-between',
                              cursor: 'pointer',
                              zIndex: isHovered ? 10 : 2,
                              transition: 'all 0.15s ease',
                              boxShadow: isLocked ? '0 0 12px rgba(234, 179, 8, 0.3)' : (isHovered ? '0 4px 12px rgba(0, 0, 0, 0.4)' : 'none')
                            }}
                          >
                            <span style={{ fontSize: '0.8rem', fontWeight: '600', color: isLocked ? '#fef08a' : (hasConflict ? '#fda4af' : 'var(--text-main)'), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {isLocked ? '🏆 ' : (hasConflict ? '⚠️ ' : '')}{opt.option_text}
                            </span>
                            <span style={{ fontSize: '0.7rem', fontWeight: 'bold', background: 'rgba(0, 0, 0, 0.3)', padding: '1px 6px', borderRadius: '10px', color: 'var(--text-muted)', whiteSpace: 'nowrap', marginLeft: '4px' }}>
                              {votesCount}v
                            </span>

                            {/* Tooltip on Hover */}
                            {isHovered && (
                              <div style={{
                                position: 'absolute',
                                bottom: '115%',
                                left: '50%',
                                transform: 'translateX(-50%)',
                                background: '#0f172a',
                                border: '1px solid var(--border-light)',
                                padding: '10px 14px',
                                borderRadius: '8px',
                                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.6)',
                                width: '230px',
                                zIndex: 100,
                                pointerEvents: 'none',
                                textAlign: 'left'
                              }}>
                                <div style={{ fontWeight: 'bold', color: 'var(--text-main)', fontSize: '0.9rem', marginBottom: '4px' }}>
                                  {isLocked ? '🏆 ' : (hasConflict ? '⚠️ ' : '')}{opt.option_text}
                                </div>
                                {hasConflict && (
                                  <div style={{ fontSize: '0.75rem', color: '#f43f5e', fontWeight: 'bold', marginBottom: '4px' }}>
                                    ⚠️ Overlapping Time Conflict!
                                  </div>
                                )}
                                {(opt.start_date || opt.end_date) && (
                                  <div style={{ fontSize: '0.75rem', color: '#60a5fa', marginBottom: '4px' }}>
                                    📅 {formatDateTimeRange(opt.start_date, opt.end_date)}
                                  </div>
                                )}
                                {opt.estimated_cost && (
                                  <div style={{ fontSize: '0.75rem', color: 'var(--primary-light)', fontWeight: '600', marginBottom: '4px' }}>
                                    Cost: {opt.estimated_cost} {opt.currency || 'USD'}
                                  </div>
                                )}
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                  Votes: <strong style={{ color: 'var(--text-main)' }}>{votesCount}</strong> {isLocked ? '(Winning Choice Locked)' : ''}
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
