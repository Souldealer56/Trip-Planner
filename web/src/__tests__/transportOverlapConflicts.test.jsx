import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { render, fireEvent, screen } from '@testing-library/react'
import { OptionCard } from '../components/OptionCard'
import { OptionsTab } from '../components/trip/OptionsTab'
import {
  detectTransportParticipantConflicts,
  checkUserTransportOverlap
} from '../utils/schedule'

describe('TASK 4: Transport Double-Booking & Overlapping Locked Vehicles', () => {
  const dummyTrip = {
    id: 'trip-100',
    name: 'Winter Roadtrip',
    start_date: '2026-12-24',
    end_date: '2027-01-03',
    base_currency: 'USD'
  }

  const dummyRoster = [
    { user_id: 'user-alexis', username: 'alexis', users: { first_name: 'Alexis' } },
    { user_id: 'user-sam', username: 'sam', users: { first_name: 'Sam' } },
    { user_id: 'user-taylor', username: 'taylor', users: { first_name: 'Taylor' } }
  ]

  const getSubaruOutback = () => ({
    id: 'opt-subaru',
    trip_id: 'trip-100',
    category: 'Transport',
    option_text: 'SUBARU OUTBACK',
    start_date: '2026-12-24',
    end_date: '2027-01-03',
    estimated_cost: 500,
    currency: 'USD',
    is_locked: true,
    metadata: {
      transport_mode: 'vehicle',
      seats_capacity: 5,
      driver_user_id: 'user-alexis',
      estimated_fuel_cost: 60
    },
    assigned_users: ['user-alexis', 'user-taylor']
  })

  const getFordLightning = () => ({
    id: 'opt-ford',
    trip_id: 'trip-100',
    category: 'Transport',
    option_text: 'FORD LIGHTNING',
    start_date: '2026-12-25',
    end_date: '2027-01-03',
    estimated_cost: 700,
    currency: 'USD',
    is_locked: true,
    metadata: {
      transport_mode: 'vehicle',
      seats_capacity: 5,
      driver_user_id: 'user-sam',
      estimated_fuel_cost: 0
    },
    assigned_users: ['user-sam', 'user-alexis']
  })

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  describe('Conflict Detection Logic', () => {
    it('detects participant double-booked across overlapping locked vehicles', () => {
      const conflicts = detectTransportParticipantConflicts([getSubaruOutback(), getFordLightning()], null, dummyRoster)
      expect(conflicts.hasConflicts).toBe(true)

      const subaruConflicts = conflicts.conflictsByOptionId['opt-subaru']
      expect(subaruConflicts).toBeDefined()
      expect(subaruConflicts[0].userName).toBe('Alexis')
      expect(subaruConflicts[0].otherOptionTitle).toBe('FORD LIGHTNING')
      expect(subaruConflicts[0].message).toContain('⚠️ Schedule Conflict: Alexis is also in FORD LIGHTNING')

      const fordConflicts = conflicts.conflictsByOptionId['opt-ford']
      expect(fordConflicts).toBeDefined()
      expect(fordConflicts[0].userName).toBe('Alexis')
      expect(fordConflicts[0].otherOptionTitle).toBe('SUBARU OUTBACK')
      expect(fordConflicts[0].message).toContain('⚠️ Schedule Conflict: Alexis is also in SUBARU OUTBACK')
    })
  })

  describe('UI Surface: OptionCard Badges & Fix for Stray "0"', () => {
    it('renders prominent schedule conflict badge on the card header', () => {
      const { container } = render(
        <OptionCard
          opt={getSubaruOutback()}
          activeTab="Transport"
          trip={dummyTrip}
          roster={dummyRoster}
          activeUser={{ id: 'user-alexis' }}
          transportConflicts={[
            {
              userId: 'user-alexis',
              userName: 'Alexis',
              otherOptionId: 'opt-ford',
              otherOptionTitle: 'FORD LIGHTNING'
            }
          ]}
        />
      )

      expect(container.textContent).toContain('⚠️ Schedule Conflict: Alexis is also in FORD LIGHTNING')
    })

    it('does NOT render a stray "0" under Driver badge when fuel cost or estimated cost is 0', () => {
      const vehicleWithZeroFuelAndCost = {
        ...getSubaruOutback(),
        estimated_cost: 0,
        metadata: {
          transport_mode: 'vehicle',
          seats_capacity: 5,
          driver_user_id: 'user-alexis',
          estimated_fuel_cost: 0,
          gas_cost: 0
        }
      }

      const { container } = render(
        <OptionCard
          opt={vehicleWithZeroFuelAndCost}
          activeTab="Transport"
          trip={dummyTrip}
          roster={dummyRoster}
          activeUser={{ id: 'user-alexis' }}
          transportConflicts={[]}
        />
      )

      // Ensure Driver badge renders
      expect(container.textContent).toContain('Driver: Alexis')

      // Ensure there is no stray "0" rendered immediately after or inside the spec box
      const specBox = container.querySelector('.category-spec-box')
      expect(specBox).not.toBeNull()
      // Directly check child nodes to ensure no text node equals "0"
      Array.from(specBox.childNodes).forEach((node) => {
        if (node.nodeType === 3 /* Node.TEXT_NODE */) {
          expect(node.textContent.trim()).not.toBe('0')
        }
      })
    })
  })

  describe('Actions: + Join & Designated Driver Conflict Interceptions', () => {
    it('prompts confirmation when clicking + Join on an overlapping locked vehicle and does not join if cancelled', () => {
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
      const onToggleParticipantMock = vi.fn()

      const { container } = render(
        <OptionCard
          opt={{
            ...getFordLightning(),
            assigned_users: ['user-sam'] // Alexis is not joined yet in Ford
          }}
          activeTab="Transport"
          trip={dummyTrip}
          roster={dummyRoster}
          activeUser={{ id: 'user-alexis' }}
          allTripOptions={[getSubaruOutback(), getFordLightning()]}
          onToggleParticipant={onToggleParticipantMock}
        />
      )

      const joinBtn = container.querySelector('.one-tap-join-btn')
      expect(joinBtn).not.toBeNull()
      expect(joinBtn.textContent).toBe('+ Join')

      fireEvent.click(joinBtn)

      // Confirm prompt was called with conflict warning
      expect(confirmSpy).toHaveBeenCalled()
      const confirmMessage = confirmSpy.mock.calls[0][0]
      expect(confirmMessage).toContain('Schedule Conflict')
      expect(confirmMessage).toContain('SUBARU OUTBACK')

      // Since user cancelled (false), onToggleParticipant was NOT called
      expect(onToggleParticipantMock).not.toHaveBeenCalled()
    })

    it('calls onToggleParticipant when user confirms switching vehicles', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true)
      const onToggleParticipantMock = vi.fn()

      const { container } = render(
        <OptionCard
          opt={{
            ...getFordLightning(),
            assigned_users: ['user-sam'] // Alexis is not joined yet in Ford
          }}
          activeTab="Transport"
          trip={dummyTrip}
          roster={dummyRoster}
          activeUser={{ id: 'user-alexis' }}
          allTripOptions={[getSubaruOutback(), getFordLightning()]}
          onToggleParticipant={onToggleParticipantMock}
        />
      )

      const joinBtn = container.querySelector('.one-tap-join-btn')
      fireEvent.click(joinBtn)

      await vi.waitFor(() => {
        expect(onToggleParticipantMock).toHaveBeenCalledWith(
          'opt-ford',
          ['user-sam'],
          expect.any(Array)
        )
      })
    })
  })

  describe('OptionsTab Integration', () => {
    it('automatically evaluates transport conflicts from allTripOptions and renders conflict pills', () => {
      const sub = getSubaruOutback()
      const ford = getFordLightning()
      const { container } = render(
        <OptionsTab
          trip={dummyTrip}
          roster={dummyRoster}
          activeUser={{ id: 'user-alexis' }}
          allTripOptions={[sub, ford]}
          options={[sub, ford]}
          activeTab="Transport"
          onToggleParticipant={vi.fn()}
        />
      )

      // Both cards should render their respective schedule conflict warning
      expect(container.textContent).toContain('⚠️ Schedule Conflict: Alexis is also in FORD LIGHTNING')
      expect(container.textContent).toContain('⚠️ Schedule Conflict: Alexis is also in SUBARU OUTBACK')
    })
  })
})
