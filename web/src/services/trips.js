import { supabase } from './supabase'

/**
 * Fetches trips for a specific user from the database ordered by start_date ascending.
 * @param {string} userId The UUID of the traveler.
 * @returns {Promise<Array>} A promise resolving to an array of trips.
 */
export async function fetchTrips(userId) {
  if (!userId) return []

  let { data, error } = await supabase
    .from('rsvps')
    .select('trip_id, trips(id, title, destination, start_date, end_date, base_currency, vibe, is_archived)')
    .eq('user_id', userId)

  if (error) {
    const fallback = await supabase
      .from('rsvps')
      .select('trip_id, trips(id, title, destination, start_date, end_date, base_currency, vibe)')
      .eq('user_id', userId)
    data = fallback.data
    error = fallback.error
  }

  if (error) {
    throw error
  }

  // Map to clean trip structures, compute is_archived, and sort by start_date ascending
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
    base_currency: baseCurrency
  }

  const { data, error } = await supabase
    .from('trips')
    .insert({ ...payload, is_archived: false })
    .select()
    .single()

  if (!error) return { ...data, is_archived: false }

  const fallback = await supabase
    .from('trips')
    .insert(payload)
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
 * @param {Object} updates Object containing fields to update (title, destination, vibe, start_date, end_date, base_currency, is_archived).
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
  return data
}

/**
 * Helper to determine if a trip is archived from object properties.
 */
export function isTripArchived(trip) {
  if (!trip) return false
  if (trip.is_archived === true) return true
  if (trip.vibe && typeof trip.vibe === 'string' && trip.vibe.includes('[ARCHIVED]')) return true
  return false
}

/**
 * Archives a trip (soft-delete).
 * Uses is_archived column if available, with [ARCHIVED] vibe tag fallback for schema resilience.
 * @param {string} id The UUID of the trip.
 * @returns {Promise<Object>} Updated trip object.
 */
export async function archiveTrip(id) {
  const current = await fetchTripById(id)
  const currentVibe = current.vibe || ''
  const newVibe = currentVibe.includes('[ARCHIVED]') ? currentVibe : `[ARCHIVED] ${currentVibe}`.trim()

  const updates = { vibe: newVibe }
  try {
    const { data, error } = await supabase
      .from('trips')
      .update({ ...updates, is_archived: true })
      .eq('id', id)
      .select()
      .single()
    if (!error) return { ...data, is_archived: true }
  } catch (e) {
    // Ignore schema error if is_archived column absent
  }

  return updateTrip(id, updates)
}

/**
 * Restores/unarchives an archived trip.
 * @param {string} id The UUID of the trip.
 * @returns {Promise<Object>} Updated trip object.
 */
export async function unarchiveTrip(id) {
  const current = await fetchTripById(id)
  const currentVibe = current.vibe || ''
  const newVibe = currentVibe.replace(/\[ARCHIVED\]\s*/g, '').trim() || null

  const updates = { vibe: newVibe }
  try {
    const { data, error } = await supabase
      .from('trips')
      .update({ ...updates, is_archived: false })
      .eq('id', id)
      .select()
      .single()
    if (!error) return { ...data, is_archived: false }
  } catch (e) {
    // Ignore schema error if is_archived column absent
  }

  return updateTrip(id, updates)
}

/**
 * Permanently deletes a trip along with clean cascading deletion of dependent records.
 * @param {string} id The UUID of the trip.
 * @returns {Promise<boolean>} True if successfully deleted.
 */
export async function deleteTrip(id) {
  if (!id) throw new Error('Trip ID is required for deletion.')

  // 1. Delete activity logs
  await supabase.from('activity_log').delete().eq('trip_id', id)

  // 2. Fetch expenses and delete splits
  const { data: expData } = await supabase.from('expenses').select('id').eq('trip_id', id)
  const expIds = (expData || []).map(e => e.id)
  if (expIds.length > 0) {
    await supabase.from('expense_splits').delete().in('expense_id', expIds)
  }
  await supabase.from('expenses').delete().eq('trip_id', id)

  // 3. Fetch active polls and delete votes + poll options
  const { data: pollData } = await supabase.from('active_polls').select('id').eq('trip_id', id)
  const pollIds = (pollData || []).map(p => p.id)
  if (pollIds.length > 0) {
    await supabase.from('poll_votes').delete().in('poll_id', pollIds)
  }
  await supabase.from('poll_options').delete().eq('trip_id', id)
  await supabase.from('active_polls').delete().eq('trip_id', id)

  // 4. Delete RSVPs
  await supabase.from('rsvps').delete().eq('trip_id', id)

  // 5. Delete trip record
  const { error } = await supabase.from('trips').delete().eq('id', id)
  if (error) throw error

  return true
}
