import React, { useState, useMemo, useCallback } from 'react'
import { GanttTimeline } from '../GanttTimeline'
import { formatDateTimeRange, formatDateRange, formatMoney } from '../../utils/format'
import { checkOptionDateConflict, isOptionLocked } from '../../services/options'
import { calculateOptionCostBreakdown } from '../../utils/currency'
import { OptionCard } from '../OptionCard'
import { MealPlanSection } from './MealPlanSection'
import { GroceryListPanel } from './GroceryListPanel'
import { fetchGroceryItems } from '../../services/groceries'
import { TripDateTimeSelector } from './TripDateTimeSelector'

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
      <div className="modal-content glass-card animate-fade-in" style={{ maxWidth: '520px' }} onClick={(e) => e.stopPropagation()}>
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
          <TripDateTimeSelector
            trip={trip}
            startDate={startDate}
            endDate={endDate}
            onChange={({ startDate: s, endDate: e }) => {
              setStartDate(s)
              setEndDate(e)
            }}
            category={option?.category}
            required
            showTripRangeBanner={false}
          />
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
  categories = ['Accommodation', 'Transport', 'Activities', 'Food', 'Other'],
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
  onEditOption,
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
  const [confirmingDeleteId, setConfirmingDeleteId] = useState(null)

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
    const activeTabLower = (activeTab || '').trim().toLowerCase()
    if (allTripOptions && allTripOptions.length > 0) {
      const filtered = allTripOptions.filter((opt) => {
        const optCat = (opt.category || '').trim().toLowerCase()
        if (activeTabLower === 'transport') {
          return optCat === 'transport' || optCat === 'flights' || optCat === 'flight'
        }
        return optCat === activeTabLower
      })
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
      let optCat = (opt.category || '').trim().toLowerCase()
      if (optCat === 'flights' || optCat === 'flight') {
        optCat = 'transport'
      }
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

  // Resolve reactive poll for any category (ensuring activePoll and allActivePollsMap stay in sync)
  const getPollForCategory = useCallback((category) => {
    const cat = (category || activeTab || '').toLowerCase()
    const activeTabLower = (activeTab || '').toLowerCase()
    if (cat === activeTabLower && activePoll && (!activePoll.category || activePoll.category.toLowerCase() === activeTabLower)) {
      return activePoll
    }
    if (allActivePollsMap && allActivePollsMap[cat]) {
      return allActivePollsMap[cat]
    }
    return currentCategoryPoll || activePoll || null
  }, [activePoll, allActivePollsMap, activeTab, currentCategoryPoll])

  // Uniform option vote count calculation across all viewports
  const getOptionVoteCount = useCallback((opt) => {
    if (!opt) return 0
    const cat = (opt.category || activeTab || '').toLowerCase()
    const poll = getPollForCategory(cat)
    const optIdStr = String(opt.id)
    const voters = getVotersForOption(opt.id, poll)
    const pollVotes = poll?.votes_by_option || {}
    const selections = poll?.voter_selections || {}
    const userVotes = selections[String(activeUser?.id)] || selections[activeUser?.id] || []
    const hasVoted = Array.isArray(userVotes) && userVotes.map(String).includes(optIdStr)
    const recordedVotes = pollVotes[opt.id] !== undefined
      ? Number(pollVotes[opt.id])
      : (pollVotes[optIdStr] !== undefined ? Number(pollVotes[optIdStr]) : undefined)
    return Math.max(
      recordedVotes !== undefined && !isNaN(recordedVotes) ? recordedVotes : 0,
      voters.length,
      hasVoted ? 1 : 0
    )
  }, [activeTab, activeUser, getPollForCategory, getVotersForOption])

  // Category pill label helper with icon
  const getCategoryLabelWithIcon = (cat) => {
    const raw = (cat || activeTab || 'Other').trim().toLowerCase()
    if (raw === 'accommodation') return '🏠 Accommodation'
    if (raw === 'transport') return '🚗 Transport'
    if (raw === 'flights' || raw === 'flight') return '✈️ Flight'
    if (raw === 'activities') return '🎟️ Activity'
    if (raw === 'food') return '🍴 Food'
    return `✨ ${cat || 'Other'}`
  }

  // Duration or date range formatting helper
  const formatCardDurationOrDates = (opt, isInsideDateGroup) => {
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
      const pollA = getPollForCategory(a.category)
      const pollB = getPollForCategory(b.category)
      const isLockedA = isOptionLocked(a, pollA) ? 1 : 0
      const isLockedB = isOptionLocked(b, pollB) ? 1 : 0
      if (isLockedB !== isLockedA) return isLockedB - isLockedA

      const votesA = getOptionVoteCount(a)
      const votesB = getOptionVoteCount(b)
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
      const optCat = (opt.category || activeTab || '').toLowerCase()
      const poll = getPollForCategory(optCat)
      const isLocked = isOptionLocked(opt, poll)
      const isConflict = checkOptionDateConflict(opt, trip?.start_date, trip?.end_date)
      const optVotes = getOptionVoteCount(opt)

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
  }, [effectiveOptions, getPollForCategory, trip, getOptionVoteCount])

  // Render individual option card using OptionCard sub-component (3-Zone layout)
  const renderOptionCard = (opt, isSectionLocked = false, isInsideDateGroup = false) => {
    return (
      <OptionCard
        key={opt.id}
        opt={opt}
        activeTab={activeTab}
        trip={trip}
        roster={roster}
        activeUser={activeUser}
        committedMembers={committedMembers}
        rates={rates}
        baseCurrency={baseCurrency}
        poll={getPollForCategory((opt.category || activeTab || '').toLowerCase())}
        isSectionLocked={isSectionLocked}
        isInsideDateGroup={isInsideDateGroup}
        isLogged={isOptionLogged(opt)}
        costDetails={getCostDetails(opt)}
        onVoteToggle={onVoteToggle}
        onLockToggle={onLockToggle}
        onDeleteOption={onDeleteOption}
        onEditOption={onEditOption}
        onOpenExpenseModal={onOpenExpenseModal}
        onOpenPollRecapModal={onOpenPollRecapModal}
        onToggleParticipant={onToggleParticipant}
        onOpenSetDatesModal={(option) => setDateModalOption(option)}
        confirmingDeleteId={confirmingDeleteId}
        setConfirmingDeleteId={setConfirmingDeleteId}
      />
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
          onDeleteOption={onDeleteOption}
          onOptionClick={(opt) => (onEditOption ? onEditOption(opt) : setDateModalOption(opt))}
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
            className="tabs-container category-tabs-container"
            style={{
              display: 'flex',
              gap: '8px',
              overflowX: 'auto',
              marginBottom: '1.25rem',
              paddingBottom: '4px'
            }}
          >
            {categories.map((cat) => {
              const count = categoryCounts[cat] || 0
              const labelWithIcon = {
                Accommodation: '🏠 Accommodation',
                Transport: '🚗✈️ Transport',
                Activities: '🎟️ Activities',
                Food: '🍴 Food',
                Other: '✨ Other'
              }[cat] || cat

              return (
                <button
                  key={cat}
                  onClick={() => onTabChange(cat)}
                  className={`tab-btn ${activeTab === cat ? 'active' : ''} ${count === 0 ? 'tab-empty' : ''}`}
                >
                  <span className="tab-label">{labelWithIcon}</span>{' '}
                  <span className="tab-count">({count})</span>
                </button>
              )
            })}
          </div>

          {/* Food Category Sub-Bar & Daily Meal Matrix */}
          {activeTab === 'Food' && (
            <MealPlanSection
              trip={trip}
              roster={roster}
              activeUser={activeUser}
              foodOptions={effectiveOptions}
              activePoll={currentCategoryPoll}
              foodViewMode={foodViewMode}
              setFoodViewMode={setFoodViewMode}
              uncheckedGroceryCount={uncheckedGroceryCount}
              onOpenGroceryList={() => setIsGroceryPanelOpen(true)}
              onOpenPitchModal={onOpenPitchModal}
              onVoteToggle={onVoteToggle}
              onLockToggle={onLockToggle}
              onDeleteOption={onDeleteOption}
              onEditOption={onEditOption}
              onToggleParticipant={onToggleParticipant}
              onSubmitMeal={onSubmitMeal}
            />
          )}

          {activeTab === 'Food' && foodViewMode === 'matrix' ? null : (
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
                            {sortOptionList(group.options).map((opt) => renderOptionCard(opt, false, true))}
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
