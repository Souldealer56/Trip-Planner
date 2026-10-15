/**
 * Offline snapshot caching utilities for travelers with weak or no internet connection.
 * Caches trip details, roster, options, and expenses in localStorage under trip_offline_cache_{tripId}.
 */

const CACHE_PREFIX = 'trip_offline_cache_'

/**
 * Saves a full snapshot of trip data to localStorage.
 * @param {string} tripId The UUID of the trip.
 * @param {Object} data Snapshot payload containing { trip, roster, options, expenses }.
 */
export function saveTripOfflineSnapshot(tripId, data) {
  if (typeof localStorage === 'undefined' || !tripId || !data) return
  try {
    const existing = loadTripOfflineSnapshot(tripId) || {}
    const snapshot = {
      timestamp: Date.now(),
      trip: data.trip !== undefined ? data.trip : existing.trip,
      roster: data.roster !== undefined ? data.roster : existing.roster,
      options: data.options !== undefined ? data.options : existing.options,
      expenses: data.expenses !== undefined ? data.expenses : existing.expenses
    }
    localStorage.setItem(`${CACHE_PREFIX}${tripId}`, JSON.stringify(snapshot))
  } catch (err) {
    console.warn(`Failed to save offline snapshot for trip ${tripId}:`, err)
  }
}

/**
 * Loads a cached trip snapshot from localStorage.
 * @param {string} tripId The UUID of the trip.
 * @returns {Object|null} Cached snapshot object or null if none exists.
 */
export function loadTripOfflineSnapshot(tripId) {
  if (typeof localStorage === 'undefined' || !tripId) return null
  try {
    const raw = localStorage.getItem(`${CACHE_PREFIX}${tripId}`)
    if (!raw) return null
    return JSON.parse(raw)
  } catch (err) {
    console.warn(`Failed to parse offline snapshot for trip ${tripId}:`, err)
    return null
  }
}

/**
 * Checks whether the browser is currently offline or if a network error occurred.
 * @param {Error|null} [error=null] Optional error instance to inspect for network failure.
 * @returns {boolean} True if offline.
 */
export function isNetworkOffline(error = null) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return true
  }
  if (error) {
    const msg = (error.message || '').toLowerCase()
    return (
      msg.includes('failed to fetch') ||
      msg.includes('network') ||
      msg.includes('offline') ||
      msg.includes('internet') ||
      msg.includes('abort')
    )
  }
  return false
}
