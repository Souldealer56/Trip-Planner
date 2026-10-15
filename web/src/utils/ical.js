/**
 * Formats a Date object or date string into standard iCal representation without UTC shifting.
 * - Date-only strings ("YYYY-MM-DD") -> "YYYYMMDD" (for VALUE=DATE all-day events)
 * - Local datetime strings ("YYYY-MM-DDTHH:mm") -> "YYYYMMDDTHHMMSS" (floating wall-clock time)
 * - ISO strings with 'Z' or offset -> "YYYYMMDDTHHMMSSZ" (UTC representation)
 * 
 * @param {string|Date|null|undefined} dateVal Date string or Date instance.
 * @returns {string} Formatted iCal datetime or date string.
 */
export function formatICalDateTime(dateVal) {
  if (!dateVal) {
    const now = new Date()
    return now.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
  }

  if (typeof dateVal === 'string') {
    const trimmed = dateVal.trim()
    // 1. Date-only format: YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed.replace(/-/g, '')
    }

    // 2. Floating local datetime format: YYYY-MM-DDTHH:mm(:ss) without Z or offset
    const localMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/)
    if (localMatch) {
      const year = localMatch[1]
      const month = localMatch[2]
      const day = localMatch[3]
      const hours = localMatch[4]
      const minutes = localMatch[5]
      const seconds = localMatch[6] || '00'
      return `${year}${month}${day}T${hours}${minutes}${seconds}`
    }

    // 3. UTC or offset ISO format
    const d = new Date(trimmed)
    if (!isNaN(d.getTime())) {
      return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
    }
  }

  if (dateVal instanceof Date) {
    if (isNaN(dateVal.getTime())) {
      const now = new Date()
      return now.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
    }
    return dateVal.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
  }

  const now = new Date()
  return now.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
}

/**
 * Generates RFC 5545 compliant .ics calendar content string for trip options.
 * Accurately outputs VALUE=DATE for all-day events and floating local times for activities.
 * 
 * @param {Object} trip Trip details object.
 * @param {Array} options Array of pitched or locked options.
 * @returns {string} Standard .ics formatted calendar string.
 */
export function generateICalContent(trip, options = []) {
  const cleanTitle = (trip?.title || 'Trip').replace(/[^a-zA-Z0-9\s]/g, '')
  const nowStamp = formatICalDateTime()

  let icsLines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//TripPlanner//NONGNS v1.8//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:Trip Itinerary - ${cleanTitle}`
  ]

  options.forEach((opt, idx) => {
    const cat = (opt.category || 'Event').toUpperCase()
    const summary = `${cat}: ${opt.option_text || 'Option'}`
    const description = opt.description ? opt.description.replace(/\n/g, '\\n') : 'Trip Planner Itinerary Choice'
    const link = opt.link || ''

    const startRaw = opt.start_date || trip?.start_date
    const endRaw = opt.end_date || opt.start_date || trip?.end_date

    const isAllDayStart = typeof startRaw === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(startRaw.trim())
    const isAllDayEnd = typeof endRaw === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(endRaw.trim())

    const dtStart = formatICalDateTime(startRaw)
    const dtEnd = formatICalDateTime(endRaw)
    const uid = `opt-${opt.id || idx}-${trip?.id || 'trip'}@tripplanner`

    icsLines.push('BEGIN:VEVENT')
    icsLines.push(`UID:${uid}`)
    icsLines.push(`DTSTAMP:${nowStamp}`)
    if (isAllDayStart) {
      icsLines.push(`DTSTART;VALUE=DATE:${dtStart}`)
    } else {
      icsLines.push(`DTSTART:${dtStart}`)
    }

    if (isAllDayEnd) {
      icsLines.push(`DTEND;VALUE=DATE:${dtEnd}`)
    } else {
      icsLines.push(`DTEND:${dtEnd}`)
    }

    icsLines.push(`SUMMARY:${summary}`)
    icsLines.push(`DESCRIPTION:${description}${link ? '\\nLink: ' + link : ''}`)
    if (trip?.destination) {
      icsLines.push(`LOCATION:${trip.destination}`)
    }
    icsLines.push('END:VEVENT')
  })

  icsLines.push('END:VCALENDAR')
  return icsLines.join('\r\n')
}

/**
 * Triggers a browser download of an .ics calendar file.
 * @param {string} filename The target filename (e.g. "Paris_Trip_itinerary.ics").
 * @param {string} icalContent The RFC 5545 .ics text content.
 */
export function downloadICalFile(filename, icalContent) {
  const blob = new Blob([icalContent], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', filename.endsWith('.ics') ? filename : `${filename}.ics`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
