import React, { useState } from 'react'
import { formatDateTimeRange, parseLocalDate, formatLocalDateStr } from '../utils/format'
import {
  detectScheduleGaps,
  detectScheduleConflicts,
  packOptionsIntoSubTracks,
  analyzeDailyLogisticsCoverage
} from '../utils/schedule'

export { packOptionsIntoSubTracks }

const CATEGORY_COLORS = {
  accommodation: { bg: 'rgba(139, 92, 246, 0.25)', border: '#8b5cf6', text: '#c4b5fd', label: 'Accommodation' },
  transport: { bg: 'rgba(56, 189, 248, 0.25)', border: '#38bdf8', text: '#7dd3fc', label: 'Transport' },
  flights: { bg: 'rgba(56, 189, 248, 0.25)', border: '#38bdf8', text: '#7dd3fc', label: 'Transport' },
  activities: { bg: 'rgba(16, 185, 129, 0.25)', border: '#10b981', text: '#6ee7b7', label: 'Activities' },
  food: { bg: 'rgba(245, 158, 11, 0.25)', border: '#f59e0b', text: '#fcd34d', label: 'Food' },
  other: { bg: 'rgba(148, 163, 184, 0.25)', border: '#94a3b8', text: '#cbd5e1', label: 'Other' }
}

const CATEGORIES = ['Accommodation', 'Transport', 'Activities', 'Food', 'Other']

export function GanttTimeline({ trip, options = [], activePolls = {}, roster = [], onOptionClick, onPitchForSlot, onDeleteOption }) {
  const [hoveredOption, setHoveredOption] = useState(null)
  const [confirmingDeleteId, setConfirmingDeleteId] = useState(null)

  // 1. Build trip days grid using local date calculations
  const getDaysArray = () => {
    if (!trip?.start_date || !trip?.end_date) {
      // Fallback: 7 days starting today
      const days = []
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      for (let i = 0; i < 7; i++) {
        const d = new Date(today)
        d.setDate(d.getDate() + i)
        days.push(d)
      }
      return days
    }

    const start = parseLocalDate(trip.start_date)
    const end = parseLocalDate(trip.end_date)
    if (!start || !end) return []

    const days = []
    const cur = new Date(start)
    cur.setHours(0, 0, 0, 0)
    const endBoundary = new Date(end)
    endBoundary.setHours(23, 59, 59, 999)

    while (cur <= endBoundary) {
      days.push(new Date(cur))
      cur.setDate(cur.getDate() + 1)
    }

    if (days.length === 0) days.push(start)
    return days
  }

  const tripDays = getDaysArray()
  const totalDays = tripDays.length
  const tripStartTime = tripDays.length > 0 ? tripDays[0].getTime() : 0
  const tripEndTime = tripDays.length > 0 ? tripDays[tripDays.length - 1].getTime() + 86400000 : 0

  // Density mode: 'scroll' (90px/day horizontal scroll) vs 'fit' (compact full-width fit)
  const [density, setDensity] = useState(totalDays > 7 ? 'scroll' : 'fit')

  // Gather all locked option IDs
  const lockedOptionIds = new Set()
  options.forEach(opt => {
    if (opt.is_locked) lockedOptionIds.add(String(opt.id))
  })
  Object.values(activePolls || {}).forEach(poll => {
    if (poll?.locked_option_id) lockedOptionIds.add(String(poll.locked_option_id))
    if (Array.isArray(poll?.voter_selections?._locked_option_ids)) {
      poll.voter_selections._locked_option_ids.forEach(id => lockedOptionIds.add(String(id)))
    }
  })

  // 2. Separate unscheduled options from scheduled options
  const unscheduledOptions = options.filter(opt => opt && !opt.start_date && !opt.end_date)

  // 3. Schedule Analysis: Gaps & Logistics Coverage
  const unbookedDays = detectScheduleGaps(trip, options)
  const unbookedDateStrs = new Set(unbookedDays.map(d => d.dateStr))
  const { conflictingOptionIds } = detectScheduleConflicts(options, lockedOptionIds)
  const logistics = analyzeDailyLogisticsCoverage(trip, options, roster, activePolls)

  // 4. Pre-calculate multi-lane packing for each category
  const categoryLanes = {}
  const activeCategories = []
  const emptyCategories = []

  CATEGORIES.forEach(cat => {
    const catKey = cat.toLowerCase()
    const catOptions = options.filter(o => {
      const oCat = (o.category || '').toLowerCase().trim()
      if (catKey === 'transport') {
        return oCat === 'transport' || oCat === 'flights' || oCat === 'flight'
      }
      return oCat === catKey
    })
    const scheduledCatOptions = catOptions.filter(o => o.start_date || o.end_date)
    const lanes = packOptionsIntoSubTracks(scheduledCatOptions, tripStartTime, tripEndTime)
    categoryLanes[catKey] = lanes

    if (lanes.length > 0) {
      activeCategories.push(cat)
    } else {
      emptyCategories.push(cat)
    }
  })

  // Helper: Calculate left % and width % for an option
  const calculateBarPosition = (opt) => {
    if (!opt.start_date && !opt.end_date) {
      return { left: 0, width: 0, isUnscheduled: true }
    }

    const optStartObj = opt.start_date ? parseLocalDate(opt.start_date) : null
    const optEndObj = opt.end_date ? parseLocalDate(opt.end_date) : null

    const optStart = optStartObj ? optStartObj.getTime() : tripStartTime
    const optEnd = optEndObj ? optEndObj.getTime() : (optStartObj ? optStart + (3600000 * 3) : tripEndTime)
    const totalDuration = Math.max(tripEndTime - tripStartTime, 86400000)

    const left = Math.max(0, Math.min(100, ((optStart - tripStartTime) / totalDuration) * 100))
    const right = Math.max(0, Math.min(100, ((optEnd - tripStartTime) / totalDuration) * 100))
    const width = Math.max(2, right - left)

    return { left, width, isUnscheduled: false }
  }

  const gridMinWidth = density === 'scroll' 
    ? `calc(var(--gantt-cat-width, 140px) + ${totalDays * 90}px)` 
    : '100%'

  return (
    <div className="gantt-container" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Daily Logistics Coverage & Schedule Health Summary Banner */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem',
        background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.9), rgba(30, 41, 59, 0.9))',
        padding: '1rem 1.5rem',
        borderRadius: '12px',
        border: '1px solid var(--border-light)'
      }}>
        <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Nights Covered Gauge */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '0.88rem',
            color: logistics.nightsCoveredCount >= logistics.totalNights && logistics.totalNights > 0 ? '#10b981' : '#f59e0b',
            fontWeight: '600'
          }}>
            <span>🛏️</span>
            <span>
              Nights Covered: <strong>{logistics.nightsCoveredCount}</strong> / {logistics.totalNights}
            </span>
          </div>

          {/* Meals Planned Gauge */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '0.88rem',
            color: logistics.mealsPlannedCount === logistics.totalMealsSlots && logistics.totalMealsSlots > 0 ? '#10b981' : '#fcd34d',
            fontWeight: '600'
          }}>
            <span>🍴</span>
            <span>
              Meals Planned: <strong>{logistics.mealsPlannedCount}</strong> / {logistics.totalMealsSlots}
            </span>
          </div>

          {/* Overlapping Conflict Indicator */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '0.88rem',
            color: conflictingOptionIds.size > 0 ? '#f43f5e' : 'var(--text-muted)',
            fontWeight: '600'
          }}>
            <span>{conflictingOptionIds.size > 0 ? '🚨' : '🛡️'}</span>
            <span>
              {conflictingOptionIds.size > 0 
                ? `${conflictingOptionIds.size} Schedule Conflict${conflictingOptionIds.size > 1 ? 's' : ''}` 
                : 'No Time Conflicts'}
            </span>
          </div>

          {/* Logistics Alerts Counter if any */}
          {logistics.alerts.length > 0 && (
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.8rem',
              padding: '3px 10px',
              borderRadius: '6px',
              background: 'rgba(245, 158, 11, 0.15)',
              color: '#fcd34d',
              border: '1px solid rgba(245, 158, 11, 0.3)'
            }} title={logistics.alerts.join('\n')}>
              <span>⚠️</span>
              <span>{logistics.alerts[0]}</span>
              {logistics.alerts.length > 1 && (
                <span style={{ fontSize: '0.75rem', opacity: 0.8 }}> (+{logistics.alerts.length - 1} more)</span>
              )}
            </div>
          )}
        </div>

        {unbookedDays.length > 0 && (
          <button
            type="button"
            onClick={() => onPitchForSlot && onPitchForSlot(unbookedDays[0].date)}
            className="btn"
            style={{ padding: '6px 14px', fontSize: '0.85rem' }}
          >
            ➕ Pitch for Day {unbookedDays[0].dayNum} Slot
          </button>
        )}
      </div>

      {/* Category Color Legend & Density Controls */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        flexWrap: 'wrap', 
        gap: '1rem', 
        background: 'rgba(255, 255, 255, 0.02)', 
        padding: '0.75rem 1rem', 
        borderRadius: '12px', 
        border: '1px solid var(--border-light)' 
      }}>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>Category Legend:</span>
          {CATEGORIES.map(cat => {
            const style = CATEGORY_COLORS[cat.toLowerCase()]
            return (
              <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: style.text }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: style.border, display: 'inline-block' }} />
                <span>{cat}</span>
              </div>
            )
          })}
        </div>

        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
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

          {/* Density / Zoom Toggle */}
          <div style={{ display: 'inline-flex', background: 'rgba(0, 0, 0, 0.35)', padding: '3px', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
            <button
              type="button"
              onClick={() => setDensity('fit')}
              style={{
                background: density === 'fit' ? 'var(--primary)' : 'transparent',
                color: density === 'fit' ? '#ffffff' : 'var(--text-muted)',
                border: 'none',
                borderRadius: '6px',
                padding: '4px 10px',
                fontSize: '0.75rem',
                cursor: 'pointer',
                fontWeight: density === 'fit' ? 'bold' : 'normal',
                transition: 'all 0.15s ease'
              }}
              title="Fit entire trip duration on screen"
            >
              ↔️ Compact Fit
            </button>
            <button
              type="button"
              onClick={() => setDensity('scroll')}
              style={{
                background: density === 'scroll' ? 'var(--primary)' : 'transparent',
                color: density === 'scroll' ? '#ffffff' : 'var(--text-muted)',
                border: 'none',
                borderRadius: '6px',
                padding: '4px 10px',
                fontSize: '0.75rem',
                cursor: 'pointer',
                fontWeight: density === 'scroll' ? 'bold' : 'normal',
                transition: 'all 0.15s ease'
              }}
              title="Scroll horizontally with 90px day columns"
            >
              📜 Day-by-Day Scroll
            </button>
          </div>
        </div>
      </div>

      {/* Unscheduled Options Tray (Options without start/end date) */}
      {unscheduledOptions.length > 0 && (
        <div 
          className="glass-card" 
          style={{
            padding: '1rem 1.25rem',
            background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.8), rgba(15, 23, 42, 0.9))',
            border: '1px solid rgba(245, 158, 11, 0.35)',
            borderRadius: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', fontWeight: 'bold', color: '#fcd34d' }}>
              <span>📌</span>
              <span>Unscheduled Options ({unscheduledOptions.length}) — Assign dates to place on timeline</span>
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Click any option below to assign schedule dates
            </span>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem' }}>
            {unscheduledOptions.map(opt => {
              const rawCat = (opt.category || 'other').toLowerCase().trim()
              const catKey = (rawCat === 'flights' || rawCat === 'flight') ? 'transport' : rawCat
              const catStyle = CATEGORY_COLORS[catKey] || CATEGORY_COLORS.other
              const optIdStr = String(opt.id)
              const isLocked = lockedOptionIds.has(optIdStr)
              const activePoll = activePolls[catKey] || {}
              const votesCount = activePoll.votes_by_option?.[optIdStr] || 0

              if (confirmingDeleteId === opt.id) {
                return (
                  <div
                    key={opt.id}
                    className="inline-delete-confirm"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '4px 8px',
                      borderRadius: '8px',
                      background: 'rgba(239, 68, 68, 0.15)',
                      border: '1px solid rgba(239, 68, 68, 0.4)'
                    }}
                  >
                    <span style={{ fontSize: '0.75rem', color: '#fca5a5', fontWeight: '600' }}>
                      Delete?
                    </span>
                    <button
                      type="button"
                      className="btn btn-danger"
                      style={{ padding: '2px 8px', fontSize: '0.75rem', minHeight: 'auto' }}
                      onClick={() => {
                        setConfirmingDeleteId(null)
                        if (onDeleteOption) onDeleteOption(opt)
                      }}
                    >
                      Yes, Delete
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ padding: '2px 6px', fontSize: '0.75rem', minHeight: 'auto' }}
                      onClick={() => setConfirmingDeleteId(null)}
                    >
                      Cancel
                    </button>
                  </div>
                )
              }

              return (
                <div
                  key={opt.id}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    borderRadius: '8px',
                    background: catStyle.bg,
                    border: `1px solid ${isLocked ? '#eab308' : catStyle.border}`,
                    boxShadow: isLocked ? '0 0 8px rgba(234, 179, 8, 0.25)' : 'none',
                    overflow: 'hidden'
                  }}
                >
                  <button
                    type="button"
                    onClick={() => onOptionClick && onOptionClick(opt)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '6px 10px',
                      background: 'transparent',
                      border: 'none',
                      color: isLocked ? '#fef08a' : 'var(--text-main)',
                      cursor: 'pointer',
                      fontSize: '0.8rem',
                      fontWeight: '500',
                      textAlign: 'left'
                    }}
                    title="Click to assign dates and place on timeline"
                  >
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: isLocked ? '#eab308' : catStyle.border }} />
                    <span style={{ fontWeight: '600' }}>
                      {isLocked ? '🏆 ' : ''}{opt.option_text}
                    </span>
                    <span style={{ fontSize: '0.7rem', color: catStyle.text, background: 'rgba(0,0,0,0.3)', padding: '1px 6px', borderRadius: '4px' }}>
                      {opt.category || 'Other'}
                    </span>
                    {votesCount > 0 && (
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        {votesCount}v
                      </span>
                    )}
                    <span style={{ fontSize: '0.75rem', color: '#60a5fa', marginLeft: '4px' }}>
                      📅 Set dates →
                    </span>
                  </button>
                  {onDeleteOption && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setConfirmingDeleteId(opt.id)
                      }}
                      className="btn-delete-icon"
                      style={{
                        padding: '6px 8px',
                        borderLeft: `1px solid ${isLocked ? 'rgba(234, 179, 8, 0.4)' : 'rgba(255, 255, 255, 0.1)'}`,
                        fontSize: '0.75rem',
                        lineHeight: 1
                      }}
                      title="Delete option"
                      aria-label="Delete option"
                    >
                      🗑️
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Main Gantt Grid */}
      <div className="gantt-scroll-container glass-card" style={{ padding: '1.5rem' }}>
        <div style={{ minWidth: gridMinWidth }}>
          {/* Day Column Headers */}
          <div 
            style={{ 
              display: 'grid', 
              gridTemplateColumns: `var(--gantt-cat-width, 140px) 1fr`,
              borderBottom: '2px solid var(--border-light)', 
              paddingBottom: '0.75rem', 
              marginBottom: '1rem' 
            }}
          >
            <div 
              className="gantt-category-col gantt-header-sticky"
              style={{ 
                fontWeight: 'bold', 
                color: 'var(--text-muted)', 
                fontSize: '0.85rem',
                backgroundColor: 'var(--bg-surface, #141a29)',
                zIndex: 15,
                borderRight: '1px solid var(--border-light)'
              }}
            >
              Category
            </div>

            <div 
              style={{ 
                display: 'grid', 
                gridTemplateColumns: `repeat(${totalDays}, 1fr)`,
                marginLeft: '12px'
              }}
            >
              {tripDays.map((d, idx) => {
                const dStr = formatLocalDateStr(d)
                const isUnbooked = unbookedDateStrs.has(dStr)

                const dayLog = logistics.days[idx]
                const isDep = dayLog?.isDepartureDay

                return (
                  <div 
                    key={idx} 
                    onClick={() => onPitchForSlot && onPitchForSlot(d)}
                    style={{
                      textAlign: 'center',
                      padding: '6px 4px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      background: isUnbooked ? 'rgba(245, 158, 11, 0.05)' : 'transparent',
                      border: isUnbooked ? '1px dashed rgba(245, 158, 11, 0.25)' : '1px solid transparent',
                      transition: 'all 0.15s ease',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                    title={isUnbooked ? 'Hole in Plan! Click to pitch an activity for this day' : 'Click to pitch an option for this day'}
                  >
                    <div style={{ fontSize: '0.75rem', color: isUnbooked ? '#f59e0b' : 'var(--primary-light)', fontWeight: 'bold' }}>
                      Day {idx + 1}
                    </div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-main)', fontWeight: '600' }}>
                      {d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </div>

                    {/* Logistics Coverage Gauges */}
                    {dayLog && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', width: '100%', marginTop: '2px' }}>
                        {isDep ? (
                          <span
                            style={{
                              fontSize: '0.65rem',
                              padding: '2px 4px',
                              borderRadius: '4px',
                              background: 'rgba(255, 255, 255, 0.05)',
                              color: 'var(--text-muted)'
                            }}
                            title="Departure Day (no lodging required tonight)"
                          >
                            🏁 Departure
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              if (onPitchForSlot) onPitchForSlot(d, 'Accommodation')
                            }}
                            style={{
                              fontSize: '0.68rem',
                              padding: '2px 4px',
                              borderRadius: '4px',
                              border: 'none',
                              cursor: 'pointer',
                              fontWeight: '600',
                              background:
                                dayLog.accommodation.status === 'covered'
                                  ? 'rgba(16, 185, 129, 0.18)'
                                  : dayLog.accommodation.status === 'partial'
                                  ? 'rgba(245, 158, 11, 0.18)'
                                  : 'rgba(244, 63, 94, 0.18)',
                              color:
                                dayLog.accommodation.status === 'covered'
                                  ? '#34d399'
                                  : dayLog.accommodation.status === 'partial'
                                  ? '#fbbf24'
                                  : '#fda4af',
                              width: '100%',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '2px'
                            }}
                            title={`${dayLog.accommodation.bedsLocked}/${dayLog.presentCount} beds locked. Click to pitch/book accommodation.`}
                          >
                            <span>🛏️</span>
                            <span>{dayLog.accommodation.bedsLocked}/{dayLog.presentCount}</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            if (onPitchForSlot) onPitchForSlot(d, 'Food')
                          }}
                          style={{
                            fontSize: '0.68rem',
                            padding: '2px 4px',
                            borderRadius: '4px',
                            border: 'none',
                            cursor: 'pointer',
                            fontWeight: '600',
                            background:
                              dayLog.meals.count === 3
                                ? 'rgba(16, 185, 129, 0.15)'
                                : dayLog.meals.count > 0
                                ? 'rgba(245, 158, 11, 0.15)'
                                : 'rgba(255, 255, 255, 0.05)',
                            color:
                              dayLog.meals.count === 3
                                ? '#34d399'
                                : dayLog.meals.count > 0
                                ? '#fcd34d'
                                : 'var(--text-muted)',
                            width: '100%',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '2px'
                          }}
                          title={`${dayLog.meals.count} of 3 meals planned (${Object.keys(dayLog.meals.slots).filter(k => dayLog.meals.slots[k]).join(', ') || 'none'}). Click to plan a meal.`}
                        >
                          <span>🍴</span>
                          <span>{dayLog.meals.count}/3</span>
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Active Category Rows (Categories with scheduled options) */}
          {activeCategories.length === 0 ? (
            <div 
              style={{ 
                padding: '2.5rem 1rem', 
                textAlign: 'center', 
                background: 'rgba(255, 255, 255, 0.02)', 
                borderRadius: '10px', 
                border: '1px dashed var(--border-light)',
                margin: '1rem 0'
              }}
            >
              <div style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>🗓️</div>
              <div style={{ fontWeight: '600', color: 'var(--text-main)', marginBottom: '0.25rem' }}>
                No Scheduled Options on Timeline
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', maxWidth: '440px', margin: '0 auto 1.25rem' }}>
                Assign start and end dates to options above, or pitch new options to populate your visual itinerary.
              </div>
              <button
                type="button"
                onClick={() => onPitchForSlot && onPitchForSlot(tripDays[0] || new Date())}
                className="btn btn-primary"
                style={{ padding: '8px 16px', fontSize: '0.85rem' }}
              >
                ➕ Pitch Option for Day 1
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {activeCategories.map(cat => {
                const catKey = cat.toLowerCase()
                const catStyle = CATEGORY_COLORS[catKey] || CATEGORY_COLORS.other
                const lanes = categoryLanes[catKey] || []
                const packedOptions = lanes.flat()
                const activePoll = activePolls[catKey] || {}

                // Dynamic height: Math.max(1, lanes.length) * 42 + 12
                const trackHeight = Math.max(1, lanes.length) * 42 + 12

                return (
                  <div 
                    key={cat} 
                    style={{ 
                      display: 'grid', 
                      gridTemplateColumns: `var(--gantt-cat-width, 140px) 1fr`, 
                      alignItems: 'stretch', 
                      position: 'relative', 
                      borderBottom: '1px solid rgba(255, 255, 255, 0.04)', 
                      paddingBottom: '0.75rem' 
                    }}
                  >
                    {/* Category Label (Sticky Left) */}
                    <div 
                      className="gantt-category-col"
                      style={{ 
                        fontWeight: '600', 
                        fontSize: '0.9rem', 
                        color: catStyle.text, 
                        display: 'flex', 
                        flexDirection: 'column',
                        justifyContent: 'center',
                        gap: '2px',
                        backgroundColor: 'var(--bg-surface, #141a29)',
                        zIndex: 10,
                        borderRight: '1px solid var(--border-light)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: catStyle.border, flexShrink: 0 }} />
                        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cat}</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>
                          ({packedOptions.length})
                        </span>
                      </div>
                      {lanes.length > 1 && (
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', paddingLeft: '14px' }}>
                          {lanes.length} sub-lanes
                        </span>
                      )}
                    </div>

                    {/* Category Options Track with Multi-Lane Height */}
                    <div 
                      style={{ 
                        position: 'relative', 
                        width: '100%', 
                        height: `${trackHeight}px`, 
                        background: 'rgba(255, 255, 255, 0.01)', 
                        borderRadius: '8px', 
                        border: '1px solid rgba(255, 255, 255, 0.03)',
                        marginLeft: '12px'
                      }}
                    >
                      {/* Background Day Grid Dividers */}
                      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${totalDays}, 1fr)`, position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, pointerEvents: 'none' }}>
                        {tripDays.map((d, i) => {
                          const dStr = formatLocalDateStr(d)
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

                      {/* Packed Option Time Bars */}
                      {packedOptions.map(opt => {
                        const optIdStr = String(opt.id)
                        const isLocked = lockedOptionIds.has(optIdStr)
                        const hasConflict = conflictingOptionIds.has(opt.id)
                        const votesCount = activePoll.votes_by_option?.[optIdStr] || 0
                        const pos = calculateBarPosition(opt)
                        const isHovered = hoveredOption === opt.id

                        let borderStyle = `1.5px solid ${catStyle.border}`
                        let bgStyle = catStyle.bg
                        if (isLocked) {
                          borderStyle = '2px solid #eab308'
                          bgStyle = 'rgba(234, 179, 8, 0.28)'
                        } else if (hasConflict) {
                          borderStyle = '2px dashed #f43f5e'
                          bgStyle = 'rgba(244, 63, 94, 0.28)'
                        }

                        // Position bar vertically based on packed laneIndex: top = laneIndex * 42 + 6
                        const topOffset = opt.laneIndex * 42 + 6

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
                              top: `${topOffset}px`,
                              height: '34px',
                              background: bgStyle,
                              border: borderStyle,
                              borderRadius: '6px',
                              padding: '0 8px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              cursor: 'pointer',
                              zIndex: isHovered ? 25 : 2,
                              transition: 'all 0.15s ease',
                              boxShadow: isLocked 
                                ? '0 0 12px rgba(234, 179, 8, 0.3)' 
                                : (isHovered ? '0 4px 12px rgba(0, 0, 0, 0.4)' : 'none')
                            }}
                          >
                            {(() => {
                              const isFood = catKey === 'food'
                              const isTransport = catKey === 'transport'
                              const mealMode = opt.metadata?.meal_mode
                              const transportMode = opt.metadata?.transport_mode
                              const isFlightOrTicket = transportMode === 'ticket' || opt.metadata?.is_legacy_flight || /flight|vol|avion|airline|plane|airfare|sata|tap|ryanair|easyjet|air france|delta|united|ticket|train|sncf/i.test(opt.option_text || '') || /flight|sata|plane|ticket/i.test(opt.metadata?.route_code || '')
                              const optDate = opt.start_date ? String(opt.start_date).slice(0, 10) : ''
                              const dayLog = logistics.days.find(d => d.dateStr === optDate)
                              const kitchenMissing = isFood && mealMode === 'cook' && dayLog?.accommodation?.hasKitchen === false && (dayLog?.accommodation?.lockedOptions?.length || 0) > 0

                              return (
                                <span style={{ 
                                  fontSize: '0.8rem', 
                                  fontWeight: '600', 
                                  color: isLocked ? '#fef08a' : (hasConflict ? '#fda4af' : 'var(--text-main)'), 
                                  whiteSpace: 'nowrap', 
                                  overflow: 'hidden', 
                                  textOverflow: 'ellipsis',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}>
                                  {isLocked && '🏆 '}
                                  {hasConflict && '⚠️ '}
                                  {isFood && (
                                    mealMode === 'cook' ? '🍳 ' :
                                    mealMode === 'picnic' ? '🥪 ' : '🍽️ '
                                  )}
                                  {isTransport && (
                                    isFlightOrTicket ? '✈️ ' : '🚗 '
                                  )}
                                  <span>{opt.option_text}</span>
                                  {kitchenMissing && (
                                    <span style={{ fontSize: '0.7rem', color: '#f87171', fontWeight: 'bold' }}>
                                      ⚠️ No Kitchen!
                                    </span>
                                  )}
                                </span>
                              )
                            })()}
                            <span style={{ 
                              fontSize: '0.7rem', 
                              fontWeight: 'bold', 
                              background: 'rgba(0, 0, 0, 0.35)', 
                              padding: '1px 6px', 
                              borderRadius: '10px', 
                              color: 'var(--text-muted)', 
                              whiteSpace: 'nowrap', 
                              marginLeft: '6px',
                              flexShrink: 0
                            }}>
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
                                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.7)',
                                width: '240px',
                                zIndex: 100,
                                pointerEvents: 'none',
                                textAlign: 'left'
                              }}>
                                <div style={{ fontWeight: 'bold', color: 'var(--text-main)', fontSize: '0.9rem', marginBottom: '4px' }}>
                                  {isLocked ? '🏆 ' : (hasConflict ? '⚠️ ' : '')}{opt.option_text}
                                </div>
                                {hasConflict && (
                                  <div style={{ fontSize: '0.75rem', color: '#f43f5e', fontWeight: 'bold', marginBottom: '4px' }}>
                                    ⚠️ Overlapping Schedule Conflict!
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
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Collapsed Empty Categories Bar */}
          {emptyCategories.length > 0 && (
            <div 
              className="gantt-empty-categories-bar"
              style={{
                marginTop: '1.25rem',
                padding: '0.75rem 1rem',
                background: 'rgba(15, 23, 42, 0.6)',
                borderRadius: '10px',
                border: '1px dashed rgba(255, 255, 255, 0.1)',
                display: 'flex',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '0.5rem',
                fontSize: '0.82rem'
              }}
            >
              <span style={{ fontWeight: '600', color: 'var(--text-muted)' }}>
                Empty categories:
              </span>
              {emptyCategories.map(cat => {
                const catKey = cat.toLowerCase()
                const style = CATEGORY_COLORS[catKey] || CATEGORY_COLORS.other
                const totalCount = options.filter(o => {
                  const oCat = (o.category || '').toLowerCase().trim()
                  if (catKey === 'transport') {
                    return oCat === 'transport' || oCat === 'flights' || oCat === 'flight'
                  }
                  return oCat === catKey
                }).length

                return (
                  <button
                    key={cat}
                    type="button"
                    className="gantt-empty-category-btn"
                    onClick={() => onPitchForSlot && onPitchForSlot(tripDays[0] || new Date(), catKey)}
                    style={{
                      background: 'rgba(255, 255, 255, 0.04)',
                      border: `1px solid ${style.border}45`,
                      borderRadius: '6px',
                      padding: '4px 10px',
                      color: style.text,
                      cursor: 'pointer',
                      fontSize: '0.78rem',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      transition: 'all 0.15s ease'
                    }}
                    title={`Click to pitch a ${cat} option`}
                  >
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: style.border }} />
                    <span>{cat} ({totalCount})</span>
                    <span style={{ opacity: 0.6 }}>+</span>
                  </button>
                )
              })}
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                — Click to pitch
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
