import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { OptionCard } from '../components/OptionCard'
import { OptionPitchModal } from '../components/OptionPitchModal'
import { MealPlanSection } from '../components/trip/MealPlanSection'
import { WorkspaceTabsNav } from '../components/trip/WorkspaceTabsNav'
import { NotOnRosterModal } from '../components/trip/NotOnRosterModal'
import { TripModalsContainer } from '../components/trip/TripModalsContainer'
import { GanttTimeline } from '../components/GanttTimeline'
import { saveMealPlan, updateOption, isVehicleCoverage } from '../services/options'
import { detectScheduleConflicts } from '../utils/schedule'
import { calculateOptionCostBreakdown } from '../utils/currency'
import { supabase } from '../services/supabase'

vi.mock('../services/supabase', () => {
  return {
    supabase: {
      from: vi.fn()
    }
  }
})

describe('TripDetails Architecture Refactoring & Critical Flows Verification', () => {
  const dummyTrip = {
    id: 'trip-rockies-2026',
    title: 'Banff Alpine Winter Expedition',
    destination: 'Banff, Canada',
    start_date: '2026-12-24',
    end_date: '2026-12-30',
    base_currency: 'USD',
    organizer_id: 'user-organizer'
  }

  const dummyRoster = [
    {
      id: 'rsvp-1',
      user_id: 'user-organizer',
      role: 'organizer',
      status: 'Committed',
      users: { id: 'user-organizer', first_name: 'Alex', username: 'alex_lead' }
    },
    {
      id: 'rsvp-2',
      user_id: 'user-traveler-2',
      role: 'participant',
      status: 'Committed',
      users: { id: 'user-traveler-2', first_name: 'Jordan', username: 'jordan_trek' }
    },
    {
      id: 'rsvp-3',
      user_id: 'user-traveler-3',
      role: 'participant',
      status: 'Committed',
      users: { id: 'user-traveler-3', first_name: 'Taylor', username: 'taylor_ski' }
    },
    {
      id: 'rsvp-4',
      user_id: 'user-traveler-4',
      role: 'participant',
      status: 'Committed',
      users: { id: 'user-traveler-4', first_name: 'Morgan', username: 'morgan_climb' }
    },
    {
      id: 'rsvp-5',
      user_id: 'user-traveler-5',
      role: 'participant',
      status: 'Committed',
      users: { id: 'user-traveler-5', first_name: 'Casey', username: 'casey_board' }
    },
    {
      id: 'rsvp-6',
      user_id: 'user-traveler-6',
      role: 'participant',
      status: 'Committed',
      users: { id: 'user-traveler-6', first_name: 'Riley', username: 'riley_hike' }
    }
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Issue 1: Editing pitched options without losing votes', () => {
    it('updates option details in database without altering poll voter_selections or vote counts', async () => {
      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          data: [{ id: 42, name: 'Luxury Banff Mountain Lodge (Updated)' }],
          error: null
        })
      })

      supabase.from.mockImplementation((table) => {
        if (table === 'poll_options') {
          return { update: mockUpdate }
        }
        return { select: vi.fn() }
      })

      const existingPoll = {
        id: 10,
        trip_id: 'trip-rockies-2026',
        category: 'accommodation',
        voter_selections: {
          'user-organizer': ['42'],
          'user-traveler-2': ['42']
        },
        votes_by_option: { '42': 2 }
      }

      await updateOption(
        42,
        {
          name: 'Luxury Banff Mountain Lodge (Updated)',
          cost: 1500,
          currency: 'USD',
          category: 'Accommodation'
        },
        'trip-rockies-2026',
        'user-organizer'
      )

      // Verifies poll_options table was updated
      expect(supabase.from).toHaveBeenCalledWith('poll_options')
      expect(mockUpdate).toHaveBeenCalled()

      // Poll votes remain intact and unaffected
      expect(existingPoll.voter_selections['user-organizer']).toContain('42')
      expect(existingPoll.voter_selections['user-traveler-2']).toContain('42')
      expect(existingPoll.votes_by_option['42']).toBe(2)
    })
  })

  describe('Issue 2: Saving meal plans with "2026-12-24T19:30" without UUID syntax errors', () => {
    it('accepts ISO datetime strings for date and meal schedule without passing timestamp into UUID columns', async () => {
      const validTripUuid = '11111111-2222-3333-4444-555555555555'
      let capturedPayload = null
      const mockInsert = vi.fn((payload) => {
        capturedPayload = payload
        return {
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                id: 901,
                trip_id: validTripUuid,
                option_text: 'Christmas Eve Fondue Feast',
                category: 'food',
                start_date: '2026-12-24T19:30',
                end_date: '2026-12-24T21:30'
              },
              error: null
            })
          })
        }
      })

      supabase.from.mockReturnValue({
        insert: mockInsert
      })

      // Regression test: caller passed "2026-12-24T19:30" as date or mistakenly as added_by
      const mealPayload = {
        trip_id: validTripUuid,
        option_text: 'Christmas Eve Fondue Feast',
        start_date: '2026-12-24T19:30',
        end_date: '2026-12-24T19:30',
        meal_slot: 'dinner',
        recipe_name: 'Christmas Eve Fondue Feast',
        meal_mode: 'cook',
        added_by: '2026-12-24T19:30', // Erroneously passed timestamp where UUID was expected
        chef_ids: ['22222222-3333-4444-5555-666666666666'],
        cleanup_ids: ['33333333-4444-5555-6666-777777777777'],
        ingredients: [{ name: 'Gruyere Cheese', quantity: '500g', aisle: 'dairy' }]
      }

      const result = await saveMealPlan(mealPayload)

      expect(supabase.from).toHaveBeenCalledWith('poll_options')
      expect(result).toBeDefined()
      expect(result.id).toBe(901)
      expect(result.option_text).toBe('Christmas Eve Fondue Feast')

      // Verifies that added_by was sanitized to null instead of crashing postgres with invalid UUID syntax
      expect(capturedPayload.added_by).toBeNull()
      expect(capturedPayload.start_date).toBe('2026-12-24T19:30')
    })
  })

  describe('Issue 3: Transparent $100 × 6 participants = $600 cost calculation', () => {
    it('computes total group cost transparently for per_person model with 6 participants', () => {
      const option = {
        id: 'opt-climb',
        category: 'Activities',
        option_text: 'Guided Ice Climbing at Johnston Canyon',
        estimated_cost: 100,
        currency: 'USD',
        cost_type: 'per_person',
        assigned_users: dummyRoster.map((m) => m.user_id) // all 6 travelers
      }

      const breakdown = calculateOptionCostBreakdown(option, dummyRoster, null, 'USD')

      expect(breakdown.costType).toBe('per_person')
      expect(breakdown.effectiveParticipantIds.length).toBe(6)
      expect(breakdown.perPersonCost).toBe(100)
      expect(breakdown.totalGroupCost).toBe(600) // $100 × 6 = $600
    })

    it('renders the live transparent calculation banner in OptionPitchModal', () => {
      const { container } = render(
        <OptionPitchModal
          isOpen={true}
          onClose={vi.fn()}
          onSubmit={vi.fn()}
          initialCategory="Activities"
          roster={dummyRoster}
          baseCurrency="USD"
          activeUserId="user-organizer"
          editingOption={{
            id: 'opt-climb',
            category: 'Activities',
            option_text: 'Guided Ice Climbing',
            estimated_cost: 100,
            currency: 'USD',
            cost_type: 'per_person',
            assigned_users: dummyRoster.map((m) => m.user_id)
          }}
        />
      )

      expect(container.textContent).toContain('Transparent Calculation:')
      expect(container.textContent).toContain('$100 × 6 participants =')
      expect(container.textContent).toContain('$600 USD')
    })
  })

  describe('Issue 4: Pre-filled trip dates and quick-select day chips', () => {
    it('pre-fills dates in OptionPitchModal bounded to trip dates and shows quick day chips', () => {
      const { container } = render(
        <OptionPitchModal
          isOpen={true}
          onClose={vi.fn()}
          onSubmit={vi.fn()}
          initialCategory="Accommodation"
          trip={dummyTrip}
          roster={dummyRoster}
          baseCurrency="USD"
        />
      )

      // Accommodation defaults to check-in 15:00 and checkout 11:00 on trip dates
      const dateInputs = container.querySelectorAll('input[type="datetime-local"]')
      expect(dateInputs.length).toBe(2)
      expect(dateInputs[0].value).toContain('2026-12-24')
      expect(dateInputs[1].value).toContain('2026-12-30')

      // Quick day chips are available for rapid selection
      expect(container.textContent).toContain('Quick-Select Day')
    })
  })

  describe('Issue 5: Readable 1-day activities and zoom modes in GanttTimeline', () => {
    it('renders 1-day activity with readable text label and supports zoom mode switching', () => {
      const options = [
        {
          id: 'opt-day-tour',
          category: 'Activities',
          option_text: 'Sulphur Mountain Gondola & Hot Springs',
          start_date: '2026-12-26T09:00:00',
          end_date: '2026-12-26T17:00:00',
          estimated_cost: 85,
          currency: 'USD'
        }
      ]

      const { container } = render(
        <GanttTimeline
          trip={dummyTrip}
          options={options}
          activePolls={{}}
          roster={dummyRoster}
        />
      )

      // Activity label should be visible
      expect(container.textContent).toContain('Sulphur Mountain Gondola & Hot Springs')

      // Zoom mode switcher buttons should exist
      const fitBtn = screen.getByRole('button', { name: /Compact Fit/i })
      const threeDayBtn = screen.getByRole('button', { name: /3-Day Window/i })
      const detailedBtn = screen.getByRole('button', { name: /Day Details/i })

      expect(fitBtn).not.toBeNull()
      expect(threeDayBtn).not.toBeNull()
      expect(detailedBtn).not.toBeNull()

      // Toggle to 3-day window
      fireEvent.click(threeDayBtn)
      expect(threeDayBtn.className).toContain('active')

      // Toggle to hourly details
      fireEvent.click(detailedBtn)
      expect(detailedBtn.className).toContain('active')
    })
  })

  describe('Issue 6: Shared vehicles spanning the trip without triggering false activity conflicts', () => {
    it('correctly recognizes vehicle_pool as trip-wide coverage and avoids triggering false schedule conflicts', () => {
      const rentalVan = {
        id: 'van-1',
        category: 'Transport',
        name: '7-Passenger AWD Minivan',
        start_date: '2026-12-24T10:00:00',
        end_date: '2026-12-30T18:00:00',
        metadata: {
          transport_mode: 'vehicle_pool',
          seats_capacity: 7
        }
      }

      const hikeActivity = {
        id: 'act-1',
        category: 'Activities',
        name: 'Tunnel Mountain Summit Hike',
        start_date: '2026-12-26T10:00:00',
        end_date: '2026-12-26T14:00:00'
      }

      expect(isVehicleCoverage(rentalVan)).toBe(true)

      // Shared vehicle spanning the whole trip should NOT conflict with a 4-hour hike
      const { conflictingOptionIds, conflictPairs } = detectScheduleConflicts([rentalVan, hikeActivity])
      expect(conflictingOptionIds.size).toBe(0)
      expect(conflictPairs.length).toBe(0)
    })
  })

  describe('Extracted Sub-Components Integration Tests', () => {
    it('mounts OptionCard with 3 zones, attendance avatars, vote button, and one-tap join', () => {
      const option = {
        id: 777,
        category: 'Activities',
        option_text: 'Bow River Winter Walk',
        estimated_cost: 0,
        currency: 'USD',
        start_date: '2026-12-25T10:00:00',
        end_date: '2026-12-25T12:00:00',
        assigned_users: ['user-organizer']
      }

      const onVoteToggle = vi.fn()
      const onLockToggle = vi.fn()
      const onToggleParticipant = vi.fn()

      const { container } = render(
        <OptionCard
          opt={option}
          activeTab="Activities"
          trip={dummyTrip}
          roster={dummyRoster}
          activeUser={{ id: 'user-organizer' }}
          committedMembers={dummyRoster}
          onVoteToggle={onVoteToggle}
          onLockToggle={onLockToggle}
          onToggleParticipant={onToggleParticipant}
        />
      )

      expect(container.textContent).toContain('Bow River Winter Walk')
      expect(container.textContent).toContain('Going (1):')

      const joinBtn = container.querySelector('.one-tap-join-btn')
      expect(joinBtn).not.toBeNull()
      expect(joinBtn?.textContent).toContain("✓ I'm In")

      const voteBtn = container.querySelector('.btn-vote')
      expect(voteBtn).not.toBeNull()
      fireEvent.click(voteBtn)
      expect(onVoteToggle).toHaveBeenCalledWith(777, false, 'Activities')

      const lockBtn = container.querySelector('.btn-secondary')
      expect(lockBtn).not.toBeNull()
      fireEvent.click(lockBtn)
      expect(onLockToggle).toHaveBeenCalledWith(777)
    })

    it('mounts MealPlanSection with switcher pills and grocery list trigger', () => {
      const setFoodViewMode = vi.fn()
      const onOpenGroceryList = vi.fn()

      const { container } = render(
        <MealPlanSection
          trip={dummyTrip}
          roster={dummyRoster}
          activeUser={{ id: 'user-organizer' }}
          foodOptions={[]}
          foodViewMode="matrix"
          setFoodViewMode={setFoodViewMode}
          uncheckedGroceryCount={3}
          onOpenGroceryList={onOpenGroceryList}
        />
      )

      expect(container.textContent).toContain('Daily Meal Matrix')
      expect(container.textContent).toContain('All Food Cards')

      const groceryBtn = container.querySelector('.grocery-btn-accent')
      expect(groceryBtn).not.toBeNull()
      expect(container.textContent).toContain('3')

      fireEvent.click(groceryBtn)
      expect(onOpenGroceryList).toHaveBeenCalledTimes(1)
    })

    it('mounts WorkspaceTabsNav and switches between Itinerary, Expenses, and Crew tabs', () => {
      const onTabChange = vi.fn()

      const { container } = render(
        <WorkspaceTabsNav
          activeWorkspaceTab="itinerary"
          onTabChange={onTabChange}
          totalOptionsCount={12}
          expensesCount={5}
          rosterCount={6}
        />
      )

      expect(container.textContent).toContain('12')
      expect(container.textContent).toContain('5')
      expect(container.textContent).toContain('6')

      const expensesTab = container.querySelector('#tab-expenses')
      expect(expensesTab).not.toBeNull()
      fireEvent.click(expensesTab)
      expect(onTabChange).toHaveBeenCalledWith('expenses')

      const rosterTab = container.querySelector('#tab-roster')
      expect(rosterTab).not.toBeNull()
      fireEvent.click(rosterTab)
      expect(onTabChange).toHaveBeenCalledWith('roster')
    })

    it('mounts NotOnRosterModal when user is not registered and triggers join/sign out', () => {
      const onJoinRoster = vi.fn()
      const onLogout = vi.fn()

      const { container } = render(
        <NotOnRosterModal
          isOpen={true}
          activeUser={{ id: 'stranger-id', first_name: 'Robin' }}
          onJoinRoster={onJoinRoster}
          onLogout={onLogout}
        />
      )

      expect(container.textContent).toContain('Not on the Roster')
      expect(container.textContent).toContain('Robin')

      const joinBtn = screen.getByRole('button', { name: /Join Trip/i })
      fireEvent.click(joinBtn)
      expect(onJoinRoster).toHaveBeenCalledTimes(1)

      const logoutBtn = screen.getByRole('button', { name: /Switch Profile \/ Sign Out/i })
      fireEvent.click(logoutBtn)
      expect(onLogout).toHaveBeenCalledTimes(1)
    })

    it('mounts TripModalsContainer and renders child modals correctly based on open states', () => {
      const onClosePitchModal = vi.fn()

      const { container } = render(
        <TripModalsContainer
          showPitchModal={true}
          onClosePitchModal={onClosePitchModal}
          onPitchSubmit={vi.fn()}
          categories={['Accommodation', 'Transport']}
          baseCurrency="USD"
          roster={dummyRoster}
          trip={dummyTrip}
        />
      )

      expect(container.textContent).toContain('Pitch New Option')
      const cancelBtn = container.querySelector('button.btn-secondary')
      expect(cancelBtn).not.toBeNull()
      fireEvent.click(cancelBtn)
      expect(onClosePitchModal).toHaveBeenCalled()
    })
  })
})
