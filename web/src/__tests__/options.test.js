import { describe, it, expect, vi, beforeEach } from 'vitest'
import { updateOption } from '../services/options'
import { supabase } from '../services/supabase'

vi.mock('../services/supabase', () => {
  return {
    supabase: {
      from: vi.fn()
    }
  }
})

describe('updateOption service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('throws an error if optionId is missing', async () => {
    await expect(updateOption(null, { name: 'Hotel' })).rejects.toThrow(
      'optionId is required to update an option'
    )
    await expect(updateOption(undefined, { name: 'Hotel' })).rejects.toThrow(
      'optionId is required to update an option'
    )
  })

  it('updates title, dates, and cost while preserving option ID and sanitizing inputs', async () => {
    const mockUpdatedOption = {
      id: 'opt-101',
      option_text: 'Grand Alpine Lodge Updated',
      estimated_cost: 450.5,
      currency: 'EUR',
      link: 'https://alpinelodge.example.com',
      description: 'Stunning luxury lodge with panoramic views',
      start_date: '2026-08-10T15:00:00.000Z',
      end_date: '2026-08-15T11:00:00.000Z',
      cost_type: 'split_total',
      assigned_users: ['00000000-0000-0000-0000-000000000001'],
      category: 'accommodation',
      metadata: { beds_summary: '4 king beds', max_capacity: 8 }
    }

    const singleMock = vi.fn().mockResolvedValue({
      data: mockUpdatedOption,
      error: null
    })
    const selectMock = vi.fn().mockReturnValue({
      single: singleMock
    })
    const eqMock = vi.fn().mockReturnValue({
      select: selectMock
    })
    const updateMock = vi.fn().mockReturnValue({
      eq: eqMock
    })

    const fromMock = vi.fn().mockImplementation((table) => {
      if (table === 'poll_options') {
        return {
          update: updateMock
        }
      }
      if (table === 'activity_log') {
        return {
          insert: vi.fn().mockResolvedValue({ error: null })
        }
      }
      if (table === 'users') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: { first_name: 'Alex' }, error: null })
            })
          })
        }
      }
      return {}
    })

    supabase.from = fromMock

    const updates = {
      title: 'Grand Alpine Lodge Updated',
      cost: '450.50',
      currency: 'EUR',
      link: 'alpinelodge.example.com', // Should be prefixed with https://
      description: '  Stunning luxury lodge with panoramic views  ',
      startDate: '2026-08-10T15:00',
      endDate: '2026-08-15T11:00',
      costType: 'split_total',
      assignedUsers: ['00000000-0000-0000-0000-000000000001'],
      metadata: { beds_summary: '4 king beds', max_capacity: 8 }
    }

    const result = await updateOption(
      'opt-101',
      updates,
      'trip-777',
      '00000000-0000-0000-0000-000000000002'
    )

    // Verify correct table and payload were sent
    expect(fromMock).toHaveBeenCalledWith('poll_options')
    expect(updateMock).toHaveBeenCalledTimes(1)

    const sentPayload = updateMock.mock.calls[0][0]
    expect(sentPayload.option_text).toBe('Grand Alpine Lodge Updated')
    expect(sentPayload.estimated_cost).toBe(450.5)
    expect(sentPayload.currency).toBe('EUR')
    expect(sentPayload.link).toBe('https://alpinelodge.example.com')
    expect(sentPayload.description).toBe('Stunning luxury lodge with panoramic views')
    expect(sentPayload.start_date).toContain('2026-08-10')
    expect(sentPayload.end_date).toContain('2026-08-15')
    expect(sentPayload.cost_type).toBe('split_total')
    expect(sentPayload.assigned_users).toEqual(['00000000-0000-0000-0000-000000000001'])

    // Verify optionId condition
    expect(eqMock).toHaveBeenCalledWith('id', 'opt-101')

    // Verify option ID is preserved
    expect(result.id).toBe('opt-101')
    expect(result.option_text).toBe('Grand Alpine Lodge Updated')
    expect(result.estimated_cost).toBe(450.5)

    // CRITICAL: Verify option_votes was NEVER queried or mutated
    const tablesQueried = fromMock.mock.calls.map(call => call[0])
    expect(tablesQueried).not.toContain('option_votes')
  })

  it('logs activity with user name and option name when tripId and userId are provided', async () => {
    const singleMock = vi.fn().mockResolvedValue({
      data: { id: 'opt-202', option_text: 'Kayaking Tour' },
      error: null
    })
    const selectMock = vi.fn().mockReturnValue({ single: singleMock })
    const eqMock = vi.fn().mockReturnValue({ select: selectMock })
    const updateMock = vi.fn().mockReturnValue({ eq: eqMock })

    const insertActivityMock = vi.fn().mockResolvedValue({ error: null })

    const fromMock = vi.fn().mockImplementation((table) => {
      if (table === 'poll_options') {
        return { update: updateMock }
      }
      if (table === 'users') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: { first_name: 'Elena' }, error: null })
            })
          })
        }
      }
      if (table === 'activity_log') {
        return { insert: insertActivityMock }
      }
      return {}
    })

    supabase.from = fromMock

    await updateOption('opt-202', { name: 'Sunset Kayaking Tour' }, 'trip-333', 'user-elena')

    expect(insertActivityMock).toHaveBeenCalledWith({
      trip_id: 'trip-333',
      user_id: null, // 'user-elena' is not a valid uuid, so sanitized to null
      action_type: 'update_option',
      description: 'Elena updated option "Sunset Kayaking Tour"'
    })
  })

  it('falls back gracefully if metadata/cost_type columns are not supported on older schemas', async () => {
    // First update call throws error
    const firstSingle = vi.fn().mockRejectedValue(new Error('column "cost_type" does not exist'))
    const firstSelect = vi.fn().mockReturnValue({ single: firstSingle })
    const firstEq = vi.fn().mockReturnValue({ select: firstSelect })
    const firstUpdate = vi.fn().mockReturnValue({ eq: firstEq })

    // Second (fallback) update succeeds
    const fallbackSingle = vi.fn().mockResolvedValue({
      data: { id: 'opt-303', option_text: 'Simple Cabin', estimated_cost: 120 },
      error: null
    })
    const fallbackSelect = vi.fn().mockReturnValue({ single: fallbackSingle })
    const fallbackEq = vi.fn().mockReturnValue({ select: fallbackSelect })
    const fallbackUpdate = vi.fn().mockReturnValue({ eq: fallbackEq })

    let callCount = 0
    const fromMock = vi.fn().mockImplementation((table) => {
      if (table === 'poll_options') {
        callCount++
        if (callCount === 1) {
          return { update: firstUpdate }
        }
        return { update: fallbackUpdate }
      }
      return {}
    })

    supabase.from = fromMock

    const res = await updateOption('opt-303', {
      name: 'Simple Cabin',
      cost: 120,
      costType: 'split_total'
    })

    expect(fallbackUpdate).toHaveBeenCalled()
    const fallbackPayload = fallbackUpdate.mock.calls[0][0]
    expect(fallbackPayload.cost_type).toBeUndefined()
    expect(fallbackPayload.option_text).toBe('Simple Cabin')
    expect(res.id).toBe('opt-303')
  })
})
