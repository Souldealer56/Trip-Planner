/**
 * Formats a start and end ISO date string into a localized human-friendly range.
 * E.g., "2026-07-12", "2026-07-18" -> "Jul 12 – Jul 18, 2026"
 * @param {string} startStr Start date ISO string.
 * @param {string} endStr End date ISO string.
 * @returns {string} The formatted date range.
 */
export function formatDateRange(startStr, endStr) {
  if (!startStr || !endStr) return ''
  const start = new Date(startStr)
  const end = new Date(endStr)
  
  const options = { month: 'short', day: 'numeric', timeZone: 'UTC' }
  const startFmt = start.toLocaleDateString('en-US', options)
  const endFmt = end.toLocaleDateString('en-US', { ...options, year: 'numeric' })
  
  return `${startFmt} – ${endFmt}`
}

/**
 * Translates an ISO currency code into its standard symbol and prefixes it to the amount.
 * @param {number|string} amount The price amount.
 * @param {string} currencyCode The ISO currency code (e.g. USD, EUR).
 * @returns {string} The formatted price string.
 */
export function formatCurrency(amount, currencyCode) {
  const symbols = {
    USD: '$',
    EUR: '€',
    GBP: '£',
    JPY: '¥',
    CAD: 'CA$',
    AUD: 'A$'
  }
  const symbol = symbols[currencyCode] || currencyCode
  return `${symbol}${amount}`
}

/**
 * Formats an ISO timestamp into a relative time string (e.g. "5m ago", "2h ago", "1d ago").
 * @param {string} isoString ISO date string.
 * @returns {string} The formatted relative time string.
 */
export function formatRelativeTime(isoString) {
  if (!isoString) return ''
  const date = new Date(isoString)
  const now = new Date()
  const seconds = Math.floor((now - date) / 1000)

  if (seconds < 60) return 'Just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

/**
 * Formats start and end date/time strings into a localized human-friendly range.
 * E.g., "2026-07-24T14:00" -> "Jul 24, 2:00 PM"
 * E.g., "2026-07-24T14:00", "2026-07-24T17:00" -> "Jul 24, 2:00 PM – 5:00 PM"
 * E.g., "2026-07-24T14:00", "2026-07-26T11:00" -> "Jul 24, 2:00 PM – Jul 26, 11:00 AM"
 */
export function formatDateTimeRange(startStr, endStr) {
  if (!startStr && !endStr) return ''

  const hasTime = (str) => Boolean(str && (str.includes('T') || str.includes(':')))
  
  const parse = (str) => {
    if (!str) return null
    const d = new Date(str)
    return isNaN(d.getTime()) ? null : d
  }

  const startDate = parse(startStr)
  const endDate = parse(endStr)

  if (!startDate && !endDate) return ''

  const dateFmt = { month: 'short', day: 'numeric' }
  const timeFmt = { hour: 'numeric', minute: '2-digit' }

  const startHasTime = hasTime(startStr)
  const endHasTime = hasTime(endStr)

  if (startDate && endDate) {
    const sameDay = startDate.toDateString() === endDate.toDateString()
    
    if (sameDay) {
      const dPart = startDate.toLocaleDateString('en-US', dateFmt)
      if (startHasTime && endHasTime) {
        const tStart = startDate.toLocaleTimeString('en-US', timeFmt)
        const tEnd = endDate.toLocaleTimeString('en-US', timeFmt)
        return `${dPart}, ${tStart} – ${tEnd}`
      }
      if (startHasTime) {
        return `${dPart}, ${startDate.toLocaleTimeString('en-US', timeFmt)}`
      }
      return `${dPart}`
    } else {
      const sDatePart = startDate.toLocaleDateString('en-US', dateFmt)
      const eDatePart = endDate.toLocaleDateString('en-US', dateFmt)
      const sTimePart = startHasTime ? `, ${startDate.toLocaleTimeString('en-US', timeFmt)}` : ''
      const eTimePart = endHasTime ? `, ${endDate.toLocaleTimeString('en-US', timeFmt)}` : ''
      return `${sDatePart}${sTimePart} – ${eDatePart}${eTimePart}`
    }
  }

  if (startDate) {
    const dPart = startDate.toLocaleDateString('en-US', dateFmt)
    const tPart = startHasTime ? `, ${startDate.toLocaleTimeString('en-US', timeFmt)}` : ''
    return `${dPart}${tPart}`
  }

  if (endDate) {
    const dPart = endDate.toLocaleDateString('en-US', dateFmt)
    const tPart = endHasTime ? `, ${endDate.toLocaleTimeString('en-US', timeFmt)}` : ''
    return `Until ${dPart}${tPart}`
  }

  return ''
}

