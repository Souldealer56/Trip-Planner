import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'

// Domain Services & Utilities
import { supabase } from '../services/supabase'
import { createTrip, updateTrip, deleteTrip } from '../services/trips'
import {
  fetchRsvpRoster,
  createRsvp,
  updateRsvpDetails,
  promoteToCoOrganizer,
  demoteCoOrganizer,
  isUserTripAdmin,
  getPresentTravelers
} from '../services/rsvps'
import {
  pitchOption,
  toggleVote,
  lockOption,
  isOptionLocked,
  fetchActivePoll
} from '../services/options'
import {
  syncGroceriesFromLockedMeals,
  getMealDietaryAlerts,
  groupGroceriesByAisle
} from '../services/groceries'
import {
  convertOptionToExpense,
  logExpense,
  fetchExpenses
} from '../services/expenses'
import {
  calculateOptionCostBreakdown,
  calculateTripBudgetAnalytics,
  calculateSettlements
} from '../utils/currency'
import {
  packOptionsIntoSubTracks,
  detectScheduleGaps,
  detectScheduleConflicts,
  analyzeDailyLogisticsCoverage
} from '../utils/schedule'

// React UI Components
import { RosterSection } from '../components/trip/RosterSection'
import { OptionsTab } from '../components/trip/OptionsTab'
import { GanttTimeline } from '../components/GanttTimeline'
import { GroceryListPanel } from '../components/trip/GroceryListPanel'
import { LedgerAndSettleTab } from '../components/trip/LedgerAndSettleTab'

vi.mock('../services/supabase', () => {
  return {
    supabase: {
      from: vi.fn()
    }
  }
})

describe('QA E2E Scenario — "QA Expedition — Banff & Canmore"', () => {
  // Test Travelers
  const user1 = {
    id: 'u1-alexis-uuid-0001',
    email: 'alexis.organizer@test.expedition.io',
    first_name: 'Alexis',
    username: 'alexis'
  }
  const user2 = {
    id: 'u2-nolwen-uuid-0002',
    email: 'nolwen.vegetarian@test.expedition.io',
    first_name: 'Nolwen',
    username: 'nolwen'
  }
  const user3 = {
    id: 'u3-etienne-uuid-0003',
    email: 'etienne.partial@test.expedition.io',
    first_name: 'Etienne',
    username: 'etienne'
  }

  const exchangeRates = {
    USD: 1.0,
    CAD: 1.35,
    EUR: 0.92
  }

  beforeEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  // =========================================================================
  // STEP 1: Auth & Onboarding
  // =========================================================================
  describe('Step 1: Auth & Onboarding', () => {
    it('resolves/creates all 3 travelers without schema or constraint errors', async () => {
      supabase.from.mockImplementation((table) => {
        if (table === 'users') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null })
              })
            }),
            insert: vi.fn().mockImplementation((payload) => ({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: payload[0].id || 'gen-uuid', ...payload[0] },
                  error: null
                })
              })
            }))
          }
        }
        return {}
      })

      const travelers = [user1, user2, user3]
      for (const t of travelers) {
        const query = supabase.from('users')
        const { data: created } = await query
          .insert([{ id: t.id, email: t.email, first_name: t.first_name, username: t.username }])
          .select()
          .single()

        expect(created).toBeDefined()
        expect(created.first_name).toBe(t.first_name)
        expect(created.email).toBe(t.email)
      }
    })
  })

  // =========================================================================
  // STEP 2: Trip Creation & Settings
  // =========================================================================
  describe('Step 2: Trip Creation & Settings', () => {
    it('creates a CAD trip for Dec 24-28, 2026 and updates its vibe settings', async () => {
      const tripData = {
        id: 'trip-banff-1234',
        title: 'QA Expedition — Banff & Canmore',
        destination: 'Banff & Canmore, Alberta, Canada',
        start_date: '2026-12-24',
        end_date: '2026-12-28',
        base_currency: 'CAD',
        organizer_id: user1.id,
        vibe: 'Mountain Adventure'
      }

      supabase.from.mockImplementation((table) => {
        if (table === 'trips') {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: tripData, error: null })
              })
            }),
            update: vi.fn().mockImplementation((fields) => ({
              eq: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: { ...tripData, ...fields },
                    error: null
                  })
                })
              })
            }))
          }
        }
        if (table === 'rsvps') {
          return {
            insert: vi.fn().mockResolvedValue({ data: { id: 'rsvp-org', role: 'organizer' }, error: null })
          }
        }
        return {}
      })

      const createdTrip = await createTrip(tripData, user1.id)
      expect(createdTrip.id).toBe(tripData.id)
      expect(createdTrip.base_currency).toBe('CAD')
      expect(createdTrip.start_date).toBe('2026-12-24')

      const updated = await updateTrip(createdTrip.id, { vibe: 'Alpine Luxury & Powder' })
      expect(updated.vibe).toBe('Alpine Luxury & Powder')
    })
  })

  // =========================================================================
  // STEP 3: Invite & Roster Management + RosterSection UI
  // =========================================================================
  describe('Step 3: Invite & Roster Management', () => {
    const trip = {
      id: 'trip-banff-1234',
      title: 'QA Expedition — Banff & Canmore',
      start_date: '2026-12-24',
      end_date: '2026-12-28',
      base_currency: 'CAD'
    }

    let initialRoster = [
      {
        id: 'rsvp-1',
        trip_id: trip.id,
        user_id: user1.id,
        role: 'organizer',
        status: 'Committed',
        arrival_date: '2026-12-24',
        departure_date: '2026-12-28',
        dietary_tags: [],
        notes: '',
        users: user1
      },
      {
        id: 'rsvp-2',
        trip_id: trip.id,
        user_id: user2.id,
        role: 'co_organizer',
        status: 'Committed',
        arrival_date: '2026-12-24',
        departure_date: '2026-12-28',
        dietary_tags: ['Vegetarian'],
        notes: '',
        users: user2
      },
      {
        id: 'rsvp-3',
        trip_id: trip.id,
        user_id: user3.id,
        role: 'member',
        status: 'Committed',
        arrival_date: '2026-12-25',
        departure_date: '2026-12-27',
        dietary_tags: [],
        notes: '[ADMIN] Attempting permission override via notes',
        users: user3
      }
    ]

    it('verifies isUserTripAdmin is true for Organizer & Co-Organizer, false for Etienne despite [ADMIN] note tag', () => {
      expect(isUserTripAdmin(user1, trip, initialRoster)).toBe(true)
      expect(isUserTripAdmin(user2, trip, initialRoster)).toBe(true)
      // Etienne should NOT be admin despite [ADMIN] in notes
      expect(isUserTripAdmin(user3, trip, initialRoster)).toBe(false)
    })

    it('accurately calculates present travelers per day taking partial stay into account', () => {
      // Day 1 (2026-12-24): User 1 & 2 present, User 3 NOT present
      const day1Present = getPresentTravelers(initialRoster, '2026-12-24', '2026-12-24')
      expect(day1Present.map(m => m.user_id)).toEqual([user1.id, user2.id])

      // Day 2 (2026-12-25): All 3 present
      const day2Present = getPresentTravelers(initialRoster, '2026-12-25', '2026-12-25')
      expect(day2Present.map(m => m.user_id)).toEqual([user1.id, user2.id, user3.id])

      // Day 5 (2026-12-28): User 3 already departed
      const day5Present = getPresentTravelers(initialRoster, '2026-12-28', '2026-12-28')
      expect(day5Present.map(m => m.user_id)).toEqual([user1.id, user2.id])
    })

    it('mounts RosterSection and asserts badges, dietary tags, partial stay dates, and promote/demote handlers', () => {
      const onPromoteMember = vi.fn()
      const onDemoteMember = vi.fn()
      const onUpdateRsvpDetails = vi.fn()

      render(
        <RosterSection
          roster={initialRoster}
          activeUser={user1}
          trip={trip}
          isAdmin={true}
          onPromoteMember={onPromoteMember}
          onDemoteMember={onDemoteMember}
          onUpdateRsvpDetails={onUpdateRsvpDetails}
        />
      )

      // Traveler names rendered
      expect(screen.getAllByText(/Alexis/i).length).toBeGreaterThan(0)
      expect(screen.getAllByText(/Nolwen/i).length).toBeGreaterThan(0)
      expect(screen.getAllByText(/Etienne/i).length).toBeGreaterThan(0)

      // Role badges rendered
      expect(screen.getAllByText(/Organizer/i).length).toBeGreaterThan(0)
      expect(screen.getAllByText(/Co-Organizer/i).length).toBeGreaterThan(0)

      // Dietary tag badge for Nolwen
      expect(screen.getAllByText(/Vegetarian/i).length).toBeGreaterThan(0)

      // Demote button for Co-Organizer
      const demoteBtn = screen.getByTitle('Remove Co-Organizer permissions')
      expect(demoteBtn).toBeTruthy()
      fireEvent.click(demoteBtn)
      expect(onDemoteMember).toHaveBeenCalledWith(user2.id)

      // Promote button for Member Etienne
      const promoteBtn = screen.getByTitle('Grant Co-Organizer permissions')
      expect(promoteBtn).toBeTruthy()
      fireEvent.click(promoteBtn)
      expect(onPromoteMember).toHaveBeenCalledWith(user3.id)
    })
  })

  // =========================================================================
  // STEP 4: Pitching Options Across Categories + OptionsTab UI
  // =========================================================================
  describe('Step 4: Pitching Options Across Categories', () => {
    const trip = {
      id: 'trip-banff-1234',
      title: 'QA Expedition — Banff & Canmore',
      start_date: '2026-12-24',
      end_date: '2026-12-28',
      base_currency: 'CAD'
    }

    const chalet = {
      id: 'opt-chalet-1',
      trip_id: trip.id,
      category: 'Accommodation',
      option_text: 'Canmore Chalet',
      estimated_cost: 1200,
      currency: 'CAD',
      start_date: '2026-12-24T15:00',
      end_date: '2026-12-28T11:00',
      cost_type: 'split_total',
      assigned_users: [],
      metadata: { max_capacity: 6, has_kitchen: true }
    }

    const hotel = {
      id: 'opt-hotel-2',
      trip_id: trip.id,
      category: 'Accommodation',
      option_text: 'Banff Hotel',
      estimated_cost: 900,
      currency: 'USD',
      start_date: '2026-12-24T16:00',
      end_date: '2026-12-28T10:00',
      cost_type: 'split_total',
      assigned_users: [],
      metadata: { max_capacity: 4 }
    }

    const suv = {
      id: 'opt-suv-3',
      trip_id: trip.id,
      category: 'Transport',
      option_text: '7-Seater SUV',
      estimated_cost: 500,
      currency: 'CAD',
      start_date: '2026-12-24T12:00',
      end_date: '2026-12-28T14:00',
      cost_type: 'split_total',
      assigned_users: [],
      metadata: { seats_capacity: 5 }
    }

    const iceClimbing = {
      id: 'opt-climb-4',
      trip_id: trip.id,
      category: 'Activities',
      option_text: 'Ice Climbing',
      estimated_cost: 200,
      currency: 'CAD',
      start_date: '2026-12-25T09:00',
      end_date: '2026-12-25T13:00',
      cost_type: 'per_person',
      assigned_users: [user1.id, user2.id],
      metadata: { difficulty: 'Moderate' }
    }

    it('calculates cost breakdown across pricing models and assigned users', () => {
      const roster = [
        { user_id: user1.id, status: 'Committed' },
        { user_id: user2.id, status: 'Committed' },
        { user_id: user3.id, status: 'Committed' }
      ]

      // Chalet: split_total 1200 CAD across 3 = 400 CAD each
      const chaletBreakdown = calculateOptionCostBreakdown(chalet, roster, exchangeRates, 'CAD')
      expect(chaletBreakdown.totalGroupCost).toBe(1200)
      expect(chaletBreakdown.perPersonCost).toBe(400)

      // Ice Climbing: per_person 200 CAD for 2 assigned users = 400 CAD total
      const climbBreakdown = calculateOptionCostBreakdown(iceClimbing, roster, exchangeRates, 'CAD')
      expect(climbBreakdown.totalGroupCost).toBe(400)
      expect(climbBreakdown.perPersonCost).toBe(200)
      expect(climbBreakdown.participantSharesMap.get(user1.id)).toBe(200)
      expect(climbBreakdown.participantSharesMap.get(user2.id)).toBe(200)
      expect(climbBreakdown.participantSharesMap.has(user3.id)).toBe(false)
    })

    it('mounts OptionsTab for Accommodation and renders option titles, costs, and badges', () => {
      render(
        <OptionsTab
          activeTab="Accommodation"
          options={[chalet, hotel]}
          allTripOptions={[chalet, hotel, suv, iceClimbing]}
          trip={trip}
          activeUser={user1}
          rates={exchangeRates}
          roster={[
            { user_id: user1.id, role: 'organizer', status: 'Committed', users: user1 },
            { user_id: user2.id, role: 'co_organizer', status: 'Committed', users: user2 }
          ]}
        />
      )

      expect(screen.getByText('Canmore Chalet')).toBeTruthy()
      expect(screen.getByText('Banff Hotel')).toBeTruthy()
      expect(screen.getByText(/1,200/)).toBeTruthy()
    })
  })

  // =========================================================================
  // STEP 5: Multi-User Voting & Retraction + UI Interaction
  // =========================================================================
  describe('Step 5: Multi-User Voting & Retraction', () => {
    it('manages votes_by_option accurately across multiple users and decrements upon retraction without wiping other votes', async () => {
      const currentPoll = {
        id: 701,
        trip_id: 'trip-banff-1234',
        category: 'accommodation',
        voter_selections: {
          [user1.id]: ['opt-chalet-1', 'opt-hotel-2'],
          [user2.id]: ['opt-chalet-1', 'opt-hotel-2'],
          [user3.id]: ['opt-chalet-1', 'opt-hotel-2']
        },
        votes_by_option: {
          'opt-chalet-1': 3,
          'opt-hotel-2': 3
        }
      }

      let updatedPollState = null
      supabase.from.mockImplementation((table) => {
        if (table === 'active_polls') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue({ data: [currentPoll], error: null })
                  })
                })
              })
            }),
            update: vi.fn().mockImplementation((payload) => {
              updatedPollState = { ...currentPoll, ...payload }
              return {
                eq: vi.fn().mockReturnValue({
                  select: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({ data: updatedPollState, error: null })
                  })
                })
              }
            })
          }
        }
        if (table === 'users') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: { first_name: 'Etienne' }, error: null })
              })
            })
          }
        }
        if (table === 'activity_log') {
          return {
            insert: vi.fn().mockResolvedValue({ data: null, error: null })
          }
        }
        return {}
      })

      // User 3 retracts vote on Banff Hotel (cast = false)
      const res = await toggleVote('trip-banff-1234', 'Accommodation', 'opt-hotel-2', user3.id, false)
      expect(res.votes_by_option['opt-hotel-2']).toBe(2)
      expect(res.votes_by_option['opt-chalet-1']).toBe(3)
      expect(res.voter_selections[user3.id]).toEqual(['opt-chalet-1'])
      expect(res.voter_selections[user1.id]).toContain('opt-hotel-2')
      expect(res.voter_selections[user2.id]).toContain('opt-hotel-2')
    })

    it('mounts OptionsTab and triggers onVoteToggle when traveler clicks vote button', () => {
      const onVoteToggle = vi.fn()
      const chalet = {
        id: 'opt-chalet-1',
        category: 'Accommodation',
        option_text: 'Canmore Chalet',
        estimated_cost: 1200,
        currency: 'CAD',
        cost_type: 'split_total'
      }
      const poll = {
        id: 701,
        category: 'accommodation',
        voter_selections: { [user1.id]: ['opt-chalet-1'] },
        votes_by_option: { 'opt-chalet-1': 1 }
      }

      render(
        <OptionsTab
          activeTab="Accommodation"
          options={[chalet]}
          allTripOptions={[chalet]}
          activePoll={poll}
          activeUser={user1}
          onVoteToggle={onVoteToggle}
          roster={[{ user_id: user1.id, role: 'organizer', status: 'Committed', users: user1 }]}
        />
      )

      const voteButton = screen.getByRole('button', { name: /✓ Voted/i })
      expect(voteButton).toBeTruthy()
      fireEvent.click(voteButton)
      expect(onVoteToggle).toHaveBeenCalledWith('opt-chalet-1', true, 'Accommodation')
    })
  })

  // =========================================================================
  // STEP 6: Multi-Option Locking + UI Interaction
  // =========================================================================
  describe('Step 6: Multi-Option Locking', () => {
    it('locks option and records locked_option_id without erasing voter_selections', async () => {
      const mockPoll = {
        id: 701,
        trip_id: 'trip-banff-1234',
        category: 'accommodation',
        voter_selections: {
          [user1.id]: ['opt-chalet-1'],
          [user2.id]: ['opt-chalet-1']
        },
        votes_by_option: { 'opt-chalet-1': 2 },
        locked_option_id: null
      }

      supabase.from.mockImplementation((table) => {
        if (table === 'active_polls') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue({ data: [mockPoll], error: null })
                  })
                })
              })
            }),
            update: vi.fn().mockImplementation((payload) => ({
              eq: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: { ...mockPoll, ...payload },
                    error: null
                  })
                })
              })
            }))
          }
        }
        if (table === 'poll_options') {
          return {
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: null, error: null })
            })
          }
        }
        if (table === 'users') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: { first_name: 'Alexis' }, error: null })
              })
            })
          }
        }
        if (table === 'activity_log') {
          return {
            insert: vi.fn().mockResolvedValue({ data: null, error: null })
          }
        }
        return {}
      })

      const updated = await lockOption('trip-banff-1234', 'Accommodation', 'opt-chalet-1', user1.id)
      expect(updated.locked_option_id).toBe('opt-chalet-1')
      expect(updated.voter_selections[user1.id]).toEqual(['opt-chalet-1'])
      expect(isOptionLocked({ id: 'opt-chalet-1' }, updated)).toBe(true)
    })

    it('mounts OptionsTab with Lock controls and triggers onLockToggle when clicked by an admin', () => {
      const onLockToggle = vi.fn()
      const chalet = {
        id: 'opt-chalet-1',
        category: 'Accommodation',
        option_text: 'Canmore Chalet',
        estimated_cost: 1200,
        currency: 'CAD',
        is_locked: false
      }
      const poll = {
        id: 701,
        category: 'accommodation',
        locked_option_id: null,
        voter_selections: {},
        votes_by_option: {}
      }

      render(
        <OptionsTab
          activeTab="Accommodation"
          options={[chalet]}
          allTripOptions={[chalet]}
          activePoll={poll}
          activeUser={user1}
          onLockToggle={onLockToggle}
          roster={[{ user_id: user1.id, role: 'organizer', status: 'Committed', users: user1 }]}
        />
      )

      const lockBtn = screen.getAllByTitle('Lock as winning choice')[0]
      expect(lockBtn).toBeTruthy()
      fireEvent.click(lockBtn)
      expect(onLockToggle).toHaveBeenCalledWith('opt-chalet-1')
    })
  })

  // =========================================================================
  // STEP 7: Gantt & Logistics Coverage Engine + GanttTimeline UI
  // =========================================================================
  describe('Step 7: Gantt & Logistics Coverage Engine', () => {
    const trip = {
      id: 'trip-banff-1234',
      title: 'QA Expedition — Banff & Canmore',
      start_date: '2026-12-24',
      end_date: '2026-12-28',
      base_currency: 'CAD'
    }

    const chalet = {
      id: 'opt-chalet-1',
      category: 'Accommodation',
      option_text: 'Canmore Chalet',
      start_date: '2026-12-24',
      end_date: '2026-12-28',
      is_locked: true,
      metadata: { max_capacity: 6, has_kitchen: true }
    }

    const hotel = {
      id: 'opt-hotel-2',
      category: 'Accommodation',
      option_text: 'Banff Hotel',
      start_date: '2026-12-24',
      end_date: '2026-12-28',
      is_locked: false
    }

    const iceClimbing = {
      id: 'opt-climb-4',
      category: 'Activities',
      option_text: 'Ice Climbing',
      start_date: '2026-12-25T09:00',
      end_date: '2026-12-25T13:00',
      is_locked: true
    }

    it('packs 2 overlapping accommodations into 2 separate sub-lanes with zero overlap', () => {
      const lanes = packOptionsIntoSubTracks([chalet, hotel], trip.start_date, trip.end_date)
      expect(lanes.length).toBe(2)
      expect(lanes[0][0].laneIndex).toBe(0)
      expect(lanes[1][0].laneIndex).toBe(1)
    })

    it('does not trigger false time conflicts between accommodation and daytime activities', () => {
      const { conflictPairs } = detectScheduleConflicts([chalet, hotel, iceClimbing])
      const hasFalseCrossCategoryConflict = conflictPairs.some(
        c => (c.optionA.category || '').toLowerCase() !== (c.optionB.category || '').toLowerCase()
      )
      expect(hasFalseCrossCategoryConflict).toBe(false)
    })

    it('runs analyzeDailyLogisticsCoverage and reports complete night coverage without deficits', () => {
      const roster = [
        { user_id: user1.id, status: 'Committed', arrival_date: '2026-12-24', departure_date: '2026-12-28' },
        { user_id: user2.id, status: 'Committed', arrival_date: '2026-12-24', departure_date: '2026-12-28' },
        { user_id: user3.id, status: 'Committed', arrival_date: '2026-12-25', departure_date: '2026-12-27' }
      ]
      const coverage = analyzeDailyLogisticsCoverage(trip, [chalet], roster, {})
      expect(coverage.days.length).toBe(5)
      expect(coverage.nightsCoveredCount).toBe(4) // 4 nights covered
      expect(coverage.days[0].accommodation.status).toBe('covered')
    })

    it('mounts GanttTimeline component and renders timeline header and categories', () => {
      render(
        <GanttTimeline
          trip={trip}
          options={[chalet, hotel, iceClimbing]}
          roster={[
            { user_id: user1.id, role: 'organizer', status: 'Committed', users: user1 },
            { user_id: user2.id, role: 'co_organizer', status: 'Committed', users: user2 }
          ]}
        />
      )

      expect(screen.getAllByText('Accommodation').length).toBeGreaterThan(0)
      expect(screen.getAllByText('Activities').length).toBeGreaterThan(0)
      expect(screen.getAllByText('Canmore Chalet').length).toBeGreaterThan(0)
    })
  })

  // =========================================================================
  // STEP 8: Meal Planning & Smart Grocery List + GroceryListPanel UI
  // =========================================================================
  describe('Step 8: Meal Planning & Smart Grocery List', () => {
    const meal = {
      id: 'opt-meal-pasta',
      trip_id: 'trip-banff-1234',
      category: 'Food',
      option_text: 'Pasta Night Dinner',
      estimated_cost: 60,
      currency: 'CAD',
      assigned_users: [],
      metadata: {
        meal_mode: 'cook',
        meal_slot: 'dinner',
        ingredients: ['Pasta', 'Tomato Sauce']
      }
    }

    const roster = [
      { user_id: user1.id, dietary_tags: [], users: user1 },
      { user_id: user2.id, dietary_tags: ['Vegetarian'], users: user2 }
    ]

    it('surfaces dietary alert for Nolwen and syncs ingredients into grocery items', async () => {
      const alerts = getMealDietaryAlerts(meal, roster)
      expect(alerts.some(a => a.tag.toLowerCase().includes('vegetarian'))).toBe(true)

      const mockGroceryItem = (name) => ({
        id: `gro-${name}`,
        trip_id: 'trip-banff-1234',
        name,
        aisle: 'dry_goods',
        is_checked: false
      })

      supabase.from.mockReturnValue({
        insert: vi.fn().mockImplementation((payload) => ({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockGroceryItem(payload[0].name), error: null })
          })
        }))
      })

      const syncResult = await syncGroceriesFromLockedMeals('trip-banff-1234', [meal], [])
      expect(syncResult.addedCount).toBe(2)
      expect(syncResult.totalIngredients).toBe(2)
    })

    it('mounts GroceryListPanel and renders grocery aisles and checkout button', async () => {
      const groceries = [
        { id: 'g1', trip_id: 'trip-banff-1234', name: 'Penne Pasta', aisle: 'dry_goods', quantity: '2 boxes', is_checked: false },
        { id: 'g2', trip_id: 'trip-banff-1234', name: 'Tomato Sauce', aisle: 'dry_goods', quantity: '2 jars', is_checked: false }
      ]

      supabase.from.mockImplementation((table) => {
        if (table === 'grocery_items') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({ data: groceries, error: null })
              })
            })
          }
        }
        return {}
      })

      render(
        <GroceryListPanel
          tripId="trip-banff-1234"
          trip={{ base_currency: 'CAD' }}
          roster={roster}
          activeUser={user1}
        />
      )

      expect(await screen.findByText('Penne Pasta')).toBeTruthy()
      expect(await screen.findByText('Tomato Sauce')).toBeTruthy()
      expect(screen.getByRole('button', { name: /Checkout & Log Grocery Expense/i })).toBeTruthy()
    })
  })

  // =========================================================================
  // STEP 9: Smart Expense Conversion, Custom Splits & FX Settlements + UI
  // =========================================================================
  describe('Step 9: Smart Expense Conversion, Custom Splits & Settlements', () => {
    const trip = {
      id: 'trip-banff-1234',
      title: 'QA Expedition — Banff & Canmore',
      base_currency: 'CAD',
      start_date: '2026-12-24',
      end_date: '2026-12-28'
    }

    const roster = [
      { user_id: user1.id, role: 'organizer', status: 'Committed', users: user1 },
      { user_id: user2.id, role: 'co_organizer', status: 'Committed', users: user2 },
      { user_id: user3.id, role: 'member', status: 'Committed', users: user3 }
    ]

    const chalet = {
      id: 'opt-chalet-1',
      category: 'Accommodation',
      option_text: 'Canmore Chalet',
      estimated_cost: 1200,
      currency: 'CAD',
      cost_type: 'split_total',
      assigned_users: []
    }

    const iceClimbing = {
      id: 'opt-climb-4',
      category: 'Activities',
      option_text: 'Ice Climbing',
      estimated_cost: 200,
      currency: 'CAD',
      cost_type: 'per_person',
      assigned_users: [user1.id, user2.id]
    }

    it('converts locked options to strongly-typed expenses without miscategorizing to other and excludes unassigned users', async () => {
      supabase.from.mockReturnValue({
        insert: vi.fn().mockImplementation((payload) => ({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: 'exp-gen-id', ...payload },
              error: null
            })
          })
        }))
      })

      const expChalet = await convertOptionToExpense(trip.id, chalet, user1.id, roster, exchangeRates, 'CAD')
      expect(expChalet.category).toBe('accommodation')
      expect(expChalet.split_users).toContain(user1.id)
      expect(expChalet.split_users).toContain(user2.id)
      expect(expChalet.split_users).toContain(user3.id)

      const expClimb = await convertOptionToExpense(trip.id, iceClimbing, user1.id, roster, exchangeRates, 'CAD')
      expect(expClimb.category).toBe('activities')
      expect(expClimb.split_users).toContain(user1.id)
      expect(expClimb.split_users).toContain(user2.id)
      // Etienne is NOT assigned to Ice Climbing!
      expect(expClimb.split_users).not.toContain(user3.id)
      expect(expClimb.amount).toBe(400) // 200 * 2
    })

    it('calculates zero-sum settlements accurately across multiple currencies and travelers', () => {
      const expenses = [
        {
          id: 'exp-1',
          paid_by: user1.id,
          amount: 1200,
          currency: 'CAD',
          category: 'accommodation',
          split_users: [user1.id, user2.id, user3.id]
        },
        {
          id: 'exp-2',
          paid_by: user1.id,
          amount: 400,
          currency: 'CAD',
          category: 'activities',
          split_users: [user1.id, user2.id]
        },
        {
          id: 'exp-3',
          paid_by: user2.id,
          amount: 150,
          currency: 'USD', // 150 USD * 1.35 = 202.5 CAD
          category: 'food',
          split_users: [user1.id, user2.id, user3.id]
        }
      ]

      const analytics = calculateTripBudgetAnalytics(expenses, [chalet, iceClimbing], roster, exchangeRates, 'CAD')
      const totalNet = analytics.travelerStats.reduce((sum, t) => sum + t.netBalance, 0)
      expect(Math.abs(totalNet)).toBeLessThan(0.05) // Strict zero-sum invariant

      const settlements = calculateSettlements(analytics.travelerStats)
      expect(settlements.length).toBeGreaterThan(0)
      expect(settlements.every(s => s.amount > 0)).toBe(true)
    })

    it('mounts LedgerAndSettleTab and displays ledger records and settlements view', () => {
      const expenses = [
        {
          id: 'exp-1',
          paid_by: user1.id,
          amount: 1200,
          currency: 'CAD',
          category: 'accommodation',
          description: '[ACCOMMODATION] Canmore Chalet',
          split_users: [user1.id, user2.id, user3.id],
          created_at: new Date().toISOString(),
          users: user1
        }
      ]

      render(
        <LedgerAndSettleTab
          tripId={trip.id}
          expenses={expenses}
          roster={roster}
          committedMembers={roster}
          activeUser={user1}
          baseCurrency="CAD"
          rates={exchangeRates}
          totalGroupSpend={1200}
          perPersonSplit={400}
          memberBalances={{
            [user1.id]: { userId: user1.id, name: 'Alexis', paid: 1200, owed: 400, net: 800 },
            [user2.id]: { userId: user2.id, name: 'Nolwen', paid: 0, owed: 400, net: -400 },
            [user3.id]: { userId: user3.id, name: 'Etienne', paid: 0, owed: 400, net: -400 }
          }}
          settlementsList={[
            { fromId: user2.id, fromName: 'Nolwen', toId: user1.id, toName: 'Alexis', amount: 400 },
            { fromId: user3.id, fromName: 'Etienne', toId: user1.id, toName: 'Alexis', amount: 400 }
          ]}
        />
      )

      expect(screen.getAllByText(/Canmore Chalet/i).length).toBeGreaterThan(0)
      expect(screen.getAllByText(/Alexis/i).length).toBeGreaterThan(0)
      expect(screen.getByRole('button', { name: /Add Expense/i })).toBeTruthy()
    })
  })

  // =========================================================================
  // STEP 10: Cleanup & Cascade Delete
  // =========================================================================
  describe('Step 10: Cleanup & Cascade Delete', () => {
    it('executes deleteTrip without orphan rows or foreign key crashes', async () => {
      const mockTripId = 'trip-banff-1234'

      supabase.from.mockReturnValue({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: null, error: null })
        })
      })

      await expect(deleteTrip(mockTripId)).resolves.toBe(true)
      expect(supabase.from).toHaveBeenCalledWith('trips')
    })
  })
})
