import { parseLocalDate, formatLocalDateStr } from './format'

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

      const optStart = optStartObj ? optStartObj.getTime() : 0
      const optEnd = optEndObj ? optEndObj.getTime() : (optStart ? optStart + 86400000 : 0)

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
 * Compares scheduled options to detect overlapping time collisions.
 * Distinguishes between hard conflicts (e.g., conflicting locked options)
 * and candidate alternatives (e.g., competing options pitched in the same category).
 * Accommodation stays are isolated so they never collide with daytime activities/food/transport.
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

      const startA = parseLocalDate(optA.start_date)?.getTime() || 0
      const endA = parseLocalDate(optA.end_date)?.getTime() || 0
      const startB = parseLocalDate(optB.start_date)?.getTime() || 0
      const endB = parseLocalDate(optB.end_date)?.getTime() || 0

      // Collision condition: Option A starts before Option B ends AND Option A ends after Option B starts
      const timeOverlaps = startA < endB && endA > startB
      if (!timeOverlaps) {
        continue
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
