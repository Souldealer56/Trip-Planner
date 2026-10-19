import { supabase } from './supabase.js'

/**
 * Fetches trips for a specific user from the database ordered by start_date ascending.
 * @param {string} userId The UUID of the traveler.
 * @returns {Promise<Array>} A promise resolving to an array of trips.
 */
export async function fetchTrips(userId) {
  if (!userId) return []

  let { data, error } = await supabase
    .from('rsvps')
    .select('trip_id, trips(id, title, destination, start_date, end_date, base_currency, vibe, is_archived, organizer_id)')
    .eq('user_id', userId)

  if (error) {
    const fallback = await supabase
      .from('rsvps')
      .select('trip_id, trips(id, title, destination, start_date, end_date, base_currency, vibe, organizer_id)')
      .eq('user_id', userId)
    data = fallback.data
    error = fallback.error
  }

  if (error) {
    throw error
  }

  // Map to clean trip structures and sort by start_date ascending
  return (data || [])
    .map(r => r.trips ? { ...r.trips, is_archived: isTripArchived(r.trips) } : null)
    .filter(Boolean)
    .sort((a, b) => new Date(a.start_date) - new Date(b.start_date))
}

/**
 * Fetches details for a specific trip by its ID.
 * @param {string} id The UUID of the trip.
 * @returns {Promise<Object>} A promise resolving to the trip object.
 */
export async function fetchTripById(id) {
  const { data, error } = await supabase
    .from('trips')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    throw error
  }
  return { ...data, is_archived: isTripArchived(data) }
}

/**
 * Creates a new trip in the database.
 * @param {string} title The title of the trip.
 * @param {string} destination The destination of the trip.
 * @param {string} startDate The start date string (YYYY-MM-DD).
 * @param {string} endDate The end date string (YYYY-MM-DD).
 * @param {string} baseCurrency The base currency.
 * @returns {Promise<Object>} A promise resolving to the created trip object.
 */
export async function createTrip(title, destination, startDate, endDate, baseCurrency) {
  const payload = {
    title,
    destination,
    start_date: startDate,
    end_date: endDate,
    base_currency: baseCurrency,
    is_archived: false
  }

  const { data, error } = await supabase
    .from('trips')
    .insert(payload)
    .select()
    .single()

  if (!error) return { ...data, is_archived: false }

  const fallback = await supabase
    .from('trips')
    .insert({
      title,
      destination,
      start_date: startDate,
      end_date: endDate,
      base_currency: baseCurrency
    })
    .select()
    .single()

  if (fallback.error) {
    throw fallback.error
  }
  return { ...fallback.data, is_archived: false }
}

/**
 * Updates an existing trip's metadata in the database.
 * @param {string} id The UUID of the trip.
 * @param {Object} updates Object containing fields to update.
 * @returns {Promise<Object>} A promise resolving to the updated trip object.
 */
export async function updateTrip(id, updates) {
  const { data, error } = await supabase
    .from('trips')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    throw error
  }
  return { ...data, is_archived: isTripArchived(data) }
}

/**
 * Helper to determine if a trip is archived.
 * Strictly uses the boolean is_archived column.
 * @param {Object} trip The trip record.
 * @returns {boolean} True if trip is archived.
 */
export function isTripArchived(trip) {
  if (!trip) return false
  return Boolean(trip.is_archived)
}

/**
 * Archives a trip (soft-delete).
 * @param {string} id The UUID of the trip.
 * @returns {Promise<Object>} Updated trip object.
 */
export async function archiveTrip(id) {
  return updateTrip(id, { is_archived: true })
}

/**
 * Restores/unarchives an archived trip.
 * @param {string} id The UUID of the trip.
 * @returns {Promise<Object>} Updated trip object.
 */
export async function unarchiveTrip(id) {
  return updateTrip(id, { is_archived: false })
}

/**
 * Permanently deletes a trip along with clean cascading deletion of dependent records.
 * @param {string} id The UUID of the trip.
 * @returns {Promise<boolean>} True if successfully deleted.
 */
export async function deleteTrip(id) {
  if (!id) throw new Error('Trip ID is required for deletion.')

  // Manual cleanup in defensive try/catch blocks for resilience
  try {
    await supabase.from('activity_log').delete().eq('trip_id', id)
  } catch (_) {
    // Ignore errors if table or RLS prevents manual delete; CASCADE handles it
  }

  try {
    const { data: expData } = await supabase.from('expenses').select('id').eq('trip_id', id)
    const expIds = (expData || []).map(e => e.id)
    if (expIds.length > 0) {
      await supabase.from('expense_splits').delete().in('expense_id', expIds)
    }
    await supabase.from('expenses').delete().eq('trip_id', id)
  } catch (_) {
    // Handled by CASCADE
  }

  try {
    const { data: pollData } = await supabase.from('active_polls').select('id').eq('trip_id', id)
    const pollIds = (pollData || []).map(p => p.id)
    if (pollIds.length > 0) {
      await supabase.from('poll_votes').delete().in('poll_id', pollIds)
    }
    await supabase.from('option_votes').delete().eq('trip_id', id)
    await supabase.from('poll_options').delete().eq('trip_id', id)
    await supabase.from('active_polls').delete().eq('trip_id', id)
  } catch (_) {
    // Handled by CASCADE
  }

  try {
    await supabase.from('rsvps').delete().eq('trip_id', id)
  } catch (_) {
    // Handled by CASCADE
  }

  // Delete root trip record
  const { error } = await supabase.from('trips').delete().eq('id', id)
  if (error) throw error

  return true
}
