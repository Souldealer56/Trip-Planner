import { supabase } from './supabase'

/**
 * Fetches all trips from the database ordered by start_date ascending.
 * @returns {Promise<Array>} A promise resolving to an array of trips.
 */
export async function fetchTrips() {
  const { data, error } = await supabase
    .from('trips')
    .select('id, title, destination, start_date, end_date, base_currency')
    .order('start_date', { ascending: true })

  if (error) {
    throw error
  }
  return data
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
