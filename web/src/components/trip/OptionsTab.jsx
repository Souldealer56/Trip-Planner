import React, { useState, useMemo } from 'react'
import { GanttTimeline } from '../GanttTimeline'
import { formatDateTimeRange, formatDateRange } from '../../utils/format'
import { checkOptionDateConflict, isOptionLocked, calculateVehicleCostPerPassenger, checkAccommodationCapacity, checkActivitySpots } from '../../services/options'
import { getPresentTravelers } from '../../services/rsvps'
import { convertCurrency, calculateOptionCostBreakdown } from '../../utils/currency'
import { MealPlannerMatrix } from './MealPlannerMatrix'
import { GroceryListPanel } from './GroceryListPanel'
import { fetchGroceryItems, getMealDietaryAlerts } from '../../services/groceries'

// Helper to extract initials from user name
function getInitials(name) {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }
  return name.slice(0, 2).toUpperCase()
}

// Helper to generate consistent avatar background colors
function getAvatarColor(nameOrId) {
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

// Compact modal for setting or fixing option dates
function SetOptionDatesModal({ isOpen, onClose, option, trip, onSave }) {
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  React.useEffect(() => {
    if (option) {
      setError('')
      const defaultStart = option.start_date
        ? option.start_date.slice(0, 16)
        : trip?.start_date
        ? `${trip.start_date}T15:00`
        : ''
      const defaultEnd = option.end_date
        ? option.end_date.slice(0, 16)
        : trip?.end_date
        ? `${trip.end_date}T11:00`
        : ''
      setStartDate(defaultStart)
      setEndDate(defaultEnd)
    }
  }, [option, trip])

  if (!isOpen || !option) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      if (startDate && endDate && new Date(endDate) < new Date(startDate)) {
        throw new Error('End date cannot be earlier than start date.')
      }
      await onSave(option.id, startDate, endDate)
      onClose()
    } catch (err) {
      setError(err.message || 'Failed to update dates.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content glass-card animate-fade-in" style={{ maxWidth: '420px' }} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ color: 'var(--primary-light)', marginBottom: '0.5rem' }}>
          {option.start_date || option.end_date ? '✏️ Fix Option Dates' : '📅 Set Option Dates'}
        </h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
          Set the date schedule for <strong>{option.option_text}</strong>.
          {trip?.start_date && trip?.end_date && (
            <span style={{ display: 'block', marginTop: '6px', color: '#60a5fa', fontWeight: '500' }}>
              Trip dates: {trip.start_date} to {trip.end_date}
            </span>
          )}
        </p>

        {error && (
          <p style={{ color: 'hsl(0, 85%, 65%)', fontSize: '0.85rem', marginBottom: '1rem' }}>
            {error}
          </p>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
              Start Date & Time
            </label>
            <input
              type="datetime-local"
              className="input-field"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
          </div>
          <div>
            <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
              End Date & Time
            </label>
            <input
              type="datetime-local"
              className="input-field"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              required
            />
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
            <button type="button" onClick={onClose} className="btn btn-secondary" disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn" disabled={saving}>
              {saving ? 'Saving...' : 'Save Dates'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

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
  rates = null,
  onVoteToggle,
  onLockToggle,
  onDeleteOption,
  onUpdateOptionDates,
  onOpenPitchModal,
  onOpenPollRecapModal,
  onOpenExpenseModal,
  onRefresh,
  onToggleParticipant,
  onLogExpense,
  onSubmitMeal
}) {
  // Filter & Sort State
  const [filterState, setFilterState] = useState('all') // 'all' | 'locked' | 'top_voted'
  const [sortOrder, setSortOrder] = useState('recommended') // 'recommended' | 'chronological' | 'price_asc'
  const [outsideCollapsed, setOutsideCollapsed] = useState(true)
  const [dateModalOption, setDateModalOption] = useState(null)

  // Food Intendance & Grocery State
  const [foodViewMode, setFoodViewMode] = useState('matrix') // 'matrix' | 'cards'
  const [isGroceryPanelOpen, setIsGroceryPanelOpen] = useState(false)
  const [groceryItems, setGroceryItems] = useState([])

  const loadGroceries = React.useCallback(async () => {
    if (trip?.id) {
      try {
        const items = await fetchGroceryItems(trip.id)
        setGroceryItems(items || [])
      } catch (err) {
        console.warn('Failed to load grocery items in OptionsTab:', err)
      }
    }
  }, [trip?.id])

  React.useEffect(() => {
    loadGroceries()
  }, [loadGroceries])

  const uncheckedGroceryCount = useMemo(
    () => groceryItems.filter((i) => !i.is_checked).length,
    [groceryItems]
  )

  const baseCurrency = trip?.base_currency || 'USD'
  const committedMembers = useMemo(() => roster.filter((m) => m.status === 'Committed'), [roster])
  const committedCount = committedMembers.length > 0 ? committedMembers.length : (roster.length > 0 ? roster.length : 1)

  // Derive effective category options from single source of truth (allTripOptions)
  const effectiveOptions = useMemo(() => {
    if (allTripOptions && allTripOptions.length > 0) {
      const filtered = allTripOptions.filter(
        (opt) => opt.category?.trim().toLowerCase() === activeTab.trim().toLowerCase()
      )
      if (filtered.length > 0 || !options || options.length === 0) {
        return filtered
      }
    }
    return options || []
  }, [allTripOptions, activeTab, options])

  // Count pitched options per category for badge display
  const categoryCounts = useMemo(() => {
    const counts = {}
    categories.forEach((cat) => {
      counts[cat] = 0
    })
    const source = (allTripOptions && allTripOptions.length > 0) ? allTripOptions : (options || [])
    source.forEach((opt) => {
      const optCat = (opt.category || '').trim().toLowerCase()
      const matched = categories.find((c) => c.toLowerCase() === optCat)
      if (matched) {
        counts[matched] = (counts[matched] || 0) + 1
      }
    })
    return counts
  }, [categories, allTripOptions, options])

  // Duplicate expense detection
  const isOptionLogged = (option) => {
    if (!expenses || !option) return false
    const optIdStr = String(option.id)
    const optionTitle = (option.option_text || option.text || '').toLowerCase().trim()
    return expenses.some((e) => {
      if (e.option_id && String(e.option_id) === optIdStr) return true
      const desc = (e.description || '').toLowerCase()
      if (!optionTitle) return false
      const strippedDesc = desc.replace(/\[.*?\]\s*/g, '').trim()
      return (
        strippedDesc === optionTitle ||
        desc.includes(optionTitle) ||
        (desc.includes('[locked option]') && desc.includes(optionTitle)) ||
        (desc.includes(`[${(option.category || '').toLowerCase()}]`) && desc.includes(optionTitle))
      )
    })
  }

  // Cost and currency conversion calculations using Smart Pricing breakdown
  const getCostDetails = (opt) => {
    if (!opt || !opt.estimated_cost || isNaN(Number(opt.estimated_cost)) || Number(opt.estimated_cost) <= 0) return null
    const rawCost = Number(opt.estimated_cost)
    const optCurr = (opt.currency || baseCurrency).toUpperCase()
    const tripBaseCurr = (baseCurrency || 'USD').toUpperCase()
    const isDiff = optCurr !== tripBaseCurr
    const breakdown = calculateOptionCostBreakdown(opt, committedMembers, rates, tripBaseCurr)

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
  }

  const formatMoney = (val, curr) => {
    if (val === undefined || val === null || isNaN(val)) return `0 ${curr}`
    return `${Math.round(val).toLocaleString('en-US')} ${curr}`
  }

  // Voter mapping and tallies
  const currentCategoryPoll = useMemo(() => {
    const cat = (activeTab || '').toLowerCase()
    if (activePoll && (!activePoll.category || activePoll.category.toLowerCase() === cat)) {
      return activePoll
    }
    return allActivePollsMap?.[cat] || activePoll || null
  }, [activePoll, allActivePollsMap, activeTab])

  const voterSelections = currentCategoryPoll?.voter_selections || {}
  const votesByOpt = currentCategoryPoll?.votes_by_option || {}

  const getVotersForOption = (optionId, poll = currentCategoryPoll) => {
    const optIdStr = String(optionId)
    const selections = poll?.voter_selections || {}
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
  }

  // Sorting function
  const sortOptionList = (list) => {
    return [...list].sort((a, b) => {
      if (sortOrder === 'price_asc') {
        const rawCostA = getCostDetails(a)?.converted
        const costA = (rawCostA !== undefined && rawCostA !== null && !isNaN(rawCostA))
          ? rawCostA
          : (a.estimated_cost === 0 ? 0 : Infinity)
        const rawCostB = getCostDetails(b)?.converted
        const costB = (rawCostB !== undefined && rawCostB !== null && !isNaN(rawCostB))
          ? rawCostB
          : (b.estimated_cost === 0 ? 0 : Infinity)
        if (costA !== costB) return costA - costB
        return (Number(a.id) || 0) - (Number(b.id) || 0)
      }
      if (sortOrder === 'chronological') {
        const dateA = a.start_date ? new Date(a.start_date).getTime() : Infinity
        const dateB = b.start_date ? new Date(b.start_date).getTime() : Infinity
        if (dateA !== dateB) return dateA - dateB
        return (Number(a.id) || 0) - (Number(b.id) || 0)
      }
      // 'recommended': Locked first, then votes descending, then ID
      const isLockedA = isOptionLocked(a, activePoll) ? 1 : 0
      const isLockedB = isOptionLocked(b, activePoll) ? 1 : 0
      if (isLockedB !== isLockedA) return isLockedB - isLockedA

      const votesA = votesByOpt[a.id] !== undefined ? votesByOpt[a.id] : getVotersForOption(a.id).length
      const votesB = votesByOpt[b.id] !== undefined ? votesByOpt[b.id] : getVotersForOption(b.id).length
      if (votesB !== votesA) return votesB - votesA

      return (Number(a.id) || 0) - (Number(b.id) || 0)
    })
  }

  // Partition options for active category into the 4 structured visual sections
  const { lockedSection, scheduledGroups, flexibleSection, outsideSection, topVotedList } = useMemo(() => {
    const locked = []
    const scheduled = []
    const flexible = []
    const outside = []
    const topVoted = []

    effectiveOptions.forEach((opt) => {
      const isLocked = isOptionLocked(opt, activePoll)
      const isConflict = checkOptionDateConflict(opt, trip?.start_date, trip?.end_date)
      const optVotes = votesByOpt[opt.id] !== undefined ? votesByOpt[opt.id] : (activePoll?.voter_selections ? Object.values(activePoll.voter_selections).filter(arr => Array.isArray(arr) && arr.map(String).includes(String(opt.id))).length : 0)

      if (optVotes > 0) {
        topVoted.push(opt)
      }

      if (isLocked) {
        locked.push(opt)
      } else if (isConflict) {
        outside.push(opt)
      } else if (opt.start_date || opt.end_date) {
        scheduled.push(opt)
      } else {
        flexible.push(opt)
      }
    })

    // Group scheduled proposals by exact date range
    const groupsMap = {}
    scheduled.forEach((opt) => {
      const sKey = opt.start_date ? opt.start_date.slice(0, 10) : 'TBD'
      const eKey = opt.end_date ? opt.end_date.slice(0, 10) : 'TBD'
      const groupKey = `${sKey}_${eKey}`

      if (!groupsMap[groupKey]) {
        let label = 'Scheduled Window'
        if (opt.start_date && opt.end_date) {
          label = formatDateRange(opt.start_date, opt.end_date)
        } else if (opt.start_date) {
          label = `Starts ${new Date(opt.start_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`
        } else if (opt.end_date) {
          label = `Until ${new Date(opt.end_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`
        }

        groupsMap[groupKey] = {
          key: groupKey,
          label,
          startDate: opt.start_date || '9999',
          options: []
        }
      }
      groupsMap[groupKey].options.push(opt)
    })

    const sortedGroups = Object.values(groupsMap).sort((a, b) => {
      return new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
    })

    return {
      lockedSection: locked,
      scheduledGroups: sortedGroups,
      flexibleSection: flexible,
      outsideSection: outside,
      topVotedList: topVoted
    }
  }, [effectiveOptions, activePoll, trip, votesByOpt])

  const handleDelete = async (opt) => {
    if (!onDeleteOption) return
    const confirmed = window.confirm(`Are you sure you want to delete "${opt.option_text}"?`)
    if (confirmed) {
      await onDeleteOption(opt.id)
    }
  }

  // Render individual option card
  const renderOptionCard = (opt, isSectionLocked = false) => {
    const optCategory = (opt.category || activeTab || '').toLowerCase()
    const optPoll = (allActivePollsMap && allActivePollsMap[optCategory]) || currentCategoryPoll
    const optIdStr = String(opt.id)
    const voters = getVotersForOption(opt.id, optPoll)
    const pollVotes = optPoll?.votes_by_option || {}
    const votesCount = pollVotes[opt.id] !== undefined
      ? pollVotes[opt.id]
      : (pollVotes[optIdStr] !== undefined ? pollVotes[optIdStr] : voters.length)
    const userVotes = (
      optPoll?.voter_selections?.[String(activeUser?.id)] ||
      optPoll?.voter_selections?.[activeUser?.id] ||
      []
    )
    const hasVoted = Array.isArray(userVotes) && userVotes.map(String).includes(optIdStr)
    const isLockedChoice = isSectionLocked || isOptionLocked(opt, optPoll)
    const isConflict = checkOptionDateConflict(opt, trip?.start_date, trip?.end_date)
    const isLogged = isOptionLogged(opt)
    const costDetails = getCostDetails(opt)

    const votePercent = Math.min(100, Math.round((votesCount / Math.max(1, committedCount)) * 100))

    const metadata = opt.metadata || {}

    const presentTravelers = getPresentTravelers(committedMembers, opt.start_date, opt.end_date)
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

    // Determine capacity if applicable
    let capacity = null
    if (optCategory === 'accommodation' && metadata.max_capacity) {
      capacity = Number(metadata.max_capacity)
    } else if ((optCategory === 'transport' || optCategory === 'flights') && metadata.transport_mode !== 'ticket' && metadata.seats_capacity) {
      capacity = Number(metadata.seats_capacity)
    } else if (optCategory === 'activities' && metadata.max_participants) {
      capacity = Number(metadata.max_participants)
    }

    return (
      <div
        key={opt.id}
        className={`option-card ${isLockedChoice ? 'locked-card' : ''} ${hasVoted ? 'voted' : ''}`}
        style={{
          border: isLockedChoice
            ? '1px solid rgba(16, 185, 129, 0.5)'
            : isConflict
            ? '1px solid rgba(245, 158, 11, 0.35)'
            : hasVoted
            ? '1px solid var(--accent)'
            : '1px solid var(--border-light)',
          background: isLockedChoice
            ? 'rgba(16, 185, 129, 0.04)'
            : 'rgba(255, 255, 255, 0.02)'
        }}
      >
        <div>
          {/* Card Title & Top Badges */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '8px' }}>
            <h4 style={{ margin: 0, fontSize: '1.15rem', color: isLockedChoice ? '#10b981' : 'var(--text-main)', lineHeight: 1.25 }}>
              {opt.option_text}
            </h4>
            {isLockedChoice && (
              <span
                style={{
                  background: 'rgba(16, 185, 129, 0.15)',
                  color: '#10b981',
                  border: '1px solid rgba(16, 185, 129, 0.4)',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  fontSize: '0.75rem',
                  fontWeight: '700',
                  whiteSpace: 'nowrap',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                🔒 Locked Choice
              </span>
            )}
          </div>

          {/* Badges Bar: Logged in Ledger vs Log as Expense */}
          {(isLockedChoice || isLogged) && (
            <div style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {isLogged ? (
                <span className="badge-logged-expense">
                  ✓ Logged in Expenses
                </span>
              ) : (
                <button
                  onClick={() => onOpenExpenseModal({ ...opt, category: opt.category || activeTab || 'Accommodation' })}
                  className="btn btn-secondary log-expense-btn"
                  title="Convert locked option directly into a shared expense"
                  type="button"
                >
                  💸 Log as Expense
                </button>
              )}
            </div>
          )}

          {/* Out of bounds badge */}
          {isConflict && (
            <div style={{ marginBottom: '8px' }}>
              <span
                style={{
                  background: 'rgba(245, 158, 11, 0.15)',
                  color: '#f59e0b',
                  border: '1px solid rgba(245, 158, 11, 0.35)',
                  padding: '2px 8px',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  fontWeight: '600',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                ⚠️ Outside Trip Dates
              </span>
            </div>
          )}

          {/* Dates Display */}
          {(opt.start_date || opt.end_date) ? (
            <div
              style={{
                fontSize: '0.85rem',
                color: '#60a5fa',
                fontWeight: '600',
                marginBottom: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <span>📅</span>
              <span>{formatDateTimeRange(opt.start_date, opt.end_date)}</span>
            </div>
          ) : (
            <div
              style={{
                fontSize: '0.8rem',
                color: 'var(--text-muted)',
                marginBottom: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <span>📌</span>
              <span>Flexible / Dates TBD</span>
              <button
                type="button"
                onClick={() => setDateModalOption(opt)}
                style={{
                  background: 'transparent',
                  border: '1px dashed var(--border-light)',
                  color: 'var(--primary-light)',
                  borderRadius: '6px',
                  padding: '1px 6px',
                  fontSize: '0.75rem',
                  cursor: 'pointer'
                }}
              >
                + Set Dates
              </button>
            </div>
          )}

          {/* Category-Specific Metadata Spec Box */}
          {optCategory === 'accommodation' && (metadata.max_capacity || metadata.beds_summary || metadata.has_kitchen || metadata.check_in_out) && (
            <div className="category-spec-box">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                {metadata.max_capacity && (() => {
                  const cap = checkAccommodationCapacity(assignedCount, metadata.max_capacity, committedMembers.length)
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
                const cap = checkAccommodationCapacity(assignedCount, metadata.max_capacity, committedMembers.length)
                if (cap.groupExceedsCapacity) {
                  return (
                    <div style={{ fontSize: '0.75rem', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span>⚠️</span> Whole group ({committedMembers.length}) needs {cap.bedsNeededForGroup} more bed{cap.bedsNeededForGroup !== 1 ? 's' : ''}
                    </div>
                  )
                }
                return null
              })()}
            </div>
          )}

          {((optCategory === 'transport' && metadata.transport_mode !== 'ticket') || (optCategory === 'transport' && !metadata.transport_mode && metadata.seats_capacity)) && (
            <div className="category-spec-box">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
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
                    <strong>Cost per passenger: {formatMoney(veh.costPerPassenger, costDetails?.currency || opt.currency || baseCurrency)}</strong>
                    {metadata.seats_capacity > assignedCount && (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '6px' }}>
                        (If all {metadata.seats_capacity} seats fill: ~{formatMoney(veh.costIfFull, costDetails?.currency || opt.currency || baseCurrency)} / person)
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
            </div>
          )}

          {(optCategory === 'flights' || (optCategory === 'transport' && metadata.transport_mode === 'ticket')) && (
            <div className="category-spec-box">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                {metadata.route_code && (
                  <span className="capacity-gauge-pill" style={{ background: 'rgba(14, 165, 233, 0.15)', color: '#38bdf8', border: '1px solid rgba(14, 165, 233, 0.3)' }}>
                    ✈️ {metadata.route_code}
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

          {/* Dual Currency and Per-Person Cost Display */}
          {costDetails && (
            <div className="option-cost-container">
              <div className="option-total-cost">
                <span className="cost-main">
                  {formatMoney(costDetails.rawCost, costDetails.currency)}
                </span>
                {costDetails.isDiff && rates && (
                  <span className="cost-converted">
                    (≈ {formatMoney(costDetails.converted, costDetails.baseCurrency)})
                  </span>
                )}
                <span className="option-per-person">
                  {costDetails.costType === 'per_person' && (
                    <span title="Priced per ticket/person">🎟️ {formatMoney(costDetails.rawCost, costDetails.currency)} / person</span>
                  )}
                  {costDetails.costType === 'per_night' && (
                    <span title="Priced per night and prorated by stay dates">🌙 ~{formatMoney(costDetails.perPerson, costDetails.baseCurrency)} / person</span>
                  )}
                  {(!costDetails.costType || costDetails.costType === 'split_total') && (
                    <span>~{formatMoney(costDetails.perPerson, costDetails.baseCurrency)} / person</span>
                  )}
                </span>
              </div>
            </div>
          )}

          {/* Interactive Participant Bar on Every Card */}
          <div className="participant-bar-row">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', minWidth: 0, flex: 1 }}>
              <span style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-muted)' }}>
                👥 {assignedCount} traveler{assignedCount !== 1 ? 's' : ''}
              </span>
              {assignedMembers.length > 0 && (
                <div className="voter-avatars-row" style={{ margin: 0 }}>
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
                {isUserJoined ? '✓ Joined (Leave)' : `✋ Join (${assignedCount}${capacity ? '/' + capacity : ''})`}
              </button>
            )}
          </div>

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
        </div>

        {/* Card Footer Actions */}
        <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
          <button
            onClick={() => onVoteToggle(opt.id, hasVoted, opt.category || activeTab)}
            className={`btn ${hasVoted ? 'btn-voted' : 'btn-vote'}`}
            type="button"
            style={{ flex: 1, minHeight: '38px' }}
          >
            {hasVoted ? `✓ Voted (${votesCount})` : `👍 Vote (${votesCount})`}
          </button>

          <button
            onClick={() => onLockToggle(opt.id)}
            className="btn btn-secondary"
            style={{
              padding: '6px 12px',
              fontSize: '0.85rem',
              borderColor: isLockedChoice ? '#10b981' : 'var(--border-light)',
              color: isLockedChoice ? '#10b981' : 'var(--text-muted)',
              minHeight: '38px'
            }}
            title={isLockedChoice ? 'Unlock this choice' : 'Lock as winning choice'}
            type="button"
          >
            {isLockedChoice ? '🏆 Locked' : '🔒 Lock'}
          </button>

          {/* Extra tools for flexible or out-of-bounds options */}
          {isConflict && (
            <>
              <button
                onClick={() => setDateModalOption(opt)}
                className="btn btn-secondary"
                style={{ padding: '6px 10px', fontSize: '0.8rem', minHeight: '38px' }}
                title="Fix option dates to fall within the trip"
                type="button"
              >
                ✏️ Fix Dates
              </button>
              <button
                onClick={() => handleDelete(opt)}
                className="btn btn-secondary btn-danger-soft"
                style={{ padding: '6px 10px', fontSize: '0.8rem', minHeight: '38px' }}
                title="Delete this out-of-bounds option"
                type="button"
              >
                🗑️ Delete
              </button>
            </>
          )}

          {!isConflict && !opt.start_date && !opt.end_date && (
            <button
              onClick={() => setDateModalOption(opt)}
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
    )
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
          onOptionClick={(opt) => setDateModalOption(opt)}
          onPitchForSlot={(dayDate, category) => {
            const dateToUse = dayDate || (trip?.start_date ? new Date(trip.start_date) : new Date())
            const dStr = dateToUse instanceof Date ? dateToUse.toISOString().slice(0, 10) : String(dateToUse).slice(0, 10)
            const nextDay = new Date(dateToUse)
            nextDay.setDate(nextDay.getDate() + 1)
            const nextDStr = nextDay.toISOString().slice(0, 10)
            onOpenPitchModal(category || activeTab, `${dStr}T16:00`, `${nextDStr}T11:00`)
          }}
        />
      ) : (
        <>
          {/* Horizontal Category Tabs */}
          <div
            className="tabs-container"
            style={{
              display: 'flex',
              gap: '8px',
              overflowX: 'auto',
              marginBottom: '1.25rem',
              paddingBottom: '4px'
            }}
          >
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => onTabChange(cat)}
                className={`tab-btn ${activeTab === cat ? 'active' : ''}`}
              >
                {cat} ({categoryCounts[cat] || 0})
              </button>
            ))}
          </div>

          {/* Food Category Sub-Bar: Matrix vs Cards Toggle + Grocery List Button */}
          {activeTab === 'Food' && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '8px',
                marginBottom: '1.25rem',
                padding: '0.6rem 0.85rem',
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid var(--border-light)',
                borderRadius: '10px'
              }}
            >
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className={`filter-pill ${foodViewMode === 'matrix' ? 'active' : ''}`}
                  onClick={() => setFoodViewMode('matrix')}
                >
                  📅 Daily Meal Matrix (Recommended)
                </button>
                <button
                  type="button"
                  className={`filter-pill ${foodViewMode === 'cards' ? 'active' : ''}`}
                  onClick={() => setFoodViewMode('cards')}
                >
                  🃏 All Food Cards
                </button>
              </div>

              <button
                type="button"
                className="btn btn-secondary grocery-btn-accent"
                onClick={() => setIsGroceryPanelOpen(true)}
              >
                <span>🛒 Grocery List</span>
                {uncheckedGroceryCount > 0 && (
                  <span className="grocery-cart-badge">{uncheckedGroceryCount}</span>
                )}
              </button>
            </div>
          )}

          {activeTab === 'Food' && foodViewMode === 'matrix' ? (
            <MealPlannerMatrix
              trip={trip}
              roster={roster}
              activeUser={activeUser}
              foodOptions={effectiveOptions}
              activePoll={currentCategoryPoll}
              onOpenPitchModal={onOpenPitchModal}
              onVoteToggle={onVoteToggle}
              onLockToggle={onLockToggle}
              onDeleteOption={onDeleteOption}
              onToggleParticipant={onToggleParticipant}
              onOpenGroceryList={() => setIsGroceryPanelOpen(true)}
              uncheckedGroceryCount={uncheckedGroceryCount}
              onSubmitMeal={onSubmitMeal}
            />
          ) : (
            <>
              {/* Quick Filter & Sort Toolbar */}
              <div className="options-filter-toolbar">
            <div className="filter-pills-group">
              <button
                type="button"
                className={`filter-pill ${filterState === 'all' ? 'active' : ''}`}
                onClick={() => setFilterState('all')}
              >
                All ({effectiveOptions.length})
              </button>
              <button
                type="button"
                className={`filter-pill ${filterState === 'locked' ? 'active' : ''}`}
                onClick={() => setFilterState('locked')}
              >
                🔒 Locked ({lockedSection.length})
              </button>
              <button
                type="button"
                className={`filter-pill ${filterState === 'top_voted' ? 'active' : ''}`}
                onClick={() => setFilterState('top_voted')}
              >
                🔥 Top Voted
              </button>
            </div>

            <div className="sort-group">
              <label htmlFor="options-sort-select" className="sort-label">Sort by:</label>
              <select
                id="options-sort-select"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                className="select-field sort-select"
              >
                <option value="recommended">Recommended (Locked & Most Votes)</option>
                <option value="chronological">Chronological (Start Date)</option>
                <option value="price_asc">Price: Low to High</option>
              </select>
            </div>
          </div>

          {/* Options Display */}
          {optionsLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1rem' }}>
              <div className="skeleton skeleton-title" style={{ width: '40%' }} />
              <div className="skeleton skeleton-text" style={{ width: '80%' }} />
              <div className="skeleton skeleton-text" style={{ width: '60%' }} />
            </div>
          ) : effectiveOptions.length === 0 ? (
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
            <div className="options-workspace-flow">
              {/* Filter State: Locked View Only */}
              {filterState === 'locked' && (
                <div className="option-section-container">
                  <h3 className="option-section-title text-emerald">
                    🔒 Locked into Itinerary ({lockedSection.length})
                  </h3>
                  {lockedSection.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No choices locked in this category yet.</p>
                  ) : (
                    <div className="options-grid">
                      {sortOptionList(lockedSection).map((opt) => renderOptionCard(opt, true))}
                    </div>
                  )}
                </div>
              )}

              {/* Filter State: Top Voted View Only */}
              {filterState === 'top_voted' && (
                <div className="option-section-container">
                  <h3 className="option-section-title">
                    🔥 Top Voted Proposals ({topVotedList.length})
                  </h3>
                  {topVotedList.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No options have received votes yet.</p>
                  ) : (
                    <div className="options-grid">
                      {sortOptionList(topVotedList).map((opt) => renderOptionCard(opt))}
                    </div>
                  )}
                </div>
              )}

              {/* Filter State: All Sections Visual Flow */}
              {filterState === 'all' && (
                <>
                  {/* Section 1: Locked into Itinerary (Pinned at the Top) */}
                  {lockedSection.length > 0 && (
                    <div className="option-section-container locked-section">
                      <h3 className="option-section-title text-emerald">
                        🔒 Locked into Itinerary ({lockedSection.length})
                      </h3>
                      <div className="options-grid">
                        {sortOptionList(lockedSection).map((opt) => renderOptionCard(opt, true))}
                      </div>
                    </div>
                  )}

                  {/* Section 2: Scheduled Proposals (Grouped by Date Window) */}
                  {scheduledGroups.length > 0 && (
                    <div className="option-section-container">
                      <h3 className="option-section-title">
                        📅 Scheduled Proposals (Grouped by Date Window)
                      </h3>
                      {scheduledGroups.map((group) => (
                        <div key={group.key} className="date-window-block">
                          <div className="date-window-header">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                              <span>📅</span>
                              <strong style={{ fontSize: '0.95rem', color: 'var(--text-main)' }}>{group.label}</strong>
                              <span className="date-window-badge">
                                {group.options.length} {group.options.length === 1 ? 'proposal' : 'competing proposals'}
                              </span>
                            </div>
                          </div>
                          <div className="options-grid">
                            {sortOptionList(group.options).map((opt) => renderOptionCard(opt))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Section 3: Flexible / Dates TBD */}
                  {flexibleSection.length > 0 && (
                    <div className="option-section-container">
                      <h3 className="option-section-title">
                        📌 Flexible / Dates TBD ({flexibleSection.length})
                      </h3>
                      <div className="options-grid">
                        {sortOptionList(flexibleSection).map((opt) => renderOptionCard(opt))}
                      </div>
                    </div>
                  )}

                  {/* Section 4: Outside Trip Dates (Collapsible) */}
                  {outsideSection.length > 0 && (
                    <div className="option-section-container outside-dates-section">
                      <div className="outside-dates-header" onClick={() => setOutsideCollapsed(!outsideCollapsed)}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span>⚠️</span>
                          <strong>Outside Trip Dates ({outsideSection.length})</strong>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            Falls outside trip boundaries ({trip?.start_date} – {trip?.end_date})
                          </span>
                        </div>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ padding: '2px 8px', fontSize: '0.75rem' }}
                        >
                          {outsideCollapsed ? 'Show Options' : 'Hide Options'}
                        </button>
                      </div>

                      {!outsideCollapsed && (
                        <div className="options-grid" style={{ marginTop: '1rem' }}>
                          {sortOptionList(outsideSection).map((opt) => renderOptionCard(opt))}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </>
      )}
    </>
  )}

      {/* Set / Fix Option Dates Modal */}
      <SetOptionDatesModal
        isOpen={Boolean(dateModalOption)}
        onClose={() => setDateModalOption(null)}
        option={dateModalOption}
        trip={trip}
        onSave={onUpdateOptionDates}
      />

      {/* Smart Grocery List Slide-Over Panel */}
      {isGroceryPanelOpen && (
        <GroceryListPanel
          tripId={trip?.id}
          trip={trip}
          roster={roster}
          activeUser={activeUser}
          foodOptions={allTripOptions.length > 0 ? allTripOptions : options}
          onClose={() => {
            setIsGroceryPanelOpen(false)
            loadGroceries()
          }}
          onLogExpense={onLogExpense}
        />
      )}
    </div>
  )
}
