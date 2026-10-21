import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import {
  calculateVehicleCostPerPassenger,
  checkAccommodationCapacity,
  checkActivitySpots,
  toggleOptionParticipant,
  normalizeCategory,
  normalizeOptionRow
} from '../services/options'
import { OptionsTab } from '../components/trip/OptionsTab'
import { supabase } from '../services/supabase'

vi.mock('../services/supabase', () => ({
  supabase: {
    from: vi.fn()
  }
}))

describe('Category Specialization & Dynamic Calculations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Vehicle Seat Availability & Cost Calculation (1 to 5 passengers)', () => {
    const totalCost = 500
    const seatsCapacity = 5
    const currency = 'USD'

    it('calculates cost and seat availability for 1 passenger', () => {
      const result = calculateVehicleCostPerPassenger(totalCost, 1, seatsCapacity, currency)
      expect(result.costPerPassenger).toBe(500)
      expect(result.costIfFull).toBe(100)
      expect(result.seatsLeft).toBe(4)
      expect(result.isFull).toBe(false)
      expect(result.isOverCapacity).toBe(false)
    })

    it('calculates cost and seat availability for 2 passengers', () => {
      const result = calculateVehicleCostPerPassenger(totalCost, 2, seatsCapacity, currency)
      expect(result.costPerPassenger).toBe(250)
      expect(result.costIfFull).toBe(100)
      expect(result.seatsLeft).toBe(3)
      expect(result.isFull).toBe(false)
      expect(result.isOverCapacity).toBe(false)
    })

    it('calculates cost and seat availability for 3 passengers', () => {
      const result = calculateVehicleCostPerPassenger(totalCost, 3, seatsCapacity, currency)
      expect(result.costPerPassenger).toBeCloseTo(166.67, 1)
      expect(result.costIfFull).toBe(100)
      expect(result.seatsLeft).toBe(2)
      expect(result.isFull).toBe(false)
      expect(result.isOverCapacity).toBe(false)
    })

    it('calculates cost and seat availability for 4 passengers', () => {
      const result = calculateVehicleCostPerPassenger(totalCost, 4, seatsCapacity, currency)
      expect(result.costPerPassenger).toBe(125)
      expect(result.costIfFull).toBe(100)
      expect(result.seatsLeft).toBe(1)
      expect(result.isFull).toBe(false)
      expect(result.isOverCapacity).toBe(false)
    })

    it('calculates cost and seat availability when full (5 passengers)', () => {
      const result = calculateVehicleCostPerPassenger(totalCost, 5, seatsCapacity, currency)
      expect(result.costPerPassenger).toBe(100)
      expect(result.costIfFull).toBe(100)
      expect(result.seatsLeft).toBe(0)
      expect(result.isFull).toBe(true)
      expect(result.isOverCapacity).toBe(false)
    })

    it('detects over-capacity when passengers exceed seats capacity', () => {
      const result = calculateVehicleCostPerPassenger(totalCost, 6, seatsCapacity, currency)
      expect(result.costPerPassenger).toBeCloseTo(83.33, 1)
      expect(result.seatsLeft).toBe(0)
      expect(result.isFull).toBe(true)
      expect(result.isOverCapacity).toBe(true)
    })

    it('handles edge case when 0 passengers are assigned', () => {
      const result = calculateVehicleCostPerPassenger(totalCost, 0, seatsCapacity, currency)
      expect(result.costPerPassenger).toBe(500) // fallback to 1 passenger
      expect(result.seatsLeft).toBe(5)
      expect(result.isFull).toBe(false)
      expect(result.isOverCapacity).toBe(false)
    })
  })

  describe('Accommodation Capacity Warnings & Bed Deficits', () => {
    it('reports available beds when within capacity', () => {
      const result = checkAccommodationCapacity(4, 6, 8)
      expect(result.isOverCapacity).toBe(false)
      expect(result.bedsRemaining).toBe(2)
      expect(result.groupExceedsCapacity).toBe(true)
      expect(result.bedsNeededForGroup).toBe(2)
      expect(result.capacityPercent).toBe(67)
    })

    it('reports exactly full when assignedCount equals maxCapacity', () => {
      const result = checkAccommodationCapacity(6, 6, 8)
      expect(result.isOverCapacity).toBe(false)
      expect(result.bedsRemaining).toBe(0)
      expect(result.groupExceedsCapacity).toBe(true)
      expect(result.bedsNeededForGroup).toBe(2)
      expect(result.capacityPercent).toBe(100)
    })

    it('flags over-capacity when assigned travelers exceed maxCapacity', () => {
      const result = checkAccommodationCapacity(7, 6, 8)
      expect(result.isOverCapacity).toBe(true)
      expect(result.bedsRemaining).toBe(0)
      expect(result.capacityPercent).toBe(117)
    })

    it('does not flag group deficit if accommodation accommodates the entire group', () => {
      const result = checkAccommodationCapacity(5, 10, 8)
      expect(result.groupExceedsCapacity).toBe(false)
      expect(result.bedsNeededForGroup).toBe(0)
      expect(result.bedsRemaining).toBe(5)
    })
  })

  describe('Activity Spots & Quotas', () => {
    it('calculates remaining spots for activity', () => {
      const result = checkActivitySpots(4, 10)
      expect(result.spotsLeft).toBe(6)
      expect(result.isFull).toBe(false)
      expect(result.isOverLimit).toBe(false)
    })

    it('detects when activity spots are full', () => {
      const result = checkActivitySpots(10, 10)
      expect(result.spotsLeft).toBe(0)
      expect(result.isFull).toBe(true)
      expect(result.isOverLimit).toBe(false)
    })

    it('detects when activity participants exceed quota limit', () => {
      const result = checkActivitySpots(12, 10)
      expect(result.spotsLeft).toBe(0)
      expect(result.isFull).toBe(true)
      expect(result.isOverLimit).toBe(true)
    })
  })

  describe('Participant Toggle Logic with Implicit Fallback Resolution', () => {
    it('toggles off an active user in an explicit array', async () => {
      const updateMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: null, error: null })
      })
      supabase.from.mockReturnValue({ update: updateMock })

      await toggleOptionParticipant('opt-1', 'user-1', ['user-1', 'user-2'])

      expect(supabase.from).toHaveBeenCalledWith('poll_options')
      expect(updateMock).toHaveBeenCalledWith({
        assigned_users: ['user-2']
      })
    })

    it('toggles on an active user missing from an explicit array', async () => {
      const updateMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: null, error: null })
      })
      supabase.from.mockReturnValue({ update: updateMock })

      await toggleOptionParticipant('opt-1', 'user-3', ['user-1', 'user-2'])

      expect(updateMock).toHaveBeenCalledWith({
        assigned_users: ['user-1', 'user-2', 'user-3']
      })
    })

    it('resolves implicit all-travelers list when toggling leave from an empty array', async () => {
      const updateMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: null, error: null })
      })
      supabase.from.mockReturnValue({ update: updateMock })

      // Currently empty assigned_users, fallback has user-1 and user-2. User-1 leaves.
      await toggleOptionParticipant('opt-1', 'user-1', [], ['user-1', 'user-2'])

      expect(updateMock).toHaveBeenCalledWith({
        assigned_users: ['user-2']
      })
    })

    it('resolves implicit all-travelers list when a non-present user joins', async () => {
      const updateMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: null, error: null })
      })
      supabase.from.mockReturnValue({ update: updateMock })

      // Currently empty assigned_users, fallback has user-1 and user-2. External user-3 joins.
      await toggleOptionParticipant('opt-1', 'user-3', [], ['user-1', 'user-2'])

      expect(updateMock).toHaveBeenCalledWith({
        assigned_users: ['user-1', 'user-2', 'user-3']
      })
    })
  })

  describe('OptionsTab Category-Specialized Cards & Interactive Join Bar', () => {
    const dummyRoster = [
      {
        id: 'rsvp-1',
        user_id: 'user-1',
        status: 'Committed',
        users: { id: 'user-1', first_name: 'Alexis' }
      },
      {
        id: 'rsvp-2',
        user_id: 'user-2',
        status: 'Committed',
        users: { id: 'user-2', first_name: 'Jordan' }
      },
      {
        id: 'rsvp-3',
        user_id: 'user-3',
        status: 'Committed',
        users: { id: 'user-3', first_name: 'Morgan' }
      }
    ]

    const dummyTrip = {
      id: 'trip-100',
      title: 'Azores Adventure',
      destination: 'São Miguel, Azores',
      start_date: '2026-08-01',
      end_date: '2026-08-10',
      base_currency: 'EUR'
    }

    it('renders accommodation card with capacity gauge, beds summary, and kitchen badge', () => {
      const accommodationOption = {
        id: 'opt-villa',
        trip_id: 'trip-100',
        category: 'Accommodation',
        option_text: 'Oceanfront Villa in Ponta Delgada',
        estimated_cost: 1200,
        currency: 'EUR',
        assigned_users: ['user-1', 'user-2'],
        metadata: {
          max_capacity: 4,
          beds_summary: '2 Queen Beds, 2 Single Sofa Beds',
          has_kitchen: true,
          check_in_out: 'Check-in 15:00 / Check-out 11:00'
        }
      }

      const { container } = render(
        React.createElement(OptionsTab, {
          trip: dummyTrip,
          roster: dummyRoster,
          activeUser: { id: 'user-1' },
          options: [accommodationOption],
          activeTab: 'Accommodation',
          onToggleParticipant: vi.fn()
        })
      )

      expect(container.textContent).toContain('Oceanfront Villa in Ponta Delgada')
      expect(container.textContent).toContain('2/4 sleepers')
      expect(container.textContent).toContain('2 left')
      expect(container.textContent).toContain('🍳 Kitchen available')
      expect(container.textContent).toContain('2 Queen Beds')
      expect(container.textContent).toContain("✓ I'm In")
    })

    it('renders transport rental vehicle card with seats gauge, driver, and dynamic passenger cost', () => {
      const vehicleOption = {
        id: 'opt-van',
        trip_id: 'trip-100',
        category: 'Transport',
        option_text: '9-Seater Minivan Rental',
        estimated_cost: 600,
        currency: 'EUR',
        assigned_users: ['user-1', 'user-2', 'user-3'],
        metadata: {
          transport_mode: 'vehicle',
          seats_capacity: 5,
          driver_user_id: 'user-1',
          estimated_fuel_cost: 80
        }
      }

      const { container } = render(
        React.createElement(OptionsTab, {
          trip: dummyTrip,
          roster: dummyRoster,
          activeUser: { id: 'user-1' },
          options: [vehicleOption],
          activeTab: 'Transport',
          onToggleParticipant: vi.fn()
        })
      )

      expect(container.textContent).toContain('9-Seater Minivan Rental')
      expect(container.textContent).toContain('3 / 5 seats filled')
      expect(container.textContent).toContain('2 seats left')
      expect(container.textContent).toContain('Driver: Alexis')
      expect(container.textContent).toContain('Cost per passenger: 200 EUR')
      expect(container.textContent).toContain('If all 5 seats fill: ~120 EUR / person')
    })

    it('renders flights / ticket card with route code, per-person pricing, and baggage badge', () => {
      const flightOption = {
        id: 'opt-flight',
        trip_id: 'trip-100',
        category: 'Flights',
        option_text: 'SATA Azores Airlines Flight',
        estimated_cost: 350,
        currency: 'EUR',
        cost_type: 'per_person',
        assigned_users: ['user-1', 'user-2'],
        metadata: {
          route_code: 'S4 120 · LIS → PDL',
          baggage_included: true
        }
      }

      const { container } = render(
        React.createElement(OptionsTab, {
          trip: dummyTrip,
          roster: dummyRoster,
          activeUser: { id: 'user-3' },
          options: [flightOption],
          activeTab: 'Flights',
          onToggleParticipant: vi.fn()
        })
      )

      expect(container.textContent).toContain('SATA Azores Airlines Flight')
      expect(container.textContent).toContain('✈️ S4 120 · LIS → PDL')
      expect(container.textContent).toContain('🧳 Baggage included')
      expect(container.textContent).toContain('Total for 2 travelers: 700 EUR')
      // User 3 is not joined
      expect(container.textContent).toContain('+ Join')
    })

    it('renders activity card with spot quota and gear requirements', () => {
      const activityOption = {
        id: 'opt-canyoning',
        trip_id: 'trip-100',
        category: 'Activities',
        option_text: 'Salto do Cabrito Canyoning Tour',
        estimated_cost: 75,
        currency: 'EUR',
        assigned_users: ['user-1'],
        metadata: {
          max_participants: 6,
          difficulty_or_duration: '3.5h · Moderate',
          required_gear: 'Neoprene booties, Swimsuit, Waterproof camera'
        }
      }

      const { container } = render(
        React.createElement(OptionsTab, {
          trip: dummyTrip,
          roster: dummyRoster,
          activeUser: { id: 'user-2' },
          options: [activityOption],
          activeTab: 'Activities',
          onToggleParticipant: vi.fn()
        })
      )

      expect(container.textContent).toContain('Salto do Cabrito Canyoning Tour')
      expect(container.textContent).toContain('1/6 spots')
      expect(container.textContent).toContain('⏱️ 3.5h · Moderate')
      expect(container.textContent).toContain('Neoprene booties, Swimsuit, Waterproof camera')
      expect(container.textContent).toContain('+ Join')
    })

    it('calls onToggleParticipant when one-tap join button is clicked', () => {
      const onToggleParticipantMock = vi.fn()
      const activityOption = {
        id: 'opt-surf',
        trip_id: 'trip-100',
        category: 'Activities',
        option_text: 'Santa Barbara Surf Lesson',
        estimated_cost: 50,
        currency: 'EUR',
        assigned_users: ['user-1'],
        metadata: {
          max_participants: 4
        }
      }

      const { container } = render(
        React.createElement(OptionsTab, {
          trip: dummyTrip,
          roster: dummyRoster,
          activeUser: { id: 'user-2' },
          options: [activityOption],
          activeTab: 'Activities',
          onToggleParticipant: onToggleParticipantMock
        })
      )

      const joinBtn = container.querySelector('.one-tap-join-btn')
      fireEvent.click(joinBtn)

      expect(onToggleParticipantMock).toHaveBeenCalledWith(
        'opt-surf',
        ['user-1'],
        expect.any(Array)
      )
    })
  })

  describe('Legacy Flights Category Normalization & Backward Compatibility', () => {
    it('normalizes legacy flight option rows into transport with ticket mode and is_legacy_flight flag', () => {
      const legacyRow = {
        id: 'legacy-opt-1',
        trip_id: 'trip-100',
        category: 'flights',
        option_text: 'Air Canada AC890 Flight',
        metadata: { route_code: 'YUL → CDG' }
      }

      const normalized = normalizeOptionRow(legacyRow)
      expect(normalized.category).toBe('transport')
      expect(normalized.metadata.transport_mode).toBe('ticket')
      expect(normalized.metadata.is_legacy_flight).toBe(true)
      expect(normalized.metadata.route_code).toBe('YUL → CDG')
    })

    it('normalizes category strings correctly via normalizeCategory', () => {
      expect(normalizeCategory('flights')).toBe('transport')
      expect(normalizeCategory('Flight')).toBe('transport')
      expect(normalizeCategory('FLIGHTS ')).toBe('transport')
      expect(normalizeCategory('Accommodation')).toBe('accommodation')
      expect(normalizeCategory('')).toBe('other')
      expect(normalizeCategory(null)).toBe('other')
    })
  })
})
