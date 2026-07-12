import { useState, useEffect, useCallback } from 'react'
import { fetchTrips } from '../services/trips'

/**
 * Custom hook to load and refresh the complete trips list.
 * @returns {Object} Object containing trips data, loading state, error, and refresh function.
 */
export function useTrips() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const loadTrips = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const trips = await fetchTrips()
      setData(trips)
    } catch (err) {
      console.error('Error fetching trips:', err)
      setError(err.message || 'Failed to fetch trips')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadTrips()
  }, [loadTrips])

  return { data, loading, error, refresh: loadTrips }
}
