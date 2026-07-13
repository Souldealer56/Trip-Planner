import { supabase } from './supabase'

/**
 * Fetches the RSVP roster for a specific trip, including user profile details.
 * Uses native Supabase (Postgrest) table relations to query linked user details in one request.
 * @param {string} tripId The UUID of the trip.
 * @returns {Promise<Array>} A promise resolving to an array of RSVPs.
 */
export async function fetchRsvpRoster(tripId) {
  const { data, error } = await supabase
    .from('rsvps')
    .select('status, user_id, notes, users(*)')
    .eq('trip_id', tripId)

  if (error) {
    throw error
  }
  return data
}

/**
 * Creates / updates an RSVP record for a user joining a trip.
 * @param {string} tripId The UUID of the trip.
 * @param {string} userId The UUID of the user.
 * @param {string} status The RSVP status (default: 'Committed').
 * @returns {Promise<Object>} A promise resolving to the created RSVP record.
 */
export async function createRsvp(tripId, userId, status = 'Committed') {
  const { data, error } = await supabase
    .from('rsvps')
    .insert({
      trip_id: tripId,
      user_id: userId,
      status: status
    })
    .select()
    .single()

  if (error) {
    throw error
  }
  return data
}

/**
 * Updates the RSVP notes field for a specific participant.
 * @param {string} tripId The UUID of the trip.
 * @param {string} userId The UUID of the user.
 * @param {string} notes The note text to set.
 * @returns {Promise<Object>} A promise resolving to the updated RSVP record.
 */
export async function updateRsvpNote(tripId, userId, notes) {
  const { data, error } = await supabase
    .from('rsvps')
    .update({ notes })
    .eq('trip_id', tripId)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) {
    throw error
  }
  return data
}
