import React, { useMemo } from 'react'
import { formatDateTimeRange, formatMoney } from '../utils/format'
import { checkOptionDateConflict, isOptionLocked, calculateVehicleCostPerPassenger, checkAccommodationCapacity, checkActivitySpots, isVehicleCoverage } from '../services/options'
import { getPresentTravelers } from '../services/rsvps'
import { calculateOptionCostBreakdown } from '../utils/currency'
import { getMealDietaryAlerts } from '../services/groceries'

// Helper to extract initials from user name
export function getInitials(name) {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }
  return name.slice(0, 2).toUpperCase()
}

// Helper to generate consistent avatar background colors
export function getAvatarColor(nameOrId) {
  const colors = [
    'hsl(210, 70%, 50%)',
    'hsl(160, 60%, 43%)',
    'hsl(280, 60%, 55%)',
    'hsl(340, 65%, 55%)',
    'hsl(20, 75%, 50%)',
    'hsl(120, 50%, 40%)',
    'hsl(45, 80%, 45%)',
    'hsl(185, 75%, 40%)'
  ]
  const str = String(nameOrId || '')
  const seed = str.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
  return colors[Math.abs(seed) % colors.length]
}

// Category pill label helper with icon
export function getCategoryLabelWithIcon(cat, fallbackTab = 'Other') {
  const raw = (cat || fallbackTab || 'Other').trim().toLowerCase()
  if (raw === 'accommodation') return '🏠 Accommodation'
  if (raw === 'transport') return '🚗 Transport'
  if (raw === 'flights' || raw === 'flight') return '✈️ Flight'
  if (raw === 'activities') return '🎟️ Activity'
  if (raw === 'food') return '🍴 Food'
  return `✨ ${cat || 'Other'}`
}

// Duration or date range formatting helper
export function formatCardDurationOrDates(opt, isInsideDateGroup, activeTab = '') {
  if (!opt.start_date && !opt.end_date) {
    return '📌 Flexible'
  }
  if (isInsideDateGroup && opt.start_date && opt.end_date) {
    const start = new Date(opt.start_date)
    const end = new Date(opt.end_date)
    const diffTime = end.getTime() - start.getTime()
    const diffDays = Math.max(1, Math.round(diffTime / (1000 * 60 * 60 * 24)))
    const isAccom = (opt.category || activeTab || '').toLowerCase() === 'accommodation'
    if (isAccom) {
      return `🌙 ${diffDays} night${diffDays !== 1 ? 's' : ''}`
    }
    return `⏱️ ${diffDays} day${diffDays !== 1 ? 's' : ''}`
  }
  return `📅 ${formatDateTimeRange(opt.start_date, opt.end_date)}`
}

/**
 * OptionCard component rendering an individual pitched option with the 3-Zone layout:
 * Zone 1: Header Row (Category pill, date/duration, conflict pill, logged badge, delete action)
 * Zone 2: Title & Pricing block with Category Spec box & description
 * Zone 3: Attendance row, vote progress bar, and action buttons (vote, lock, edit, fix dates)
 */
export function OptionCard({
  opt,
  activeTab = 'Accommodation',
  trip,
  roster = [],
  activeUser,
  committedMembers = [],
  rates = null,
  baseCurrency = 'USD',
  poll = null,
  isSectionLocked = false,
  isInsideDateGroup = false,
  isLogged = false,
  costDetails: providedCostDetails,
  onVoteToggle,
  onLockToggle,
  onDeleteOption,
  onEditOption,
  onOpenExpenseModal,
  onOpenPollRecapModal,
  onToggleParticipant,
  onOpenSetDatesModal,
  confirmingDeleteId,
  setConfirmingDeleteId
}) {
  const optCategory = (opt.category || activeTab || '').toLowerCase()
  const optIdStr = String(opt.id)

  // Voters calculation
  const selections = poll?.voter_selections || {}
  const pollVotes = poll?.votes_by_option || {}

  const voters = useMemo(() => {
    return Object.entries(selections)
      .filter(([key, opts]) => !key.startsWith('_') && Array.isArray(opts) && opts.map(String).includes(optIdStr))
      .map(([uId]) => {
        const member = roster.find(
          (m) =>
            (m.user_id && String(m.user_id) === String(uId)) ||
            (m.users?.id && String(m.users.id) === String(uId)) ||
            (m.id && String(m.id) === String(uId))
        )
        return {
          id: uId,
          name: member?.users?.first_name || member?.username || member?.full_name || 'Traveler'
        }
      })
  }, [selections, optIdStr, roster])

  const userVotes = selections[String(activeUser?.id)] || selections[activeUser?.id] || []
  const hasVoted = Array.isArray(userVotes) && userVotes.map(String).includes(optIdStr)

  const recordedVotes = pollVotes[opt.id] !== undefined
    ? Number(pollVotes[opt.id])
    : (pollVotes[optIdStr] !== undefined ? Number(pollVotes[optIdStr]) : undefined)

  const votesCount = Math.max(
    recordedVotes !== undefined && !isNaN(recordedVotes) ? recordedVotes : 0,
    voters.length,
    hasVoted ? 1 : 0
  )

  const effectiveCommitted = committedMembers.length > 0 ? committedMembers : roster.filter((m) => m.status === 'Committed')
  const committedCount = effectiveCommitted.length > 0 ? effectiveCommitted.length : (roster.length > 0 ? roster.length : 1)
  const votePercent = Math.min(100, Math.round((votesCount / Math.max(1, committedCount)) * 100))

  const isLockedChoice = isSectionLocked || isOptionLocked(opt, poll)
  const isConflict = checkOptionDateConflict(opt, trip?.start_date, trip?.end_date)

  // Calculate cost details if not provided
  const costDetails = useMemo(() => {
    if (providedCostDetails !== undefined) return providedCostDetails
    if (!opt || !opt.estimated_cost || isNaN(Number(opt.estimated_cost)) || Number(opt.estimated_cost) <= 0) return null
    const rawCost = Number(opt.estimated_cost)
    const optCurr = (opt.currency || baseCurrency).toUpperCase()
    const tripBaseCurr = (baseCurrency || 'USD').toUpperCase()
    const isDiff = optCurr !== tripBaseCurr
    const breakdown = calculateOptionCostBreakdown(opt, effectiveCommitted, rates, tripBaseCurr)

    return {
      rawCost,
      currency: optCurr,
      isDiff,
      converted: breakdown.totalGroupCost,
      baseCurrency: tripBaseCurr,
      perPerson: breakdown.perPersonCost,
      costType: breakdown.costType,
      participantCount: breakdown.effectiveParticipantIds.length,
      effectiveParticipantIds: breakdown.effectiveParticipantIds
    }
  }, [providedCostDetails, opt, baseCurrency, effectiveCommitted, rates])

  const metadata = opt.metadata || {}

  const presentTravelers = getPresentTravelers(effectiveCommitted, opt.start_date, opt.end_date)
  const presentTravelerIds = presentTravelers.map((m) => String(m.user_id || m.id))
  const hasExplicitAssignments = Array.isArray(opt.assigned_users) && opt.assigned_users.length > 0
  const assignedUserIds = hasExplicitAssignments ? opt.assigned_users.map(String) : presentTravelerIds
  const assignedCount = assignedUserIds.length
  const isUserJoined = activeUser && assignedUserIds.includes(String(activeUser.id))

  // Resolve assigned users to member objects for avatar chips
  const assignedMembers = assignedUserIds.map((uId) => {
    const member = roster.find(
      (m) => String(m.user_id) === String(uId) || String(m.users?.id) === String(uId) || String(m.id) === String(uId)
    )
    return {
      id: uId,
      name: member?.users?.first_name || member?.username || 'Traveler'
    }
  })

  return (
    <div
      key={opt.id}
      className={`option-card ${isLockedChoice ? 'locked-card' : ''} ${hasVoted ? 'voted' : ''}`}
      style={{
        border: isLockedChoice
          ? '1px solid rgba(16, 185, 129, 0.4)'
          : isConflict
          ? '1px solid rgba(245, 158, 11, 0.35)'
          : hasVoted
          ? '1px solid var(--accent)'
          : '1px solid var(--border-light)',
        background: isLockedChoice
          ? 'rgba(16, 185, 129, 0.03)'
          : 'rgba(255, 255, 255, 0.02)'
      }}
    >
      <div>
        {/* Zone 1: Header Row — Category Pill + Date Range / Duration + Status Badge */}
        <div className="option-card-header-row">
          <div className="option-header-left">
            <span className="option-category-pill">
              {getCategoryLabelWithIcon(opt.category, activeTab)}
            </span>
            <span className="option-duration-pill">
              {formatCardDurationOrDates(opt, isInsideDateGroup, activeTab)}
            </span>
            {isConflict && (
              <span className="option-conflict-pill">
                ⚠️ Outside Trip Dates
              </span>
            )}
          </div>

          <div className="option-header-right">
            {isLogged ? (
              <span className="badge-logged-expense">
                ✓ Logged in Expenses
              </span>
            ) : isLockedChoice && onOpenExpenseModal && (
              <button
                onClick={() => onOpenExpenseModal({ ...opt, category: opt.category || activeTab || 'Accommodation' })}
                className="btn btn-secondary log-expense-btn"
                title="Convert locked option directly into a shared expense"
                type="button"
              >
                💸 Log as Expense
              </button>
            )}

            {onDeleteOption && (
              confirmingDeleteId === opt.id ? (
                <div className="inline-delete-confirm" onClick={(e) => e.stopPropagation()}>
                  <span style={{ fontSize: '0.75rem', color: '#fca5a5', fontWeight: '600' }}>Delete?</span>
                  <button
                    type="button"
                    className="btn btn-danger"
                    style={{ padding: '2px 8px', fontSize: '0.75rem', minHeight: 'auto' }}
                    onClick={() => {
                      if (setConfirmingDeleteId) setConfirmingDeleteId(null)
                      onDeleteOption(opt)
                    }}
                  >
                    Yes, Delete
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ padding: '2px 6px', fontSize: '0.75rem', minHeight: 'auto' }}
                    onClick={() => setConfirmingDeleteId && setConfirmingDeleteId(null)}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="btn-delete-icon"
                  onClick={(e) => {
                    e.stopPropagation()
                    if (setConfirmingDeleteId) setConfirmingDeleteId(opt.id)
                  }}
                  title="Delete option"
                  aria-label="Delete option"
                >
                  🗑️
                </button>
              )
            )}
          </div>
        </div>

        {/* Zone 2: Title & Pricing Row */}
        <div className="option-card-title-pricing-row">
          <h4 className="option-card-title">
            {opt.option_text}
          </h4>

          <div className="option-card-pricing-block">
            {costDetails ? (
              <>
                <div className="option-total-price">
                  {formatMoney(costDetails.rawCost, costDetails.currency, { maximumFractionDigits: 0 })}
                  {costDetails.isDiff && rates && (
                    <span className="cost-converted option-converted-price">
                      (≈ {formatMoney(costDetails.converted, costDetails.baseCurrency, { maximumFractionDigits: 0 })})
                    </span>
                  )}
                </div>
                <div className="option-per-person">
                  {costDetails.costType === 'per_person' && (
                    <span title="Priced per ticket/person">🎟️ {formatMoney(costDetails.rawCost, costDetails.currency, { maximumFractionDigits: 0 })} / person</span>
                  )}
                  {costDetails.costType === 'per_night' && (
                    <span title="Priced per night and prorated by stay dates">🌙 ~{formatMoney(costDetails.perPerson, costDetails.baseCurrency, { maximumFractionDigits: 0 })} / person</span>
                  )}
                  {(!costDetails.costType || costDetails.costType === 'split_total') && (
                    <span>~{formatMoney(costDetails.perPerson, costDetails.baseCurrency, { maximumFractionDigits: 0 })} / person</span>
                  )}
                </div>
              </>
            ) : (
              <span className="price-tbd-badge">Price TBD</span>
            )}
          </div>
        </div>

        {/* Category-Specific Metadata Spec Box */}
        {optCategory === 'accommodation' && (metadata.max_capacity || metadata.beds_summary || metadata.has_kitchen || metadata.check_in_out) && (
          <div className="category-spec-box">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {metadata.max_capacity && (() => {
                const cap = checkAccommodationCapacity(assignedCount, metadata.max_capacity, effectiveCommitted.length)
                if (cap.isOverCapacity) {
                  return (
                    <span className="capacity-gauge-pill gauge-red">
                      ⚠️ Over capacity! ({assignedCount}/{metadata.max_capacity} sleepers)
                    </span>
                  )
                }
                return (
                  <span className="capacity-gauge-pill gauge-green">
                    🛏️ {assignedCount}/{metadata.max_capacity} sleepers ({cap.bedsRemaining} left)
                  </span>
                )
              })()}
              {metadata.has_kitchen && (
                <span className="capacity-gauge-pill" style={{ background: 'rgba(234, 179, 8, 0.15)', color: '#facc15', border: '1px solid rgba(234, 179, 8, 0.3)' }}>
                  🍳 Kitchen available
                </span>
              )}
              {metadata.check_in_out && (
                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                  ⏰ {metadata.check_in_out}
                </span>
              )}
            </div>
            {metadata.beds_summary && (
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                🛏️ {metadata.beds_summary}
              </div>
            )}
            {metadata.max_capacity && (() => {
              const cap = checkAccommodationCapacity(assignedCount, metadata.max_capacity, effectiveCommitted.length)
              if (cap.groupExceedsCapacity) {
                return (
                  <div style={{ fontSize: '0.75rem', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span>⚠️</span> Whole group ({effectiveCommitted.length}) needs {cap.bedsNeededForGroup} more bed{cap.bedsNeededForGroup !== 1 ? 's' : ''}
                  </div>
                )
              }
              return null
            })()}
          </div>
        )}

        {isVehicleCoverage(opt) && (
          <div className="category-spec-box">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span className="capacity-gauge-pill" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
                🚗 Shared Vehicle
              </span>
              {metadata.seats_capacity && (() => {
                const veh = calculateVehicleCostPerPassenger(
                  costDetails?.rawCost || opt.estimated_cost,
                  assignedCount,
                  metadata.seats_capacity,
                  costDetails?.currency || opt.currency || baseCurrency
                )
                if (veh.isOverCapacity) {
                  return (
                    <span className="capacity-gauge-pill gauge-red">
                      🚗 {assignedCount} / {metadata.seats_capacity} seats (Overloaded!)
                    </span>
                  )
                }
                if (veh.isFull) {
                  return (
                    <span className="capacity-gauge-pill gauge-amber">
                      🚗 {assignedCount} / {metadata.seats_capacity} seats filled (Full)
                    </span>
                  )
                }
                return (
                  <span className="capacity-gauge-pill gauge-green">
                    🚗 {assignedCount} / {metadata.seats_capacity} seats filled ({veh.seatsLeft} seat{veh.seatsLeft !== 1 ? 's' : ''} left)
                  </span>
                )
              })()}
              {metadata.driver_user_id && (() => {
                const driverMember = roster.find((m) => String(m.user_id) === String(metadata.driver_user_id) || String(m.users?.id) === String(metadata.driver_user_id) || String(m.id) === String(metadata.driver_user_id))
                const driverName = driverMember?.users?.first_name || driverMember?.username || 'Designated Driver'
                return (
                  <span className="capacity-gauge-pill" style={{ background: 'rgba(96, 165, 250, 0.15)', color: '#93c5fd', border: '1px solid rgba(96, 165, 250, 0.3)' }}>
                    🛞 Driver: {driverName}
                  </span>
                )
              })()}
            </div>
            {metadata.seats_capacity && (costDetails?.rawCost || opt.estimated_cost) && (() => {
              const veh = calculateVehicleCostPerPassenger(
                costDetails?.rawCost || opt.estimated_cost,
                assignedCount,
                metadata.seats_capacity,
                costDetails?.currency || opt.currency || baseCurrency
              )
              return (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-main)', marginTop: '2px' }}>
                  <strong>Cost per passenger: {formatMoney(veh.costPerPassenger, costDetails?.currency || opt.currency || baseCurrency, { maximumFractionDigits: 0 })}</strong>
                  {metadata.seats_capacity > assignedCount && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '6px' }}>
                      (If all {metadata.seats_capacity} seats fill: ~{formatMoney(veh.costIfFull, costDetails?.currency || opt.currency || baseCurrency, { maximumFractionDigits: 0 })} / person)
                    </span>
                  )}
                </div>
              )
            })()}
            {metadata.estimated_fuel_cost && (
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                ⛽ Estimated fuel: ~{metadata.estimated_fuel_cost} {costDetails?.currency || opt.currency || baseCurrency}
              </div>
            )}

            {/* Passenger Assignment Badges */}
            <div style={{ marginTop: '6px', paddingTop: '6px', borderTop: '1px dashed rgba(255, 255, 255, 0.1)' }}>
              <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginBottom: '4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>👥 Passengers in this car ({assignedCount}{metadata.seats_capacity ? `/${metadata.seats_capacity}` : ''}):</span>
                {metadata.seats_capacity && assignedCount >= Number(metadata.seats_capacity) && (
                  <span style={{ fontSize: '0.7rem', color: '#f59e0b', fontWeight: 'bold' }}>Car is full</span>
                )}
              </div>
              {assignedMembers.length > 0 ? (
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                  {assignedMembers.map((m, idx) => (
                    <span
                      key={idx}
                      className="passenger-chip"
                      style={{
                        background: 'rgba(59, 130, 246, 0.15)',
                        border: '1px solid rgba(59, 130, 246, 0.3)',
                        borderRadius: '12px',
                        padding: '2px 8px',
                        fontSize: '0.74rem',
                        color: '#93c5fd',
                        fontWeight: '500',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <span>👤</span> {m.name}
                    </span>
                  ))}
                </div>
              ) : (
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  No passengers assigned yet. Click "+ Join" below to ride in this vehicle.
                </span>
              )}
            </div>
          </div>
        )}

        {!isVehicleCoverage(opt) && (optCategory === 'flights' || optCategory === 'transport') && (
          <div className="category-spec-box">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {metadata.is_legacy_flight && (
                <span className="capacity-gauge-pill" style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
                  ✈️ Flight
                </span>
              )}
              {metadata.route_code && (
                <span className="capacity-gauge-pill" style={{ background: 'rgba(14, 165, 233, 0.15)', color: '#38bdf8', border: '1px solid rgba(14, 165, 233, 0.3)' }}>
                  ✈️ {metadata.route_code}
                </span>
              )}
              {metadata.transit_times && (
                <span className="capacity-gauge-pill" style={{ background: 'rgba(147, 51, 234, 0.15)', color: '#c084fc', border: '1px solid rgba(147, 51, 234, 0.3)' }}>
                  ⏱️ {metadata.transit_times}
                </span>
              )}
              {metadata.baggage_included && (
                <span className="capacity-gauge-pill" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                  🧳 Baggage included
                </span>
              )}
            </div>
            {(costDetails?.rawCost || opt.estimated_cost) && (
              <div style={{ fontSize: '0.8rem', color: 'var(--text-main)', marginTop: '2px' }}>
                <strong>🎟️ {formatMoney(costDetails?.rawCost || opt.estimated_cost, costDetails?.currency || opt.currency || baseCurrency)} / person</strong>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '6px' }}>
                  (Total for {assignedCount} traveler{assignedCount !== 1 ? 's' : ''}: {formatMoney((costDetails?.rawCost || opt.estimated_cost) * assignedCount, costDetails?.currency || opt.currency || baseCurrency)})
                </span>
              </div>
            )}
          </div>
        )}

        {optCategory === 'activities' && (metadata.max_participants || metadata.difficulty_or_duration || metadata.required_gear) && (
          <div className="category-spec-box">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {metadata.max_participants && (() => {
                const act = checkActivitySpots(assignedCount, metadata.max_participants)
                if (act.isOverLimit) {
                  return (
                    <span className="capacity-gauge-pill gauge-red">
                      ⚠️ {assignedCount}/{metadata.max_participants} spots (Over quota!)
                    </span>
                  )
                }
                if (act.isFull) {
                  return (
                    <span className="capacity-gauge-pill gauge-amber">
                      🎯 Full ({assignedCount}/{metadata.max_participants} spots)
                    </span>
                  )
                }
                return (
                  <span className="capacity-gauge-pill gauge-green">
                    🎯 {assignedCount}/{metadata.max_participants} spots ({act.spotsLeft} left)
                  </span>
                )
              })()}
              {metadata.difficulty_or_duration && (
                <span className="capacity-gauge-pill" style={{ background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc', border: '1px solid rgba(168, 85, 247, 0.3)' }}>
                  ⏱️ {metadata.difficulty_or_duration}
                </span>
              )}
            </div>
            {metadata.required_gear && (
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                🎒 Gear needed: <strong style={{ color: 'var(--text-main)' }}>{metadata.required_gear}</strong>
              </div>
            )}
          </div>
        )}

        {optCategory === 'food' && (metadata.meal_mode || metadata.chef_ids?.length > 0 || metadata.cleanup_ids?.length > 0 || metadata.ingredients?.length > 0 || metadata.meal_slot) && (
          <div className="category-spec-box">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {metadata.meal_slot && (
                <span className="capacity-gauge-pill" style={{ background: 'rgba(251, 191, 36, 0.15)', color: '#fbbf24', border: '1px solid rgba(251, 191, 36, 0.3)' }}>
                  {metadata.meal_slot === 'breakfast' && '🌅 Breakfast'}
                  {metadata.meal_slot === 'lunch' && '☀️ Lunch'}
                  {metadata.meal_slot === 'dinner' && '🌙 Dinner'}
                </span>
              )}
              {metadata.meal_mode && (
                <span className="capacity-gauge-pill" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
                  {metadata.meal_mode === 'cook' && '🍳 Home-Cooked'}
                  {metadata.meal_mode === 'restaurant' && '🍽️ Restaurant'}
                  {metadata.meal_mode === 'picnic' && '🥪 Trail Picnic'}
                </span>
              )}
              {Array.isArray(metadata.ingredients) && metadata.ingredients.length > 0 && (
                <span className="capacity-gauge-pill" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                  🛒 {metadata.ingredients.length} ingredients
                </span>
              )}
            </div>

            {/* Kitchen Crew */}
            {(metadata.chef_ids?.length > 0 || metadata.cleanup_ids?.length > 0) && (
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '3px' }}>
                {metadata.chef_ids?.length > 0 && (() => {
                  const chefs = metadata.chef_ids.map((id) => {
                    const m = roster.find((r) => String(r.user_id || r.id) === String(id))
                    return m?.users?.first_name || m?.username || 'Traveler'
                  }).join(', ')
                  return (
                    <span className="duty-badge chef">👨‍🍳 Chefs: {chefs}</span>
                  )
                })()}
                {metadata.cleanup_ids?.length > 0 && (() => {
                  const washers = metadata.cleanup_ids.map((id) => {
                    const m = roster.find((r) => String(r.user_id || r.id) === String(id))
                    return m?.users?.first_name || m?.username || 'Traveler'
                  }).join(', ')
                  return (
                    <span className="duty-badge cleanup">🧽 Cleanup: {washers}</span>
                  )
                })()}
              </div>
            )}

            {/* Dietary Alerts */}
            {(() => {
              const alerts = getMealDietaryAlerts(opt, roster)
              if (alerts.length === 0) return null
              return (
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '3px' }}>
                  {alerts.map((al, idx) => (
                    <span key={idx} className="dietary-warning-pill">{al.label}</span>
                  ))}
                </div>
              )
            })()}
          </div>
        )}

        {/* Description */}
        {opt.description && (
          <p style={{ margin: '0 0 10px 0', fontSize: '0.85rem', color: 'var(--text-muted)', lineBreak: 'anywhere' }}>
            {opt.description}
          </p>
        )}

        {/* External Link */}
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
              marginBottom: '10px'
            }}
          >
            <span>🔗</span> View Pitch Link
          </a>
        )}
      </div>

      {/* Zone 3: Participation & Decision Footer */}
      <div className="option-card-footer">
        {/* Attendance Row */}
        <div className="option-attendance-row">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', minWidth: 0, flex: 1 }}>
            <span className="attendance-label">
              {isVehicleCoverage(opt) ? `Passengers (${assignedCount}):` : `Going (${assignedCount}):`}
            </span>
            {assignedMembers.length > 0 && (
              <div className="voter-avatars-row attendance-avatars" style={{ margin: 0 }}>
                {assignedMembers.slice(0, 5).map((m, i) => (
                  <div
                    key={i}
                    className="voter-avatar-chip"
                    style={{ backgroundColor: getAvatarColor(m.name) }}
                    title={m.name}
                  >
                    {getInitials(m.name)}
                  </div>
                ))}
                {assignedMembers.length > 5 && (
                  <span className="voter-more-chip">+{assignedMembers.length - 5}</span>
                )}
              </div>
            )}
          </div>

          {onToggleParticipant && activeUser && (
            <button
              type="button"
              className={`one-tap-join-btn ${isUserJoined ? 'joined' : 'not-joined'}`}
              onClick={() => onToggleParticipant(opt.id, opt.assigned_users || [], presentTravelerIds)}
              title={isUserJoined ? 'Click to leave this option' : 'Click to join this option'}
            >
              {isUserJoined ? "✓ I'm In" : '+ Join'}
            </button>
          )}
        </div>

        {/* Visual Vote Progress Bar & Voter Avatar Chips */}
        <div className="option-voting-section">
          <div className="option-vote-meta">
            <span className="vote-count-label">
              {votesCount} {votesCount === 1 ? 'vote' : 'votes'} ({votePercent}%)
            </span>
            {voters.length > 0 && (
              <div
                className="voter-avatars-row"
                onClick={onOpenPollRecapModal}
                title="Click to view full voter poll breakdown"
              >
                {voters.slice(0, 4).map((v, i) => (
                  <div
                    key={i}
                    className="voter-avatar-chip"
                    style={{ backgroundColor: getAvatarColor(v.name) }}
                    title={v.name}
                  >
                    {getInitials(v.name)}
                  </div>
                ))}
                {voters.length > 4 && (
                  <span className="voter-more-chip">+{voters.length - 4}</span>
                )}
              </div>
            )}
          </div>

          <div className="vote-progress-track">
            <div
              className="vote-progress-fill"
              style={{
                width: `${votePercent}%`,
                background: hasVoted
                  ? 'linear-gradient(90deg, #10b981, #34d399)'
                  : 'linear-gradient(90deg, var(--primary), var(--primary-light))'
              }}
            />
          </div>
        </div>

        {/* Action Row */}
        <div className="option-action-row" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            onClick={() => onVoteToggle && onVoteToggle(opt.id, hasVoted, opt.category || activeTab)}
            className={`btn ${hasVoted ? 'btn-voted' : 'btn-vote'}`}
            type="button"
            style={{ flex: 1, minHeight: '38px' }}
          >
            {hasVoted ? `✓ Voted (${votesCount}) (${votePercent}%)` : `👍 ${votesCount} Vote${votesCount === 1 ? '' : 's'} (${votePercent}%)`}
          </button>

          <button
            onClick={() => onLockToggle && onLockToggle(opt.id)}
            className={`btn ${isLockedChoice ? 'btn-locked-choice' : 'btn-secondary'}`}
            style={{
              padding: '6px 14px',
              fontSize: '0.85rem',
              minHeight: '38px',
              whiteSpace: 'nowrap'
            }}
            title={isLockedChoice ? 'Unlock this choice' : 'Lock as winning choice'}
            type="button"
          >
            {isLockedChoice ? '🔒 Locked · Undo' : '🔒 Lock'}
          </button>

          {onEditOption && (
            <button
              onClick={() => onEditOption(opt)}
              className="btn btn-secondary"
              style={{
                padding: '6px 12px',
                fontSize: '0.85rem',
                minHeight: '38px',
                whiteSpace: 'nowrap'
              }}
              title="Edit option details, pricing, or dates"
              type="button"
            >
              ✏️ Edit
            </button>
          )}

          {/* Extra tools for flexible or out-of-bounds options */}
          {isConflict && (
            <>
              {onOpenSetDatesModal && (
                <button
                  onClick={() => onOpenSetDatesModal(opt)}
                  className="btn btn-secondary"
                  style={{ padding: '6px 10px', fontSize: '0.8rem', minHeight: '38px' }}
                  title="Fix option dates to fall within the trip"
                  type="button"
                >
                  ✏️ Fix Dates
                </button>
              )}
              {onDeleteOption && (
                confirmingDeleteId === opt.id ? (
                  <div className="inline-delete-confirm" onClick={(e) => e.stopPropagation()}>
                    <span style={{ fontSize: '0.8rem', color: '#fca5a5', fontWeight: '600' }}>Delete?</span>
                    <button
                      type="button"
                      className="btn btn-danger"
                      style={{ padding: '4px 8px', fontSize: '0.8rem', minHeight: '38px' }}
                      onClick={() => {
                        if (setConfirmingDeleteId) setConfirmingDeleteId(null)
                        onDeleteOption(opt)
                      }}
                    >
                      Yes, Delete
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ padding: '4px 8px', fontSize: '0.8rem', minHeight: '38px' }}
                      onClick={() => setConfirmingDeleteId && setConfirmingDeleteId(null)}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmingDeleteId && setConfirmingDeleteId(opt.id)}
                    className="btn btn-secondary btn-danger-soft"
                    style={{ padding: '6px 10px', fontSize: '0.8rem', minHeight: '38px' }}
                    title="Delete this out-of-bounds option"
                    type="button"
                  >
                    🗑️ Delete
                  </button>
                )
              )}
            </>
          )}

          {!isConflict && !opt.start_date && !opt.end_date && onOpenSetDatesModal && (
            <button
              onClick={() => onOpenSetDatesModal(opt)}
              className="btn btn-secondary"
              style={{ padding: '6px 10px', fontSize: '0.8rem', minHeight: '38px' }}
              title="Set scheduled dates for this option"
              type="button"
            >
              📅 Set Dates
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
