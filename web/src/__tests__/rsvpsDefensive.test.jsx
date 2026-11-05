import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import {
  saveRsvpRecord,
  createRsvp,
  updateRsvpStatus,
  updateRsvpDetails,
  updateRsvpNote,
  promoteToCoOrganizer,
  demoteCoOrganizer
} from '../services/rsvps'
import { useRosterActions } from '../hooks/useRosterActions'
import { supabase } from '../services/supabase'

vi.mock('../services/supabase', () => {
  return {
    supabase: {
      from: vi.fn()
    }
  }
})

describe('RSVP Defensive Save & Mutation Pattern (TASK 1)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('updates existing row by id when 1 row exists without calling .single()', async () => {
    const tripId = 'trip-123'
    const userId = 'user-abc'

    // Mock select existing rows
    const mockOrder = vi.fn().mockResolvedValue({
      data: [{ id: 'rsvp-1', trip_id: tripId, user_id: userId, status: 'Interested' }],
      error: null
    })
    const mockEqUser = vi.fn().mockReturnValue({ order: mockOrder })
    const mockEqTrip = vi.fn().mockReturnValue({ eq: mockEqUser })
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEqTrip })

    // Mock update query
    const mockUpdateSelect = vi.fn().mockResolvedValue({
      data: [{ id: 'rsvp-1', trip_id: tripId, user_id: userId, status: 'Committed' }],
      error: null
    })
    const mockUpdateEqId = vi.fn().mockReturnValue({ select: mockUpdateSelect })
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockUpdateEqId })

    supabase.from.mockImplementation((table) => {
      if (table === 'rsvps') {
        return {
          select: mockSelect,
          update: mockUpdate
        }
      }
      return {}
    })

    const result = await saveRsvpRecord(tripId, userId, { status: 'Committed' })

    expect(result).toEqual({ id: 'rsvp-1', trip_id: tripId, user_id: userId, status: 'Committed' })
    expect(mockUpdateEqId).toHaveBeenCalledWith('id', 'rsvp-1')
    expect(mockUpdateSelect).toHaveBeenCalled()
    // Verify .single() is not called on update
    expect(mockUpdateSelect.mock.results[0].value.single).toBeUndefined()
  })

  it('inserts row when 0 rows exist without calling .single()', async () => {
    const tripId = 'trip-123'
    const userId = 'user-abc'

    // Mock select existing rows returning empty array
    const mockOrder = vi.fn().mockResolvedValue({
      data: [],
      error: null
    })
    const mockEqUser = vi.fn().mockReturnValue({ order: mockOrder })
    const mockEqTrip = vi.fn().mockReturnValue({ eq: mockEqUser })
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEqTrip })

    // Mock insert query
    const mockInsertSelect = vi.fn().mockResolvedValue({
      data: [{ id: 'rsvp-new', trip_id: tripId, user_id: userId, status: 'Committed', role: 'member' }],
      error: null
    })
    const mockInsert = vi.fn().mockReturnValue({ select: mockInsertSelect })

    supabase.from.mockImplementation((table) => {
      if (table === 'rsvps') {
        return {
          select: mockSelect,
          insert: mockInsert
        }
      }
      return {}
    })

    const result = await saveRsvpRecord(tripId, userId, { status: 'Committed', role: 'member' })

    expect(result).toEqual({ id: 'rsvp-new', trip_id: tripId, user_id: userId, status: 'Committed', role: 'member' })
    expect(mockInsert).toHaveBeenCalledWith([
      { trip_id: tripId, user_id: userId, status: 'Committed', role: 'member' }
    ])
    expect(mockInsertSelect).toHaveBeenCalled()
  })

  it('deduplicates multiple existing rows by deleting redundant duplicate IDs and updating primary row', async () => {
    const tripId = 'trip-123'
    const userId = 'user-duplicate'

    // Return 3 duplicate rows ordered by created_at DESC
    const duplicates = [
      { id: 'rsvp-latest', trip_id: tripId, user_id: userId, created_at: '2026-11-05T08:00:00Z', status: 'Tentative' },
      { id: 'rsvp-old-1', trip_id: tripId, user_id: userId, created_at: '2026-11-04T08:00:00Z', status: 'Tentative' },
      { id: 'rsvp-old-2', trip_id: tripId, user_id: userId, created_at: '2026-11-03T08:00:00Z', status: 'Interested' }
    ]

    const mockOrder = vi.fn().mockResolvedValue({ data: duplicates, error: null })
    const mockEqUser = vi.fn().mockReturnValue({ order: mockOrder })
    const mockEqTrip = vi.fn().mockReturnValue({ eq: mockEqUser })
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEqTrip })

    // Mock delete for duplicates
    const mockDeleteIn = vi.fn().mockResolvedValue({ data: null, error: null })
    const mockDelete = vi.fn().mockReturnValue({ in: mockDeleteIn })

    // Mock update on primary row
    const mockUpdateSelect = vi.fn().mockResolvedValue({
      data: [{ id: 'rsvp-latest', trip_id: tripId, user_id: userId, status: 'Committed' }],
      error: null
    })
    const mockUpdateEqId = vi.fn().mockReturnValue({ select: mockUpdateSelect })
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockUpdateEqId })

    supabase.from.mockImplementation((table) => {
      if (table === 'rsvps') {
        return {
          select: mockSelect,
          delete: mockDelete,
          update: mockUpdate
        }
      }
      return {}
    })

    const result = await saveRsvpRecord(tripId, userId, { status: 'Committed' })

    // Verify redundant duplicate IDs were deleted
    expect(mockDelete).toHaveBeenCalled()
    expect(mockDeleteIn).toHaveBeenCalledWith('id', ['rsvp-old-1', 'rsvp-old-2'])

    // Verify primary row was updated
    expect(mockUpdateEqId).toHaveBeenCalledWith('id', 'rsvp-latest')
    expect(result.id).toBe('rsvp-latest')
    expect(result.status).toBe('Committed')
  })

  it('updateRsvpStatus, updateRsvpDetails, promoteToCoOrganizer and demoteCoOrganizer delegate through defensive save without throwing PGRST116', async () => {
    const tripId = 'trip-def'
    const userId = 'user-def'

    // Mock single existing row
    const mockOrder = vi.fn().mockResolvedValue({
      data: [{ id: 'rsvp-def', trip_id: tripId, user_id: userId, status: 'Committed', role: 'member' }],
      error: null
    })
    const mockEqUser = vi.fn().mockReturnValue({ order: mockOrder })
    const mockEqTrip = vi.fn().mockReturnValue({ eq: mockEqUser })
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEqTrip })

    const mockUpdateSelect = vi.fn().mockImplementation(() => {
      return Promise.resolve({
        data: [{ id: 'rsvp-def', trip_id: tripId, user_id: userId, status: 'Declined' }],
        error: null
      })
    })
    const mockUpdateEqId = vi.fn().mockReturnValue({ select: mockUpdateSelect })
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockUpdateEqId })

    supabase.from.mockImplementation(() => ({
      select: mockSelect,
      update: mockUpdate
    }))

    const statusRes = await updateRsvpStatus(tripId, userId, 'Declined')
    expect(statusRes.status).toBe('Declined')

    const detailsRes = await updateRsvpDetails(tripId, userId, { dietary_tags: ['Halal'] })
    expect(detailsRes).toBeDefined()

    const promoteRes = await promoteToCoOrganizer(tripId, userId)
    expect(promoteRes).toBeDefined()

    const demoteRes = await demoteCoOrganizer(tripId, userId)
    expect(demoteRes).toBeDefined()
  })
})

describe('useRosterActions Hook Error Handling & Optimistic Reconciliation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('optimistically updates roster state and reconciles on status change with event target payload', async () => {
    const tripId = 'trip-hook-1'
    const activeUser = { id: 'user-hook', name: 'Taylor' }
    let rosterState = [
      { id: 'rsvp-hook', user_id: 'user-hook', status: 'Committed', role: 'member' }
    ]
    const setRoster = vi.fn((updater) => {
      rosterState = typeof updater === 'function' ? updater(rosterState) : updater
    })
    const refreshRoster = vi.fn()

    // Mock DB update
    const mockOrder = vi.fn().mockResolvedValue({
      data: [{ id: 'rsvp-hook', trip_id: tripId, user_id: 'user-hook', status: 'Committed' }],
      error: null
    })
    supabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: mockOrder
          })
        })
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockResolvedValue({
            data: [{ id: 'rsvp-hook', trip_id: tripId, user_id: 'user-hook', status: 'Tentative' }],
            error: null
          })
        })
      })
    })

    const { result } = renderHook(() =>
      useRosterActions({
        tripId,
        roster: rosterState,
        setRoster,
        activeUser,
        refreshRoster
      })
    )

    // Trigger status change with event-like target object (as RosterSection does)
    await act(async () => {
      await result.current.handleStatusChange({ target: { value: 'Tentative' } })
    })

    expect(setRoster).toHaveBeenCalled()
    expect(result.current.rosterSuccess).toContain('Tentative')
    expect(result.current.rosterError).toBe('')
    expect(refreshRoster).toHaveBeenCalled()
  })

  it('replaces raw alert with graceful error state and rolls back optimistic changes on failure', async () => {
    const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {})
    const tripId = 'trip-hook-2'
    const activeUser = { id: 'user-hook-2', name: 'Jordan' }
    const initialRoster = [
      { id: 'rsvp-hook-2', user_id: 'user-hook-2', status: 'Committed', role: 'member' }
    ]
    const setRoster = vi.fn()

    // Mock DB query failure
    supabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockRejectedValue(new Error('Network error on RSVP update'))
          })
        })
      })
    })

    const { result } = renderHook(() =>
      useRosterActions({
        tripId,
        roster: initialRoster,
        setRoster,
        activeUser
      })
    )

    await act(async () => {
      await result.current.handleStatusChange('Declined')
    })

    // Assert alert was NOT called
    expect(alertMock).not.toHaveBeenCalled()

    // Assert graceful error state was set
    expect(result.current.rosterError).toBe('Network error on RSVP update')

    // Assert setRoster rolled back
    expect(setRoster).toHaveBeenCalledWith(initialRoster)

    alertMock.mockRestore()
  })
})

