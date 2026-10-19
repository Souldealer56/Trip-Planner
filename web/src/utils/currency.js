import { getPresentTravelers } from '../services/rsvps.js'
export { getPresentTravelers }

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
  if (!balances) return []
  const debtors = []
  const creditors = []

  const balanceList = Array.isArray(balances) ? balances : Object.values(balances)
  balanceList.forEach(b => {
    if (!b) return
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

      const rawCat = (opt.category || 'Other').trim().toLowerCase()
      const effectiveCat = (rawCat === 'flights' || rawCat === 'flight') ? 'transport' : rawCat
      const formattedCat = effectiveCat.charAt(0).toUpperCase() + effectiveCat.slice(1).toLowerCase()
      categoryEstimates[formattedCat] = (categoryEstimates[formattedCat] || 0) + convertedCost
    }
  })

  // 2. Calculate Actual Logged Spend by Category & Per Traveler
  let totalActualSpend = 0
  const categoryActuals = {}
  const committedIds = roster.map(m => String(m.user_id))

  const travelerStats = {}
  roster.forEach(m => {
    const uId = String(m.user_id || m.id)
    travelerStats[uId] = {
      userId: uId,
      name: m.users?.first_name || m.username || 'Member',
      paid: 0,
      owed: 0,
      actualLoggedShare: 0,
      projectedFromLockedOptions: 0,
      totalProjectedPersonalCost: 0,
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

      // Resolve category: first-class category column, then description prefix, then linked option, then keyword fallback
      let cat = 'Other'
      const rawCat = (exp.category || '').trim().toLowerCase()
      if (rawCat && rawCat !== 'other') {
        if (rawCat === 'accommodation') cat = 'Accommodation'
        else if (rawCat === 'flights' || rawCat === 'flight' || rawCat === 'transport') cat = 'Transport'
        else if (rawCat === 'food') cat = 'Food'
        else if (rawCat === 'activities') cat = 'Activities'
        else cat = rawCat.charAt(0).toUpperCase() + rawCat.slice(1)
      } else {
        const descLower = (exp.description || '').toLowerCase()
        const bracketMatch = descLower.match(/^\[(accommodation|flights|flight|activities|food|transport|other)\]/i)
        if (bracketMatch && bracketMatch[1].toLowerCase() !== 'other') {
          const matched = bracketMatch[1].toLowerCase()
          if (matched === 'flights' || matched === 'flight') {
            cat = 'Transport'
          } else {
            cat = matched.charAt(0).toUpperCase() + matched.slice(1)
          }
        } else if (exp.option_id && options && options.length > 0) {
          const linkedOpt = options.find(o => String(o.id) === String(exp.option_id))
          if (linkedOpt && linkedOpt.category && linkedOpt.category.toLowerCase() !== 'other') {
            const lCat = linkedOpt.category.toLowerCase()
            if (lCat === 'flights' || lCat === 'flight') {
              cat = 'Transport'
            } else {
              cat = lCat.charAt(0).toUpperCase() + lCat.slice(1)
            }
          }
        }

        if (cat === 'Other') {
          if (/hotel|h[oô]tel|h[eé]bergement|stay|airbnb|lodging|auberge|villa|resort|machiya|ryokan|cabin|cottage|chalet|apartment|suite/i.test(descLower)) {
            cat = 'Accommodation'
          } else if (/flight|vol|avion|airline|airfare|billet d'avion|plane|transport|car|voiture|uber|taxi|train|ferry|p[eé]age|toll|essence|gas|fuel|metro|m[eé]tro|bus/i.test(descLower)) {
            cat = 'Transport'
          } else if (/dinner|d[iî]ner|lunch|d[eé]jeuner|food|resto|restaurant|courses|repas|meal|breakfast|petit[ -]d[eé]jeuner/i.test(descLower)) {
            cat = 'Food'
          } else if (/activity|activit[eé]|tour|ticket|billet|visite|excursion|mus[eé]e|museum/i.test(descLower)) {
            cat = 'Activities'
          }
        }
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

  // 3. Personal Projected Cost Simulator across locked options
  const hasAnyLocked = options.some(o => Boolean(o.is_locked))
  const candidateOptions = hasAnyLocked ? options.filter(o => Boolean(o.is_locked)) : options.filter(o => (o.estimated_cost || 0) > 0)

  // Identify options already converted into logged expenses to prevent double-counting
  const isOptionLogged = (opt) => {
    return expenses.some(exp => {
      if (exp.option_id && String(exp.option_id) === String(opt.id)) return true
      if (exp.description && opt.option_text) {
        const descLower = exp.description.toLowerCase()
        const textLower = opt.option_text.toLowerCase()
        const strippedDesc = descLower.replace(/^\[[^\]]+\]\s*/, '')
        if (descLower.includes(textLower) || textLower.includes(strippedDesc)) return true
      }
      return false
    })
  }

  let totalUnloggedLockedBudget = 0

  candidateOptions.forEach(opt => {
    if (!isOptionLogged(opt)) {
      const breakdown = calculateOptionCostBreakdown(opt, roster, rates, baseCurrency)
      totalUnloggedLockedBudget += breakdown.totalGroupCost
      breakdown.participantSharesMap.forEach((share, uId) => {
        if (travelerStats[uId]) {
          travelerStats[uId].projectedFromLockedOptions = (travelerStats[uId].projectedFromLockedOptions || 0) + share
        }
      })
    }
  })

  const round2 = (num) => Math.round((num + Number.EPSILON) * 100) / 100

  // 4. Compute Net Balances, Forecasts & Percent Shares
  Object.values(travelerStats).forEach(t => {
    t.netBalance = round2(t.paid - t.owed)
    t.sharePercent = totalActualSpend > 0 ? (t.owed / totalActualSpend) * 100 : 0
    t.actualLoggedShare = round2(t.owed)
    t.projectedFromLockedOptions = round2(t.projectedFromLockedOptions || 0)
    t.totalProjectedPersonalCost = round2(t.actualLoggedShare + t.projectedFromLockedOptions)
  })

  const variance = totalEstimatedBudget > 0 ? totalActualSpend - totalEstimatedBudget : 0
  const variancePercent = totalEstimatedBudget > 0 ? (variance / totalEstimatedBudget) * 100 : 0
  const totalProjectedTripCost = round2(totalActualSpend + totalUnloggedLockedBudget)

  return {
    totalEstimatedBudget,
    totalActualSpend,
    totalUnloggedLockedBudget: round2(totalUnloggedLockedBudget),
    totalProjectedTripCost,
    variance,
    variancePercent,
    categoryEstimates,
    categoryActuals,
    travelerStats: Object.values(travelerStats)
  }
}

/**
 * Calculates total and per-person cost breakdown for a pitched option based on its pricing model
 * ('split_total', 'per_person', or 'per_night') and assigned/present participants.
 * @param {Object} option The option object.
 * @param {Array} committedRoster Roster array of committed participants.
 * @param {Object|null} rates Currency exchange rates map.
 * @param {string} [baseCurrency='USD'] Target trip base currency.
 * @returns {Object} { totalGroupCost, perPersonCost, participantSharesMap, effectiveParticipantIds, costType }
 */
export function calculateOptionCostBreakdown(option, committedRoster = [], rates = null, baseCurrency = 'USD') {
  if (!option) {
    return {
      totalGroupCost: 0,
      perPersonCost: 0,
      participantSharesMap: new Map(),
      effectiveParticipantIds: [],
      costType: 'split_total'
    }
  }

  // Normalize committed roster array
  const normalizedRoster = Array.isArray(committedRoster)
    ? committedRoster.map(item => (typeof item === 'object' && item !== null ? item : { user_id: String(item), status: 'Committed' }))
    : []

  // Resolve effective participants list:
  // If assigned_users is specified and non-empty, use those users; otherwise use getPresentTravelers
  let effectiveParticipantIds = []
  if (Array.isArray(option.assigned_users) && option.assigned_users.length > 0) {
    effectiveParticipantIds = option.assigned_users.map(String)
  } else {
    const present = getPresentTravelers(normalizedRoster, option.start_date, option.end_date)
    effectiveParticipantIds = present.map(m => String(m.user_id || m.id))
  }

  // Calculate raw cost converted to baseCurrency
  const rawCost = parseFloat(option.estimated_cost || 0)
  const validCost = !isNaN(rawCost) && rawCost > 0 ? rawCost : 0
  const optCurrency = option.currency || baseCurrency || 'USD'
  const convertedCost = rates ? convertCurrency(validCost, optCurrency, baseCurrency, rates) : validCost
  const round2 = (num) => Math.round((num + Number.EPSILON) * 100) / 100
  const rawUnitOrTotal = round2(convertedCost)

  const costType = option.cost_type || 'split_total'
  const count = effectiveParticipantIds.length
  const participantSharesMap = new Map()

  let totalGroupCost = 0
  let perPersonCost = 0

  if (costType === 'per_person') {
    perPersonCost = rawUnitOrTotal
    totalGroupCost = round2(rawUnitOrTotal * Math.max(1, count))
    effectiveParticipantIds.forEach(uid => {
      participantSharesMap.set(uid, perPersonCost)
    })
  } else if (costType === 'per_night') {
    totalGroupCost = rawUnitOrTotal

    const optStart = option.start_date ? new Date(String(option.start_date).slice(0, 10)) : null
    const optEnd = option.end_date ? new Date(String(option.end_date).slice(0, 10)) : null

    const nightsMap = {}
    let totalStayNights = 0

    effectiveParticipantIds.forEach(uid => {
      const member = normalizedRoster.find(m => String(m.user_id || m.id) === uid)
      let stayNights = 1
      if (optStart && optEnd && optEnd > optStart) {
        const arr = member?.arrival_date ? new Date(String(member.arrival_date).slice(0, 10)) : optStart
        const dep = member?.departure_date ? new Date(String(member.departure_date).slice(0, 10)) : optEnd

        const overlapStart = Math.max(optStart.getTime(), arr.getTime())
        const overlapEnd = Math.min(optEnd.getTime(), dep.getTime())

        stayNights = overlapEnd > overlapStart ? Math.round((overlapEnd - overlapStart) / (1000 * 60 * 60 * 24)) : 0
      }
      nightsMap[uid] = stayNights
      totalStayNights += stayNights
    })

    if (totalStayNights > 0) {
      let sum = 0
      effectiveParticipantIds.forEach(uid => {
        const share = round2(totalGroupCost * (nightsMap[uid] / totalStayNights))
        participantSharesMap.set(uid, share)
        sum = round2(sum + share)
      })
      const delta = round2(totalGroupCost - sum)
      if (delta !== 0 && count > 0) {
        const firstUid = effectiveParticipantIds[0]
        participantSharesMap.set(firstUid, round2(participantSharesMap.get(firstUid) + delta))
      }
    } else {
      const equalShare = round2(totalGroupCost / Math.max(1, count))
      let sum = 0
      effectiveParticipantIds.forEach(uid => {
        participantSharesMap.set(uid, equalShare)
        sum = round2(sum + equalShare)
      })
      const delta = round2(totalGroupCost - sum)
      if (delta !== 0 && count > 0) {
        const firstUid = effectiveParticipantIds[0]
        participantSharesMap.set(firstUid, round2(participantSharesMap.get(firstUid) + delta))
      }
    }

    perPersonCost = count > 0 ? round2(totalGroupCost / count) : 0
  } else {
    // Default: 'split_total'
    totalGroupCost = rawUnitOrTotal
    perPersonCost = count > 0 ? round2(totalGroupCost / count) : totalGroupCost
    let sum = 0
    effectiveParticipantIds.forEach(uid => {
      participantSharesMap.set(uid, perPersonCost)
      sum = round2(sum + perPersonCost)
    })
    const delta = round2(totalGroupCost - sum)
    if (delta !== 0 && count > 0) {
      const firstUid = effectiveParticipantIds[0]
      participantSharesMap.set(firstUid, round2(participantSharesMap.get(firstUid) + delta))
    }
  }

  return {
    totalGroupCost,
    perPersonCost,
    participantSharesMap,
    effectiveParticipantIds,
    costType
  }
}

