/**
 * Analyzes trip days to detect unbooked gap days ("Holes in the Plan").
 * @param {Object} trip Trip record containing start_date and end_date.
 * @param {Array} options Array of all pitched options across categories.
 * @returns {Array} List of unbooked day objects.
 */
export function detectScheduleGaps(trip, options = []) {
  if (!trip?.start_date || !trip?.end_date) return []

  const start = new Date(trip.start_date)
  const end = new Date(trip.end_date)
  const days = []
  const cur = new Date(start)

  while (cur <= end) {
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
      if (!opt.start_date && !opt.end_date) return false
      const optStart = opt.start_date ? new Date(opt.start_date).getTime() : 0
      const optEnd = opt.end_date ? new Date(opt.end_date).getTime() : optStart + 86400000

      // Day overlaps option if option starts before day ends AND ends after day starts
      return optStart <= dayEndTime && optEnd >= dayStartTime
    })

    if (!hasOptionOnDay) {
      unbookedDays.push({
        dayNum: idx + 1,
        date: day,
        dateStr: day.toISOString().slice(0, 10),
        label: day.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      })
    }
  })

  return unbookedDays
}

/**
 * Compares scheduled options to detect overlapping time collisions.
 * @param {Array} options Array of pitched options.
 * @returns {Object} { conflictingOptionIds: Set, conflictPairs: Array }
 */
export function detectScheduleConflicts(options = []) {
  const scheduledOpts = options.filter(o => o.start_date && o.end_date)
  const conflictingOptionIds = new Set()
  const conflictPairs = []

  for (let i = 0; i < scheduledOpts.length; i++) {
    for (let j = i + 1; j < scheduledOpts.length; j++) {
      const optA = scheduledOpts[i]
      const optB = scheduledOpts[j]

      const startA = new Date(optA.start_date).getTime()
      const endA = new Date(optA.end_date).getTime()
      const startB = new Date(optB.start_date).getTime()
      const endB = new Date(optB.end_date).getTime()

      // Collision condition: Option A starts before Option B ends AND Option A ends after Option B starts
      if (startA < endB && endA > startB) {
        conflictingOptionIds.add(optA.id)
        conflictingOptionIds.add(optB.id)
        conflictPairs.push({ optA, optB })
      }
    }
  }

  return { conflictingOptionIds, conflictPairs }
}
