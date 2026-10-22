/**
 * Parses a date or datetime string into a local Date instance without UTC shifting.
 * Handles:
 * - Date-only strings ("YYYY-MM-DD") -> local midnight (00:00:00.000)
 * - Local datetime strings ("YYYY-MM-DDTHH:mm" or "YYYY-MM-DD HH:mm") -> local time
 * - Full ISO strings with timezone offsets or trailing 'Z' -> standard Date parsing
 * 
 * @param {string|Date|null|undefined} dateStr Input date string or Date object.
 * @returns {Date|null} Local Date instance or null if invalid/empty.
 */
export function parseLocalDate(dateStr) {
  if (!dateStr) return null
  if (dateStr instanceof Date) {
    return isNaN(dateStr.getTime()) ? null : new Date(dateStr.getTime())
  }

  if (typeof dateStr !== 'string') return null
  const trimmed = dateStr.trim()
  if (!trimmed) return null

  // 1. Date-only format: YYYY-MM-DD
  const dateOnlyMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (dateOnlyMatch) {
    const year = Number(dateOnlyMatch[1])
    const month = Number(dateOnlyMatch[2]) - 1
    const day = Number(dateOnlyMatch[3])
    return new Date(year, month, day, 0, 0, 0, 0)
  }

  // 2. Local datetime format without explicit offset: YYYY-MM-DDTHH:mm or YYYY-MM-DD HH:mm(:ss)
  const localTimeMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?(?:\.(\d+))?$/)
  if (localTimeMatch) {
    const year = Number(localTimeMatch[1])
    const month = Number(localTimeMatch[2]) - 1
    const day = Number(localTimeMatch[3])
    const hours = Number(localTimeMatch[4])
    const minutes = Number(localTimeMatch[5])
    const seconds = Number(localTimeMatch[6] || 0)
    const ms = localTimeMatch[7] ? Number(localTimeMatch[7].slice(0, 3).padEnd(3, '0')) : 0
    return new Date(year, month, day, hours, minutes, seconds, ms)
  }

  // 3. Fallback for ISO strings with Z or timezone offset (e.g., 2026-07-12T00:00:00.000Z, +02:00)
  const parsed = new Date(trimmed)
  return isNaN(parsed.getTime()) ? null : parsed
}

/**
 * Formats a Date object to local YYYY-MM-DD string without UTC conversion.
 * @param {Date|string} dateVal Date object or date string.
 * @returns {string} Formatted YYYY-MM-DD string.
 */
export function formatLocalDateStr(dateVal) {
  const d = dateVal instanceof Date ? dateVal : parseLocalDate(dateVal)
  if (!d) return ''
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Formats a start and end date string into a localized human-friendly range.
 * E.g., "2026-07-12", "2026-07-18" -> "Jul 12 – Jul 18, 2026"
 * @param {string} startStr Start date string.
 * @param {string} endStr End date string.
 * @returns {string} The formatted date range.
 */
export function formatDateRange(startStr, endStr) {
  if (!startStr || !endStr) return ''
  const start = parseLocalDate(startStr)
  const end = parseLocalDate(endStr)
  if (!start || !end) return ''

  const options = { month: 'short', day: 'numeric' }
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
    AUD: 'A$',
    CHF: 'CHF ',
    MXN: 'MX$',
    ISK: 'kr ',
    NZD: 'NZ$',
    SEK: 'kr ',
    NOK: 'kr '
  }
  const symbol = symbols[currencyCode] || currencyCode
  return `${symbol}${amount}`
}

/**
 * Standardizes monetary displays using Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })
 * or up to 2 decimals when cents are non-zero.
 * E.g., 6563, 'CAD' -> '6,563 CAD'
 * E.g., 6563.5, 'CAD' -> '6,563.50 CAD'
 * E.g., 0, 'USD' -> '0 USD'
 * @param {number|string} amount Monetary amount to format.
 * @param {string} [currencyCode] ISO currency code.
 * @param {Object} [options] Optional Intl formatting options (e.g. { maximumFractionDigits: 0 }).
 * @returns {string} Standardized price string.
 */
export function formatMoney(amount, currencyCode = '', options = {}) {
  if (amount === undefined || amount === null || amount === '') {
    return currencyCode ? `0 ${currencyCode}` : '0'
  }
  const num = typeof amount === 'number' ? amount : parseFloat(amount)
  if (isNaN(num)) {
    return currencyCode ? `0 ${currencyCode}` : '0'
  }

  const maxDigits = options?.maximumFractionDigits
  const hasCents = maxDigits !== undefined ? maxDigits > 0 : (Math.abs(num % 1) > 0.005)
  const minDigits = options?.minimumFractionDigits !== undefined 
    ? options.minimumFractionDigits 
    : (hasCents ? 2 : 0)

  const formatter = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: minDigits,
    maximumFractionDigits: maxDigits !== undefined ? maxDigits : (hasCents ? 2 : 0)
  })

  const formattedNum = formatter.format(num)
  return currencyCode ? `${formattedNum} ${currencyCode}` : formattedNum
}

/**
 * Formats an ISO timestamp into a relative time string (e.g. "5m ago", "2h ago", "1d ago").
 * @param {string} isoString ISO date string.
 * @returns {string} The formatted relative time string.
 */
export function formatRelativeTime(isoString) {
  if (!isoString) return ''
  const date = parseLocalDate(isoString) || new Date(isoString)
  if (isNaN(date.getTime())) return ''
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
 * @param {string} startStr Start date/time string.
 * @param {string} endStr End date/time string.
 * @returns {string} Formatted range.
 */
export function formatDateTimeRange(startStr, endStr) {
  if (!startStr && !endStr) return ''

  const hasTime = (str) => Boolean(str && (str.includes('T') || str.includes(':')))

  const startDate = parseLocalDate(startStr)
  const endDate = parseLocalDate(endStr)

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

/**
 * Generates an array of day descriptors for a trip date range.
 * E.g., [{ dayNumber: 1, dateStr: '2026-12-25', label: 'Day 1 (Dec 25)', shortDate: 'Dec 25', chipLabel: 'Day 1 · Dec 25' }]
 *
 * @param {string|Date|null|undefined} startDate Trip start date
 * @param {string|Date|null|undefined} endDate Trip end date
 * @returns {Array<{ dayNumber: number, dateStr: string, label: string, shortDate: string, chipLabel: string }>}
 */
export function getTripDaysList(startDate, endDate) {
  if (!startDate || !endDate) return []
  const start = parseLocalDate(startDate)
  const end = parseLocalDate(endDate)
  if (!start || !end) return []

  start.setHours(0, 0, 0, 0)
  end.setHours(0, 0, 0, 0)

  if (start.getTime() > end.getTime()) return []

  const days = []
  const cur = new Date(start.getTime())

  while (cur.getTime() <= end.getTime()) {
    const dayNumber = days.length + 1
    const dateStr = formatLocalDateStr(cur)
    const shortDate = cur.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    const label = `Day ${dayNumber} (${shortDate})`
    const chipLabel = `Day ${dayNumber} · ${shortDate}`

    days.push({
      dayNumber,
      dateStr,
      label,
      shortDate,
      chipLabel
    })

    cur.setDate(cur.getDate() + 1)
  }

  return days
}

/**
 * Builds sensible default start and end datetime strings (YYYY-MM-DDTHH:mm) bounded within trip dates.
 * - Accommodation or Shared Vehicle: full trip span
 * - Activity: Day 1 from 09:00 to 12:00
 * - Meal / Food: Day 1 at 19:30 (until 21:30)
 *
 * @param {string|Date|null|undefined} tripStartDate Trip start date
 * @param {string|Date|null|undefined} tripEndDate Trip end date
 * @param {string} [category] Option category (e.g., Accommodation, Transport, Activities, Food)
 * @returns {{ start: string, end: string, startDate: string, endDate: string }}
 */
export function buildDefaultOptionDates(tripStartDate, tripEndDate, category = '') {
  if (!tripStartDate) {
    return { start: '', end: '', startDate: '', endDate: '' }
  }

  const sDate = parseLocalDate(tripStartDate)
  if (!sDate) {
    return { start: '', end: '', startDate: '', endDate: '' }
  }

  const eDate = tripEndDate ? (parseLocalDate(tripEndDate) || sDate) : sDate
  const sDateStr = formatLocalDateStr(sDate)
  const eDateStr = formatLocalDateStr(eDate)

  const cat = (category || '').toLowerCase().trim()
  let start = ''
  let end = ''

  if (cat === 'accommodation') {
    // Full trip span: check-in 15:00, check-out 11:00
    if (sDateStr === eDateStr) {
      start = `${sDateStr}T15:00`
      end = `${eDateStr}T21:00`
    } else {
      start = `${sDateStr}T15:00`
      end = `${eDateStr}T11:00`
    }
  } else if (
    cat === 'transport' ||
    cat === 'flights' ||
    cat === 'flight' ||
    cat === 'vehicle' ||
    cat === 'shared vehicle'
  ) {
    // Full trip span: 09:00 to 18:00
    start = `${sDateStr}T09:00`
    end = `${eDateStr}T18:00`
  } else if (cat === 'activities' || cat === 'activity') {
    // Day 1 from 09:00 to 12:00
    start = `${sDateStr}T09:00`
    end = `${sDateStr}T12:00`
  } else if (cat === 'food' || cat === 'meal' || cat === 'meals') {
    // Day 1 at 19:30
    start = `${sDateStr}T19:30`
    end = `${sDateStr}T21:30`
  } else {
    // Default: Day 1
    start = `${sDateStr}T09:00`
    end = `${sDateStr}T12:00`
  }

  return {
    start,
    end,
    startDate: start,
    endDate: end
  }
}

