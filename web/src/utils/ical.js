/**
 * Formats a Date object or ISO date string into UTC iCal format YYYYMMDDTHHMMSSZ.
 * @param {string|Date} dateVal Date string or Date instance.
 * @returns {string} Formatted iCal datetime string.
 */
export function formatICalDateTime(dateVal) {
  if (!dateVal) {
    const now = new Date()
    return now.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
  }
  const d = new Date(dateVal)
  if (isNaN(d.getTime())) {
    const now = new Date()
    return now.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
  }
  return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
}

/**
 * Generates RFC 5545 compliant .ics calendar content string for trip options.
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

    const dtStart = formatICalDateTime(opt.start_date || trip.start_date)
    const dtEnd = formatICalDateTime(opt.end_date || opt.start_date || trip.end_date)
    const uid = `opt-${opt.id || idx}-${trip.id || 'trip'}@tripplanner`

    icsLines.push('BEGIN:VEVENT')
    icsLines.push(`UID:${uid}`)
    icsLines.push(`DTSTAMP:${nowStamp}`)
    icsLines.push(`DTSTART:${dtStart}`)
    icsLines.push(`DTEND:${dtEnd}`)
    icsLines.push(`SUMMARY:${summary}`)
    icsLines.push(`DESCRIPTION:${description}${link ? '\\nLink: ' + link : ''}`)
    if (trip.destination) {
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
