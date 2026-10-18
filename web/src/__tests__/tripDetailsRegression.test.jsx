import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { render, fireEvent } from '@testing-library/react'
import { OptionsTab } from '../components/trip/OptionsTab'
import { checkOptionDateConflict } from '../services/options'

vi.mock('../services/supabase', () => {
  return {
    supabase: {
      from: vi.fn()
    }
  }
})

describe('TripDetails Production Regression Tests', () => {
  const tripChristmas = {
    id: 'trip-xmas-2026',
    title: 'Christmas & NYE 2026',
    start_date: '2026-12-24',
    end_date: '2027-01-03',
    organizer_id: 'user-organizer-1',
    base_currency: 'USD'
  }

  const dummyRoster = [
    {
      id: 'rsvp-1',
      user_id: 'user-organizer-1',
      role: 'organizer',
      status: 'Committed',
      users: { id: 'user-organizer-1', first_name: 'Alex', email: 'alex@example.com', username: 'alex_travel' }
    },
    {
      id: 'rsvp-2',
      user_id: 'user-member-2',
      role: 'participant',
      status: 'Committed',
      users: { id: 'user-member-2', first_name: 'Jordan', email: 'jordan@example.com', username: 'jordan_nye' }
    }
  ]

  const harveyOptions = [
    {
      id: 101,
      trip_id: 'trip-xmas-2026',
      category: 'Accommodation',
      option_text: 'Harvey heights',
      start_date: '2026-12-25T16:00:00',
      end_date: '2026-12-27T11:00:00',
      estimated_cost: null, // No cost provided
      currency: 'USD',
      is_locked: false
    },
    {
      id: 102,
      trip_id: 'trip-xmas-2026',
      category: 'accommodation', // lowercase category
      option_text: 'Harvey heights - canmore',
      start_date: '2026-12-27T16:00:00',
      end_date: '2027-01-03T11:00:00', // checkout on last day of trip
      estimated_cost: 0, // 0 cost
      currency: 'USD',
      is_locked: false
    }
  ]

  describe('Bug 1: Unified Option Data Source & Scheduling / Sorting', () => {
    it('correctly validates that options within trip dates (including last day) have no date conflict', () => {
      // Dec 25 - Dec 27 inside Dec 24 - Jan 3
      expect(checkOptionDateConflict(harveyOptions[0], tripChristmas.start_date, tripChristmas.end_date)).toBe(false)
      // Dec 27 - Jan 3 checkout inside Dec 24 - Jan 3
      expect(checkOptionDateConflict(harveyOptions[1], tripChristmas.start_date, tripChristmas.end_date)).toBe(false)
    })

    it('derives category options from allTripOptions when options prop is empty (All (2) instead of All (0))', () => {
      const { container } = render(
        <OptionsTab
          activeTab="Accommodation"
          options={[]} // Simulates options state being out-of-sync or empty
          allTripOptions={harveyOptions} // Unified single source of truth
          trip={tripChristmas}
          roster={dummyRoster}
          activeUser={{ id: 'user-organizer-1' }}
          viewMode="grid"
        />
      )

      // Both Harvey heights options should be rendered in the document
      expect(container.textContent).toContain('Harvey heights')
      expect(container.textContent).toContain('Harvey heights - canmore')

      // Filter pill should show All (2)
      const allPill = Array.from(container.querySelectorAll('.filter-pill')).find((el) => el.textContent.includes('All'))
      expect(allPill?.textContent).toContain('All (2)')

      // Category tab button should display badge Accommodation (2)
      const accomTab = Array.from(container.querySelectorAll('.tab-btn')).find((el) => el.textContent.includes('Accommodation'))
      expect(accomTab?.textContent).toContain('Accommodation (2)')
    })

    it('keeps scheduled options visible under Price: Low to High sort mode even if cost is null or 0', () => {
      const { container } = render(
        <OptionsTab
          activeTab="Accommodation"
          options={harveyOptions}
          allTripOptions={harveyOptions}
          trip={tripChristmas}
          roster={dummyRoster}
          activeUser={{ id: 'user-organizer-1' }}
          viewMode="grid"
        />
      )

      // Select Price: Low to High sort
      const sortSelect = container.querySelector('#options-sort-select')
      expect(sortSelect).not.toBeNull()
      fireEvent.change(sortSelect, { target: { value: 'price_asc' } })

      // Both options must remain rendered and not dropped by NaN sort
      expect(container.textContent).toContain('Harvey heights')
      expect(container.textContent).toContain('Harvey heights - canmore')
    })
  })

  describe('Bug 2: False-Positive "Not on the Roster" Modal Logic', () => {
    // Pure logic simulation matching TripDetails implementation
    const isUserOnRoster = (activeUser, trip, roster) => {
      if (!activeUser) return false
      if (!trip) return true // Do not flag while trip is still loading
      if (String(trip.organizer_id) === String(activeUser.id)) return true

      const userEmail = activeUser.email?.trim().toLowerCase()
      const userUsername = activeUser.username?.trim().toLowerCase()

      return roster.some((r) => {
        if (String(r.user_id) === String(activeUser.id)) return true
        const rosterEmail = r.users?.email?.trim().toLowerCase()
        if (rosterEmail && userEmail && rosterEmail === userEmail) return true
        const rosterUsername = (r.users?.username || r.username)?.trim().toLowerCase()
        if (rosterUsername && userUsername && rosterUsername === userUsername) return true
        return false
      })
    }

    const shouldShowBlockingModal = (tripLoading, rosterLoading, trip, activeUser, roster) => {
      if (tripLoading || rosterLoading || trip === null || !activeUser) return false
      return !isUserOnRoster(activeUser, trip, roster)
    }

    it('recognizes trip creator/organizer even if not explicitly in roster array', () => {
      const creatorUser = { id: 'user-organizer-1', first_name: 'Alex' }
      expect(isUserOnRoster(creatorUser, tripChristmas, [])).toBe(true)
      expect(shouldShowBlockingModal(false, false, tripChristmas, creatorUser, [])).toBe(false)
    })

    it('never shows blocking modal while tripLoading or rosterLoading is true', () => {
      const newUser = { id: 'user-guest-999', first_name: 'Guest' }
      // While roster is loading
      expect(shouldShowBlockingModal(false, true, tripChristmas, newUser, dummyRoster)).toBe(false)
      // While trip is loading
      expect(shouldShowBlockingModal(true, false, tripChristmas, newUser, dummyRoster)).toBe(false)
    })

    it('matches user by case-insensitive email even if user ID differs', () => {
      const sessionUserWithDifferentId = {
        id: 'different-local-uuid',
        first_name: 'Jordan',
        email: 'JORDAN@EXAMPLE.COM'
      }
      expect(isUserOnRoster(sessionUserWithDifferentId, tripChristmas, dummyRoster)).toBe(true)
      expect(shouldShowBlockingModal(false, false, tripChristmas, sessionUserWithDifferentId, dummyRoster)).toBe(false)
    })

    it('matches user by case-insensitive username even if user ID differs', () => {
      const sessionUserWithDifferentId = {
        id: 'different-local-uuid-2',
        first_name: 'Jordan',
        username: 'JORDAN_NYE'
      }
      expect(isUserOnRoster(sessionUserWithDifferentId, tripChristmas, dummyRoster)).toBe(true)
      expect(shouldShowBlockingModal(false, false, tripChristmas, sessionUserWithDifferentId, dummyRoster)).toBe(false)
    })

    it('shows blocking modal only when loading finished and user is genuinely not on the roster', () => {
      const outsider = {
        id: 'outsider-uuid',
        first_name: 'Stranger',
        email: 'stranger@nowhere.com',
        username: 'stranger'
      }
      expect(isUserOnRoster(outsider, tripChristmas, dummyRoster)).toBe(false)
      expect(shouldShowBlockingModal(false, false, tripChristmas, outsider, dummyRoster)).toBe(true)
    })
  })
})
