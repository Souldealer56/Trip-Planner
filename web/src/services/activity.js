import { supabase } from './supabase'

/**
 * Fetches recent activity logs for a trip.
 * @param {string} tripId The UUID of the trip.
 * @param {number} limit Maximum number of records to return.
 * @returns {Promise<Array>} A promise resolving to an array of activity log records.
 */
export async function fetchActivityLogs(tripId, limit = 50) {
  const { data, error } = await supabase
    .from('activity_log')
    .select('*, users(first_name, username)')
    .eq('trip_id', tripId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    throw error
  }
  return data
}
