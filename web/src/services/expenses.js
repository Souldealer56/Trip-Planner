import { supabase } from './supabase'

/**
 * Fetches all expenses logged for a trip, joining with the payer's user details.
 * @param {string} tripId The UUID of the trip.
 * @returns {Promise<Array>} A promise resolving to an array of expense records.
 */
export async function fetchExpenses(tripId) {
  const { data, error } = await supabase
    .from('expenses')
    .select('*, users!expenses_paid_by_fkey(first_name, username)')
    .eq('trip_id', tripId)
    .order('created_at', { ascending: true })

  if (error) {
    throw error
  }
  return data
}

/**
 * Logs a new expense in the database.
 * @param {string} tripId The UUID of the trip.
 * @param {string} paidByUserId The UUID of the payer.
 * @param {number} amount The decimal cost amount.
 * @param {string} currency The ISO code (e.g. USD, EUR).
 * @param {string} description The description of the expense.
 * @param {Array} splitUsers Array of user UUIDs participating in the split.
 * @returns {Promise<Object>} A promise resolving to the created expense record.
 */
export async function logExpense(tripId, paidByUserId, amount, currency, description, splitUsers) {
  const { data, error } = await supabase
    .from('expenses')
    .insert({
      trip_id: tripId,
      paid_by: paidByUserId,
      amount: parseFloat(amount),
      currency: currency || 'USD',
      description: description || '',
      split_users: splitUsers || []
    })
    .select()
    .single()

  if (error) {
    throw error
  }
  return data
}
