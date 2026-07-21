import { supabase } from './supabase'

/**
 * Fetches trips for a specific user from the database ordered by start_date ascending.
 * @param {string} userId The UUID of the traveler.
 * @returns {Promise<Array>} A promise resolving to an array of trips.
 */
export async function fetchTrips(userId) {
  if (!userId) return []

  const { data, error } = await supabase
    .from('rsvps')
    .select('trip_id, trips(id, title, destination, start_date, end_date, base_currency)')
    .eq('user_id', userId)

  if (error) {
    throw error
  }

  // Map to clean trip structures and sort by start_date ascending
  return data
    .map(r => r.trips)
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
  return data
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
  const { data, error } = await supabase
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

  if (error) {
    throw error
  }
  return data
}

/**
 * Updates an existing trip's metadata in the database.
 * @param {string} id The UUID of the trip.
 * @param {Object} updates Object containing fields to update (title, destination, vibe, start_date, end_date, base_currency).
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
