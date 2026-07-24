/**
 * Fetches current exchange rates relative to USD from the free public API.
 * If fetch fails, it falls back to standard static baseline rates.
 * @returns {Promise<Object>} A promise resolving to a mapping of ISO currency codes to rates.
 */
export async function fetchExchangeRates() {
  const fallbackRates = {
    USD: 1.0,
    EUR: 0.92,
    GBP: 0.78,
    CAD: 1.35,
    AUD: 1.50
  }
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD')
    if (!res.ok) {
      throw new Error(`Rates API returned status ${res.status}`)
    }
    const data = await res.json()
    if (data && data.rates) {
      return data.rates
    }
    return fallbackRates
  } catch (err) {
    console.warn('Failed to fetch exchange rates, serving static fallbacks:', err)
    return fallbackRates
  }
}

/**
 * Converts an amount from one currency to another using USD as the intermediary base.
 * @param {number} amount The cost amount to convert.
 * @param {string} fromCurrency The source ISO currency code.
 * @param {string} toCurrency The target ISO currency code.
 * @param {Object} rates The currency rates mapping.
 * @returns {number} The converted cost amount.
 */
export function convertCurrency(amount, fromCurrency, toCurrency, rates) {
  if (!rates || amount === 0) {
    return amount
  }
  const from = (fromCurrency || 'USD').toUpperCase()
  const to = (toCurrency || 'USD').toUpperCase()
  if (from === to) {
    return amount
  }
  const fromRate = rates[from]
  const toRate = rates[to]
  if (!fromRate || !toRate) {
    console.warn(`Missing rate for conversion from ${from} to ${to}. Serving original amount.`)
    return amount
  }
  // Convert fromSource -> USD -> toTarget
  return (amount / fromRate) * toRate
}

/**
 * Greedily matches debtors and creditors to compute the minimum set of transactions to settle debts.
 * @param {Object} balances Map of userId to balance object containing { userId, name, paid, owed }.
 * @returns {Array<Object>} List of transactions containing { fromId, fromName, toId, toName, amount }.
 */
export function calculateSettlements(balances) {
  const debtors = []
  const creditors = []

  Object.values(balances).forEach(b => {
    const net = b.paid - b.owed
    if (net > 0.01) {
      creditors.push({ userId: b.userId, name: b.name, amount: net })
    } else if (net < -0.01) {
      debtors.push({ userId: b.userId, name: b.name, amount: Math.abs(net) })
    }
  })

  // Sort descending by amount to maximize greedy transaction settlement matches
  debtors.sort((a, b) => b.amount - a.amount)
  creditors.sort((a, b) => b.amount - a.amount)

  const transactions = []
  let i = 0
  let j = 0

  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i]
    const creditor = creditors[j]
    const payAmount = Math.min(debtor.amount, creditor.amount)

    transactions.push({
      fromId: debtor.userId,
      fromName: debtor.name,
      toId: creditor.userId,
      toName: creditor.name,
      amount: payAmount
    })

    debtor.amount -= payAmount
    creditor.amount -= payAmount

    // Check with small delta margin to avoid floating point precision issues
    if (debtor.amount < 0.01) {
      i++
    }
    if (creditor.amount < 0.01) {
      j++
    }
  }

  return transactions
}

/**
 * Computes individual traveler shares for an expense considering equal, custom amount, or percentage split allocations.
 * @param {number} expenseAmount The total converted expense amount.
 * @param {Array} splitUsers List of user IDs or custom split objects [{ user_id, amount, percent }].
 * @param {Array} fallbackUserIds Fallback list of committed user IDs if splitUsers is empty.
 * @returns {Map<string, number>} Map of userId to owed share amount.
 */
export function calculateExpenseParticipantShares(expenseAmount, splitUsers, fallbackUserIds = []) {
  const shares = new Map()
  if (!splitUsers || splitUsers.length === 0) {
    if (fallbackUserIds.length > 0) {
      const equalShare = expenseAmount / fallbackUserIds.length
      fallbackUserIds.forEach(uid => shares.set(String(uid), equalShare))
    }
    return shares
  }

  // Check if splitUsers contains custom objects
  const firstItem = splitUsers[0]
  if (typeof firstItem === 'object' && firstItem !== null && (firstItem.amount !== undefined || firstItem.percent !== undefined)) {
    splitUsers.forEach(item => {
      const uId = String(item.user_id || item.userId)
      if (item.amount !== undefined && item.amount !== null && !isNaN(parseFloat(item.amount))) {
        shares.set(uId, parseFloat(item.amount))
      } else if (item.percent !== undefined && item.percent !== null && !isNaN(parseFloat(item.percent))) {
        const share = (parseFloat(item.percent) / 100) * expenseAmount
        shares.set(uId, share)
      } else {
        shares.set(uId, 0)
      }
    })
  } else {
    // Standard equal split across list of user IDs
    const userIds = splitUsers.map(String)
    const equalShare = userIds.length > 0 ? expenseAmount / userIds.length : 0
    userIds.forEach(uId => shares.set(uId, equalShare))
  }

  return shares
}

/**
 * Calculates budget analytics including total estimated locked option costs,
 * actual spend by category, and per-traveler balance/share breakdown.
 * @param {Array} expenses List of expense records.
 * @param {Array} options List of locked options.
 * @param {Array} roster List of committed roster members.
 * @param {Object} rates Currency rates map relative to USD.
 * @param {string} baseCurrency Base currency code.
 * @returns {Object} Analytics summary.
 */
export function calculateTripBudgetAnalytics(expenses = [], options = [], roster = [], rates = null, baseCurrency = 'USD') {
  // 1. Calculate Estimated Budget from locked options
  let totalEstimatedBudget = 0
  const categoryEstimates = {}

  options.forEach(opt => {
    if (opt.estimated_cost && typeof opt.estimated_cost === 'number' && opt.estimated_cost > 0) {
      const optCurrency = opt.currency || baseCurrency
      const convertedCost = rates ? convertCurrency(opt.estimated_cost, optCurrency, baseCurrency, rates) : opt.estimated_cost
      totalEstimatedBudget += convertedCost

      const cat = (opt.category || 'Other').trim()
      categoryEstimates[cat] = (categoryEstimates[cat] || 0) + convertedCost
    }
  })

  // 2. Calculate Actual Logged Spend by Category & Per Traveler
  let totalActualSpend = 0
  const categoryActuals = {}
  const committedIds = roster.map(m => String(m.user_id))

  const travelerStats = {}
  roster.forEach(m => {
    travelerStats[String(m.user_id)] = {
      userId: String(m.user_id),
      name: m.users?.first_name || m.username || 'Member',
      paid: 0,
      owed: 0,
      netBalance: 0,
      sharePercent: 0
    }
  })

  if (rates && expenses.length > 0) {
    expenses.forEach(exp => {
      const amount = parseFloat(exp.amount || 0)
      const converted = convertCurrency(amount, exp.currency || 'USD', baseCurrency, rates)
      totalActualSpend += converted

      // Categorize description if prefixed or default to Other
      let cat = 'Other'
      const descLower = (exp.description || '').toLowerCase()
      if (descLower.includes('hotel') || descLower.includes('stay') || descLower.includes('airbnb') || descLower.includes('lodging')) cat = 'Accommodation'
      else if (descLower.includes('flight') || descLower.includes('airline') || descLower.includes('airfare')) cat = 'Flights'
      else if (descLower.includes('dinner') || descLower.includes('food') || descLower.includes('lunch') || descLower.includes('meal')) cat = 'Food'
      else if (descLower.includes('car') || descLower.includes('uber') || descLower.includes('taxi') || descLower.includes('train')) cat = 'Transport'
      else if (descLower.includes('tour') || descLower.includes('ticket') || descLower.includes('activity')) cat = 'Activities'

      categoryActuals[cat] = (categoryActuals[cat] || 0) + converted

      // Update Payer Paid Amount
      const payerKey = String(exp.paid_by)
      if (travelerStats[payerKey]) {
        travelerStats[payerKey].paid += converted
      }

      // Update Owed Shares
      const userShares = calculateExpenseParticipantShares(converted, exp.split_users, committedIds)
      userShares.forEach((owedShare, uId) => {
        if (travelerStats[uId]) {
          travelerStats[uId].owed += owedShare
        }
      })
    })
  }

  // 3. Compute Net Balances & Percent Shares
  Object.values(travelerStats).forEach(t => {
    t.netBalance = t.paid - t.owed
    t.sharePercent = totalActualSpend > 0 ? (t.owed / totalActualSpend) * 100 : 0
  })

  const variance = totalEstimatedBudget > 0 ? totalActualSpend - totalEstimatedBudget : 0
  const variancePercent = totalEstimatedBudget > 0 ? (variance / totalEstimatedBudget) * 100 : 0

  return {
    totalEstimatedBudget,
    totalActualSpend,
    variance,
    variancePercent,
    categoryEstimates,
    categoryActuals,
    travelerStats: Object.values(travelerStats)
  }
}
