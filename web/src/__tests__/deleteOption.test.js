import { describe, it, expect, vi, beforeEach } from 'vitest'
import { deleteOption } from '../services/options'
import { supabase } from '../services/supabase'

vi.mock('../services/supabase', () => {
  return {
    supabase: {
      from: vi.fn()
    }
  }
})

describe('deleteOption service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('throws an error if optionId is missing', async () => {
    await expect(deleteOption('trip-123', null, 'Accommodation')).rejects.toThrow(
      'optionId is required to delete an option'
    )
    await expect(deleteOption('trip-123', undefined, 'Accommodation')).rejects.toThrow(
      'optionId is required to delete an option'
    )
  })

  it('calls .delete().eq("id", optionId) on poll_options and deletes option from database', async () => {
    const deleteEqTrip = vi.fn().mockResolvedValue({ error: null })
    const deleteEqId = vi.fn().mockReturnValue({
      eq: deleteEqTrip,
      then: (resolve) => resolve({ error: null })
    })
    const deleteMock = vi.fn().mockReturnValue({
      eq: deleteEqId
    })

    const updateEq = vi.fn().mockResolvedValue({ error: null })
    const updateMock = vi.fn().mockReturnValue({
      eq: updateEq
    })

    const selectOrder = vi.fn().mockReturnValue({
      limit: vi.fn().mockResolvedValue({
        data: [
          {
            id: 1,
            trip_id: 'trip-1',
            category: 'accommodation',
            voter_selections: {},
            votes_by_option: {}
          }
        ],
        error: null
      })
    })

    const selectEqCat = vi.fn().mockReturnValue({ order: selectOrder })
    const selectEqTrip = vi.fn().mockReturnValue({ eq: selectEqCat })
    const selectMock = vi.fn().mockReturnValue({ eq: selectEqTrip })

    const insertMock = vi.fn().mockResolvedValue({ error: null })

    supabase.from.mockImplementation((table) => {
      if (table === 'poll_options') {
        return { delete: deleteMock }
      }
      if (table === 'active_polls') {
        return {
          select: selectMock,
          update: updateMock
        }
      }
      if (table === 'users') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: { first_name: 'Alex' } })
            })
          })
        }
      }
      if (table === 'activity_log') {
        return { insert: insertMock }
      }
      return {}
    })

    const result = await deleteOption('trip-1', 'opt-99', 'Accommodation', 'user-1')

    expect(result).toBe(true)
    expect(supabase.from).toHaveBeenCalledWith('poll_options')
    expect(deleteMock).toHaveBeenCalled()
    expect(deleteEqId).toHaveBeenCalledWith('id', 'opt-99')
    expect(deleteEqTrip).toHaveBeenCalledWith('trip_id', 'trip-1')
  })

  it('strips String(optionId) from voter_selections, votes_by_option, and _locked_option_id / _locked_option_ids in active_polls', async () => {
    const deleteEqTrip = vi.fn().mockResolvedValue({ error: null })
    const deleteEqId = vi.fn().mockReturnValue({
      eq: deleteEqTrip,
      then: (resolve) => resolve({ error: null })
    })
    const deleteMock = vi.fn().mockReturnValue({
      eq: deleteEqId
    })

    let updatedPollPayload = null
    const updateEq = vi.fn().mockImplementation((col, val) => {
      return Promise.resolve({ error: null })
    })
    const updateMock = vi.fn().mockImplementation((payload) => {
      updatedPollPayload = payload
      return { eq: updateEq }
    })

    // Poll where opt-123 is voted on by user-1 and user-2, and is locked
    const mockActivePoll = {
      id: 55,
      trip_id: 'trip-1',
      category: 'accommodation',
      voter_selections: {
        'user-1': ['opt-123', 'opt-456'],
        'user-2': ['opt-123'],
        _locked_option_id: 'opt-123',
        _locked_option_ids: ['opt-123', 'opt-456']
      },
      votes_by_option: {
        'opt-123': 2,
        'opt-456': 1
      }
    }

    const selectOrder = vi.fn().mockReturnValue({
      limit: vi.fn().mockResolvedValue({
        data: [mockActivePoll],
        error: null
      })
    })

    supabase.from.mockImplementation((table) => {
      if (table === 'poll_options') {
        return { delete: deleteMock }
      }
      if (table === 'active_polls') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: selectOrder
              })
            })
          }),
          update: updateMock
        }
      }
      if (table === 'users') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: { first_name: 'Sam' } })
            })
          })
        }
      }
      if (table === 'activity_log') {
        return { insert: vi.fn().mockResolvedValue({ error: null }) }
      }
      return {}
    })

    const res = await deleteOption('trip-1', 'opt-123', 'Accommodation', 'user-1')
    expect(res).toBe(true)

    expect(updateMock).toHaveBeenCalled()
    expect(updatedPollPayload).not.toBeNull()

    // 1. voter_selections
    // user-1 should only have opt-456
    expect(updatedPollPayload.voter_selections['user-1']).toEqual(['opt-456'])
    // user-2 had only opt-123, so user-2 entry should be deleted
    expect(updatedPollPayload.voter_selections['user-2']).toBeUndefined()

    // 2. _locked_option_id should be removed
    expect(updatedPollPayload.voter_selections._locked_option_id).toBeUndefined()

    // 3. _locked_option_ids should have opt-123 removed, leaving opt-456
    expect(updatedPollPayload.voter_selections._locked_option_ids).toEqual(['opt-456'])

    // 4. votes_by_option should be recalculated without metadata keys
    expect(updatedPollPayload.votes_by_option).toEqual({
      'opt-456': 1
    })
    expect(updatedPollPayload.votes_by_option['opt-123']).toBeUndefined()
  })

  it('logs option deletion to activity_log with category', async () => {
    const deleteEqTrip = vi.fn().mockResolvedValue({ error: null })
    const deleteEqId = vi.fn().mockReturnValue({
      eq: deleteEqTrip,
      then: (resolve) => resolve({ error: null })
    })

    const insertMock = vi.fn().mockResolvedValue({ error: null })

    supabase.from.mockImplementation((table) => {
      if (table === 'poll_options') {
        return { delete: vi.fn().mockReturnValue({ eq: deleteEqId }) }
      }
      if (table === 'active_polls') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({
                    data: [
                      {
                        id: 777,
                        trip_id: 'trip-456',
                        category: 'activities',
                        voter_selections: {},
                        votes_by_option: {}
                      }
                    ],
                    error: null
                  })
                })
              })
            })
          }),
          update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) })
        }
      }
      if (table === 'users') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: { first_name: 'Jordan' } })
            })
          })
        }
      }
      if (table === 'activity_log') {
        return { insert: insertMock }
      }
      return {}
    })

    await deleteOption('trip-456', 77, 'Activities', 'user-2')

    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        trip_id: 'trip-456',
        user_id: 'user-2',
        action_type: 'delete_option',
        description: 'Jordan deleted a pitched option in Activities'
      })
    )
  })

  it('throws error if database poll_options deletion fails', async () => {
    supabase.from.mockImplementation((table) => {
      if (table === 'poll_options') {
        return {
          delete: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: new Error('Database connection failed') })
            })
          })
        }
      }
      return {}
    })

    await expect(deleteOption('trip-1', 'opt-1', 'Food')).rejects.toThrow(
      'Database connection failed'
    )
  })
})
