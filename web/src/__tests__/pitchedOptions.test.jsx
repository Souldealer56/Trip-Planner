import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { render, fireEvent } from '@testing-library/react'
import { OptionsTab } from '../components/trip/OptionsTab'
import { convertOptionToExpense, parseOptionCost } from '../services/expenses'
import { calculateTripBudgetAnalytics } from '../utils/currency'
import { supabase } from '../services/supabase'

vi.mock('../services/supabase', () => {
  return {
    supabase: {
      from: vi.fn()
    }
  }
})

describe('Pitched Options & Expense Conversion Redesign', () => {
  const dummyRoster = [
    {
      id: 'rsvp-1',
      user_id: 'user-1',
      role: 'organizer',
      status: 'Committed',
      users: { id: 'user-1', first_name: 'Alexis' }
    },
    {
      id: 'rsvp-2',
      user_id: 'user-2',
      role: 'participant',
      status: 'Committed',
      users: { id: 'user-2', first_name: 'Jordan' }
    }
  ]

  const dummyTrip = {
    id: 'trip-100',
    title: 'French Riviera Getaway',
    destination: 'Nice, France',
    start_date: '2026-09-01',
    end_date: '2026-09-10',
    base_currency: 'CAD'
  }

  const rates = {
    USD: 1.0,
    CAD: 1.35,
    EUR: 0.92
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('convertOptionToExpense & Category Mapping', () => {
    it('accurately parses numerical cost from numbers and strings', () => {
      expect(parseOptionCost({ estimated_cost: 6859, currency: 'USD' })).toEqual({
        amount: 6859,
        currency: 'USD'
      })
      expect(parseOptionCost({ estimated_cost: '1250.50', currency: 'EUR' })).toEqual({
        amount: 1250.5,
        currency: 'EUR'
      })
      expect(parseOptionCost({ option_text: 'Villa rental $3,400' }, 'CAD')).toEqual({
        amount: 3400,
        currency: 'CAD'
      })
    })

    it('converts a locked accommodation option with explicit category to Accommodation, never Other', async () => {
      const mockInsertSingle = vi.fn().mockResolvedValue({
        data: {
          id: 501,
          trip_id: 'trip-100',
          category: 'accommodation',
          description: '[ACCOMMODATION] Villa de luxe',
          amount: 6859,
          currency: 'USD'
        },
        error: null
      })

      supabase.from.mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: mockInsertSingle
          })
        })
      })

      const option = {
        id: 'opt-villa',
        option_text: 'Villa de luxe',
        category: 'Accommodation',
        estimated_cost: 6859,
        currency: 'USD'
      }

      const res = await convertOptionToExpense('trip-100', option, 'user-1', ['user-1', 'user-2'], 'CAD')

      expect(supabase.from).toHaveBeenCalledWith('expenses')
      expect(res.category).toBe('accommodation')
      expect(res.description).toContain('[ACCOMMODATION]')
      expect(res.description).not.toContain('[OTHER]')
    })

    it('infers accommodation category from title if category is unspecified or other', async () => {
      const mockInsertSingle = vi.fn().mockImplementation((payload) => Promise.resolve({
        data: { id: 502, ...payload },
        error: null
      }))

      supabase.from.mockReturnValue({
        insert: vi.fn().mockImplementation((payload) => ({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: 502, ...payload },
              error: null
            })
          })
        }))
      })

      const option = {
        id: 'opt-villa-2',
        option_text: 'Grand Villa Resort',
        category: 'other',
        estimated_cost: 2500,
        currency: 'USD'
      }

      await convertOptionToExpense('trip-100', option, 'user-1', ['user-1', 'user-2'], 'CAD')

      const insertCall = supabase.from().insert.mock.calls[0][0]
      expect(insertCall.category).toBe('accommodation')
      expect(insertCall.description).toBe('[ACCOMMODATION] Grand Villa Resort')
      expect(insertCall.option_id).toBe('opt-villa-2')
    })
  })

  describe('calculateTripBudgetAnalytics category classification', () => {
    it('classifies converted locked option expenses under Accommodation, never Other', () => {
      const lockedOption = {
        id: 'opt-villa',
        option_text: 'Villa de luxe',
        category: 'Accommodation',
        estimated_cost: 6859,
        currency: 'USD'
      }

      const loggedExpense = {
        id: 701,
        trip_id: 'trip-100',
        option_id: 'opt-villa',
        category: 'accommodation',
        description: '[ACCOMMODATION] Villa de luxe',
        amount: 6859,
        currency: 'USD',
        paid_by: 'user-1',
        split_users: ['user-1', 'user-2']
      }

      const analytics = calculateTripBudgetAnalytics(
        [loggedExpense],
        [lockedOption],
        dummyRoster,
        rates,
        'CAD'
      )

      expect(analytics.categoryActuals.Accommodation).toBeGreaterThan(0)
      expect(analytics.categoryActuals.Other).toBeUndefined()
    })

    it('classifies expense via linked option_id even if category is omitted or other', () => {
      const lockedOption = {
        id: 'opt-chalet',
        option_text: 'Mountain Chalet',
        category: 'Accommodation',
        estimated_cost: 1200,
        currency: 'USD'
      }

      const loggedExpense = {
        id: 702,
        trip_id: 'trip-100',
        option_id: 'opt-chalet',
        category: 'Other',
        description: 'Mountain Chalet stay booking',
        amount: 1200,
        currency: 'USD',
        paid_by: 'user-1',
        split_users: ['user-1']
      }

      const analytics = calculateTripBudgetAnalytics(
        [loggedExpense],
        [lockedOption],
        dummyRoster,
        rates,
        'CAD'
      )

      expect(analytics.categoryActuals.Accommodation).toBeGreaterThan(0)
      expect(analytics.categoryActuals.Other).toBeUndefined()
    })
  })

  describe('OptionsTab Visual Grouping & Readability UI', () => {
    const mixedOptions = [
      {
        id: 1,
        option_text: 'Villa de luxe',
        category: 'Accommodation',
        estimated_cost: 6859,
        currency: 'USD',
        is_locked: true,
        start_date: '2026-09-02T15:00',
        end_date: '2026-09-08T11:00'
      },
      {
        id: 2,
        option_text: 'Boutique Hotel Center',
        category: 'Accommodation',
        estimated_cost: 3200,
        currency: 'USD',
        is_locked: false,
        start_date: '2026-09-02T15:00',
        end_date: '2026-09-08T11:00'
      },
      {
        id: 3,
        option_text: 'Flexible Airbnb Apartment',
        category: 'Accommodation',
        estimated_cost: 2100,
        currency: 'CAD',
        is_locked: false,
        start_date: null,
        end_date: null
      },
      {
        id: 4,
        option_text: 'iglk.kb (Test pitch)',
        category: 'Accommodation',
        estimated_cost: 500,
        currency: 'USD',
        is_locked: false,
        start_date: '2026-07-08T15:00',
        end_date: '2026-07-31T11:00'
      }
    ]

    const dummyPoll = {
      id: 'poll-1',
      category: 'accommodation',
      voter_selections: {
        'user-1': ['1', '2']
      },
      votes_by_option: {
        '1': 1,
        '2': 1
      }
    }

    it('renders quick filter pills and sort dropdown', () => {
      const { container } = render(
        <OptionsTab
          activeTab="Accommodation"
          options={mixedOptions}
          activePoll={dummyPoll}
          trip={dummyTrip}
          roster={dummyRoster}
          activeUser={{ id: 'user-1' }}
          expenses={[]}
          rates={rates}
          onVoteToggle={vi.fn()}
          onLockToggle={vi.fn()}
          onDeleteOption={vi.fn()}
          onUpdateOptionDates={vi.fn()}
          onOpenPitchModal={vi.fn()}
          onOpenPollRecapModal={vi.fn()}
          onOpenExpenseModal={vi.fn()}
        />
      )

      expect(container.textContent).toContain('All (4)')
      expect(container.textContent).toContain('🔒 Locked (1)')
      expect(container.textContent).toContain('🔥 Top Voted')

      const sortSelect = container.querySelector('#options-sort-select')
      expect(sortSelect).not.toBeNull()
      expect(sortSelect.textContent).toContain('Recommended (Locked & Most Votes)')
      expect(sortSelect.textContent).toContain('Chronological (Start Date)')
      expect(sortSelect.textContent).toContain('Price: Low to High')
    })

    it('pins locked choices at the top in Section 1 with emerald border', () => {
      const { container } = render(
        <OptionsTab
          activeTab="Accommodation"
          options={mixedOptions}
          activePoll={dummyPoll}
          trip={dummyTrip}
          roster={dummyRoster}
          activeUser={{ id: 'user-1' }}
          expenses={[]}
          rates={rates}
          onVoteToggle={vi.fn()}
          onLockToggle={vi.fn()}
        />
      )

      const lockedHeading = container.querySelector('.text-emerald')
      expect(lockedHeading?.textContent).toContain('🔒 Locked into Itinerary')

      const lockedSection = container.querySelector('.locked-section')
      expect(lockedSection).not.toBeNull()
      expect(lockedSection.textContent).toContain('Villa de luxe')
    })

    it('groups scheduled proposals into Section 2 and flexible proposals into Section 3', () => {
      const { container } = render(
        <OptionsTab
          activeTab="Accommodation"
          options={mixedOptions}
          activePoll={dummyPoll}
          trip={dummyTrip}
          roster={dummyRoster}
          activeUser={{ id: 'user-1' }}
          expenses={[]}
          rates={rates}
        />
      )

      expect(container.textContent).toContain('📅 Scheduled Proposals (Grouped by Date Window)')
      expect(container.textContent).toContain('Boutique Hotel Center')

      expect(container.textContent).toContain('📌 Flexible / Dates TBD')
      expect(container.textContent).toContain('Flexible Airbnb Apartment')
    })

    it('groups out-of-bounds options into Section 4 with Fix Dates and Delete buttons', () => {
      const onDeleteMock = vi.fn()
      window.confirm = vi.fn().mockReturnValue(true)

      const { container } = render(
        <OptionsTab
          activeTab="Accommodation"
          options={mixedOptions}
          activePoll={dummyPoll}
          trip={dummyTrip}
          roster={dummyRoster}
          activeUser={{ id: 'user-1' }}
          expenses={[]}
          rates={rates}
          onDeleteOption={onDeleteMock}
        />
      )

      expect(container.textContent).toContain('Outside Trip Dates')
      
      // Expand outside dates collapsible
      const header = container.querySelector('.outside-dates-header')
      fireEvent.click(header)

      expect(container.textContent).toContain('iglk.kb (Test pitch)')
      expect(container.textContent).toContain('✏️ Fix Dates')
      expect(container.textContent).toContain('🗑️ Delete')

      const deleteBtn = container.querySelector('.btn-danger-soft')
      fireEvent.click(deleteBtn)
      expect(onDeleteMock).toHaveBeenCalledWith(4)
    })

    it('displays dual currency comparison and per-person cost beside total cost', () => {
      const { container } = render(
        <OptionsTab
          activeTab="Accommodation"
          options={[mixedOptions[0]]} // Villa de luxe: 6859 USD on CAD trip
          activePoll={dummyPoll}
          trip={dummyTrip} // CAD trip
          roster={dummyRoster} // 2 committed travelers
          activeUser={{ id: 'user-1' }}
          expenses={[]}
          rates={rates} // 1 USD = 1.35 CAD -> 6859 * 1.35 = 9259.65 CAD (≈ 9,260 CAD)
        />
      )

      // Total cost in original currency: 6,859 USD
      expect(container.textContent).toContain('6,859 USD')
      // Converted equivalent in base currency: (≈ 9,260 CAD)
      expect(container.textContent).toContain('(≈ 9,260 CAD)')
      // Cost per traveler: ~4,630 CAD / person
      expect(container.textContent).toContain('/ person')
    })

    it('displays one-tap vote toggle and visual vote progress bar', () => {
      const onVoteToggleMock = vi.fn()

      const { container } = render(
        <OptionsTab
          activeTab="Accommodation"
          options={[mixedOptions[1]]} // Boutique Hotel Center
          activePoll={dummyPoll}
          trip={dummyTrip}
          roster={dummyRoster}
          activeUser={{ id: 'user-1' }}
          expenses={[]}
          rates={rates}
          onVoteToggle={onVoteToggleMock}
        />
      )

      expect(container.querySelector('.vote-progress-track')).not.toBeNull()
      expect(container.querySelector('.voter-avatar-chip')).not.toBeNull()

      const voteBtn = container.querySelector('.btn-voted')
      expect(voteBtn?.textContent).toContain('✓ Voted (1)')

      fireEvent.click(voteBtn)
      expect(onVoteToggleMock).toHaveBeenCalledWith(2, true)
    })

    it('displays Logged in Expenses badge instead of button when option is already converted', () => {
      const existingExpenses = [
        {
          id: 'exp-1',
          option_id: '1',
          description: '[ACCOMMODATION] Villa de luxe',
          amount: 6859,
          currency: 'USD'
        }
      ]

      const { container } = render(
        <OptionsTab
          activeTab="Accommodation"
          options={[mixedOptions[0]]} // Villa de luxe (id: 1)
          activePoll={dummyPoll}
          trip={dummyTrip}
          roster={dummyRoster}
          activeUser={{ id: 'user-1' }}
          expenses={existingExpenses}
          rates={rates}
        />
      )

      expect(container.querySelector('.badge-logged-expense')?.textContent).toContain('✓ Logged in Expenses')
      expect(container.querySelector('.log-expense-btn')).toBeNull()
    })

    it('passes option category to onOpenExpenseModal when clicking Log as Expense', () => {
      const onOpenExpenseModalMock = vi.fn()

      const { container } = render(
        <OptionsTab
          activeTab="Accommodation"
          options={[mixedOptions[0]]}
          activePoll={dummyPoll}
          trip={dummyTrip}
          roster={dummyRoster}
          activeUser={{ id: 'user-1' }}
          expenses={[]} // Not logged yet
          rates={rates}
          onOpenExpenseModal={onOpenExpenseModalMock}
        />
      )

      const logExpenseBtn = container.querySelector('.log-expense-btn')
      expect(logExpenseBtn).not.toBeNull()
      fireEvent.click(logExpenseBtn)

      expect(onOpenExpenseModalMock).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 1,
          category: 'Accommodation',
          option_text: 'Villa de luxe'
        })
      )
    })
  })
})
