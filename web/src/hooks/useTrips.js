import { useState, useEffect, useCallback } from 'react'
import { fetchTrips } from '../services/trips'

/**
 * Custom hook to load and refresh the complete trips list.
 * @param {string} userId The UUID of the active user session.
 * @returns {Object} Object containing trips data, loading state, error, and refresh function.
 */
export function useTrips(userId) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const loadTrips = useCallback(async () => {
    if (!userId) {
      setData([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const trips = await fetchTrips(userId)
      setData(trips)
    } catch (err) {
      console.error('Error fetching trips:', err)
      setError(err.message || 'Failed to fetch trips')
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    loadTrips()
  }, [loadTrips])

  return { data, loading, error, refresh: loadTrips }
}
