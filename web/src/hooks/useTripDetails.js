import { useState, useEffect, useCallback } from 'react'
import { fetchTripById } from '../services/trips'

/**
 * Custom hook to load and refresh specific trip details by ID.
 * @param {string} tripId The UUID of the trip.
 * @returns {Object} Object containing trip data, loading state, error, and refresh function.
 */
export function useTripDetails(tripId) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const loadTripDetails = useCallback(async () => {
    if (!tripId) return
    setLoading(true)
    setError(null)
    try {
      const trip = await fetchTripById(tripId)
      setData(trip)
    } catch (err) {
      console.error(`Error fetching trip details for ID ${tripId}:`, err)
      setError(err.message || 'Failed to fetch trip details')
    } finally {
      setLoading(false)
    }
  }, [tripId])

  useEffect(() => {
    loadTripDetails()
  }, [loadTripDetails])

  return { data, loading, error, refresh: loadTripDetails }
}
