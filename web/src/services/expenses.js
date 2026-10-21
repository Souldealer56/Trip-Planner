import { supabase } from './supabase.js'
import { calculateOptionCostBreakdown } from '../utils/currency.js'

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
  return (data || []).map((exp) => {
    if (!exp) return exp
    const catLower = (exp.category || '').toLowerCase().trim()
    if (catLower === 'flights' || catLower === 'flight') {
      return { ...exp, category: 'transport', is_legacy_flight: true }
    }
    return exp
  })
}

/**
 * Logs a new expense in the database with strongly-typed category, option link, and rate.
 * Gracefully falls back to baseline columns if new columns have not migrated yet.
 * @param {string} tripId The UUID of the trip.
 * @param {string} paidByUserId The UUID of the payer.
 * @param {number} amount The decimal cost amount.
 * @param {string} currency The ISO code (e.g. USD, EUR).
 * @param {string} description The description of the expense.
 * @param {Array} splitUsers Array of user UUIDs participating in the split.
 * @param {string} [category='other'] Expense category.
 * @param {string|null} [optionId=null] Linked option UUID.
 * @param {number|null} [exchangeRate=null] Frozen conversion exchange rate.
 * @returns {Promise<Object>} A promise resolving to the created expense record.
 */
export async function logExpense(
  tripId,
  paidByUserId,
  amount,
  currency,
  description,
  splitUsers,
  category = 'other',
  optionId = null,
  exchangeRate = null
) {
  const rawCat = (category || 'other').toLowerCase().trim()
  const normalizedCategory = (rawCat === 'flights' || rawCat === 'flight') ? 'transport' : rawCat
  const validCategory = ['accommodation', 'activities', 'food', 'transport', 'other'].includes(normalizedCategory)
    ? normalizedCategory
    : 'other'

  const payload = {
    trip_id: tripId,
    paid_by: paidByUserId,
    amount: parseFloat(amount),
    currency: currency || 'USD',
    description: description || '',
    split_users: splitUsers || [],
    category: validCategory,
    option_id: optionId || null,
    exchange_rate: exchangeRate !== null && exchangeRate !== undefined ? parseFloat(exchangeRate) : null
  }

  // Attempt insert with normalized columns
  const { data, error } = await supabase
    .from('expenses')
    .insert(payload)
    .select()
    .single()

  if (!error) {
    return data
  }

  // Fallback to baseline payload if schema has not yet migrated
  const fallbackPayload = {
    trip_id: tripId,
    paid_by: paidByUserId,
    amount: parseFloat(amount),
    currency: currency || 'USD',
    description: description || '',
    split_users: splitUsers || []
  }

  const fallback = await supabase
    .from('expenses')
    .insert(fallbackPayload)
    .select()
    .single()

  if (fallback.error) {
    throw fallback.error
  }
  return fallback.data
}

/**
 * Updates an existing expense in the database.
 * @param {string} expenseId UUID of the expense record.
 * @param {Object} updates Fields to update (description, amount, currency, category, paidBy, splitUsers).
 * @returns {Promise<Object>} The updated expense record.
 */
export async function updateExpense(
  expenseId,
  {
    description,
    amount,
    currency,
    category,
    paidBy,
    splitUsers
  }
) {
  const rawCat = (category || 'other').toLowerCase().trim()
  const normalizedCategory = (rawCat === 'flights' || rawCat === 'flight') ? 'transport' : rawCat
  const validCategory = ['accommodation', 'activities', 'food', 'transport', 'other'].includes(normalizedCategory)
    ? normalizedCategory
    : 'other'

  const payload = {
    paid_by: paidBy,
    amount: parseFloat(amount),
    currency: currency || 'USD',
    description: description || '',
    split_users: splitUsers || [],
    category: validCategory
  }

  const { data, error } = await supabase
    .from('expenses')
    .update(payload)
    .eq('id', expenseId)
    .select('*, users!expenses_paid_by_fkey(first_name, username)')
    .single()

  if (error) {
    throw error
  }
  return data
}

/**
 * Deletes an expense by its UUID.
 * @param {string} expenseId UUID of the expense to delete.
 * @returns {Promise<boolean>} True if successfully deleted.
 */
export async function deleteExpense(expenseId) {
  const { error } = await supabase
    .from('expenses')
    .delete()
    .eq('id', expenseId)

  if (error) {
    throw error
  }
  return true
}

/**
 * Helper to parse numerical cost and currency from option text or option properties.
 */
export function parseOptionCost(option, baseCurrency = 'USD') {
  if (!option) return { amount: 0, currency: baseCurrency }
  if (option.estimated_cost && !isNaN(Number(option.estimated_cost)) && Number(option.estimated_cost) > 0) {
    return { amount: Number(option.estimated_cost), currency: option.currency || baseCurrency }
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
 * Links participants (assigned_users / present travelers) and automatically splits
 * by pricing model ('split_total', 'per_person', or 'per_night').
 * @param {string} tripId The UUID of the trip.
 * @param {Object} option The locked option object.
 * @param {string|number} paidByUserId The ID of the payer.
 * @param {Array} committedRoster Roster array or split user IDs array.
 * @param {Object|string|null} [ratesOrBaseCurrency=null] Currency rates map or baseCurrency string.
 * @param {string|number|null} [baseCurrencyOrExchangeRate='USD'] Base currency or frozen rate.
 * @param {number|null} [exchangeRate=null] Frozen conversion rate.
 * @returns {Promise<Object>} Created expense record.
 */
export async function convertOptionToExpense(
  tripId,
  option,
  paidByUserId,
  committedRoster = [],
  ratesOrBaseCurrency = null,
  baseCurrencyOrExchangeRate = 'USD',
  exchangeRate = null
) {
  let rates = null
  let baseCurrency = 'USD'
  let frozenRate = null

  if (typeof ratesOrBaseCurrency === 'string') {
    baseCurrency = ratesOrBaseCurrency
    rates = null
    frozenRate = typeof baseCurrencyOrExchangeRate === 'number' ? baseCurrencyOrExchangeRate : null
  } else if (typeof ratesOrBaseCurrency === 'object' && ratesOrBaseCurrency !== null) {
    rates = ratesOrBaseCurrency
    baseCurrency = typeof baseCurrencyOrExchangeRate === 'string' ? baseCurrencyOrExchangeRate : 'USD'
    frozenRate = exchangeRate
  } else {
    baseCurrency = typeof baseCurrencyOrExchangeRate === 'string' ? baseCurrencyOrExchangeRate : 'USD'
    frozenRate = exchangeRate
  }

  // Normalize roster array
  const roster = Array.isArray(committedRoster)
    ? committedRoster.map(m => (typeof m === 'object' && m !== null ? m : { user_id: String(m), status: 'Committed' }))
    : []

  // Compute breakdown
  const breakdown = calculateOptionCostBreakdown(option, roster, rates, baseCurrency)

  const optionTitle = option.option_text || option.text || 'Locked Option'
  let rawCategory = (option.category || option.poll_category || '').toLowerCase().trim()
  if (rawCategory === 'flights' || rawCategory === 'flight') {
    rawCategory = 'transport'
  }
  
  if (!rawCategory || rawCategory === 'other') {
    const titleLower = optionTitle.toLowerCase()
    if (/hotel|h[oô]tel|h[eé]bergement|stay|airbnb|lodging|auberge|villa|resort|machiya|ryokan|cabin|cottage|chalet|apartment|suite/i.test(titleLower)) {
      rawCategory = 'accommodation'
    } else if (/flight|vol|avion|airline|airfare|plane|transport|car|voiture|uber|taxi|train|toll|gas|fuel|bus|ferry/i.test(titleLower)) {
      rawCategory = 'transport'
    } else if (/activity|activit[eé]|tour|ticket|billet|visite|excursion|mus[eé]e|museum/i.test(titleLower)) {
      rawCategory = 'activities'
    } else if (/dinner|d[iî]ner|lunch|d[eé]jeuner|food|resto|restaurant|courses|repas|meal|breakfast/i.test(titleLower)) {
      rawCategory = 'food'
    } else {
      rawCategory = 'accommodation'
    }
  }

  const category = rawCategory
  const description = `[${category.toUpperCase()}] ${optionTitle}`.trim()
  
  // Resolve amount and currency
  let amount = breakdown.totalGroupCost
  let currency = option.currency || baseCurrency || 'USD'

  if (rates && option.currency && option.currency.toUpperCase() !== baseCurrency.toUpperCase()) {
    currency = baseCurrency
  } else if (!amount || amount === 0) {
    const parsed = parseOptionCost(option, baseCurrency)
    amount = parsed.amount
    currency = parsed.currency
  }

  const optionId = option.id || null

  // Determine split_users based on cost_type
  let splitUsers = []
  if (breakdown.costType === 'per_night') {
    splitUsers = breakdown.effectiveParticipantIds.map(uid => ({
      user_id: uid,
      amount: breakdown.participantSharesMap.get(uid) || 0
    }))
  } else {
    // Both 'per_person' and 'split_total' split across effectiveParticipantIds
    splitUsers = breakdown.effectiveParticipantIds
  }

  return logExpense(
    tripId,
    paidByUserId,
    amount,
    currency,
    description,
    splitUsers,
    category,
    optionId,
    frozenRate
  )
}
