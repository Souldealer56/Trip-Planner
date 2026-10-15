import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  convertCurrency,
  calculateExpenseParticipantShares,
  calculateSettlements,
  calculateTripBudgetAnalytics,
  fetchExchangeRates
} from '../utils/currency'

describe('Currency & Expense Utilities', () => {
  const rates = {
    USD: 1.0,
    EUR: 0.92,
    GBP: 0.78,
    CAD: 1.36,
    AUD: 1.50,
    JPY: 155.0,
    CHF: 0.89,
    MXN: 18.0
  }

  describe('convertCurrency', () => {
    it('returns exact amount when fromCurrency matches toCurrency', () => {
      expect(convertCurrency(100, 'USD', 'USD', rates)).toBe(100)
      expect(convertCurrency(50, 'EUR', 'EUR', rates)).toBe(50)
    })

    it('returns amount directly when amount is 0 or rates are null', () => {
      expect(convertCurrency(0, 'USD', 'EUR', rates)).toBe(0)
      expect(convertCurrency(100, 'USD', 'EUR', null)).toBe(100)
    })

    it('accurately converts from USD to other currencies', () => {
      // 100 USD -> 92 EUR
      expect(convertCurrency(100, 'USD', 'EUR', rates)).toBeCloseTo(92, 2)
      // 100 USD -> 136 CAD
      expect(convertCurrency(100, 'USD', 'CAD', rates)).toBeCloseTo(136, 2)
      // 100 USD -> 15500 JPY
      expect(convertCurrency(100, 'USD', 'JPY', rates)).toBeCloseTo(15500, 2)
    })

    it('accurately converts non-USD to non-USD via USD intermediary', () => {
      // 92 EUR is 100 USD -> in CAD it should be 136 CAD
      expect(convertCurrency(92, 'EUR', 'CAD', rates)).toBeCloseTo(136, 2)
      // 136 CAD is 100 USD -> in EUR it should be 92 EUR
      expect(convertCurrency(136, 'CAD', 'EUR', rates)).toBeCloseTo(92, 2)
    })

    it('returns original amount when rate is missing', () => {
      expect(convertCurrency(100, 'XYZ', 'USD', rates)).toBe(100)
      expect(convertCurrency(100, 'USD', 'XYZ', rates)).toBe(100)
    })
  })

  describe('calculateExpenseParticipantShares', () => {
    it('calculates equal splits across array of user IDs', () => {
      const shares = calculateExpenseParticipantShares(100, ['u1', 'u2'])
      expect(shares.get('u1')).toBe(50)
      expect(shares.get('u2')).toBe(50)
    })

    it('allocates 1-cent floating rounding remainder to first participant on equal splits', () => {
      // 100 / 3 = 33.33 + 33.33 + 33.33 = 99.99 (delta 0.01 to first)
      const shares = calculateExpenseParticipantShares(100, ['u1', 'u2', 'u3'])
      expect(shares.get('u1')).toBe(33.34)
      expect(shares.get('u2')).toBe(33.33)
      expect(shares.get('u3')).toBe(33.33)
      const sum = shares.get('u1') + shares.get('u2') + shares.get('u3')
      expect(sum).toBe(100)
    })

    it('uses fallbackUserIds when splitUsers is empty or null', () => {
      const shares = calculateExpenseParticipantShares(60, null, ['userA', 'userB', 'userC'])
      expect(shares.get('userA')).toBe(20)
      expect(shares.get('userB')).toBe(20)
      expect(shares.get('userC')).toBe(20)
    })

    it('handles custom dollar amount splits', () => {
      const customSplits = [
        { user_id: 'u1', amount: 70.0 },
        { user_id: 'u2', amount: 30.0 }
      ]
      const shares = calculateExpenseParticipantShares(100, customSplits)
      expect(shares.get('u1')).toBe(70.0)
      expect(shares.get('u2')).toBe(30.0)
    })

    it('handles custom percentage splits and allocates rounding remainder if 100%', () => {
      const customSplits = [
        { user_id: 'u1', percent: 60.0 },
        { user_id: 'u2', percent: 40.0 }
      ]
      const shares = calculateExpenseParticipantShares(200, customSplits)
      expect(shares.get('u1')).toBe(120.0)
      expect(shares.get('u2')).toBe(80.0)
    })

    it('allocates remainder when 3-way 33.33% percentage split is used', () => {
      const customSplits = [
        { user_id: 'u1', percent: 33.34 },
        { user_id: 'u2', percent: 33.33 },
        { user_id: 'u3', percent: 33.33 }
      ]
      const shares = calculateExpenseParticipantShares(100, customSplits)
      const sum = shares.get('u1') + shares.get('u2') + shares.get('u3')
      expect(sum).toBe(100)
    })
  })

  describe('calculateSettlements', () => {
    it('returns empty array when everyone is settled', () => {
      const balances = {
        u1: { userId: 'u1', name: 'Alice', paid: 50, owed: 50 },
        u2: { userId: 'u2', name: 'Bob', paid: 50, owed: 50 }
      }
      expect(calculateSettlements(balances)).toEqual([])
    })

    it('minimizes transactions in a 3-person group using greedy settlement', () => {
      // Alice paid 90, owed 30 -> +60
      // Bob paid 0, owed 30 -> -30
      // Charlie paid 0, owed 30 -> -30
      const balances = {
        u1: { userId: 'u1', name: 'Alice', paid: 90, owed: 30 },
        u2: { userId: 'u2', name: 'Bob', paid: 0, owed: 30 },
        u3: { userId: 'u3', name: 'Charlie', paid: 0, owed: 30 }
      }
      const settlements = calculateSettlements(balances)
      expect(settlements).toHaveLength(2)
      
      const totalSettled = settlements.reduce((sum, s) => sum + s.amount, 0)
      expect(totalSettled).toBe(60)
      expect(settlements.every(s => s.toId === 'u1')).toBe(true)
    })

    it('handles direct 2-person debt accurately', () => {
      const balances = {
        u1: { userId: 'u1', name: 'Alice', paid: 100, owed: 50 },
        u2: { userId: 'u2', name: 'Bob', paid: 0, owed: 50 }
      }
      const settlements = calculateSettlements(balances)
      expect(settlements).toEqual([
        {
          fromId: 'u2',
          fromName: 'Bob',
          toId: 'u1',
          toName: 'Alice',
          amount: 50
        }
      ])
    })
  })

  describe('calculateTripBudgetAnalytics', () => {
    const dummyRoster = [
      { user_id: 'user1', users: { first_name: 'Alice' } },
      { user_id: 'user2', users: { first_name: 'Bob' } }
    ]

    const dummyOptions = [
      { id: 1, option_text: 'Hotel Beach Resort', category: 'Accommodation', estimated_cost: 600, currency: 'USD' },
      { id: 2, option_text: 'Sunset Boat Tour', category: 'Activities', estimated_cost: 150, currency: 'USD' }
    ]

    it('calculates total estimated budget and category estimates correctly', () => {
      const analytics = calculateTripBudgetAnalytics([], dummyOptions, dummyRoster, rates, 'USD')
      expect(analytics.totalEstimatedBudget).toBe(750)
      expect(analytics.categoryEstimates.Accommodation).toBe(600)
      expect(analytics.categoryEstimates.Activities).toBe(150)
    })

    it('calculates actual spend, category actuals, and per-traveler net balances', () => {
      const dummyExpenses = [
        {
          id: 101,
          description: 'Hotel Beach Resort Stay',
          amount: 600,
          currency: 'USD',
          paid_by: 'user1',
          split_users: ['user1', 'user2']
        },
        {
          id: 102,
          description: 'Group Dinner at Seafood Spot',
          amount: 100,
          currency: 'USD',
          paid_by: 'user2',
          split_users: [
            { user_id: 'user1', amount: 60 },
            { user_id: 'user2', amount: 40 }
          ]
        }
      ]

      const analytics = calculateTripBudgetAnalytics(dummyExpenses, dummyOptions, dummyRoster, rates, 'USD')

      expect(analytics.totalEstimatedBudget).toBe(750)
      expect(analytics.totalActualSpend).toBe(700)
      expect(analytics.variance).toBe(-50) // 700 - 750
      expect(analytics.variancePercent).toBeCloseTo((-50 / 750) * 100, 1)

      const alice = analytics.travelerStats.find(t => t.userId === 'user1')
      const bob = analytics.travelerStats.find(t => t.userId === 'user2')

      // Alice: paid 600, owes 300 (hotel) + 60 (dinner) = 360 -> net +240
      expect(alice.paid).toBe(600)
      expect(alice.owed).toBe(360)
      expect(alice.netBalance).toBe(240)

      // Bob: paid 100, owes 300 (hotel) + 40 (dinner) = 340 -> net -240
      expect(bob.paid).toBe(100)
      expect(bob.owed).toBe(340)
      expect(bob.netBalance).toBe(-240)
    })

    it('resolves explicit expense categories before falling back to bilingual keywords', () => {
      const expensesWithCategories = [
        {
          id: 201,
          category: 'Transport',
          description: 'Unknown service XYZ',
          amount: 50,
          currency: 'USD',
          paid_by: 'user1',
          split_users: ['user1']
        },
        {
          id: 202,
          category: 'Other',
          description: 'Dîner au bistrot parisien',
          amount: 80,
          currency: 'USD',
          paid_by: 'user1',
          split_users: ['user1']
        },
        {
          id: 203,
          description: 'Billet d avion Air France',
          amount: 300,
          currency: 'USD',
          paid_by: 'user1',
          split_users: ['user1']
        }
      ]

      const analytics = calculateTripBudgetAnalytics(expensesWithCategories, [], dummyRoster, rates, 'USD')
      expect(analytics.categoryActuals.Transport).toBe(50)
      expect(analytics.categoryActuals.Food).toBe(80)
      expect(analytics.categoryActuals.Flights).toBe(300)
    })

    it('respects frozen exchange_rate column stored on expense record', () => {
      const expensesWithFrozenRate = [
        {
          id: 301,
          amount: 100,
          currency: 'EUR',
          exchange_rate: 1.10, // Stored custom rate
          paid_by: 'user1',
          split_users: ['user1']
        }
      ]

      const analytics = calculateTripBudgetAnalytics(expensesWithFrozenRate, [], dummyRoster, rates, 'USD')
      // 100 * 1.10 = 110 USD (rather than 100 / 0.92 = 108.70)
      expect(analytics.totalActualSpend).toBeCloseTo(110, 2)
    })
  })

  describe('fetchExchangeRates', () => {
    let mockStorage = {}

    beforeEach(() => {
      vi.restoreAllMocks()
      mockStorage = {}
      Object.defineProperty(globalThis, 'localStorage', {
        value: {
          getItem: vi.fn((key) => mockStorage[key] || null),
          setItem: vi.fn((key, value) => {
            mockStorage[key] = String(value)
          }),
          removeItem: vi.fn((key) => {
            delete mockStorage[key]
          }),
          clear: vi.fn(() => {
            mockStorage = {}
          })
        },
        writable: true,
        configurable: true
      })
    })

    afterEach(() => {
      vi.restoreAllMocks()
      mockStorage = {}
    })

    it('returns fallback rates if network fetch fails and no cache exists', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'))
      const result = await fetchExchangeRates()
      expect(result.USD).toBe(1.0)
      expect(result.EUR).toBe(0.92)
      expect(result.CAD).toBe(1.36)
      expect(result.JPY).toBe(155.0)
    })

    it('serves cached rates from localStorage when within 6 hours', async () => {
      const mockCached = {
        timestamp: Date.now() - 1000 * 60, // 1 minute ago
        rates: { USD: 1.0, EUR: 0.95 }
      }
      globalThis.localStorage.setItem('trip_planner_fx_cache', JSON.stringify(mockCached))

      const fetchSpy = vi.spyOn(globalThis, 'fetch')
      const result = await fetchExchangeRates()

      expect(fetchSpy).not.toHaveBeenCalled()
      expect(result.EUR).toBe(0.95)
      expect(result.CAD).toBe(1.36) // Fallback merged
    })
  })
})
