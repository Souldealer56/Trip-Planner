const FX_CACHE_KEY = 'trip_planner_fx_cache'
const FX_CACHE_TTL = 6 * 60 * 60 * 1000 // 6 hours

const fallbackRates = {
  USD: 1.0,
  EUR: 0.92,
  GBP: 0.78,
  CAD: 1.36,
  AUD: 1.50,
  JPY: 155.0,
  CHF: 0.89,
  MXN: 18.0,
  ISK: 138.0,
  NZD: 1.64,
  SEK: 10.5,
  NOK: 10.6
}

/**
 * Fetches current exchange rates relative to USD from the free public API.
 * Uses 6-hour localStorage caching and an AbortSignal timeout of 4000ms.
 * Merges fresh results over comprehensive static fallbacks.
 * @returns {Promise<Object>} A promise resolving to a mapping of ISO currency codes to rates.
 */
export async function fetchExchangeRates() {
  // 1. Check local cache
  if (typeof localStorage !== 'undefined') {
    try {
      const cached = localStorage.getItem(FX_CACHE_KEY)
      if (cached) {
        const parsed = JSON.parse(cached)
        if (parsed && parsed.timestamp && (Date.now() - parsed.timestamp < FX_CACHE_TTL) && parsed.rates) {
          return { ...fallbackRates, ...parsed.rates }
        }
      }
    } catch (_) {
      // Ignore cache parse failures
    }
  }

  // 2. Network fetch with 4000ms timeout
  try {
    const timeoutSignal = typeof AbortSignal !== 'undefined' && AbortSignal.timeout
      ? AbortSignal.timeout(4000)
      : undefined

    const res = await fetch('https://open.er-api.com/v6/latest/USD', {
      signal: timeoutSignal
    })
    if (!res.ok) {
      throw new Error(`Rates API returned status ${res.status}`)
    }
    const data = await res.json()
    if (data && data.rates) {
      const mergedRates = { ...fallbackRates, ...data.rates }
      if (typeof localStorage !== 'undefined') {
        try {
          localStorage.setItem(FX_CACHE_KEY, JSON.stringify({
            timestamp: Date.now(),
            rates: mergedRates
          }))
        } catch (_) {}
      }
      return mergedRates
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
      amount: Math.round(payAmount * 100) / 100
    })

    debtor.amount -= payAmount
    creditor.amount -= payAmount

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
 * Computes individual traveler shares for an expense considering equal, custom amount,
 * or percentage split allocations with penny-accurate rounding remainders.
 * @param {number} expenseAmount The total converted expense amount.
 * @param {Array} splitUsers List of user IDs or custom split objects [{ user_id, amount, percent }].
 * @param {Array} fallbackUserIds Fallback list of committed user IDs if splitUsers is empty.
 * @returns {Map<string, number>} Map of userId to owed share amount.
 */
export function calculateExpenseParticipantShares(expenseAmount, splitUsers, fallbackUserIds = []) {
  const shares = new Map()
  const round2 = (num) => Math.round((num + Number.EPSILON) * 100) / 100

  if (!splitUsers || splitUsers.length === 0) {
    if (fallbackUserIds.length > 0) {
      const n = fallbackUserIds.length
      const equalShare = round2(expenseAmount / n)
      let sum = 0
      fallbackUserIds.forEach(uid => {
        shares.set(String(uid), equalShare)
        sum += equalShare
      })
      const delta = round2(expenseAmount - sum)
      if (delta !== 0) {
        const firstUid = String(fallbackUserIds[0])
        shares.set(firstUid, round2((shares.get(firstUid) || 0) + delta))
      }
    }
    return shares
  }

  // Check if splitUsers contains custom objects [{ user_id, amount, percent }]
  const firstItem = splitUsers[0]
  if (typeof firstItem === 'object' && firstItem !== null && (firstItem.amount !== undefined || firstItem.percent !== undefined)) {
    let totalPercent = 0
    let isAllPercent = true

    splitUsers.forEach(item => {
      if (item.percent !== undefined && item.percent !== null && !isNaN(parseFloat(item.percent))) {
        totalPercent += parseFloat(item.percent)
      } else {
        isAllPercent = false
      }
    })

    let calculatedSum = 0
    splitUsers.forEach(item => {
      const uId = String(item.user_id || item.userId)
      if (item.amount !== undefined && item.amount !== null && !isNaN(parseFloat(item.amount))) {
        const amt = round2(parseFloat(item.amount))
        shares.set(uId, amt)
        calculatedSum += amt
      } else if (item.percent !== undefined && item.percent !== null && !isNaN(parseFloat(item.percent))) {
        const pct = parseFloat(item.percent)
        const amt = round2((pct / 100) * expenseAmount)
        shares.set(uId, amt)
        calculatedSum += amt
      } else {
        shares.set(uId, 0)
      }
    })

    // If percentages sum to 100% (within tolerance), allocate penny remainder to the first participant
    if (isAllPercent && Math.abs(totalPercent - 100) < 0.01 && splitUsers.length > 0) {
      const delta = round2(expenseAmount - calculatedSum)
      if (delta !== 0) {
        const firstUid = String(splitUsers[0].user_id || splitUsers[0].userId)
        shares.set(firstUid, round2((shares.get(firstUid) || 0) + delta))
      }
    }
  } else {
    // Standard equal split across list of user IDs
    const userIds = splitUsers.map(String)
    const n = userIds.length
    if (n > 0) {
      const equalShare = round2(expenseAmount / n)
      let sum = 0
      userIds.forEach(uId => {
        shares.set(uId, equalShare)
        sum += equalShare
      })
      const delta = round2(expenseAmount - sum)
      if (delta !== 0) {
        shares.set(userIds[0], round2((shares.get(userIds[0]) || 0) + delta))
      }
    }
  }

  return shares
}

/**
 * Calculates budget analytics including total estimated locked option costs,
 * actual spend by category (supporting explicit category column and bilingual fallbacks),
 * and per-traveler balance/share breakdown.
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
      const formattedCat = cat.charAt(0).toUpperCase() + cat.slice(1).toLowerCase()
      categoryEstimates[formattedCat] = (categoryEstimates[formattedCat] || 0) + convertedCost
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

  if (expenses.length > 0) {
    expenses.forEach(exp => {
      const amount = parseFloat(exp.amount || 0)
      let converted = amount

      const rate = exp.exchange_rate ? parseFloat(exp.exchange_rate) : null
      if (rate && !isNaN(rate) && rate > 0) {
        converted = amount * rate
      } else if (rates) {
        converted = convertCurrency(amount, exp.currency || 'USD', baseCurrency, rates)
      }

      totalActualSpend += converted

      // Resolve category: first-class category column, then bilingual keyword fallback
      let cat = 'Other'
      const rawCat = (exp.category || '').trim().toLowerCase()
      if (rawCat && rawCat !== 'other') {
        if (rawCat === 'accommodation') cat = 'Accommodation'
        else if (rawCat === 'flights') cat = 'Flights'
        else if (rawCat === 'food') cat = 'Food'
        else if (rawCat === 'transport') cat = 'Transport'
        else if (rawCat === 'activities') cat = 'Activities'
        else cat = rawCat.charAt(0).toUpperCase() + rawCat.slice(1)
      } else {
        // Bilingual (English + French) keyword matching on description
        const descLower = (exp.description || '').toLowerCase()
        if (/hotel|h[oô]tel|h[eé]bergement|stay|airbnb|lodging|auberge/i.test(descLower)) cat = 'Accommodation'
        else if (/flight|vol|avion|airline|airfare|billet d'avion/i.test(descLower)) cat = 'Flights'
        else if (/dinner|d[iî]ner|lunch|d[eé]jeuner|food|resto|restaurant|courses|repas|meal|breakfast|petit[ -]d[eé]jeuner/i.test(descLower)) cat = 'Food'
        else if (/transport|car|voiture|uber|taxi|train|p[eé]age|toll|essence|gas|fuel|metro|m[eé]tro|bus/i.test(descLower)) cat = 'Transport'
        else if (/activity|activit[eé]|tour|ticket|billet|visite|excursion|mus[eé]e|museum/i.test(descLower)) cat = 'Activities'
      }

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
