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

/**
 * Helper to parse numerical cost and currency from option text or option properties.
 */
export function parseOptionCost(option, baseCurrency = 'USD') {
  if (!option) return { amount: 0, currency: baseCurrency }
  if (option.estimated_cost && typeof option.estimated_cost === 'number' && option.estimated_cost > 0) {
    return { amount: option.estimated_cost, currency: option.currency || baseCurrency }
  }
  const text = option.option_text || option.text || ''
  const match = text.match(/([$€£¥A-Za-z]{1,3})\s*([\d,]+(?:\.\d+)?)/) || text.match(/([\d,]+(?:\.\d+)?)\s*([$€£¥A-Za-z]{1,3})?/)
  if (match) {
    const rawVal = match[1] && !isNaN(parseFloat(match[1].replace(/,/g, ''))) ? match[1] : match[2]
    const amount = parseFloat((rawVal || '0').replace(/,/g, ''))
    const currency = option.currency || baseCurrency
    return { amount: isNaN(amount) ? 0 : amount, currency }
  }
  return { amount: 0, currency: baseCurrency }
}

/**
 * Converts a locked trip option directly into a logged expense ledger entry.
 * @param {string} tripId The UUID of the trip.
 * @param {Object} option The locked option object.
 * @param {string|number} paidByUserId The ID of the payer.
 * @param {Array} splitUserIds Array of user IDs participating in the expense split.
 * @param {string} [baseCurrency] Default currency fallback.
 * @returns {Promise<Object>} Created expense record.
 */
export async function convertOptionToExpense(tripId, option, paidByUserId, splitUserIds, baseCurrency = 'USD') {
  const optionTitle = option.option_text || option.text || 'Locked Option'
  const description = `[Locked Option] ${optionTitle}`.trim()
  const { amount, currency } = parseOptionCost(option, baseCurrency)

  return logExpense(tripId, paidByUserId, amount, currency, description, splitUserIds)
}
