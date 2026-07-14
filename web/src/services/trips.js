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
