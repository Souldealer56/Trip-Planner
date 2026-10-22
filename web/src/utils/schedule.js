import { parseLocalDate, formatLocalDateStr } from './format.js'
import { getPresentTravelers } from '../services/rsvps.js'

/**
 * Analyzes trip days to detect unbooked gap days ("Holes in the Plan").
 * Uses local calendar date math to avoid UTC-midnight offset shifting bugs.
 * @param {Object} trip Trip record containing start_date and end_date.
 * @param {Array} options Array of all pitched options across categories.
 * @returns {Array} List of unbooked day objects.
 */
export function detectScheduleGaps(trip, options = []) {
  if (!trip?.start_date || !trip?.end_date) return []

  const start = parseLocalDate(trip.start_date)
  const end = parseLocalDate(trip.end_date)
  if (!start || !end) return []

  const cur = new Date(start)
  cur.setHours(0, 0, 0, 0)

  const endBoundary = new Date(end)
  endBoundary.setHours(23, 59, 59, 999)

  const days = []
  while (cur <= endBoundary) {
    days.push(new Date(cur))
    cur.setDate(cur.getDate() + 1)
  }

  const unbookedDays = []

  days.forEach((day, idx) => {
    const dayStart = new Date(day)
    dayStart.setHours(0, 0, 0, 0)
    const dayEnd = new Date(day)
    dayEnd.setHours(23, 59, 59, 999)

    const dayStartTime = dayStart.getTime()
    const dayEndTime = dayEnd.getTime()

    // Check if any option spans this day
    const hasOptionOnDay = options.some(opt => {
      if (!opt || (!opt.start_date && !opt.end_date)) return false
      const optStartObj = opt.start_date ? parseLocalDate(opt.start_date) : null
      const optEndObj = opt.end_date ? parseLocalDate(opt.end_date) : null

      if (!optStartObj && !optEndObj) return false

      const optStart = optStartObj ? optStartObj.getTime() : (optEndObj ? optEndObj.getTime() - 86400000 : 0)
      const optEnd = optEndObj ? optEndObj.getTime() : (optStart + 86400000)

      // Day overlaps option if option starts before day ends AND ends after day starts
      return optStart <= dayEndTime && optEnd >= dayStartTime
    })

    if (!hasOptionOnDay) {
      unbookedDays.push({
        dayNum: idx + 1,
        date: day,
        dateStr: formatLocalDateStr(day),
        label: day.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      })
    }
  })

  return unbookedDays
}

/**
 * Packs options of a single category into horizontal non-overlapping sub-tracks (lanes).
 * Options that overlap in date ranges are assigned to separate vertical lanes (laneIndex: 0, 1, 2, ...).
 * Non-overlapping options can share the same lane to optimize vertical space.
 * 
 * @param {Array} categoryOptions Array of options within a category.
 * @param {Date|string|number} [tripStart] Trip start boundary.
 * @param {Date|string|number} [tripEnd] Trip end boundary.
 * @returns {Array<Array<Object>>} Array of lanes, where each lane is an array of packed option objects with laneIndex.
 */
export function packOptionsIntoSubTracks(categoryOptions = [], tripStart = null, tripEnd = null) {
  // Only process options with valid scheduled dates
  const scheduledOpts = (categoryOptions || []).filter(o => o && (o.start_date || o.end_date))

  const tripStartMs = tripStart 
    ? (typeof tripStart === 'number' ? tripStart : parseLocalDate(tripStart)?.getTime() || new Date(tripStart).getTime()) 
    : 0
  const tripEndMs = tripEnd 
    ? (typeof tripEnd === 'number' ? tripEnd : parseLocalDate(tripEnd)?.getTime() || new Date(tripEnd).getTime()) 
    : (tripStartMs ? tripStartMs + 86400000 : 0)

  // Calculate start & end ms
  const processed = scheduledOpts.map(opt => {
    const sObj = opt.start_date ? parseLocalDate(opt.start_date) : null
    const eObj = opt.end_date ? parseLocalDate(opt.end_date) : null

    let startMs = sObj ? sObj.getTime() : (tripStartMs || 0)
    let endMs = eObj ? eObj.getTime() : (sObj ? startMs + 3600000 * 3 : (tripEndMs || startMs + 86400000))
    if (endMs < startMs) {
      endMs = startMs + 3600000 * 3
    }

    return {
      ...opt,
      _startMs: startMs,
      _endMs: endMs
    }
  })

  // Sort options: locked options first, then start date ascending, then end date ascending
  processed.sort((a, b) => {
    const lockA = a.is_locked ? 1 : 0
    const lockB = b.is_locked ? 1 : 0
    if (lockA !== lockB) return lockB - lockA

    if (a._startMs !== b._startMs) {
      return a._startMs - b._startMs
    }
    return a._endMs - b._endMs
  })

  const lanes = []

  processed.forEach(opt => {
    // Find the first lane where last option in lane ends before or at current option's start
    let targetLaneIdx = -1
    for (let i = 0; i < lanes.length; i++) {
      const lane = lanes[i]
      const lastOpt = lane[lane.length - 1]
      if (lastOpt._endMs <= opt._startMs) {
        targetLaneIdx = i
        break
      }
    }

    if (targetLaneIdx !== -1) {
      const packedOpt = { ...opt, laneIndex: targetLaneIdx }
      lanes[targetLaneIdx].push(packedOpt)
    } else {
      const newLaneIdx = lanes.length
      const packedOpt = { ...opt, laneIndex: newLaneIdx }
      lanes.push([packedOpt])
    }
  })

  return lanes
}

/**
 * Determines whether a transport option functions as a multi-day background
 * vehicle/carpool coverage (e.g. rental car, shared vehicle) or a point-to-point transit leg.
 * Vehicle coverage acts as background logistics (like lodging) and does not conflict with activities.
 * 
 * @param {Object} option Option object
 * @returns {boolean} True if option is a vehicle/carpool coverage
 */
export function isVehicleCoverage(option) {
  if (!option) return false
  const cat = (option.category || '').toLowerCase().trim()
  if (cat !== 'transport' && cat !== 'flights' && cat !== 'flight') return false

  const meta = option.metadata && typeof option.metadata === 'object' ? option.metadata : {}
  const mode = meta.transport_mode

  // Explicit modes
  if (mode === 'vehicle_pool' || mode === 'vehicle') {
    return true
  }
  if (meta.is_vehicle_coverage === true) {
    return true
  }
  if (mode === 'transit' || mode === 'ticket' || meta.is_legacy_flight) {
    return false
  }

  // Heuristics for existing / backwards compatibility
  if (meta.seats_capacity || meta.driver_user_id) {
    return true
  }

  const text = (option.option_text || option.name || '').toLowerCase()
  if (/flight|vol|avion|airline|plane|airfare|train|sncf|eurostar|bus\s+ticket|ferry\s+ticket/i.test(text)) {
    return false
  }

  if (/car|rental|van|suv|auto|voiture|drive|carpool|vehicle/i.test(text)) {
    return true
  }

  // Multi-day duration check (>= 24 hours) under transport
  if (option.start_date && option.end_date) {
    const s = new Date(option.start_date).getTime()
    const e = new Date(option.end_date).getTime()
    if (!isNaN(s) && !isNaN(e) && e - s >= 86400000) {
      return true
    }
  }

  return false
}

/**
 * Determines whether an option represents multi-day background logistics coverage
 * (e.g. Accommodations/Stays or Shared Vehicles/Carpools/Rental Cars).
 * 
 * @param {Object} option Option object
 * @returns {boolean} True if option is an accommodation or vehicle coverage
 */
export function isLogisticsCoverage(option) {
  if (!option) return false
  const cat = (option.category || '').toLowerCase().trim()
  if (cat === 'accommodation') return true
  return isVehicleCoverage(option)
}

/**
 * Determines whether a scheduled option has a short duration (e.g. <= 24 hours),
 * such as single-day activities, dinners, or point-to-point transit legs.
 * 
 * @param {Object} option Option object
 * @param {number} [thresholdHours=24] Maximum duration in hours to be considered short
 * @returns {boolean} True if option duration is <= thresholdHours
 */
export function isShortDurationOption(option, thresholdHours = 24) {
  if (!option || (!option.start_date && !option.end_date)) return false
  const s = option.start_date ? parseLocalDate(option.start_date)?.getTime() : null
  const e = option.end_date ? parseLocalDate(option.end_date)?.getTime() : null
  if (!s && !e) return false
  const startMs = s || (e - 3600000 * 3)
  const endMs = e || (s + 3600000 * 3)
  const durationMs = Math.max(0, endMs - startMs)
  return durationMs <= thresholdHours * 3600000
}

/**
 * Compares scheduled options to detect overlapping time collisions.
 * Distinguishes between hard conflicts (e.g., conflicting locked options)
 * and candidate alternatives (e.g., competing options pitched in the same category).
 * Accommodation stays and Vehicle/Carpool coverages are background logistics that
 * never collide with daytime activities/food/point-to-point transits.
 * 
 * @param {Array} options Array of pitched options.
 * @param {Set|Array|null} [lockedOptionIds=null] Optional set or array of locked option IDs.
 * @returns {Object} { conflictingOptionIds: Set, conflictPairs: Array }
 */
export function detectScheduleConflicts(options = [], lockedOptionIds = null) {
  const scheduledOpts = (options || []).filter(o => o && o.start_date && o.end_date)
  const conflictingOptionIds = new Set()
  const conflictPairs = []

  const lockedSet = lockedOptionIds instanceof Set 
    ? lockedOptionIds 
    : Array.isArray(lockedOptionIds) 
      ? new Set(lockedOptionIds.map(String))
      : null

  const checkIsLocked = (opt) => {
    if (lockedSet) {
      return lockedSet.has(String(opt.id))
    }
    return Boolean(opt.is_locked)
  }

  for (let i = 0; i < scheduledOpts.length; i++) {
    for (let j = i + 1; j < scheduledOpts.length; j++) {
      const optA = scheduledOpts[i]
      const optB = scheduledOpts[j]

      const catA = (optA.category || '').toLowerCase()
      const catB = (optB.category || '').toLowerCase()

      // Accommodation rule:
      // Lodging stays span multi-day ranges and should not collide with day activities/food/transport.
      // Accommodation only collides if BOTH options are accommodation.
      const isAccomA = catA === 'accommodation'
      const isAccomB = catB === 'accommodation'

      if ((isAccomA && !isAccomB) || (!isAccomA && isAccomB)) {
        continue
      }

      // Vehicle / Carpool Coverage rule:
      // Shared vehicles and rental cars act as background logistics coverage across multiple days.
      // They NEVER trigger schedule conflicts against activities, meals, point-to-point transits,
      // or other vehicles.
      const isVehA = isVehicleCoverage(optA)
      const isVehB = isVehicleCoverage(optB)

      if (isVehA || isVehB) {
        continue
      }

      const startA = parseLocalDate(optA.start_date)?.getTime() || 0
      const endA = parseLocalDate(optA.end_date)?.getTime() || 0
      const startB = parseLocalDate(optB.start_date)?.getTime() || 0
      const endB = parseLocalDate(optB.end_date)?.getTime() || 0

      // Collision condition: Option A starts before Option B ends AND Option A ends after Option B starts
      const timeOverlaps = startA < endB && endA > startB
      if (!timeOverlaps) {
        continue
      }

      // Participant awareness:
      // If both options explicitly specify assigned participants, they only conflict
      // if they share at least one traveler (i.e. disjoint participant groups can run parallel activities).
      const usersA = Array.isArray(optA.assigned_users) && optA.assigned_users.length > 0 ? optA.assigned_users.map(String) : null
      const usersB = Array.isArray(optB.assigned_users) && optB.assigned_users.length > 0 ? optB.assigned_users.map(String) : null
      if (usersA && usersB) {
        const hasSharedUser = usersA.some(u => usersB.includes(u))
        if (!hasSharedUser) {
          continue
        }
      }

      const isLockedA = checkIsLocked(optA)
      const isLockedB = checkIsLocked(optB)

      let isHardConflict = false

      if (isLockedA && isLockedB) {
        // Both overlapping options are locked choices -> definite schedule clash
        isHardConflict = true
      } else if (lockedSet && (isLockedA || isLockedB)) {
        // One option is locked and the other is an unlocked proposal -> proposal alternative, not hard clash
        isHardConflict = false
      } else {
        // Neither is locked
        if (catA && catB && catA === catB) {
          // Competing options pitched under the same category to vote between -> candidate proposals
          isHardConflict = false
        } else {
          // Different categories (e.g. activity vs flight) or untyped options
          isHardConflict = true
        }
      }

      if (isHardConflict) {
        conflictingOptionIds.add(optA.id)
        conflictingOptionIds.add(optB.id)
        conflictPairs.push({ optA, optB })
      }
    }
  }

  return { conflictingOptionIds, conflictPairs }
}

/**
 * Analyzes day-by-day logistics coverage (Beds, Seats, Meals) across the trip.
 * Correlates exact traveler presence each day against locked accommodations,
 * vehicles / transports, and scheduled meal slots.
 *
 * @param {Object} trip Trip object with start_date and end_date.
 * @param {Array} options Array of pitched options.
 * @param {Array} roster Roster array of participants.
 * @param {Object} activePollsMap Map of active category polls with locked choices.
 * @returns {Object} { days, nightsCoveredCount, totalNights, mealsPlannedCount, totalMealsSlots, totalVehiclesCount, alerts }
 */
export function analyzeDailyLogisticsCoverage(trip, options = [], roster = [], activePollsMap = {}) {
  if (!trip?.start_date || !trip?.end_date) {
    return {
      days: [],
      nightsCoveredCount: 0,
      totalNights: 0,
      mealsPlannedCount: 0,
      totalMealsSlots: 0,
      totalVehiclesCount: 0,
      alerts: []
    }
  }

  const start = parseLocalDate(trip.start_date)
  const end = parseLocalDate(trip.end_date)
  if (!start || !end) {
    return {
      days: [],
      nightsCoveredCount: 0,
      totalNights: 0,
      mealsPlannedCount: 0,
      totalMealsSlots: 0,
      totalVehiclesCount: 0,
      alerts: []
    }
  }

  // Build calendar days array using local date math
  const cur = new Date(start)
  cur.setHours(0, 0, 0, 0)
  const endBoundary = new Date(end)
  endBoundary.setHours(23, 59, 59, 999)

  const calendarDays = []
  while (cur <= endBoundary) {
    calendarDays.push(new Date(cur))
    cur.setDate(cur.getDate() + 1)
  }

  const totalDays = calendarDays.length
  const totalNights = totalDays > 1 ? totalDays - 1 : 1

  // Filter committed members
  const committedRoster = Array.isArray(roster)
    ? roster.filter((m) => m && m.status?.toLowerCase() === 'committed')
    : []

  // Gather locked option IDs
  const lockedOptionIds = new Set()
  options.forEach((opt) => {
    if (opt.is_locked) lockedOptionIds.add(String(opt.id))
  })
  Object.values(activePollsMap || {}).forEach((poll) => {
    if (poll?.locked_option_id) lockedOptionIds.add(String(poll.locked_option_id))
    if (Array.isArray(poll?.voter_selections?._locked_option_ids)) {
      poll.voter_selections._locked_option_ids.forEach((id) => lockedOptionIds.add(String(id)))
    }
  })

  const isOptLocked = (opt) => lockedOptionIds.has(String(opt.id))

  let nightsCoveredCount = 0
  let totalMealsPlanned = 0
  const alerts = []
  let missingNightsCount = 0

  const days = calendarDays.map((dayDate, dayIdx) => {
    const dayStr = formatLocalDateStr(dayDate)
    const dayLabel = `Day ${dayIdx + 1}`
    const subLabel = dayDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    const isDepartureDay = totalDays > 1 && dayIdx === totalDays - 1

    // 1. Present travelers for this date
    const presentTravelers = getPresentTravelers(committedRoster, dayStr, dayStr)
    const presentCount = presentTravelers.length

    // 2. Accommodation Coverage for this night (all days except final departure day)
    let bedsLocked = 0
    let pitchedAccomCount = 0
    let lockedAccoms = []
    let hasKitchen = true // default true unless explicitly false in locked accommodation

    if (!isDepartureDay) {
      // Find accommodations covering this night
      options.forEach((opt) => {
        if ((opt.category || '').toLowerCase() !== 'accommodation') return

        const sStr = opt.start_date ? String(opt.start_date).slice(0, 10) : null
        const eStr = opt.end_date ? String(opt.end_date).slice(0, 10) : null

        let coversNight = false
        if (sStr && eStr && eStr > sStr) {
          coversNight = dayStr >= sStr && dayStr < eStr
        } else if (sStr) {
          coversNight = dayStr === sStr
        }

        if (coversNight) {
          if (isOptLocked(opt)) {
            lockedAccoms.push(opt)
            const explicitCap = opt.metadata?.max_capacity ? Number(opt.metadata.max_capacity) : 0
            const assignedCap = Array.isArray(opt.assigned_users) && opt.assigned_users.length > 0 ? opt.assigned_users.length : 0
            const cap = explicitCap > 0 ? explicitCap : (assignedCap > 0 ? assignedCap : presentCount)
            bedsLocked += cap

            if (opt.metadata?.has_kitchen === false) {
              hasKitchen = false
            }
          } else {
            pitchedAccomCount++
          }
        }
      })
    }

    let accomStatus = 'departure'
    if (!isDepartureDay) {
      if (bedsLocked >= presentCount && presentCount > 0) {
        accomStatus = 'covered'
        nightsCoveredCount++
      } else if (bedsLocked > 0) {
        accomStatus = 'partial'
        alerts.push(
          `⚠️ ${dayLabel}: ${bedsLocked}/${presentCount} sleepers covered — ${presentCount - bedsLocked} beds short`
        )
      } else {
        accomStatus = 'missing'
        missingNightsCount++
      }
    }

    // 3. Transport & Vehicle Coverage
    let seatsLocked = 0
    const lockedTransports = []
    const availableVehicles = []
    const lockedVehicles = []
    const transitLegs = []

    options.forEach((opt) => {
      const cat = (opt.category || '').toLowerCase()
      if (cat !== 'transport' && cat !== 'flights') return

      const sStr = opt.start_date ? String(opt.start_date).slice(0, 10) : null
      const eStr = opt.end_date ? String(opt.end_date).slice(0, 10) : null

      const activeOnDay = (sStr && sStr === dayStr) || (eStr && eStr === dayStr) || (sStr && eStr && dayStr >= sStr && dayStr <= eStr)
      if (!activeOnDay) return

      const isVeh = isVehicleCoverage(opt)
      const isLocked = isOptLocked(opt)

      if (isVeh) {
        const explicitCap = opt.metadata?.seats_capacity
          ? Number(opt.metadata.seats_capacity)
          : (opt.metadata?.max_capacity ? Number(opt.metadata.max_capacity) : 0)
        const assignedUserIds = Array.isArray(opt.assigned_users) ? opt.assigned_users.map(String) : []
        const assignedMembers = committedRoster.filter(r => assignedUserIds.includes(String(r.user_id || r.id)))
        const capacity = explicitCap > 0 ? explicitCap : (assignedUserIds.length > 0 ? assignedUserIds.length : presentCount)

        const vehInfo = {
          ...opt,
          capacity,
          seats_capacity: capacity,
          assignedUserIds,
          assignedMembers,
          assignedCount: assignedUserIds.length,
          driverUserId: opt.metadata?.driver_user_id || null,
          isLocked
        }

        availableVehicles.push(vehInfo)
        if (isLocked) {
          lockedVehicles.push(vehInfo)
          lockedTransports.push(opt)
          seatsLocked += capacity
        }
      } else {
        if (isLocked) {
          lockedTransports.push(opt)
          transitLegs.push(opt)
          const explicitCap = opt.metadata?.seats_capacity
            ? Number(opt.metadata.seats_capacity)
            : (opt.metadata?.max_capacity ? Number(opt.metadata.max_capacity) : 0)
          const assignedCap = Array.isArray(opt.assigned_users) && opt.assigned_users.length > 0 ? opt.assigned_users.length : 0
          seatsLocked += explicitCap > 0 ? explicitCap : (assignedCap > 0 ? assignedCap : presentCount)
        }
      }
    })

    let transportStatus = 'not_scheduled'
    if (lockedTransports.length > 0) {
      transportStatus = seatsLocked >= presentCount ? 'covered' : 'partial'
    }

    // 4. Meals Coverage (Breakfast, Lunch, Dinner)
    const dayMeals = options.filter((opt) => {
      if ((opt.category || '').toLowerCase() !== 'food') return false
      const sStr = opt.start_date ? String(opt.start_date).slice(0, 10) : null
      return sStr === dayStr
    })

    const slots = {
      breakfast: null,
      lunch: null,
      dinner: null
    }

    let hasCookedWithoutKitchen = false

    dayMeals.forEach((meal) => {
      let slotKey = meal.metadata?.meal_slot
      if (!slotKey && meal.start_date) {
        const hour = parseInt(meal.start_date.slice(11, 13), 10) || 12
        if (hour < 11) slotKey = 'breakfast'
        else if (hour < 16) slotKey = 'lunch'
        else slotKey = 'dinner'
      }

      if (slotKey && slots[slotKey] === null) {
        slots[slotKey] = meal
      }

      // Check if meal is cooked while accommodation has no kitchen
      if (meal.metadata?.meal_mode === 'cook' && !hasKitchen && lockedAccoms.length > 0) {
        hasCookedWithoutKitchen = true
      }
    })

    const plannedSlotsCount = (slots.breakfast ? 1 : 0) + (slots.lunch ? 1 : 0) + (slots.dinner ? 1 : 0)
    totalMealsPlanned += plannedSlotsCount

    if (hasCookedWithoutKitchen) {
      alerts.push(`⚠️ ${dayLabel}: Home-cooked meal planned, but locked accommodation has no kitchen!`)
    }

    return {
      dayIndex: dayIdx + 1,
      date: dayDate,
      dateStr: dayStr,
      label: dayLabel,
      subLabel,
      isDepartureDay,
      presentCount,
      presentTravelers,
      accommodation: {
        bedsLocked,
        presentCount,
        status: accomStatus,
        pitchedCount: pitchedAccomCount,
        lockedOptions: lockedAccoms,
        hasKitchen
      },
      transport: {
        seatsLocked,
        presentCount,
        status: transportStatus,
        lockedOptions: lockedTransports,
        availableVehicles,
        lockedVehicles,
        transitLegs
      },
      meals: {
        count: plannedSlotsCount,
        slots,
        hasCookedWithoutKitchen
      }
    }
  })

  if (missingNightsCount > 0) {
    alerts.unshift(`⚠️ ${missingNightsCount} night${missingNightsCount > 1 ? 's' : ''} missing locked accommodation`)
  }

  const totalMealsSlots = totalDays * 3
  if (totalMealsPlanned < totalMealsSlots) {
    alerts.push(`🍴 ${totalMealsPlanned}/${totalMealsSlots} meals planned`)
  }

  // Calculate unique vehicles count across the trip
  const uniqueVehicleIds = new Set()
  days.forEach(d => {
    (d.transport.availableVehicles || []).forEach(v => uniqueVehicleIds.add(String(v.id)))
  })
  const totalVehiclesCount = uniqueVehicleIds.size

  return {
    days,
    nightsCoveredCount,
    totalNights,
    mealsPlannedCount: totalMealsPlanned,
    totalMealsSlots,
    totalVehiclesCount,
    alerts
  }
}
