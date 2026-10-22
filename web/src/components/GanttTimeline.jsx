import React, { useState } from 'react'
import { formatDateTimeRange, parseLocalDate, formatLocalDateStr } from '../utils/format'
import {
  detectScheduleGaps,
  detectScheduleConflicts,
  packOptionsIntoSubTracks,
  analyzeDailyLogisticsCoverage,
  isVehicleCoverage,
  isLogisticsCoverage,
  isShortDurationOption
} from '../utils/schedule'

export { packOptionsIntoSubTracks, isLogisticsCoverage, isShortDurationOption }

const CATEGORY_COLORS = {
  accommodation: { bg: 'rgba(139, 92, 246, 0.25)', border: '#8b5cf6', text: '#c4b5fd', label: 'Accommodation', icon: '🛏️' },
  transport: { bg: 'rgba(56, 189, 248, 0.25)', border: '#38bdf8', text: '#7dd3fc', label: 'Transport', icon: '🚗' },
  flights: { bg: 'rgba(56, 189, 248, 0.25)', border: '#38bdf8', text: '#7dd3fc', label: 'Transport', icon: '✈️' },
  activities: { bg: 'rgba(16, 185, 129, 0.25)', border: '#10b981', text: '#6ee7b7', label: 'Activities', icon: '🎯' },
  food: { bg: 'rgba(245, 158, 11, 0.25)', border: '#f59e0b', text: '#fcd34d', label: 'Food', icon: '🍴' },
  other: { bg: 'rgba(148, 163, 184, 0.25)', border: '#94a3b8', text: '#cbd5e1', label: 'Other', icon: '📌' }
}

const CATEGORIES = ['Accommodation', 'Transport', 'Activities', 'Food', 'Other']

const SHORT_CATEGORY_NAMES = {
  Accommodation: 'Stays',
  Transport: 'Transit',
  Activities: 'Plans',
  Food: 'Food',
  Other: 'Other'
}

export function GanttTimeline({
  trip,
  options = [],
  activePolls = {},
  roster = [],
  onOptionClick,
  onPitchForSlot,
  onDeleteOption
}) {
  const [hoveredOption, setHoveredOption] = useState(null)
  const [inspectedOption, setInspectedOption] = useState(null)
  const [confirmingDeleteId, setConfirmingDeleteId] = useState(null)
  const [showLegend, setShowLegend] = useState(false)

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

  // Zoom modes: 'fit' (Fit Whole Trip), 'scroll' (1x standard), '3day' (2x 3-Day Window), 'hourly' (4x Day Details)
  const [zoomMode, setZoomMode] = useState(totalDays > 7 ? 'scroll' : 'fit')

  // Backwards compatibility density alias
  const density = zoomMode === 'fit' ? 'fit' : 'scroll'
  const setDensity = (mode) => setZoomMode(mode === 'fit' ? 'fit' : 'scroll')

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

  // 4. Multi-Layer Track Separation
  // LAYER 1: Multi-Day Logistics & Coverage (Accommodations + Shared Vehicles / Rental Cars / Carpools)
  // LAYER 2: Scheduled Activities, Meals & Transit Legs (Daily Itinerary, Excursions, Dining & Point-to-Point Flights/Transit)
  const coverageTracksConfig = [
    {
      id: 'accommodation',
      catKey: 'accommodation',
      label: 'Accommodation',
      shortLabel: 'Stays',
      icon: '🛏️',
      style: CATEGORY_COLORS.accommodation,
      filter: (o) => (o.category || '').toLowerCase().trim() === 'accommodation'
    },
    {
      id: 'vehicles',
      catKey: 'transport',
      label: 'Shared Vehicles',
      shortLabel: 'Vehicles',
      icon: '🚗',
      style: CATEGORY_COLORS.transport,
      filter: (o) => {
        const cat = (o.category || '').toLowerCase().trim()
        const isTrans = cat === 'transport' || cat === 'flights' || cat === 'flight'
        return isTrans && isVehicleCoverage(o)
      }
    }
  ]

  const activityTracksConfig = [
    {
      id: 'activities',
      catKey: 'activities',
      label: 'Activities',
      shortLabel: 'Plans',
      icon: '🎯',
      style: CATEGORY_COLORS.activities,
      filter: (o) => (o.category || '').toLowerCase().trim() === 'activities'
    },
    {
      id: 'food',
      catKey: 'food',
      label: 'Food',
      shortLabel: 'Food',
      icon: '🍴',
      style: CATEGORY_COLORS.food,
      filter: (o) => (o.category || '').toLowerCase().trim() === 'food'
    },
    {
      id: 'transit',
      catKey: 'transport',
      label: 'Transport',
      shortLabel: 'Transit',
      icon: '✈️',
      style: CATEGORY_COLORS.transport,
      filter: (o) => {
        const cat = (o.category || '').toLowerCase().trim()
        const isTrans = cat === 'transport' || cat === 'flights' || cat === 'flight'
        return isTrans && !isVehicleCoverage(o)
      }
    },
    {
      id: 'other',
      catKey: 'other',
      label: 'Other',
      shortLabel: 'Other',
      icon: '📌',
      style: CATEGORY_COLORS.other,
      filter: (o) => (o.category || '').toLowerCase().trim() === 'other'
    }
  ]

  // Pack each track's options into sub-tracks
  const packTrack = (track) => {
    const scheduledTrackOptions = options.filter(o => (o.start_date || o.end_date) && track.filter(o))
    const lanes = packOptionsIntoSubTracks(scheduledTrackOptions, tripStartTime, tripEndTime)
    return {
      ...track,
      lanes,
      packedOptions: lanes.flat()
    }
  }

  const coverageTracks = coverageTracksConfig.map(packTrack)
  const activityTracks = activityTracksConfig.map(packTrack)

  const activeCoverageTracks = coverageTracks.filter(t => t.lanes.length > 0)
  const activeActivityTracks = activityTracks.filter(t => t.lanes.length > 0)
  const totalActiveTracksCount = activeCoverageTracks.length + activeActivityTracks.length

  // Find empty categories (for bottom pitch toolbar)
  const emptyCategories = CATEGORIES.filter(cat => {
    const catKey = cat.toLowerCase()
    const scheduledCount = options.filter(o => {
      if (!o.start_date && !o.end_date) return false
      const oCat = (o.category || '').toLowerCase().trim()
      if (catKey === 'transport') {
        return oCat === 'transport' || oCat === 'flights' || oCat === 'flight'
      }
      return oCat === catKey
    }).length
    return scheduledCount === 0
  })

  // Helper: Calculate left % and width % for an option bar
  const calculateBarPosition = (opt) => {
    if (!opt.start_date && !opt.end_date) {
      return { left: 0, width: 0, rawWidth: 0, durationHours: 0, isNarrow: true, isUnscheduled: true }
    }

    const optStartObj = opt.start_date ? parseLocalDate(opt.start_date) : null
    const optEndObj = opt.end_date ? parseLocalDate(opt.end_date) : null

    const optStart = optStartObj ? optStartObj.getTime() : tripStartTime
    const optEnd = optEndObj ? optEndObj.getTime() : (optStartObj ? optStart + (3600000 * 3) : tripEndTime)
    const totalDuration = Math.max(tripEndTime - tripStartTime, 86400000)

    const durationMs = Math.max(0, optEnd - optStart)
    const durationHours = Math.max(0.25, durationMs / 3600000)
    const durationDays = durationHours / 24

    const left = Math.max(0, Math.min(100, ((optStart - tripStartTime) / totalDuration) * 100))
    const right = Math.max(0, Math.min(100, ((optEnd - tripStartTime) / totalDuration) * 100))
    const rawWidth = Math.max(0, right - left)

    // Enforce practical min-width floor so short events never collapse into invisible slivers
    const minPercentFloor = zoomMode === 'fit' 
      ? Math.max(2.5, Math.min(6, (100 / Math.max(totalDays, 1)) * 0.45)) 
      : 1.2
    const width = Math.max(minPercentFloor, rawWidth)

    // Narrow determination: 
    // True if duration is <= 26 hours (single-day or short event) OR visual width in fit mode is < 14%
    const isNarrow = durationHours <= 26 || (zoomMode === 'fit' && rawWidth < 14)

    return { left, width, rawWidth, durationHours, durationDays, isNarrow, isUnscheduled: false }
  }

  // Determine column template & min grid width based on zoomMode
  let dayWidthStyle = '140px'
  if (zoomMode === '3day') {
    dayWidthStyle = '280px'
  } else if (zoomMode === 'hourly') {
    dayWidthStyle = '560px'
  }

  const gridMinWidth = zoomMode === 'fit'
    ? '100%'
    : `calc(var(--gantt-cat-width, 160px) + 12px + (${totalDays} * ${dayWidthStyle}))`

  const dayColumnsTemplate = zoomMode === 'fit'
    ? `repeat(${totalDays}, 1fr)`
    : `repeat(${totalDays}, minmax(${dayWidthStyle}, 1fr))`

  const handleBarClick = (opt, e) => {
    e.stopPropagation()
    setInspectedOption(opt)
    if (onOptionClick) {
      onOptionClick(opt)
    }
  }

  // Helper to render an individual track row
  const renderTrackRow = (track) => {
    const activePoll = activePolls[track.catKey] || {}
    const trackHeight = Math.max(1, track.lanes.length) * 44 + 12

    return (
      <div 
        key={track.id} 
        style={{ 
          display: 'grid', 
          gridTemplateColumns: `var(--gantt-cat-width, 160px) 1fr`, 
          alignItems: 'stretch', 
          position: 'relative', 
          borderBottom: '1px solid rgba(255, 255, 255, 0.04)', 
          paddingBottom: '0.75rem' 
        }}
      >
        {/* Track Label (Sticky Left) */}
        <div 
          className="gantt-category-col"
          style={{ 
            fontWeight: '600', 
            fontSize: '0.88rem', 
            color: 'var(--text-main)', 
            display: 'flex', 
            flexDirection: 'column',
            justifyContent: 'center',
            gap: '3px',
            backgroundColor: 'var(--bg-surface, #141a29)',
            zIndex: 10,
            borderRight: '1px solid var(--border-light)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.85rem', flexShrink: 0 }}>{track.icon}</span>
            <span className="gantt-cat-name-full">{track.label}</span>
            <span className="gantt-cat-name-short">{track.shortLabel || track.label}</span>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 'normal', flexShrink: 0 }}>
              ({track.packedOptions.length})
            </span>
          </div>
          {track.lanes.length > 1 && (
            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', paddingLeft: '18px' }}>
              {track.lanes.length} lanes
            </span>
          )}
        </div>

        {/* Track Options Timeline with Multi-Lane Height */}
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
          <div style={{ display: 'grid', gridTemplateColumns: dayColumnsTemplate, position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, pointerEvents: 'none' }}>
            {tripDays.map((d, i) => {
              const dStr = formatLocalDateStr(d)
              const isUnbooked = unbookedDateStrs.has(dStr)

              return (
                <div 
                  key={i} 
                  style={{ 
                    borderRight: i < totalDays - 1 ? '1px dashed rgba(255, 255, 255, 0.04)' : 'none',
                    background: isUnbooked ? 'rgba(245, 158, 11, 0.02)' : 'transparent',
                    position: 'relative'
                  }} 
                >
                  {zoomMode === 'hourly' && (
                    <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', pointerEvents: 'none' }}>
                      <div style={{ borderRight: '1px dotted rgba(255, 255, 255, 0.03)' }} />
                      <div style={{ borderRight: '1px dotted rgba(255, 255, 255, 0.05)' }} />
                      <div style={{ borderRight: '1px dotted rgba(255, 255, 255, 0.03)' }} />
                      <div />
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Packed Option Time Bars */}
          {track.packedOptions.map(opt => {
            const optIdStr = String(opt.id)
            const isLocked = lockedOptionIds.has(optIdStr)
            const hasConflict = conflictingOptionIds.has(opt.id)
            const votesCount = activePoll.votes_by_option?.[optIdStr] || 0
            const pos = calculateBarPosition(opt)
            const isHovered = hoveredOption === opt.id
            const isInspected = inspectedOption?.id === opt.id

            let borderStyle = `1.5px solid ${track.style.border}`
            let bgStyle = track.style.bg
            if (isLocked) {
              borderStyle = '2px solid #eab308'
              bgStyle = 'rgba(234, 179, 8, 0.28)'
            } else if (hasConflict) {
              borderStyle = '2px dashed #f43f5e'
              bgStyle = 'rgba(244, 63, 94, 0.28)'
            }

            // Vertical positioning: laneIndex * 44 + 6
            const topOffset = (opt.laneIndex || 0) * 44 + 6

            const isFood = track.catKey === 'food'
            const isTransport = track.catKey === 'transport'
            const mealMode = opt.metadata?.meal_mode
            const transportMode = opt.metadata?.transport_mode
            const isVeh = isVehicleCoverage(opt)
            const isFlightOrTicket = !isVeh && (transportMode === 'ticket' || transportMode === 'transit' || opt.metadata?.is_legacy_flight || /flight|vol|avion|airline|plane|airfare|sata|tap|ryanair|easyjet|air france|delta|united|ticket|train|sncf/i.test(opt.option_text || '') || /flight|sata|plane|ticket/i.test(opt.metadata?.route_code || ''))
            const optDate = opt.start_date ? String(opt.start_date).slice(0, 10) : ''
            const dayLog = logistics.days.find(d => d.dateStr === optDate)
            const kitchenMissing = isFood && mealMode === 'cook' && dayLog?.accommodation?.hasKitchen === false && (dayLog?.accommodation?.lockedOptions?.length || 0) > 0

            return (
              <div
                key={opt.id}
                onMouseEnter={() => setHoveredOption(opt.id)}
                onMouseLeave={() => setHoveredOption(null)}
                onFocus={() => setHoveredOption(opt.id)}
                onBlur={() => setHoveredOption(null)}
                onClick={(e) => handleBarClick(opt, e)}
                tabIndex={0}
                role="button"
                aria-label={opt.option_text}
                title={opt.option_text}
                style={{
                  position: 'absolute',
                  left: `${pos.left}%`,
                  width: `${pos.width}%`,
                  minWidth: zoomMode === 'fit' ? '48px' : '64px',
                  top: `${topOffset}px`,
                  height: '34px',
                  background: bgStyle,
                  border: borderStyle,
                  borderRadius: '8px',
                  padding: '0 8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  zIndex: isHovered ? 25 : (isInspected ? 20 : 3),
                  transition: 'all 0.15s ease',
                  boxShadow: isLocked 
                    ? '0 0 12px rgba(234, 179, 8, 0.35)' 
                    : (isHovered ? '0 4px 14px rgba(0, 0, 0, 0.5)' : 'none'),
                  outline: isInspected ? '2px solid var(--primary, #3b82f6)' : 'none'
                }}
              >
                {/* Inside Bar Content */}
                <span style={{ 
                  fontSize: '0.8rem', 
                  fontWeight: '600', 
                  color: isLocked ? 'var(--gantt-locked-text, #fef08a)' : (hasConflict ? 'var(--gantt-conflict-text, #fda4af)' : 'var(--text-main)'), 
                  whiteSpace: 'nowrap', 
                  overflow: 'hidden', 
                  textOverflow: 'ellipsis',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  minWidth: 0,
                  flex: 1
                }}>
                  {isLocked && <span style={{ flexShrink: 0 }}>🏆</span>}
                  {hasConflict && <span style={{ flexShrink: 0 }}>🚨</span>}
                  {isFood && (
                    <span style={{ flexShrink: 0 }}>
                      {mealMode === 'cook' ? '🍳' : mealMode === 'picnic' ? '🥪' : '🍽️'}
                    </span>
                  )}
                  {isTransport && (
                    <span style={{ flexShrink: 0 }}>
                      {isFlightOrTicket ? '✈️' : '🚗'}
                    </span>
                  )}
                  {track.id === 'accommodation' && (
                    <span style={{ flexShrink: 0 }}>🛏️</span>
                  )}
                  {track.id === 'activities' && (
                    <span style={{ flexShrink: 0 }}>🎯</span>
                  )}

                  {/* If wide enough, show text directly inside bar */}
                  {!pos.isNarrow && (
                    <span style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      minWidth: 0
                    }}>
                      {opt.option_text}
                    </span>
                  )}

                  {/* Hidden screen-reader span so full title is always in DOM for accessibility and tests */}
                  {pos.isNarrow && (
                    <span style={{
                      position: 'absolute',
                      width: 1,
                      height: 1,
                      padding: 0,
                      margin: -1,
                      overflow: 'hidden',
                      clip: 'rect(0, 0, 0, 0)',
                      border: 0
                    }}>
                      {opt.option_text}
                    </span>
                  )}

                  {!pos.isNarrow && kitchenMissing && (
                    <span style={{ fontSize: '0.7rem', color: '#f87171', fontWeight: 'bold', flexShrink: 0 }}>
                      ⚠️ No Kitchen!
                    </span>
                  )}
                </span>

                <span 
                  className="gantt-bar-votes"
                  style={{ 
                    fontSize: '0.7rem', 
                    fontWeight: 'bold', 
                    background: 'rgba(0, 0, 0, 0.4)', 
                    padding: '1px 5px', 
                    borderRadius: '10px', 
                    color: 'var(--text-muted)', 
                    whiteSpace: 'nowrap', 
                    marginLeft: '4px',
                    flexShrink: 0
                  }}
                >
                  {votesCount}v
                </span>

                {/* External Floating Pill Label for Single-Day & Short Events */}
                {pos.isNarrow && (
                  <div
                    className={`gantt-pill-label ${isLocked ? 'is-locked' : ''} ${hasConflict ? 'has-conflict' : ''}`}
                    style={{
                      [pos.left > 75 ? 'right' : 'left']: 'calc(100% + 6px)'
                    }}
                  >
                    <span>{opt.option_text}</span>
                    {kitchenMissing && (
                      <span style={{ color: '#f87171', fontSize: '0.7rem', fontWeight: 'bold' }}>⚠️ No Kitchen!</span>
                    )}
                  </div>
                )}

                {/* Rich Hover / Focus Popover Tooltip */}
                {isHovered && (
                  <div 
                    className="glass-card"
                    style={{
                      position: 'absolute',
                      bottom: '120%',
                      left: pos.left > 75 ? 'auto' : '50%',
                      right: pos.left > 75 ? '0' : 'auto',
                      transform: pos.left > 75 ? 'none' : 'translateX(-50%)',
                      background: 'var(--tooltip-bg, #0f172a)',
                      border: isLocked ? '1.5px solid #eab308' : (hasConflict ? '1.5px solid #f43f5e' : '1px solid var(--border-light)'),
                      padding: '10px 14px',
                      borderRadius: '10px',
                      boxShadow: '0 12px 35px -5px rgba(0, 0, 0, 0.8)',
                      width: '260px',
                      zIndex: 100,
                      pointerEvents: 'none',
                      textAlign: 'left',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '5px'
                    }}
                  >
                    <div style={{ fontWeight: 'bold', color: 'var(--text-main)', fontSize: '0.92rem' }}>
                      {isLocked ? '🏆 ' : (hasConflict ? '🚨 ' : '')}{opt.option_text}
                    </div>

                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap', fontSize: '0.72rem' }}>
                      <span style={{ background: track.style.bg, color: track.style.text, padding: '1px 6px', borderRadius: '4px', border: `1px solid ${track.style.border}` }}>
                        {track.label}
                      </span>
                      {isLocked && (
                        <span style={{ background: 'rgba(234, 179, 8, 0.2)', color: '#fef08a', padding: '1px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
                          🏆 Locked Choice
                        </span>
                      )}
                      {hasConflict && (
                        <span style={{ background: 'rgba(244, 63, 94, 0.2)', color: '#fda4af', padding: '1px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
                          🚨 Overlap Conflict
                        </span>
                      )}
                    </div>

                    {(opt.start_date || opt.end_date) && (
                      <div style={{ fontSize: '0.75rem', color: '#60a5fa' }}>
                        📅 {formatDateTimeRange(opt.start_date, opt.end_date)}
                      </div>
                    )}

                    {pos.durationHours > 0 && (
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        ⏱️ Duration: {pos.durationHours < 24 ? `${pos.durationHours.toFixed(1)} hrs` : `${Math.round(pos.durationDays)} days`}
                      </div>
                    )}

                    {opt.estimated_cost && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--primary-light)', fontWeight: '600' }}>
                        💰 Cost: {opt.estimated_cost} {opt.currency || 'USD'} {opt.cost_type ? `(${opt.cost_type.replace('_', ' ')})` : ''}
                      </div>
                    )}

                    {isVehicleCoverage(opt) && (
                      <div style={{ fontSize: '0.75rem', color: '#93c5fd' }}>
                        🚗 Capacity: {opt.metadata?.seats_capacity || opt.metadata?.max_capacity || 'N/A'} seats
                      </div>
                    )}

                    {Array.isArray(opt.assigned_users) && opt.assigned_users.length > 0 && (
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        👥 Assigned ({opt.assigned_users.length}): {roster?.filter(r => (opt.assigned_users || []).map(String).includes(String(r.user_id || r.id))).map(m => m.users?.first_name || m.username || 'Traveler').join(', ') || `${opt.assigned_users.length} members`}
                      </div>
                    )}

                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border-light)', paddingTop: '4px', marginTop: '2px', display: 'flex', justifyContent: 'space-between' }}>
                      <span>🗳️ {votesCount} votes</span>
                      <span style={{ color: '#93c5fd' }}>Click to inspect →</span>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="gantt-container" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {/* Daily Logistics Coverage & Schedule Health Summary Banner */}
      <div 
        className="gantt-status-bar"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.6rem 1rem',
          background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.9), rgba(30, 41, 59, 0.9))',
          padding: '0.65rem 1rem',
          borderRadius: '10px',
          border: '1px solid var(--border-light)'
        }}
      >
        <div style={{ display: 'flex', gap: '0.75rem 1.25rem', alignItems: 'center', flexWrap: 'wrap', minWidth: 0, flex: 1 }}>
          {/* Nights Covered Gauge */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            fontSize: '0.82rem',
            color: logistics.nightsCoveredCount >= logistics.totalNights && logistics.totalNights > 0 ? '#10b981' : '#f59e0b',
            fontWeight: '600',
            whiteSpace: 'nowrap'
          }}>
            <span>🛏️</span>
            <span>
              <strong>{logistics.nightsCoveredCount}/{logistics.totalNights}</strong> Nights
            </span>
          </div>

          {/* Meals Planned Gauge */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            fontSize: '0.82rem',
            color: logistics.mealsPlannedCount === logistics.totalMealsSlots && logistics.totalMealsSlots > 0 ? '#10b981' : '#fcd34d',
            fontWeight: '600',
            whiteSpace: 'nowrap'
          }}>
            <span>🍴</span>
            <span>
              <strong>{logistics.mealsPlannedCount}/{logistics.totalMealsSlots}</strong> Meals
            </span>
          </div>

          {/* Vehicles Coverage Gauge */}
          {logistics.totalVehiclesCount > 0 && (
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              fontSize: '0.82rem',
              color: '#60a5fa',
              fontWeight: '600',
              whiteSpace: 'nowrap'
            }}>
              <span>🚗</span>
              <span>
                <strong>{logistics.totalVehiclesCount}</strong> Vehicle{logistics.totalVehiclesCount > 1 ? 's' : ''}
              </span>
            </div>
          )}

          {/* Overlapping Conflict Indicator */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            fontSize: '0.82rem',
            color: conflictingOptionIds.size > 0 ? '#f43f5e' : 'var(--text-muted)',
            fontWeight: '600',
            whiteSpace: 'nowrap'
          }}>
            <span>{conflictingOptionIds.size > 0 ? '🚨' : '🛡️'}</span>
            <span>
              {conflictingOptionIds.size > 0 
                ? `${conflictingOptionIds.size} Conflict${conflictingOptionIds.size > 1 ? 's' : ''}` 
                : 'No Time Conflicts'}
            </span>
          </div>

          {/* Logistics Alerts Counter if any (clean single ⚠️ icon) */}
          {logistics.alerts.length > 0 && (() => {
            const cleanAlert = (logistics.alerts[0] || '').replace(/^(\s*(⚠️|🍴|🚨))+\s*/u, '').trim()
            return (
              <div 
                className="gantt-alert-pill"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  fontSize: '0.78rem',
                  padding: '2px 8px',
                  borderRadius: '6px',
                  background: 'rgba(245, 158, 11, 0.15)',
                  color: '#fcd34d',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  maxWidth: '100%',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }} 
                title={logistics.alerts.join('\n')}
              >
                <span>⚠️</span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{cleanAlert}</span>
                {logistics.alerts.length > 1 && (
                  <span style={{ fontSize: '0.72rem', opacity: 0.8, flexShrink: 0 }}> (+{logistics.alerts.length - 1} more)</span>
                )}
              </div>
            )
          })()}
        </div>

        {unbookedDays.length > 0 && (
          <button
            type="button"
            onClick={() => onPitchForSlot && onPitchForSlot(unbookedDays[0].date)}
            className="btn btn-primary gantt-pitch-slot-btn"
            style={{ 
              padding: '5px 12px', 
              fontSize: '0.8rem',
              fontWeight: '600',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              whiteSpace: 'nowrap',
              flexShrink: 0
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            <span>Pitch for Day {unbookedDays[0].dayNum} Slot</span>
          </button>
        )}
      </div>

      {/* View Controls: Collapsible Legend & Zoom / Density Switcher */}
      <div 
        className="gantt-controls-bar"
        style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          flexWrap: 'wrap', 
          gap: '0.75rem',
          position: 'relative'
        }}
      >
        <div style={{ position: 'relative' }}>
          <button
            type="button"
            className="btn btn-secondary gantt-legend-btn"
            onClick={() => setShowLegend(prev => !prev)}
            aria-expanded={showLegend}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              fontSize: '0.78rem',
              fontWeight: '600',
              borderRadius: '8px',
              background: showLegend ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.04)',
              borderColor: showLegend ? 'var(--primary)' : 'var(--border-light)'
            }}
          >
            <span>🎨 Legend</span>
            <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>{showLegend ? '▴' : '▾'}</span>
          </button>

          {/* Toggleable Legend Popover */}
          {showLegend && (
            <div 
              className="gantt-legend-popover glass-card"
              style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                left: 0,
                zIndex: 60,
                background: 'var(--bg-surface, #0f172a)',
                border: '1px solid var(--border-light)',
                borderRadius: '10px',
                padding: '0.75rem 1rem',
                boxShadow: '0 12px 30px rgba(0, 0, 0, 0.6)',
                minWidth: '260px',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.6rem'
              }}
            >
              <div style={{ fontSize: '0.72rem', fontWeight: 'bold', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Categories & Layers
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.4rem 0.75rem' }}>
                {CATEGORIES.map(cat => {
                  const style = CATEGORY_COLORS[cat.toLowerCase()] || CATEGORY_COLORS.other
                  return (
                    <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: style.text }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: style.border, display: 'inline-block', flexShrink: 0 }} />
                      <span>{cat}</span>
                    </div>
                  )
                })}
              </div>
              <div style={{ height: '1px', background: 'var(--border-light)', margin: '2px 0' }} />
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', fontSize: '0.75rem' }}>
                <span style={{ border: '1.5px solid #eab308', background: 'rgba(234, 179, 8, 0.2)', padding: '1px 6px', borderRadius: '4px', color: '#eab308', fontWeight: 'bold' }}>
                  🏆 Locked
                </span>
                <span style={{ border: '1.5px dashed #f43f5e', background: 'rgba(244, 63, 94, 0.2)', padding: '1px 6px', borderRadius: '4px', color: '#fda4af' }}>
                  🚨 Overlap
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Timeline Zoom / View Mode Switcher */}
        <div 
          className="gantt-zoom-switcher" 
          role="group" 
          aria-label="Timeline Zoom & View Mode"
          style={{ display: 'inline-flex', background: 'rgba(0, 0, 0, 0.35)', padding: '3px', borderRadius: '8px', border: '1px solid var(--border-light)', flexWrap: 'wrap', gap: '2px' }}
        >
          <button
            type="button"
            onClick={() => { setZoomMode('fit'); setDensity('fit') }}
            className={`btn-zoom-mode ${zoomMode === 'fit' ? 'active' : ''}`}
            title="Fit entire trip duration on screen"
          >
            ↔️ Compact Fit
          </button>
          <button
            type="button"
            onClick={() => { setZoomMode('scroll'); setDensity('scroll') }}
            className={`btn-zoom-mode ${zoomMode === 'scroll' ? 'active' : ''}`}
            title="Scroll horizontally with 1-day standard columns"
          >
            📜 Day-by-Day Scroll
          </button>
          <button
            type="button"
            onClick={() => setZoomMode('3day')}
            className={`btn-zoom-mode ${zoomMode === '3day' ? 'active' : ''}`}
            title="Zoom into 3-Day Window view"
          >
            🔍 3-Day Window
          </button>
          <button
            type="button"
            onClick={() => setZoomMode('hourly')}
            className={`btn-zoom-mode ${zoomMode === 'hourly' ? 'active' : ''}`}
            title="Hourly day details breakdown"
          >
            🔬 Day Details (Hourly)
          </button>
        </div>
      </div>

      {/* Unscheduled Options Tray */}
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

      {/* Main Gantt Grid Card */}
      <div className="glass-card" style={{ padding: '1.25rem', overflow: 'hidden' }}>
        <div className="gantt-scroll-container">
          <div style={{ minWidth: gridMinWidth }}>
            {/* Day Column Headers */}
            <div 
              style={{ 
                display: 'grid', 
                gridTemplateColumns: `var(--gantt-cat-width, 160px) 1fr`,
                borderBottom: '2px solid var(--border-light)', 
                paddingBottom: '0.75rem', 
                marginBottom: '0.75rem' 
              }}
            >
              <div 
                className="gantt-category-col gantt-header-sticky"
                style={{ 
                  fontWeight: 'bold', 
                  color: 'var(--text-muted)', 
                  fontSize: '0.82rem',
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
                  gridTemplateColumns: dayColumnsTemplate,
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

                      {/* Hourly Guides for Hourly Mode */}
                      {zoomMode === 'hourly' && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', fontSize: '0.62rem', color: 'var(--text-muted)', marginTop: '2px', borderTop: '1px dotted rgba(255, 255, 255, 0.1)', paddingTop: '2px' }}>
                          <span>00:00</span>
                          <span>06:00</span>
                          <span>12:00</span>
                          <span>18:00</span>
                          <span>24:00</span>
                        </div>
                      )}

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

                          {dayLog.transport && (dayLog.transport.seatsLocked > 0 || (dayLog.transport.availableVehicles && dayLog.transport.availableVehicles.length > 0)) && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                if (onPitchForSlot) onPitchForSlot(d, 'Transport')
                              }}
                              style={{
                                fontSize: '0.68rem',
                                padding: '2px 4px',
                                borderRadius: '4px',
                                border: 'none',
                                cursor: 'pointer',
                                fontWeight: '600',
                                background:
                                  dayLog.transport.status === 'covered'
                                    ? 'rgba(59, 130, 246, 0.18)'
                                    : dayLog.transport.status === 'partial'
                                    ? 'rgba(245, 158, 11, 0.18)'
                                    : 'rgba(255, 255, 255, 0.05)',
                                color:
                                  dayLog.transport.status === 'covered'
                                    ? '#60a5fa'
                                    : dayLog.transport.status === 'partial'
                                    ? '#fbbf24'
                                    : 'var(--text-muted)',
                                width: '100%',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '2px'
                              }}
                              title={
                                dayLog.transport.availableVehicles?.length > 0
                                  ? dayLog.transport.availableVehicles.map(v => `${v.option_text || 'Vehicle'}: ${v.assignedMembers?.map(m => m.users?.first_name || m.username || 'Traveler').join(', ') || 'No passengers assigned'} (${v.assignedCount}/${v.capacity} seats)`).join('\n')
                                  : `${dayLog.transport.seatsLocked}/${dayLog.presentCount} seats locked. Click to manage vehicles.`
                              }
                            >
                              <span>🚗</span>
                              <span>{dayLog.transport.seatsLocked}/{dayLog.presentCount}</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Empty State when no scheduled options exist on timeline */}
            {totalActiveTracksCount === 0 ? (
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {/* LAYER 1: Multi-Day Logistics & Coverage (Accommodations + Shared Vehicles) */}
                {activeCoverageTracks.length > 0 && (
                  <div className="gantt-layer-section" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div className="gantt-layer-header-row">
                      <div className="gantt-layer-sticky-label">
                        <span className="gantt-layer-title">🛡️ Multi-Day Logistics & Coverage</span>
                        <span className="gantt-layer-subtitle">Stays & Shared Vehicles / Carpools</span>
                      </div>
                    </div>
                    {activeCoverageTracks.map(renderTrackRow)}
                  </div>
                )}

                {/* LAYER 2: Scheduled Activities, Meals & Transit Legs */}
                {activeActivityTracks.length > 0 && (
                  <div className="gantt-layer-section" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div className="gantt-layer-header-row">
                      <div className="gantt-layer-sticky-label">
                        <span className="gantt-layer-title">🎯 Scheduled Activities, Meals & Transit</span>
                        <span className="gantt-layer-subtitle">Daily itinerary, scheduled tours, dining & transit</span>
                      </div>
                    </div>
                    {activeActivityTracks.map(renderTrackRow)}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Selected Option Inspection Card */}
        {inspectedOption && (
          <div className="gantt-inspector-card glass-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '1.25rem' }}>
                  {CATEGORY_COLORS[inspectedOption.category?.toLowerCase()]?.icon || '📌'}
                </span>
                <div>
                  <div style={{ fontWeight: 'bold', fontSize: '0.95rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {inspectedOption.is_locked ? '🏆 ' : ''}{inspectedOption.option_text}
                    {conflictingOptionIds.has(inspectedOption.id) && (
                      <span style={{ fontSize: '0.72rem', color: '#f43f5e', background: 'rgba(244, 63, 94, 0.15)', padding: '1px 6px', borderRadius: '4px' }}>
                        🚨 Schedule Overlap
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {inspectedOption.category || 'Option'} • {formatDateTimeRange(inspectedOption.start_date, inspectedOption.end_date)}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {onOptionClick && (
                  <button
                    type="button"
                    onClick={() => onOptionClick(inspectedOption)}
                    className="btn btn-primary"
                    style={{ padding: '4px 10px', fontSize: '0.78rem' }}
                  >
                    ✏️ Edit / Reschedule
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setInspectedOption(null)}
                  className="btn btn-secondary"
                  style={{ padding: '4px 8px', fontSize: '0.78rem' }}
                  title="Close inspection"
                >
                  ✕
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', fontSize: '0.8rem', background: 'rgba(255, 255, 255, 0.02)', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
              {inspectedOption.estimated_cost && (
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Cost: </span>
                  <strong style={{ color: 'var(--primary-light)' }}>{inspectedOption.estimated_cost} {inspectedOption.currency || 'USD'}</strong>
                </div>
              )}
              {isVehicleCoverage(inspectedOption) && (
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Vehicle Capacity: </span>
                  <strong>{inspectedOption.metadata?.seats_capacity || inspectedOption.metadata?.max_capacity || 'N/A'} seats</strong>
                </div>
              )}
              {Array.isArray(inspectedOption.assigned_users) && inspectedOption.assigned_users.length > 0 && (
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Assigned Travelers ({inspectedOption.assigned_users.length}): </span>
                  <strong>{roster?.filter(r => (inspectedOption.assigned_users || []).map(String).includes(String(r.user_id || r.id))).map(m => m.users?.first_name || m.username || 'Traveler').join(', ') || `${inspectedOption.assigned_users.length} members`}</strong>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Collapsed Empty Categories Bar (Outside horizontal scroll container) */}
        {emptyCategories.length > 0 && (
          <div 
            className="gantt-empty-categories-bar"
            style={{
              marginTop: '1rem',
              padding: '0.75rem 1rem',
              background: 'rgba(15, 23, 42, 0.6)',
              borderRadius: '10px',
              border: '1px dashed rgba(255, 255, 255, 0.1)',
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.5rem',
              fontSize: '0.82rem',
              width: '100%',
              boxSizing: 'border-box'
            }}
          >
            <span style={{ fontWeight: '600', color: 'var(--text-muted)', flexShrink: 0 }}>
              Empty categories:
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
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
                      transition: 'all 0.15s ease',
                      flexShrink: 0
                    }}
                    title={`Click to pitch a ${cat} option`}
                  >
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: style.border }} />
                    <span>{cat} ({totalCount})</span>
                    <span style={{ opacity: 0.6 }}>+</span>
                  </button>
                )
              })}
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: 'auto', flexShrink: 0 }}>
              — Click to pitch
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
