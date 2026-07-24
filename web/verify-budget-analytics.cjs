const path = require('path')

function convertCurrency(amount, fromCurrency, toCurrency, rates) {
  if (!rates || amount === 0) return amount
  const from = (fromCurrency || 'USD').toUpperCase()
  const to = (toCurrency || 'USD').toUpperCase()
  if (from === to) return amount
  const fromRate = rates[from] || 1
  const toRate = rates[to] || 1
  return (amount / fromRate) * toRate
}

function calculateExpenseParticipantShares(expenseAmount, splitUsers, fallbackUserIds = []) {
  const shares = new Map()
  if (!splitUsers || splitUsers.length === 0) {
    if (fallbackUserIds.length > 0) {
      const equalShare = expenseAmount / fallbackUserIds.length
      fallbackUserIds.forEach(uid => shares.set(String(uid), equalShare))
    }
    return shares
  }

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
    const userIds = splitUsers.map(String)
    const equalShare = userIds.length > 0 ? expenseAmount / userIds.length : 0
    userIds.forEach(uId => shares.set(uId, equalShare))
  }

  return shares
}

function calculateTripBudgetAnalytics(expenses = [], options = [], roster = [], rates = null, baseCurrency = 'USD') {
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
      const converted = convertCurrency(amount, exp.currency || 'USD', baseCurrency, rates)
      totalActualSpend += converted

      let cat = 'Other'
      const descLower = (exp.description || '').toLowerCase()
      if (descLower.includes('hotel') || descLower.includes('stay') || descLower.includes('airbnb') || descLower.includes('lodging')) cat = 'Accommodation'
      else if (descLower.includes('flight') || descLower.includes('airline') || descLower.includes('airfare')) cat = 'Flights'
      else if (descLower.includes('dinner') || descLower.includes('food') || descLower.includes('lunch') || descLower.includes('meal')) cat = 'Food'
      else if (descLower.includes('car') || descLower.includes('uber') || descLower.includes('taxi') || descLower.includes('train')) cat = 'Transport'
      else if (descLower.includes('tour') || descLower.includes('ticket') || descLower.includes('activity')) cat = 'Activities'

      categoryActuals[cat] = (categoryActuals[cat] || 0) + converted

      const payerKey = String(exp.paid_by)
      if (travelerStats[payerKey]) {
        travelerStats[payerKey].paid += converted
      }

      const userShares = calculateExpenseParticipantShares(converted, exp.split_users, committedIds)
      userShares.forEach((owedShare, uId) => {
        if (travelerStats[uId]) {
          travelerStats[uId].owed += owedShare
        }
      })
    })
  }

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

function runVerification() {
  console.log('🧪 Starting Budget & Cost Distribution Analytics Verification...\n')

  try {
    const dummyRoster = [
      { user_id: 'user1', users: { first_name: 'Alice' } },
      { user_id: 'user2', users: { first_name: 'Bob' } }
    ]

    const dummyOptions = [
      { id: 1, option_text: 'Hotel Beach Resort', category: 'Accommodation', estimated_cost: 600, currency: 'USD' },
      { id: 2, option_text: 'Sunset Boat Tour', category: 'Activities', estimated_cost: 150, currency: 'USD' }
    ]

    const dummyExpenses = [
      { id: 101, description: 'Hotel Beach Resort Stay', amount: 600, currency: 'USD', paid_by: 'user1', split_users: ['user1', 'user2'] },
      { id: 102, description: 'Group Dinner at Seafood Spot', amount: 100, currency: 'USD', paid_by: 'user2', split_users: [{ user_id: 'user1', amount: 60 }, { user_id: 'user2', amount: 40 }] }
    ]

    const rates = { USD: 1.0, EUR: 0.92 }

    console.log('1. Calculating budget analytics...')
    const analytics = calculateTripBudgetAnalytics(dummyExpenses, dummyOptions, dummyRoster, rates, 'USD')

    console.log(`   ✓ Total Estimated Budget: ${analytics.totalEstimatedBudget} USD`)
    console.log(`   ✓ Total Actual Spend: ${analytics.totalActualSpend} USD`)
    console.log(`   ✓ Variance: ${analytics.variance} USD (${analytics.variancePercent.toFixed(1)}%)`)

    if (analytics.totalEstimatedBudget !== 750) {
      throw new Error(`Estimated budget mismatch! Expected 750, got ${analytics.totalEstimatedBudget}`)
    }

    if (analytics.totalActualSpend !== 700) {
      throw new Error(`Actual spend mismatch! Expected 700, got ${analytics.totalActualSpend}`)
    }

    console.log('\n2. Verifying per-traveler balance calculations...')
    const alice = analytics.travelerStats.find(t => t.userId === 'user1')
    const bob = analytics.travelerStats.find(t => t.userId === 'user2')

    if (!alice || !bob) throw new Error('Traveler stats missing!')
    
    // Alice paid $600, owes $300 (Hotel) + $60 (Dinner) = $360 -> Net Balance +$240
    // Bob paid $100, owes $300 (Hotel) + $40 (Dinner) = $340 -> Net Balance -$240
    console.log(`   ✓ Alice Paid: $${alice.paid}, Owed: $${alice.owed}, Net: $${alice.netBalance}`)
    console.log(`   ✓ Bob Paid: $${bob.paid}, Owed: $${bob.owed}, Net: $${bob.netBalance}`)

    if (Math.abs(alice.netBalance - 240) > 0.01 || Math.abs(bob.netBalance - (-240)) > 0.01) {
      throw new Error('Traveler net balance calculation mismatch!')
    }

    console.log('\n✅ ALL BUDGET ANALYTICS VERIFICATION CHECKS PASSED SUCCESSFULLY!')
    process.exit(0)
  } catch (err) {
    console.error('\n❌ Verification Failed:', err)
    process.exit(1)
  }
}

runVerification()
