import { useState, useCallback } from 'react'
import { createUser } from '../services/users'
import { createRsvp } from '../services/rsvps'

/**
 * Custom hook to manage the sequence of adding a new participant to a trip.
 * This inserts a new user record and immediately creates a committed RSVP.
 * @returns {Object} Object containing loading state, error state, and the addParticipant function.
 */
export function useAddParticipant() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const addParticipant = useCallback(async (tripId, username, firstName) => {
    setLoading(true)
    setError(null)
    try {
      // 1. Create the user record in DB
      const user = await createUser(username, firstName)

      // 2. Link the user to the trip via RSVP record
      await createRsvp(tripId, user.id, 'Committed')

      setLoading(false)
      return user
    } catch (err) {
      console.error('Error adding participant:', err)
      setError(err.message || 'Failed to add participant to trip')
      setLoading(false)
      throw err
    }
  }, [])

  return { addParticipant, loading, error }
}
