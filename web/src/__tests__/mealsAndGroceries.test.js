import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import {
  computeKitchenCrewFairness,
  getMealDietaryAlerts,
  groupGroceriesByAisle,
  syncGroceriesFromLockedMeals,
  fetchGroceryItems,
  addGroceryItem,
  toggleGroceryItemChecked,
  deleteGroceryItem,
  GROCERY_AISLES,
  saveMealPlan,
  isValidUuid,
  sanitizeUuidOrNull,
  sanitizeUuidArray,
  sanitizeDateTimeOrNull
} from '../services/groceries'
import { pitchOption } from '../services/options'
import { MealPlannerMatrix } from '../components/trip/MealPlannerMatrix'
import { GroceryListPanel } from '../components/trip/GroceryListPanel'
import { supabase } from '../services/supabase'

vi.mock('../services/supabase', () => ({
  supabase: {
    from: vi.fn()
  }
}))

describe('Group Meal & Intendance System (Meals and Groceries)', () => {
  const dummyRoster = [
    {
      id: 'rsvp-1',
      user_id: 'user-1',
      status: 'Committed',
      dietary_tags: ['Vegetarian', 'Gluten-Free'],
      users: { id: 'user-1', first_name: 'Alexis' }
    },
    {
      id: 'rsvp-2',
      user_id: 'user-2',
      status: 'Committed',
      dietary_tags: ['Nut Allergy'],
      users: { id: 'user-2', first_name: 'Jordan' }
    },
    {
      id: 'rsvp-3',
      user_id: 'user-3',
      status: 'Committed',
      dietary_tags: ['Halal'],
      users: { id: 'user-3', first_name: 'Sam' }
    },
    {
      id: 'rsvp-4',
      user_id: 'user-4',
      status: 'Committed',
      dietary_tags: [],
      users: { id: 'user-4', first_name: 'Taylor' }
    }
  ]

  const dummyTrip = {
    id: 'trip-meals-1',
    title: 'Swiss Alps Hiking & Fondue',
    destination: 'Interlaken, Switzerland',
    start_date: '2026-07-10',
    end_date: '2026-07-12',
    base_currency: 'CHF'
  }

  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  afterEach(() => {
    cleanup()
  })

  describe('Kitchen Crew Duty Fairness Counter', () => {
    it('tallies cook and cleanup duties accurately across multiple meals', () => {
      const foodOptions = [
        {
          id: 'meal-1',
          metadata: {
            meal_mode: 'cook',
            chef_ids: ['user-1', 'user-2'],
            cleanup_ids: ['user-3']
          }
        },
        {
          id: 'meal-2',
          metadata: {
            meal_mode: 'cook',
            chef_ids: ['user-1'],
            cleanup_ids: ['user-2', 'user-4']
          }
        },
        {
          id: 'meal-3',
          metadata: {
            meal_mode: 'picnic',
            chef_ids: ['user-3'],
            cleanup_ids: ['user-1']
          }
        }
      ]

      const fairness = computeKitchenCrewFairness(foodOptions, dummyRoster)

      // Alexis: cooked in meal-1, meal-2 (2x). Cleaned up in meal-3 (1x). Total = 3
      expect(fairness['user-1'].cookCount).toBe(2)
      expect(fairness['user-1'].cleanupCount).toBe(1)
      expect(fairness['user-1'].totalDuties).toBe(3)

      // Jordan: cooked in meal-1 (1x). Cleaned up in meal-2 (1x). Total = 2
      expect(fairness['user-2'].cookCount).toBe(1)
      expect(fairness['user-2'].cleanupCount).toBe(1)
      expect(fairness['user-2'].totalDuties).toBe(2)

      // Sam: cooked in meal-3 (1x). Cleaned up in meal-1 (1x). Total = 2
      expect(fairness['user-3'].cookCount).toBe(1)
      expect(fairness['user-3'].cleanupCount).toBe(1)
      expect(fairness['user-3'].totalDuties).toBe(2)

      // Taylor: cleaned up in meal-2 (1x). Total = 1
      expect(fairness['user-4'].cookCount).toBe(0)
      expect(fairness['user-4'].cleanupCount).toBe(1)
      expect(fairness['user-4'].totalDuties).toBe(1)
    })

    it('initializes zero duties for travelers who have not yet helped in the kitchen', () => {
      const fairness = computeKitchenCrewFairness([], dummyRoster)
      expect(fairness['user-1'].totalDuties).toBe(0)
      expect(fairness['user-2'].cookCount).toBe(0)
      expect(fairness['user-4'].cleanupCount).toBe(0)
    })
  })

  describe('Dietary Alerts from Diners Roster', () => {
    it('surfaces active dietary restrictions matching assigned diners only', () => {
      const mealForTwo = {
        id: 'meal-veg',
        assigned_users: ['user-1', 'user-2'] // Alexis (Vegetarian, Gluten-Free) and Jordan (Nut Allergy)
      }

      const alerts = getMealDietaryAlerts(mealForTwo, dummyRoster)
      expect(alerts.length).toBe(3)

      const labels = alerts.map((a) => a.label)
      expect(labels).toContain('🌱 Vegetarian (Alexis)')
      expect(labels).toContain('🌾 Gluten-Free (Alexis)')
      expect(labels).toContain('🥜 Nut Allergy (Jordan)')
      // Sam (Halal) is not eating, so no Halal alert
      expect(labels.some((l) => l.includes('Halal'))).toBe(false)
    })

    it('falls back to all committed travelers if assigned_users is empty', () => {
      const groupMeal = {
        id: 'meal-group',
        assigned_users: [] // Semantically all travelers present
      }

      const alerts = getMealDietaryAlerts(groupMeal, dummyRoster)
      expect(alerts.length).toBe(4) // Alexis (2), Jordan (1), Sam (1)

      const tags = alerts.map((a) => a.tag)
      expect(tags).toContain('Vegetarian')
      expect(tags).toContain('Gluten-Free')
      expect(tags).toContain('Nut Allergy')
      expect(tags).toContain('Halal')
    })

    it('returns empty array when diners have no dietary restrictions', () => {
      const simpleMeal = {
        id: 'meal-simple',
        assigned_users: ['user-4'] // Taylor has no restrictions
      }

      const alerts = getMealDietaryAlerts(simpleMeal, dummyRoster)
      expect(alerts).toEqual([])
    })
  })

  describe('Supermarket Aisle Grouping & Ingredient Deduplication', () => {
    it('groups grocery items by standard supermarket aisle', () => {
      const items = [
        { id: '1', name: 'Apples', aisle: 'produce' },
        { id: '2', name: 'Carrots', aisle: 'produce' },
        { id: '3', name: 'Gruyère Cheese', aisle: 'dairy_meat' },
        { id: '4', name: 'Spaghetti', aisle: 'dry_goods' },
        { id: '5', name: 'Red Wine', aisle: 'drinks' },
        { id: '6', name: 'Paper Towels', aisle: 'household' },
        { id: '7', name: 'Fire Starter', aisle: 'other' }
      ]

      const grouped = groupGroceriesByAisle(items)
      expect(grouped.length).toBe(GROCERY_AISLES.length)

      const produce = grouped.find((g) => g.id === 'produce')
      expect(produce.items.length).toBe(2)
      expect(produce.items[0].name).toBe('Apples')

      const dairyMeat = grouped.find((g) => g.id === 'dairy_meat')
      expect(dairyMeat.items.length).toBe(1)
      expect(dairyMeat.items[0].name).toBe('Gruyère Cheese')

      const dryGoods = grouped.find((g) => g.id === 'dry_goods')
      expect(dryGoods.items.length).toBe(1)
    })

    it('syncs ingredients from locked meals and ignores duplicates', async () => {
      const lockedMeals = [
        {
          id: 'meal-carbonara',
          category: 'Food',
          is_locked: true,
          metadata: {
            meal_mode: 'cook',
            ingredients: [
              { name: 'Spaghetti', quantity: '500g', aisle: 'dry_goods' },
              { name: 'Pancetta', quantity: '200g', aisle: 'dairy_meat' },
              { name: 'Parmesan', quantity: '150g', aisle: 'dairy_meat' }
            ]
          }
        }
      ]

      // Existing list already has Spaghetti linked to that meal
      const existingGroceries = [
        {
          id: 'exist-1',
          trip_id: 'trip-meals-1',
          meal_option_id: 'meal-carbonara',
          name: 'Spaghetti',
          quantity: '500g',
          aisle: 'dry_goods'
        }
      ]

      // Mock Supabase insert
      supabase.from.mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: 'new-1', name: 'Pancetta', trip_id: 'trip-meals-1' },
              error: null
            })
          })
        })
      })

      const { addedCount, totalIngredients } = await syncGroceriesFromLockedMeals(
        'trip-meals-1',
        lockedMeals,
        existingGroceries
      )

      expect(totalIngredients).toBe(3)
      // Pancetta and Parmesan should be added, Spaghetti skipped as duplicate
      expect(addedCount).toBe(2)
    })
  })

  describe('Local Fallback & CRUD in Groceries Service', () => {
    it('saves and fetches grocery items from localStorage when offline or unmigrated', async () => {
      // Mock Supabase error
      supabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: null, error: new Error('table does not exist') })
          })
        }),
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: new Error('table does not exist') })
          })
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: new Error('table does not exist') })
        }),
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: new Error('table does not exist') })
        })
      })

      const added = await addGroceryItem('trip-meals-1', {
        name: 'Dark Chocolate',
        quantity: '3 bars',
        aisle: 'dry_goods'
      })

      expect(added).not.toBeNull()
      expect(added.name).toBe('Dark Chocolate')
      expect(added.quantity).toBe('3 bars')

      const items = await fetchGroceryItems('trip-meals-1')
      expect(items.length).toBe(1)
      expect(items[0].name).toBe('Dark Chocolate')
      expect(items[0].is_checked).toBe(false)

      // Toggle checked
      await toggleGroceryItemChecked(added.id, true, 'trip-meals-1')
      const updated = await fetchGroceryItems('trip-meals-1')
      expect(updated[0].is_checked).toBe(true)

      // Delete item
      await deleteGroceryItem(added.id, 'trip-meals-1')
      const afterDelete = await fetchGroceryItems('trip-meals-1')
      expect(afterDelete.length).toBe(0)
    })
  })

  describe('MealPlannerMatrix Component', () => {
    it('renders daily slots for breakfast, lunch, and dinner with unplanned buttons', () => {
      const { container } = render(
        React.createElement(MealPlannerMatrix, {
          trip: dummyTrip,
          roster: dummyRoster,
          activeUser: { id: 'user-1' },
          foodOptions: []
        })
      )

      expect(container.textContent).toContain('0 of 9 meals planned')
      expect(container.textContent).toContain('9 slots open')
      expect(container.textContent).toContain('Day 1')
      expect(container.textContent).toContain('Day 2')
      expect(container.textContent).toContain('Day 3')
      expect(container.textContent).toContain('+ Plan Breakfast')
      expect(container.textContent).toContain('+ Plan Lunch')
      expect(container.textContent).toContain('+ Plan Dinner')
    })

    it('renders populated meal slot card with kitchen crew and dietary alert badges', () => {
      const foodOptions = [
        {
          id: 'meal-fondue',
          category: 'Food',
          option_text: 'Authentic Swiss Cheese Fondue Night',
          estimated_cost: 120,
          currency: 'CHF',
          start_date: '2026-07-10T19:30:00',
          is_locked: true,
          assigned_users: ['user-1', 'user-2'],
          metadata: {
            meal_slot: 'dinner',
            meal_mode: 'cook',
            chef_ids: ['user-3'],
            cleanup_ids: ['user-4']
          }
        }
      ]

      const { container } = render(
        React.createElement(MealPlannerMatrix, {
          trip: dummyTrip,
          roster: dummyRoster,
          activeUser: { id: 'user-1' },
          foodOptions
        })
      )

      expect(container.textContent).toContain('Authentic Swiss Cheese Fondue Night')
      expect(container.textContent).toContain('Home-Cooked')
      expect(container.textContent).toContain('🔒 Locked')
      expect(container.textContent).toContain('Chefs: Sam')
      expect(container.textContent).toContain('Cleanup: Taylor')
      expect(container.textContent).toContain('🌱 Vegetarian (Alexis)')
      expect(container.textContent).toContain('🌾 Gluten-Free (Alexis)')
      expect(container.textContent).toContain('🥜 Nut Allergy (Jordan)')
      expect(container.textContent).toContain('~120 CHF')
    })

    it('opens plan meal modal with 3 mode tabs when clicking plan button', async () => {
      const { container } = render(
        React.createElement(MealPlannerMatrix, {
          trip: dummyTrip,
          roster: dummyRoster,
          activeUser: { id: 'user-1' },
          foodOptions: []
        })
      )

      const planDinnerBtn = screen.getAllByText('+ Plan Dinner')[0]
      fireEvent.click(planDinnerBtn)

      const cookTab = await screen.findByText('🍳 Cook Together')
      expect(cookTab).toBeTruthy()
      expect(container.textContent).toContain('Plan Dinner')
      expect(container.textContent).toContain('🍽️ Restaurant / Eat Out')
      expect(container.textContent).toContain('🥪 Trail Picnic')
      expect(container.textContent).toContain('Cooking Crew (Chefs)')
      expect(container.textContent).toContain('Cleanup & Dishes Crew')
      expect(container.textContent).toContain('Menu Ingredients')
    })
  })

  describe('GroceryListPanel Component & Expense Checkout', () => {
    it('renders grouped grocery aisles and triggers checkout', async () => {
      // Mock fetch items
      supabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: [
                { id: '1', name: 'Fresh Rosemary', quantity: '1 bunch', aisle: 'produce', is_checked: true },
                { id: '2', name: 'Swiss Cheese', quantity: '500g', aisle: 'dairy_meat', is_checked: true },
                { id: '3', name: 'Baguettes', quantity: '3', aisle: 'dry_goods', is_checked: false }
              ],
              error: null
            })
          })
        })
      })

      const onLogExpenseMock = vi.fn().mockResolvedValue({})

      const { container } = render(
        React.createElement(GroceryListPanel, {
          tripId: 'trip-meals-1',
          trip: dummyTrip,
          roster: dummyRoster,
          activeUser: { id: 'user-1' },
          foodOptions: [],
          onClose: vi.fn(),
          onLogExpense: onLogExpenseMock
        })
      )

      expect(container.textContent).toContain('Smart Grocery List')
      // Wait for items to render
      const produceText = await screen.findByText('Fresh Rosemary')
      expect(produceText).toBeTruthy()
      expect(container.textContent).toContain('Swiss Cheese')
      expect(container.textContent).toContain('Baguettes')
      expect(container.textContent).toContain('2 of 3 items in cart')

      // Open checkout modal
      const checkoutBtn = screen.getByText('💸 Checkout & Log Grocery Expense')
      fireEvent.click(checkoutBtn)

      expect(container.textContent).toContain('Log Grocery Receipt Expense')
      expect(container.textContent).toContain('Actual Receipt Amount *')

      // Fill in receipt amount
      const amountInput = screen.getByPlaceholderText('e.g. 78.50')
      fireEvent.change(amountInput, { target: { value: '85.50' } })

      // Submit checkout form
      const confirmBtn = screen.getByText('Confirm & Log Expense')
      fireEvent.click(confirmBtn)

      expect(onLogExpenseMock).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 85.5,
          category: 'food',
          currency: 'CHF'
        })
      )
    })
  })

  describe('Meal Plan Saving & Payload Hardening against PostgreSQL UUID errors', () => {
    const validTripId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
    const validCookId = 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22'
    const validCleanupId = 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33'

    it('validates UUIDs and sanitizes invalid UUID / non-UUID values', () => {
      // isValidUuid
      expect(isValidUuid(validTripId)).toBe(true)
      expect(isValidUuid(validCookId)).toBe(true)
      expect(isValidUuid('2026-12-24T19:30')).toBe(false)
      expect(isValidUuid('')).toBe(false)
      expect(isValidUuid(null)).toBe(false)
      expect(isValidUuid(undefined)).toBe(false)
      expect(isValidUuid('not-a-uuid')).toBe(false)

      // sanitizeUuidOrNull
      expect(sanitizeUuidOrNull(validTripId)).toBe(validTripId)
      expect(sanitizeUuidOrNull('2026-12-24T19:30')).toBeNull()
      expect(sanitizeUuidOrNull('')).toBeNull()
      expect(sanitizeUuidOrNull(null)).toBeNull()
      expect(sanitizeUuidOrNull(undefined)).toBeNull()
      expect(sanitizeUuidOrNull('invalid-uuid')).toBeNull()

      // sanitizeUuidArray
      expect(sanitizeUuidArray([validCookId, '2026-12-24T19:30', '', validCleanupId, null]))
        .toEqual([validCookId, validCleanupId])
      expect(sanitizeUuidArray(null)).toEqual([])
      expect(sanitizeUuidArray('not-array')).toEqual([])

      // sanitizeDateTimeOrNull
      expect(sanitizeDateTimeOrNull('2026-12-24T19:30')).toBe('2026-12-24T19:30')
      expect(sanitizeDateTimeOrNull('2026-12-24T19:30:00.000Z')).toBe('2026-12-24T19:30:00.000Z')
      expect(sanitizeDateTimeOrNull('')).toBeNull()
      expect(sanitizeDateTimeOrNull('invalid-date')).toBeNull()
      expect(sanitizeDateTimeOrNull(null)).toBeNull()
    })

    it('throws client-side error if trip_id is missing or not a valid UUID', async () => {
      await expect(
        saveMealPlan({
          title: 'Fondue Night',
          start_date: '2026-12-24T19:30'
        })
      ).rejects.toThrow('Trip ID is required to save a meal plan.')

      await expect(
        saveMealPlan({
          trip_id: 'invalid-trip-id',
          title: 'Fondue Night',
          start_date: '2026-12-24T19:30'
        })
      ).rejects.toThrow(/Invalid trip_id: expected a valid UUID/)
    })

    it('saves a meal plan with date "2026-12-24T19:30" and valid cook UUID, passing strictly valid payload to Supabase', async () => {
      let capturedPayload = null
      supabase.from.mockReturnValue({
        insert: vi.fn((payload) => {
          capturedPayload = payload
          return {
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: 101, ...payload },
                error: null
              })
            })
          }
        })
      })

      const mealPayload = {
        trip_id: validTripId,
        option_text: 'Christmas Eve Dinner',
        start_date: '2026-12-24T19:30',
        end_date: '2026-12-24T19:30',
        added_by: validCookId,
        estimated_cost: 120,
        currency: 'CHF',
        cost_type: 'split_total',
        assigned_users: [validCookId, validCleanupId],
        metadata: {
          meal_slot: 'dinner',
          meal_mode: 'cook',
          chef_ids: [validCookId],
          cleanup_ids: [validCleanupId],
          ingredients: ['Cheese', 'Wine', 'Bread']
        }
      }

      const result = await saveMealPlan(mealPayload)

      expect(result).toBeDefined()
      expect(capturedPayload).not.toBeNull()
      expect(capturedPayload.trip_id).toBe(validTripId)
      expect(capturedPayload.start_date).toBe('2026-12-24T19:30')
      expect(capturedPayload.end_date).toBe('2026-12-24T19:30')
      expect(capturedPayload.added_by).toBe(validCookId)
      expect(capturedPayload.category).toBe('food')
      expect(capturedPayload.estimated_cost).toBe(120)
      expect(capturedPayload.currency).toBe('CHF')
      expect(capturedPayload.assigned_users).toEqual([validCookId, validCleanupId])
      expect(capturedPayload.metadata.chef_ids).toEqual([validCookId])
      expect(capturedPayload.metadata.cleanup_ids).toEqual([validCleanupId])
    })

    it('saves a meal plan with date "2026-12-24T19:30" WITHOUT cook UUID, ensuring added_by is null and NEVER a date string', async () => {
      let capturedPayload = null
      supabase.from.mockReturnValue({
        insert: vi.fn((payload) => {
          capturedPayload = payload
          return {
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: 102, ...payload },
                error: null
              })
            })
          }
        })
      })

      // Simulate case where added_by is missing/empty/undefined
      const resultWithoutCook = await saveMealPlan({
        trip_id: validTripId,
        option_text: 'Self-Serve Breakfast',
        start_date: '2026-12-24T08:30',
        end_date: '2026-12-24T08:30',
        added_by: ''
      })

      expect(resultWithoutCook).toBeDefined()
      expect(capturedPayload.added_by).toBeNull()
      expect(capturedPayload.start_date).toBe('2026-12-24T08:30')

      // Critical regression test: what if caller erroneously passed the datetime as added_by?
      // (The exact bug that caused: Failed to save meal plan: invalid input syntax for type uuid: "2026-12-24T19:30")
      const resultWithShiftedDateAsCook = await saveMealPlan({
        trip_id: validTripId,
        option_text: 'Christmas Eve Dinner',
        start_date: '2026-12-24T19:30',
        end_date: '2026-12-24T19:30',
        added_by: '2026-12-24T19:30' // Erroneous input syntax!
      })

      expect(resultWithShiftedDateAsCook).toBeDefined()
      expect(capturedPayload.added_by).toBeNull() // Coerced to null, avoiding PostgreSQL UUID syntax error!
      expect(capturedPayload.start_date).toBe('2026-12-24T19:30')
      expect(capturedPayload.end_date).toBe('2026-12-24T19:30')
    })

    it('pitchOption handles both structured object and legacy arguments, sanitizing UUIDs and dates', async () => {
      let capturedPayload = null
      supabase.from.mockImplementation((table) => {
        if (table === 'poll_options') {
          return {
            insert: vi.fn((payload) => {
              capturedPayload = payload
              return {
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: { id: 103, ...payload },
                    error: null
                  })
                })
              }
            })
          }
        }
        return {
          select: vi.fn().mockImplementation(() => {
            const chain = {
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({
                  data: [{ id: 'poll-1', category: 'food', voter_selections: {} }],
                  error: null
                })
              })
            }
            chain.eq = vi.fn().mockReturnValue(chain)
            return chain
          }),
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: {}, error: null })
            })
          })
        }
      })

      // Calling with structured object
      await pitchOption({
        tripId: validTripId,
        category: 'Food',
        name: 'Alpine Raclette',
        estimatedCost: 90,
        currency: 'CHF',
        startDate: '2026-12-24T19:30',
        endDate: '2026-12-24T19:30',
        addedByUserId: validCookId
      })

      expect(capturedPayload.trip_id).toBe(validTripId)
      expect(capturedPayload.start_date).toBe('2026-12-24T19:30')
      expect(capturedPayload.end_date).toBe('2026-12-24T19:30')
      expect(capturedPayload.added_by).toBe(validCookId)

      // Calling with shifted positional arguments where datetime was passed to addedBy
      await pitchOption(
        validTripId,
        'Food',
        'Raclette Shifted',
        90,
        'CHF',
        '',
        'start_date_passed_as_description',
        '2026-12-24T19:30', // passed as addedByUserId!
        '2026-12-24T19:30',
        '2026-12-24T19:30'
      )

      // added_by is safely sanitized to null rather than causing PostgreSQL syntax error
      expect(capturedPayload.added_by).toBeNull()
      expect(capturedPayload.start_date).toBe('2026-12-24T19:30')
    })
  })
})
