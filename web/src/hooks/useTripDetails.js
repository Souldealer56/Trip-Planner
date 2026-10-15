import { useState, useEffect, useCallback } from 'react'
import { fetchTripById } from '../services/trips'
import { loadTripOfflineSnapshot, saveTripOfflineSnapshot, isNetworkOffline } from '../utils/offlineCache'

/**
 * Custom hook to load and refresh specific trip details by ID.
 * Supports offline fallback using localStorage snapshot caching.
 * @param {string} tripId The UUID of the trip.
 * @returns {Object} Object containing trip data, loading state, error, isOffline flag, and refresh function.
 */
export function useTripDetails(tripId) {
  const [data, setData] = useState(() => {
    const cached = loadTripOfflineSnapshot(tripId)
    return cached?.trip || null
  })
  const [loading, setLoading] = useState(!data)
  const [error, setError] = useState(null)
  const [isOffline, setIsOffline] = useState(false)

  const loadTripDetails = useCallback(async () => {
    if (!tripId) return
    setLoading(true)
    setError(null)
    try {
      const trip = await fetchTripById(tripId)
      setData(trip)
      setIsOffline(false)
      saveTripOfflineSnapshot(tripId, { trip })
    } catch (err) {
      console.error(`Error fetching trip details for ID ${tripId}:`, err)
      const cached = loadTripOfflineSnapshot(tripId)
      if (cached?.trip) {
        setData(cached.trip)
        setIsOffline(true)
      } else {
        setError(err.message || 'Failed to fetch trip details')
      }
    } finally {
      setLoading(false)
    }
  }, [tripId])

  useEffect(() => {
    loadTripDetails()
  }, [loadTripDetails])

  return { data, loading, error, isOffline, refresh: loadTripDetails }
}

