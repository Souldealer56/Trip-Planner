import { useState, useEffect, useCallback } from 'react'
import { fetchRsvpRoster } from '../services/rsvps'

/**
 * Custom hook to load and refresh the RSVP roster for a specific trip.
 * @param {string} tripId The UUID of the trip.
 * @returns {Object} Object containing roster data, loading state, error, and refresh function.
 */
export function useRsvpRoster(tripId) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const loadRoster = useCallback(async () => {
    if (!tripId) return
    setLoading(true)
    setError(null)
    try {
      const roster = await fetchRsvpRoster(tripId)
      setData(roster)
    } catch (err) {
      console.error(`Error fetching RSVP roster for trip ID ${tripId}:`, err)
      setError(err.message || 'Failed to fetch RSVP roster')
    } finally {
      setLoading(false)
    }
  }, [tripId])

  useEffect(() => {
    loadRoster()
  }, [loadRoster])

  return { data, loading, error, refresh: loadRoster }
}
