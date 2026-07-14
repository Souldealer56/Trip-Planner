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
