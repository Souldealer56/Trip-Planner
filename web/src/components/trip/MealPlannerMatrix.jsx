import React, { useState, useMemo } from 'react'
import { computeKitchenCrewFairness, getMealDietaryAlerts, GROCERY_AISLES } from '../../services/groceries'
import { getPresentTravelers } from '../../services/rsvps'

const MEAL_SLOTS = [
  { id: 'breakfast', label: 'Breakfast', icon: '🌅', defaultTime: '08:30' },
  { id: 'lunch', label: 'Lunch', icon: '☀️', defaultTime: '12:30' },
  { id: 'dinner', label: 'Dinner', icon: '🌙', defaultTime: '19:30' }
]

function getInitials(name) {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

function getAvatarColor(nameOrId) {
  const colors = [
    'hsl(210, 70%, 50%)',
    'hsl(160, 60%, 43%)',
    'hsl(280, 60%, 55%)',
    'hsl(340, 65%, 55%)',
    'hsl(20, 75%, 50%)',
    'hsl(120, 50%, 40%)'
  ]
  const str = String(nameOrId || '')
  const seed = str.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
  return colors[Math.abs(seed) % colors.length]
}

export function MealPlannerMatrix({
  trip,
  roster = [],
  activeUser,
  foodOptions = [],
  activePoll = null,
  onOpenPitchModal,
  onVoteToggle,
  onLockToggle,
  onDeleteOption,
  onToggleParticipant,
  onOpenGroceryList,
  uncheckedGroceryCount = 0,
  onSubmitMeal
}) {
  const [selectedSlotForModal, setSelectedSlotForModal] = useState(null) // { dateStr, slotId }
  const [modalMode, setModalMode] = useState('cook') // 'cook' | 'restaurant' | 'picnic'
  const [mealTitle, setMealTitle] = useState('')
  const [mealCost, setMealCost] = useState('')
  const [mealCurrency, setMealCurrency] = useState(trip?.base_currency || 'USD')
  const [mealLink, setMealLink] = useState('')
  const [costType, setCostType] = useState('split_total')
  const [assignedUsers, setAssignedUsers] = useState([])
  const [chefIds, setChefIds] = useState([])
  const [cleanupIds, setCleanupIds] = useState([])
  const [ingredients, setIngredients] = useState([])
  const [newIngName, setNewIngName] = useState('')
  const [newIngQty, setNewIngQty] = useState('')
  const [newIngAisle, setNewIngAisle] = useState('produce')
  const [submitting, setSubmitting] = useState(false)
  const [confirmingDeleteId, setConfirmingDeleteId] = useState(null)

  const committedMembers = useMemo(() => roster.filter((m) => m.status === 'Committed'), [roster])
  const crewFairness = useMemo(() => computeKitchenCrewFairness(foodOptions, roster), [foodOptions, roster])

  // Generate trip calendar days
  const tripDays = useMemo(() => {
    if (!trip?.start_date || !trip?.end_date) {
      // Default fallback 3 days if dates not set
      const today = new Date()
      return [0, 1, 2].map((i) => {
        const d = new Date(today)
        d.setDate(d.getDate() + i)
        const dateStr = d.toISOString().slice(0, 10)
        return {
          dayIndex: i + 1,
          dateStr,
          label: `Day ${i + 1}`,
          subLabel: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
        }
      })
    }

    const [sYear, sMonth, sDay] = trip.start_date.split('-').map(Number)
    const [eYear, eMonth, eDay] = trip.end_date.split('-').map(Number)
    const cur = new Date(sYear, sMonth - 1, sDay, 12, 0, 0)
    const end = new Date(eYear, eMonth - 1, eDay, 12, 0, 0)
    const days = []
    let idx = 1

    while (cur <= end) {
      const y = cur.getFullYear()
      const m = String(cur.getMonth() + 1).padStart(2, '0')
      const d = String(cur.getDate()).padStart(2, '0')
      const dateStr = `${y}-${m}-${d}`
      days.push({
        dayIndex: idx,
        dateStr,
        label: `Day ${idx}`,
        subLabel: cur.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
      })
      cur.setDate(cur.getDate() + 1)
      idx++
    }
    return days
  }, [trip?.start_date, trip?.end_date])

  // Open planning modal for a slot
  const handleOpenPlanModal = (dateStr, slotId) => {
    const present = getPresentTravelers(committedMembers, dateStr, dateStr)
    const defaultDiners = present.length > 0 ? present.map((m) => String(m.user_id || m.id)) : committedMembers.map((m) => String(m.user_id || m.id))

    setSelectedSlotForModal({ dateStr, slotId })
    setModalMode('cook')
    setMealTitle('')
    setMealCost('')
    setMealCurrency(trip?.base_currency || 'USD')
    setMealLink('')
    setCostType('split_total')
    setAssignedUsers(defaultDiners)
    setChefIds([])
    setCleanupIds([])
    setIngredients([])
    setNewIngName('')
    setNewIngQty('')
    setNewIngAisle('produce')
  }

  const handleClosePlanModal = () => {
    setSelectedSlotForModal(null)
  }

  const handleAddIngredient = () => {
    if (!newIngName.trim()) return
    setIngredients([
      ...ingredients,
      {
        id: `ing-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: newIngName.trim(),
        quantity: newIngQty.trim(),
        aisle: newIngAisle
      }
    ])
    setNewIngName('')
    setNewIngQty('')
  }

  const handleRemoveIngredient = (index) => {
    setIngredients(ingredients.filter((_, i) => i !== index))
  }

  const handleSaveMealPlan = async (e) => {
    e.preventDefault()
    if (!mealTitle.trim() || !selectedSlotForModal) return

    setSubmitting(true)
    const { dateStr, slotId } = selectedSlotForModal
    const slotDef = MEAL_SLOTS.find((s) => s.id === slotId) || MEAL_SLOTS[0]
    const startDateTime = `${dateStr}T${slotDef.defaultTime}`

    const metadata = {
      meal_slot: slotId,
      meal_mode: modalMode,
      chef_ids: modalMode === 'cook' || modalMode === 'picnic' ? chefIds : [],
      cleanup_ids: modalMode === 'cook' || modalMode === 'picnic' ? cleanupIds : [],
      ingredients: modalMode === 'cook' || modalMode === 'picnic' ? ingredients : []
    }

    try {
      if (onSubmitMeal) {
        await onSubmitMeal({
          category: 'Food',
          option_text: mealTitle.trim(),
          estimated_cost: mealCost ? Number(mealCost) : 0,
          currency: mealCurrency,
          cost_type: modalMode === 'restaurant' ? costType : 'split_total',
          assigned_users: assignedUsers,
          start_date: startDateTime,
          end_date: startDateTime,
          link: mealLink.trim(),
          metadata
        })
      }
      handleClosePlanModal()
    } catch (err) {
      console.error('Failed to pitch meal option:', err)
      alert('Failed to save meal plan: ' + (err.message || err))
    } finally {
      setSubmitting(false)
    }
  }

  // Pre-calculate dietary alerts for modal diners
  const modalDietaryAlerts = useMemo(() => {
    if (!selectedSlotForModal) return []
    const dummyOpt = { assigned_users: assignedUsers }
    return getMealDietaryAlerts(dummyOpt, roster)
  }, [selectedSlotForModal, assignedUsers, roster])

  // Count planned meals across all days
  const { totalSlots, plannedCount } = useMemo(() => {
    const total = tripDays.length * 3
    let planned = 0
    for (const opt of foodOptions) {
      if (opt.metadata?.meal_slot) planned++
      else if (opt.start_date) planned++
    }
    return { totalSlots: total, plannedCount: planned }
  }, [tripDays, foodOptions])

  // Find meals matching a given date and slot
  const getMealsForSlot = (dateStr, slotId) => {
    return foodOptions.filter((opt) => {
      const optDate = opt.start_date ? opt.start_date.slice(0, 10) : ''
      const optSlot = opt.metadata?.meal_slot

      if (optSlot && optDate) {
        return optDate === dateStr && optSlot === slotId
      }

      // Fallback heuristics if no explicit slot stored
      if (optDate === dateStr) {
        const hour = opt.start_date ? parseInt(opt.start_date.slice(11, 13), 10) : 12
        if (slotId === 'breakfast' && hour < 11) return true
        if (slotId === 'lunch' && hour >= 11 && hour < 16) return true
        if (slotId === 'dinner' && hour >= 16) return true
      }
      return false
    })
  }

  return (
    <div className="meal-planner-matrix-wrapper">
      {/* Top Intendance Bar */}
      <div className="meal-planner-top-bar">
        <div className="meal-stats-badge">
          <span>🍽️</span>
          <span>
            <strong>{plannedCount}</strong> of <strong>{totalSlots}</strong> meals planned
            {totalSlots - plannedCount > 0 && (
              <span className="unplanned-alert"> ({totalSlots - plannedCount} slots open)</span>
            )}
          </span>
        </div>

        <div className="meal-actions-group">
          {onOpenGroceryList && (
            <button
              type="button"
              className="btn btn-secondary grocery-btn-accent"
              onClick={onOpenGroceryList}
              title="Open mobile supermarket grocery checklist"
            >
              <span>🛒 Grocery List</span>
              {uncheckedGroceryCount > 0 && (
                <span className="grocery-cart-badge">{uncheckedGroceryCount}</span>
              )}
            </button>
          )}

          <button
            type="button"
            className="btn"
            onClick={() => handleOpenPlanModal(tripDays[0]?.dateStr || '', 'dinner')}
          >
            + Plan a Meal
          </button>
        </div>
      </div>

      {/* Day by Day Matrix */}
      <div className="matrix-table-container">
        {tripDays.map((day) => (
          <div key={day.dateStr} className="matrix-day-row">
            {/* Day Header Column */}
            <div className="matrix-day-header">
              <span className="matrix-day-title">{day.label}</span>
              <span className="matrix-day-sub">{day.subLabel}</span>
            </div>

            {/* 3 Slot Columns: Breakfast, Lunch, Dinner */}
            <div className="matrix-slots-grid">
              {MEAL_SLOTS.map((slot) => {
                const meals = getMealsForSlot(day.dateStr, slot.id)
                const isPopulated = meals.length > 0

                return (
                  <div key={slot.id} className={`matrix-slot-card ${isPopulated ? 'populated' : 'empty'}`}>
                    <div className="slot-card-header">
                      <span className="slot-card-icon">{slot.icon}</span>
                      <span className="slot-card-label">{slot.label}</span>
                    </div>

                    {isPopulated ? (
                      <div className="slot-meals-list">
                        {meals.map((meal) => {
                          const meta = meal.metadata || {}
                          const isLocked = meal.is_locked
                          const dietaryAlerts = getMealDietaryAlerts(meal, roster)
                          const isCook = meta.meal_mode === 'cook'
                          const isPicnic = meta.meal_mode === 'picnic'
                          const isRestaurant = meta.meal_mode === 'restaurant'

                          // Resolve chef & washer names
                          const chefNames = (meta.chef_ids || [])
                            .map((uId) => {
                              const m = roster.find((r) => String(r.user_id || r.id) === String(uId))
                              return m?.users?.first_name || m?.username || 'Traveler'
                            })
                            .join(', ')

                          const washerNames = (meta.cleanup_ids || [])
                            .map((uId) => {
                              const m = roster.find((r) => String(r.user_id || r.id) === String(uId))
                              return m?.users?.first_name || m?.username || 'Traveler'
                            })
                            .join(', ')

                          const assignedCount = Array.isArray(meal.assigned_users) && meal.assigned_users.length > 0
                            ? meal.assigned_users.length
                            : committedMembers.length

                          const isUserJoined = activeUser && (
                            !Array.isArray(meal.assigned_users) ||
                            meal.assigned_users.length === 0 ||
                            meal.assigned_users.map(String).includes(String(activeUser.id))
                          )

                          const mealIdStr = String(meal.id)
                          const userVotes = (
                            activePoll?.voter_selections?.[String(activeUser?.id)] ||
                            activePoll?.voter_selections?.[activeUser?.id] ||
                            []
                          )
                          const hasVoted = Array.isArray(userVotes) && userVotes.map(String).includes(mealIdStr)
                          const pollVotes = activePoll?.votes_by_option || {}
                          const votesCount = pollVotes[meal.id] !== undefined
                            ? pollVotes[meal.id]
                            : (pollVotes[mealIdStr] !== undefined ? pollVotes[mealIdStr] : 0)

                          return (
                            <div key={meal.id} className={`meal-item-card ${isLocked ? 'locked-meal' : ''}`}>
                              <div className="meal-item-title-row">
                                <span className="meal-mode-tag">
                                  {isCook && '🍳 Home-Cooked'}
                                  {isPicnic && '🥪 Picnic'}
                                  {isRestaurant && '🍽️ Restaurant'}
                                  {!meta.meal_mode && '🍽️ Meal'}
                                </span>
                                {isLocked && <span className="badge-locked-mini">🔒 Locked</span>}
                              </div>

                              <h4 className="meal-item-name">{meal.option_text}</h4>

                              {/* Kitchen Crew Assignment */}
                              {(isCook || isPicnic) && (chefNames || washerNames) && (
                                <div className="meal-duty-roster">
                                  {chefNames && (
                                    <span className="duty-badge chef" title="Chefs">
                                      👨‍🍳 Chefs: {chefNames}
                                    </span>
                                  )}
                                  {washerNames && (
                                    <span className="duty-badge cleanup" title="Cleanup Crew">
                                      🧽 Cleanup: {washerNames}
                                    </span>
                                  )}
                                </div>
                              )}

                              {/* Dietary Alert Badges */}
                              {dietaryAlerts.length > 0 && (
                                <div className="meal-dietary-alerts" title="Dietary requirements for diners">
                                  {dietaryAlerts.slice(0, 3).map((alert, aIdx) => (
                                    <span key={aIdx} className="dietary-warning-pill">
                                      {alert.label}
                                    </span>
                                  ))}
                                  {dietaryAlerts.length > 3 && (
                                    <span className="dietary-warning-more">+{dietaryAlerts.length - 3}</span>
                                  )}
                                </div>
                              )}

                              {/* Meal Cost & Participant Row */}
                              <div className="meal-item-footer">
                                <span className="meal-cost-text">
                                  {meal.estimated_cost > 0
                                    ? `~${Math.round(meal.estimated_cost)} ${meal.currency || trip?.base_currency}`
                                    : 'Budget TBD'}
                                </span>

                                <div className="meal-mini-actions">
                                  {onVoteToggle && activeUser && (
                                    <button
                                      type="button"
                                      className={`mini-join-btn ${hasVoted ? 'joined' : 'not-joined'}`}
                                      onClick={() => onVoteToggle(meal.id, hasVoted, 'food')}
                                      title={hasVoted ? 'Remove vote' : 'Vote for this meal'}
                                    >
                                      {hasVoted ? `✓ ${votesCount}` : `👍 ${votesCount}`}
                                    </button>
                                  )}

                                  {onToggleParticipant && activeUser && (
                                    <button
                                      type="button"
                                      className={`mini-join-btn ${isUserJoined ? 'joined' : 'not-joined'}`}
                                      onClick={() => onToggleParticipant(meal.id, meal.assigned_users || [])}
                                      title={isUserJoined ? 'Leave meal' : 'Join meal'}
                                    >
                                      {isUserJoined ? `✓ Joined (${assignedCount})` : `+ Join (${assignedCount})`}
                                    </button>
                                  )}

                                  {onLockToggle && (
                                    <button
                                      type="button"
                                      className="btn-icon-soft"
                                      onClick={() => onLockToggle(meal.id)}
                                      title={isLocked ? 'Unlock menu' : 'Lock as winning menu'}
                                    >
                                      {isLocked ? '🏆' : '🔒'}
                                    </button>
                                  )}

                                  {onDeleteOption && (
                                    confirmingDeleteId === meal.id ? (
                                      <div className="inline-delete-confirm" style={{ padding: '2px 6px' }}>
                                        <span style={{ fontSize: '0.7rem', color: '#fca5a5', fontWeight: '600' }}>Delete?</span>
                                        <button
                                          type="button"
                                          className="btn btn-danger"
                                          style={{ padding: '2px 6px', fontSize: '0.7rem', minHeight: 'auto' }}
                                          onClick={() => {
                                            setConfirmingDeleteId(null)
                                            onDeleteOption(meal)
                                          }}
                                        >
                                          Yes
                                        </button>
                                        <button
                                          type="button"
                                          className="btn btn-secondary"
                                          style={{ padding: '2px 4px', fontSize: '0.7rem', minHeight: 'auto' }}
                                          onClick={() => setConfirmingDeleteId(null)}
                                        >
                                          Cancel
                                        </button>
                                      </div>
                                    ) : (
                                      <button
                                        type="button"
                                        className="btn-icon-soft btn-danger-soft"
                                        onClick={() => setConfirmingDeleteId(meal.id)}
                                        title="Delete meal pitch"
                                      >
                                        🗑️
                                      </button>
                                    )
                                  )}
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <div className="empty-slot-content">
                        <button
                          type="button"
                          className="btn-plan-slot"
                          onClick={() => handleOpenPlanModal(day.dateStr, slot.id)}
                        >
                          + Plan {slot.label}
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Plan Meal Modal */}
      {selectedSlotForModal && (
        <div className="modal-overlay" onClick={handleClosePlanModal}>
          <div
            className="modal-content glass-card animate-fade-in meal-modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="meal-modal-header">
              <h3>
                {MEAL_SLOTS.find((s) => s.id === selectedSlotForModal.slotId)?.icon}{' '}
                Plan {MEAL_SLOTS.find((s) => s.id === selectedSlotForModal.slotId)?.label}
              </h3>
              <span className="meal-modal-date-badge">{selectedSlotForModal.dateStr}</span>
            </div>

            {/* 3 Mode Tabs */}
            <div className="meal-mode-tabs">
              <button
                type="button"
                className={`meal-mode-tab ${modalMode === 'cook' ? 'active' : ''}`}
                onClick={() => setModalMode('cook')}
              >
                🍳 Cook Together
              </button>
              <button
                type="button"
                className={`meal-mode-tab ${modalMode === 'restaurant' ? 'active' : ''}`}
                onClick={() => setModalMode('restaurant')}
              >
                🍽️ Restaurant / Eat Out
              </button>
              <button
                type="button"
                className={`meal-mode-tab ${modalMode === 'picnic' ? 'active' : ''}`}
                onClick={() => setModalMode('picnic')}
              >
                🥪 Trail Picnic
              </button>
            </div>

            <form onSubmit={handleSaveMealPlan} className="meal-plan-form">
              {/* Menu Title */}
              <div>
                <label className="field-label">
                  {modalMode === 'restaurant' ? 'Restaurant Name *' : 'Menu / Recipe Name *'}
                </label>
                <input
                  type="text"
                  className="input-field"
                  placeholder={
                    modalMode === 'cook'
                      ? 'e.g. Pasta Carbonara, Garlic Bread & Arugula Salad'
                      : modalMode === 'picnic'
                      ? 'e.g. Baguettes, Cheeses, Prosciutto & Apples'
                      : 'e.g. Trattoria Da Enzo (Piazza Navona)'
                  }
                  value={mealTitle}
                  onChange={(e) => setMealTitle(e.target.value)}
                  required
                />
              </div>

              {/* Diners / Participants Selection */}
              <div>
                <label className="field-label">Who is eating? ({assignedUsers.length} diners)</label>
                <div className="participant-pill-bar">
                  {committedMembers.map((m) => {
                    const uId = String(m.user_id || m.id)
                    const isSelected = assignedUsers.includes(uId)
                    const name = m.users?.first_name || m.username || 'Traveler'

                    return (
                      <button
                        key={uId}
                        type="button"
                        className={`participant-pill-toggle ${isSelected ? 'selected' : ''}`}
                        onClick={() => {
                          if (isSelected) setAssignedUsers(assignedUsers.filter((id) => id !== uId))
                          else setAssignedUsers([...assignedUsers, uId])
                        }}
                      >
                        {isSelected ? '✓ ' : '+ '}
                        {name}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Live Dietary Alert Warning Banner */}
              {modalDietaryAlerts.length > 0 && (
                <div className="modal-dietary-warning-box">
                  <div className="dietary-warning-box-title">
                    <span>⚠️ Dietary Alert ({modalDietaryAlerts.length})</span>
                  </div>
                  <div className="dietary-warning-box-list">
                    {modalDietaryAlerts.map((alert, idx) => (
                      <span key={idx} className="dietary-warning-pill">
                        {alert.label}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Cook / Picnic Crew Assignments with Fairness Counters */}
              {(modalMode === 'cook' || modalMode === 'picnic') && (
                <div className="kitchen-crew-grid">
                  <div>
                    <label className="field-label">👨‍🍳 Cooking Crew (Chefs)</label>
                    <div className="crew-select-row">
                      {committedMembers.map((m) => {
                        const uId = String(m.user_id || m.id)
                        const isChef = chefIds.includes(uId)
                        const duty = crewFairness[uId]?.cookCount || 0
                        const name = m.users?.first_name || m.username || 'Traveler'

                        return (
                          <button
                            key={uId}
                            type="button"
                            className={`duty-pill-toggle ${isChef ? 'active-chef' : ''}`}
                            onClick={() => {
                              if (isChef) setChefIds(chefIds.filter((id) => id !== uId))
                              else setChefIds([...chefIds, uId])
                            }}
                          >
                            <span>{name}</span>
                            <span className="duty-count-pill" title="Times cooked so far">
                              🍳 {duty}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="field-label">🧽 Cleanup & Dishes Crew</label>
                    <div className="crew-select-row">
                      {committedMembers.map((m) => {
                        const uId = String(m.user_id || m.id)
                        const isCleanup = cleanupIds.includes(uId)
                        const duty = crewFairness[uId]?.cleanupCount || 0
                        const name = m.users?.first_name || m.username || 'Traveler'

                        return (
                          <button
                            key={uId}
                            type="button"
                            className={`duty-pill-toggle ${isCleanup ? 'active-washer' : ''}`}
                            onClick={() => {
                              if (isCleanup) setCleanupIds(cleanupIds.filter((id) => id !== uId))
                              else setCleanupIds([...cleanupIds, uId])
                            }}
                          >
                            <span>{name}</span>
                            <span className="duty-count-pill" title="Times washed so far">
                              🧽 {duty}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Estimated Budget & Pricing */}
              <div className="meal-cost-row">
                <div style={{ flex: 1 }}>
                  <label className="field-label">Estimated Grocery / Meal Cost</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    className="input-field"
                    placeholder="0"
                    value={mealCost}
                    onChange={(e) => setMealCost(e.target.value)}
                  />
                </div>
                <div style={{ width: '100px' }}>
                  <label className="field-label">Currency</label>
                  <input
                    type="text"
                    className="input-field"
                    value={mealCurrency}
                    onChange={(e) => setMealCurrency(e.target.value.toUpperCase())}
                  />
                </div>
                {modalMode === 'restaurant' && (
                  <div style={{ flex: 1 }}>
                    <label className="field-label">Pricing Mode</label>
                    <select
                      className="select-field"
                      value={costType}
                      onChange={(e) => setCostType(e.target.value)}
                    >
                      <option value="per_person">Per Person</option>
                      <option value="split_total">Split Total Evenly</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Restaurant Link */}
              {modalMode === 'restaurant' && (
                <div>
                  <label className="field-label">Website or Google Maps Link</label>
                  <input
                    type="url"
                    className="input-field"
                    placeholder="https://maps.google.com/..."
                    value={mealLink}
                    onChange={(e) => setMealLink(e.target.value)}
                  />
                </div>
              )}

              {/* Ingredients Builder (For Cook & Picnic) */}
              {(modalMode === 'cook' || modalMode === 'picnic') && (
                <div className="ingredients-builder-box">
                  <label className="field-label">🛒 Menu Ingredients (Syncs to Grocery List)</label>

                  <div className="ingredient-quick-add-bar">
                    <input
                      type="text"
                      className="input-field"
                      placeholder="Ingredient (e.g. Pasta, Eggs, Olive oil)"
                      value={newIngName}
                      onChange={(e) => setNewIngName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          handleAddIngredient()
                        }
                      }}
                    />
                    <input
                      type="text"
                      className="input-field ing-qty-input"
                      placeholder="Qty (500g)"
                      value={newIngQty}
                      onChange={(e) => setNewIngQty(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          handleAddIngredient()
                        }
                      }}
                    />
                    <select
                      className="select-field ing-aisle-select"
                      value={newIngAisle}
                      onChange={(e) => setNewIngAisle(e.target.value)}
                    >
                      {GROCERY_AISLES.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.icon} {a.label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="btn btn-secondary btn-add-ing"
                      onClick={handleAddIngredient}
                    >
                      + Add
                    </button>
                  </div>

                  {ingredients.length > 0 && (
                    <div className="ingredients-tag-list">
                      {ingredients.map((ing, i) => (
                        <span key={i} className="ingredient-tag">
                          <span>
                            {GROCERY_AISLES.find((a) => a.id === ing.aisle)?.icon} {ing.name}
                            {ing.quantity ? ` (${ing.quantity})` : ''}
                          </span>
                          <button
                            type="button"
                            className="btn-remove-tag"
                            onClick={() => handleRemoveIngredient(i)}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="modal-actions-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleClosePlanModal}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button type="submit" className="btn" disabled={submitting}>
                  {submitting ? 'Saving Menu...' : 'Save & Add to Meal Matrix'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
