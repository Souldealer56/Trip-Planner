import { useState, useEffect, useCallback, useMemo } from 'react'
import { fetchExpenses, logExpense, updateExpense, deleteExpense } from '../services/expenses'
import { fetchExchangeRates, convertCurrency, calculateSettlements, calculateExpenseParticipantShares } from '../utils/currency'
import { saveTripOfflineSnapshot, loadTripOfflineSnapshot } from '../utils/offlineCache'

/**
 * Custom hook managing trip expenses, live currency rates, settlement minimization,
 * and ledger balances.
 *
 * @param {Object} options
 * @param {string} options.tripId - UUID of the trip
 * @param {string} [options.baseCurrency='USD'] - Base currency code for conversions
 * @param {Object} [options.activeUser] - Active user session
 * @param {Array} [options.committedMembers=[]] - List of committed RSVP travelers
 * @param {Function} [options.onActivityLogged] - Optional callback after mutating expenses
 * @param {Array} [options.initialExpenses] - Offline cached expenses fallback
 */
export function useTripFinancials({
  tripId,
  baseCurrency = 'USD',
  activeUser,
  committedMembers = [],
  onActivityLogged,
  initialExpenses
}) {
  const [expenses, setExpenses] = useState(() => {
    if (initialExpenses) return initialExpenses
    const cached = loadTripOfflineSnapshot(tripId)
    return cached?.expenses || []
  })
  const [expensesLoading, setExpensesLoading] = useState(false)
  const [rates, setRates] = useState(null)
  const [ledgerTab, setLedgerTab] = useState('ledger')

  const loadExpenses = useCallback(async (silent = false) => {
    if (!tripId) return
    if (!silent) setExpensesLoading(true)
    try {
      const data = await fetchExpenses(tripId)
      setExpenses(data || [])
      saveTripOfflineSnapshot(tripId, { expenses: data || [] })
    } catch (err) {
      console.warn('Failed to load expenses, checking offline cache:', err)
      const cached = loadTripOfflineSnapshot(tripId)
      if (cached?.expenses) setExpenses(cached.expenses)
    } finally {
      if (!silent) setExpensesLoading(false)
    }
  }, [tripId])

  useEffect(() => {
    if (activeUser && tripId) {
      loadExpenses()
      fetchExchangeRates().then(setRates).catch(console.warn)
    }
  }, [activeUser, tripId, loadExpenses])

  // Compute member balances and debt minimization settlements
  const { memberBalances, totalGroupSpend, settlementsList, perPersonSplit } = useMemo(() => {
    const balances = {}
    committedMembers.forEach((m) => {
      balances[m.user_id] = {
        userId: m.user_id,
        name: m.users?.first_name || m.username || 'Member',
        paid: 0.0,
        owed: 0.0
      }
    })

    let groupSpend = 0.0
    if (rates && expenses.length > 0) {
      expenses.forEach((exp) => {
        const payerId = exp.paid_by
        const originalAmount = parseFloat(exp.amount)
        const expCurrency = exp.currency || 'USD'
        const convertedAmount = exp.exchange_rate
          ? originalAmount * parseFloat(exp.exchange_rate)
          : convertCurrency(originalAmount, expCurrency, baseCurrency, rates)

        const fallbackUserIds = committedMembers.map((m) => m.user_id)
        const userShares = calculateExpenseParticipantShares(convertedAmount, exp.split_users, fallbackUserIds)

        userShares.forEach((owedShare, uIdStr) => {
          const targetKey = Object.keys(balances).find((k) => String(k) === uIdStr)
          if (targetKey && balances[targetKey]) {
            balances[targetKey].owed += owedShare
          }
        })

        const payerKey = Object.keys(balances).find((k) => String(k) === String(payerId))
        if (payerKey && balances[payerKey]) {
          balances[payerKey].paid += convertedAmount
          groupSpend += convertedAmount
        }
      })
    }

    const settlements = rates ? calculateSettlements(balances) : []
    const split = committedMembers.length > 0 ? groupSpend / committedMembers.length : 0.0

    return {
      memberBalances: balances,
      totalGroupSpend: groupSpend,
      settlementsList: settlements,
      perPersonSplit: split
    }
  }, [committedMembers, rates, expenses, baseCurrency])

  const submitExpense = async ({
    description,
    amount,
    currency,
    category,
    paidBy,
    splitUsers,
    optionId,
    expenseId
  }) => {
    if (expenseId) {
      await updateExpense(expenseId, {
        description,
        amount,
        currency,
        category,
        paidBy,
        splitUsers
      })
    } else {
      await logExpense(
        tripId,
        paidBy,
        amount,
        currency,
        description,
        splitUsers,
        category,
        optionId
      )
    }
    await loadExpenses(true)
    onActivityLogged?.()
  }

  const removeExpense = async (expenseId) => {
    await deleteExpense(expenseId)
    await loadExpenses(true)
    onActivityLogged?.()
  }

  const logGroceryExpense = async (expenseData) => {
    const {
      paid_by,
      amount,
      currency,
      description,
      split_details,
      category,
      option_id
    } = expenseData
    const splitUsers = split_details ? Object.keys(split_details) : []
    await logExpense(
      tripId,
      paid_by || activeUser?.id,
      amount,
      currency || baseCurrency || 'USD',
      description,
      splitUsers,
      category || 'food',
      option_id || null
    )
    await loadExpenses(true)
    onActivityLogged?.()
  }

  return {
    expenses,
    expensesLoading,
    rates,
    setRates,
    ledgerTab,
    setLedgerTab,
    loadExpenses,
    memberBalances,
    totalGroupSpend,
    settlementsList,
    perPersonSplit,
    submitExpense,
    removeExpense,
    logGroceryExpense
  }
}
