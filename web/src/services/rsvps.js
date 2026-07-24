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

/**
 * Updates the RSVP status field for a specific participant.
 * @param {string} tripId The UUID of the trip.
 * @param {string} userId The UUID of the user.
 * @param {string} status The status to set ('Committed', 'Tentative', 'Declined').
 * @returns {Promise<Object>} A promise resolving to the updated RSVP record.
 */
export async function updateRsvpStatus(tripId, userId, status) {
  const { data, error } = await supabase
    .from('rsvps')
    .update({ status })
    .eq('trip_id', tripId)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) {
    throw error
  }
  return data
}

/**
 * Helper to determine if a user has admin/organizer permissions for a trip.
 * @param {Object|number|string} user The active user object or user ID.
 * @param {Object} trip The trip object.
 * @param {Object} [rsvp] Optional RSVP record for the user on this trip.
 * @returns {boolean} True if user is the primary organizer or a co-organizer.
 */
export function isUserTripAdmin(user, trip, rsvp) {
  if (!user || !trip) return false
  const userId = typeof user === 'object' ? user.id : user

  // 1. Primary organizer check
  if (trip.organizer_id && String(trip.organizer_id) === String(userId)) {
    return true
  }

  // 2. Co-organizer check from RSVP
  if (rsvp) {
    if (rsvp.is_admin === true) return true
    if (rsvp.notes && typeof rsvp.notes === 'string' && (rsvp.notes.includes('[CO_ORGANIZER]') || rsvp.notes.includes('[ADMIN]'))) {
      return true
    }
  }

  return false
}

/**
 * Promotes a participant to Co-Organizer admin status.
 * @param {string} tripId The UUID of the trip.
 * @param {string|number} userId The ID of the participant.
 * @returns {Promise<Object>} Updated RSVP record.
 */
export async function promoteToCoOrganizer(tripId, userId) {
  const { data: rsvp } = await supabase
    .from('rsvps')
    .select('*')
    .eq('trip_id', tripId)
    .eq('user_id', userId)
    .single()

  const currentNotes = rsvp?.notes || ''
  const newNotes = currentNotes.includes('[CO_ORGANIZER]') ? currentNotes : `[CO_ORGANIZER] ${currentNotes}`.trim()

  try {
    const { data, error } = await supabase
      .from('rsvps')
      .update({ notes: newNotes, is_admin: true })
      .eq('trip_id', tripId)
      .eq('user_id', userId)
      .select()
      .single()
    if (!error) return data
  } catch (e) {
    // Fallback if is_admin column absent
  }

  return updateRsvpNote(tripId, userId, newNotes)
}

/**
 * Demotes a Co-Organizer back to regular participant status.
 * @param {string} tripId The UUID of the trip.
 * @param {string|number} userId The ID of the participant.
 * @returns {Promise<Object>} Updated RSVP record.
 */
export async function demoteCoOrganizer(tripId, userId) {
  const { data: rsvp } = await supabase
    .from('rsvps')
    .select('*')
    .eq('trip_id', tripId)
    .eq('user_id', userId)
    .single()

  const currentNotes = rsvp?.notes || ''
  const newNotes = currentNotes.replace(/\[(CO_ORGANIZER|ADMIN)\]\s*/g, '').trim() || null

  try {
    const { data, error } = await supabase
      .from('rsvps')
      .update({ notes: newNotes, is_admin: false })
      .eq('trip_id', tripId)
      .eq('user_id', userId)
      .select()
      .single()
    if (!error) return data
  } catch (e) {
    // Fallback if is_admin column absent
  }

  return updateRsvpNote(tripId, userId, newNotes)
}
