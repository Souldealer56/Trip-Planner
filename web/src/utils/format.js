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

