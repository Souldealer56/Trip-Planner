import { supabase } from './supabase'

/**
 * Fetches the RSVP roster for a specific trip, including user profile details.
 * Uses native Supabase (Postgrest) table relations to query linked user details in one request.
 * @param {string} tripId The UUID of the trip.
 * @returns {Promise<Array>} A promise resolving to an array of RSVPs.
 */
export async function fetchRsvpRoster(tripId) {
  let { data, error } = await supabase
    .from('rsvps')
    .select('status, user_id, notes, role, is_admin, users(*)')
    .eq('trip_id', tripId)

  if (error) {
    // Fallback if role or is_admin column absent on unmigrated schema
    const fallback = await supabase
      .from('rsvps')
      .select('status, user_id, notes, users(*)')
      .eq('trip_id', tripId)
    data = fallback.data
    error = fallback.error
  }

  if (error) {
    throw error
  }
  return data
}

/**
 * Creates / updates an RSVP record for a user joining a trip.
 * Uses upsert with onConflict on (trip_id, user_id) to prevent duplicate RSVP rows.
 * @param {string} tripId The UUID of the trip.
 * @param {string} userId The UUID of the user.
 * @param {string} [status='Committed'] The RSVP status.
 * @param {string} [role='member'] The RSVP role ('organizer', 'co_organizer', 'member').
 * @returns {Promise<Object>} A promise resolving to the created/updated RSVP record.
 */
export async function createRsvp(tripId, userId, status = 'Committed', role = 'member') {
  const payload = {
    trip_id: tripId,
    user_id: userId,
    status,
    role
  }

  const { data, error } = await supabase
    .from('rsvps')
    .upsert(payload, { onConflict: 'trip_id,user_id' })
    .select()
    .single()

  if (!error) return data

  // Fallback without role column if unmigrated
  const fallback = await supabase
    .from('rsvps')
    .upsert({
      trip_id: tripId,
      user_id: userId,
      status
    }, { onConflict: 'trip_id,user_id' })
    .select()
    .single()

  if (fallback.error) {
    throw fallback.error
  }
  return fallback.data
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
 * Strictly uses relational columns (trip.organizer_id, rsvp.role, rsvp.is_admin)
 * and never grants privileges from user-editable notes.
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

  // 2. Co-organizer or explicit admin check from RSVP role / is_admin column
  if (rsvp) {
    if (rsvp.role === 'organizer' || rsvp.role === 'co_organizer') {
      return true
    }
    if (rsvp.is_admin === true) {
      return true
    }
  }

  return false
}

/**
 * Promotes a participant to Co-Organizer admin status.
 * Updates role to 'co_organizer' and is_admin to true without mutating user notes.
 * @param {string} tripId The UUID of the trip.
 * @param {string|number} userId The ID of the participant.
 * @returns {Promise<Object>} Updated RSVP record.
 */
export async function promoteToCoOrganizer(tripId, userId) {
  try {
    const { data, error } = await supabase
      .from('rsvps')
      .update({ role: 'co_organizer', is_admin: true })
      .eq('trip_id', tripId)
      .eq('user_id', userId)
      .select()
      .single()
    if (!error) return data
  } catch (_) {
    // Fallback if role column is absent on unmigrated schema
  }

  const { data, error } = await supabase
    .from('rsvps')
    .update({ is_admin: true })
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
 * Demotes a Co-Organizer back to regular participant status.
 * Updates role to 'member' and is_admin to false without mutating user notes.
 * @param {string} tripId The UUID of the trip.
 * @param {string|number} userId The ID of the participant.
 * @returns {Promise<Object>} Updated RSVP record.
 */
export async function demoteCoOrganizer(tripId, userId) {
  try {
    const { data, error } = await supabase
      .from('rsvps')
      .update({ role: 'member', is_admin: false })
      .eq('trip_id', tripId)
      .eq('user_id', userId)
      .select()
      .single()
    if (!error) return data
  } catch (_) {
    // Fallback if role column is absent on unmigrated schema
  }

  const { data, error } = await supabase
    .from('rsvps')
    .update({ is_admin: false })
    .eq('trip_id', tripId)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) {
    throw error
  }
  return data
}
