import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { render, fireEvent } from '@testing-library/react'
import { fetchActivePoll, toggleVote } from '../services/options'
import { OptionsTab } from '../components/trip/OptionsTab'
import { supabase } from '../services/supabase'

vi.mock('../services/supabase', () => {
  return {
    supabase: {
      from: vi.fn()
    }
  }
})

describe('Multi-User Voting & Active Polls Resiliency', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('1. fetchActivePoll PGRST116 Prevention with Multiple Rows', () => {
    it('handles multiple duplicate rows from Supabase without throwing PGRST116 and selects the first row', async () => {
      const duplicateRows = [
        {
          id: 10,
          trip_id: 'trip-abc',
          category: 'accommodation',
          voter_selections: { 'user-1': ['42'] },
          votes_by_option: { '42': 1 }
        },
        {
          id: 11,
          trip_id: 'trip-abc',
          category: 'accommodation',
          voter_selections: {},
          votes_by_option: {}
        }
      ]

      const mockOrder = vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue({
          data: duplicateRows,
          error: null
        })
      })

      supabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: mockOrder
            })
          })
        })
      })

      const poll = await fetchActivePoll('trip-abc', 'Accommodation')

      expect(supabase.from).toHaveBeenCalledWith('active_polls')
      expect(mockOrder).toHaveBeenCalledWith('id', { ascending: true })
      expect(poll).toBeDefined()
      expect(poll.id).toBe(10)
      expect(poll.votes_by_option['42']).toBe(1)
    })

    it('creates a default active poll if no existing rows are found', async () => {
      const mockOrder = vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue({
          data: [],
          error: null
        })
      })

      const createdPoll = {
        id: 99,
        trip_id: 'trip-abc',
        category: 'transport',
        voter_selections: {},
        votes_by_option: {}
      }

      const mockInsertSingle = vi.fn().mockResolvedValue({
        data: createdPoll,
        error: null
      })

      supabase.from.mockImplementation((table) => {
        if (table === 'active_polls') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  order: mockOrder
                })
              })
            }),
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: mockInsertSingle
              })
            })
          }
        }
        return {}
      })

      const poll = await fetchActivePoll('trip-abc', 'Transport')
      expect(poll).toBeDefined()
      expect(poll.id).toBe(99)
      expect(poll.category).toBe('transport')
    })
  })

  describe('2. Multi-User Voting & Vote Accumulation in toggleVote', () => {
    it('allows User A (Organizer) and User B (Participant) to both vote on option 42, resulting in votes_by_option["42"] === 2', async () => {
      let currentPoll = {
        id: 1,
        trip_id: 'trip-test',
        category: 'accommodation',
        voter_selections: {},
        votes_by_option: {}
      }

      supabase.from.mockImplementation((table) => {
        if (table === 'active_polls') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({
                    limit: vi.fn().mockImplementation(() =>
                      Promise.resolve({ data: [currentPoll], error: null })
                    )
                  })
                })
              })
            }),
            update: vi.fn().mockImplementation((payload) => ({
              eq: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockImplementation(() => {
                    currentPoll = { ...currentPoll, ...payload }
                    return Promise.resolve({ data: currentPoll, error: null })
                  })
                })
              })
            }))
          }
        }
        if (table === 'users') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { first_name: 'TestUser' },
                  error: null
                })
              })
            })
          }
        }
        if (table === 'activity_log') {
          return {
            insert: vi.fn().mockResolvedValue({ error: null })
          }
        }
        return {}
      })

      const userAId = 'a0000000-0000-0000-0000-000000000001'
      const userBId = 'b0000000-0000-0000-0000-000000000002'
      const optionId = 42

      // Step 1: User A votes for option 42
      const pollAfterUserA = await toggleVote('trip-test', 'accommodation', optionId, userAId, true)
      expect(pollAfterUserA.voter_selections[userAId]).toEqual(['42'])
      expect(pollAfterUserA.votes_by_option['42']).toBe(1)

      // Step 2: User B votes for option 42
      const pollAfterUserB = await toggleVote('trip-test', 'accommodation', optionId, userBId, true)
      expect(pollAfterUserB.voter_selections[userAId]).toEqual(['42'])
      expect(pollAfterUserB.voter_selections[userBId]).toEqual(['42'])
      expect(pollAfterUserB.votes_by_option['42']).toBe(2)

      // Step 3: User A removes vote
      const pollAfterUserAUnvote = await toggleVote('trip-test', 'accommodation', optionId, userAId, false)
      expect(pollAfterUserAUnvote.voter_selections[userAId]).toBeUndefined()
      expect(pollAfterUserAUnvote.voter_selections[userBId]).toEqual(['42'])
      expect(pollAfterUserAUnvote.votes_by_option['42']).toBe(1)
    })

    it('throws clear error when userId is missing', async () => {
      await expect(
        toggleVote('trip-test', 'accommodation', 42, null, true)
      ).rejects.toThrow('User ID is required to toggle vote')
    })
  })

  describe('3. Metadata & _locked_option_ids Preservation in toggleVote', () => {
    it('preserves _locked_option_ids and does NOT count them as extra votes in votes_by_option', async () => {
      let currentPoll = {
        id: 2,
        trip_id: 'trip-test',
        category: 'accommodation',
        voter_selections: {
          _locked_option_id: '42',
          _locked_option_ids: ['42', '99'],
          'user-existing': ['99']
        },
        votes_by_option: {
          '99': 1
        }
      }

      supabase.from.mockImplementation((table) => {
        if (table === 'active_polls') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({
                    limit: vi.fn().mockImplementation(() =>
                      Promise.resolve({ data: [currentPoll], error: null })
                    )
                  })
                })
              })
            }),
            update: vi.fn().mockImplementation((payload) => ({
              eq: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockImplementation(() => {
                    currentPoll = { ...currentPoll, ...payload }
                    return Promise.resolve({ data: currentPoll, error: null })
                  })
                })
              })
            }))
          }
        }
        if (table === 'users') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { first_name: 'Alexis' },
                  error: null
                })
              })
            })
          }
        }
        if (table === 'activity_log') {
          return {
            insert: vi.fn().mockResolvedValue({ error: null })
          }
        }
        return {}
      })

      const userNewId = 'user-new-123'
      const result = await toggleVote('trip-test', 'accommodation', 101, userNewId, true)

      expect(result.voter_selections._locked_option_id).toBe('42')
      expect(result.voter_selections._locked_option_ids).toEqual(['42', '99'])
      expect(result.locked_option_id).toBe('42')
      expect(result.locked_option_ids).toEqual(['42', '99'])

      // Verify _locked_option_ids are NOT counted as voter keys in votes_by_option
      expect(result.votes_by_option['42']).toBeUndefined()
      expect(result.votes_by_option['99']).toBe(1)
      expect(result.votes_by_option['101']).toBe(1)
    })
  })

  describe('4. OptionsTab UI Voter Name Resolution & No Ghost Voters', () => {
    it('does not display fake "Traveler" voter chip from _locked_option_ids and resolves roster names correctly', () => {
      const roster = [
        {
          id: 'rsvp-1',
          user_id: 'user-organizer',
          role: 'organizer',
          status: 'Committed',
          users: { id: 'user-organizer', first_name: 'Alexis' }
        },
        {
          id: 'rsvp-2',
          user_id: 'user-invited',
          role: 'participant',
          status: 'Committed',
          users: { id: 'user-invited', first_name: 'Nolwen' }
        }
      ]

      const pollWithLockAndVotes = {
        id: 1,
        trip_id: 'trip-1',
        category: 'accommodation',
        voter_selections: {
          _locked_option_id: '42',
          _locked_option_ids: ['42'],
          'user-organizer': ['42'],
          'user-invited': ['42']
        },
        votes_by_option: {
          '42': 2
        }
      }

      const options = [
        {
          id: 42,
          option_text: 'Charming Seaside Villa',
          category: 'Accommodation',
          estimated_cost: 2000,
          currency: 'USD'
        }
      ]

      const onVoteToggleMock = vi.fn()

      const { container } = render(
        <OptionsTab
          activeTab="Accommodation"
          options={options}
          activePoll={pollWithLockAndVotes}
          trip={{ id: 'trip-1', base_currency: 'USD' }}
          roster={roster}
          activeUser={{ id: 'user-organizer' }}
          onVoteToggle={onVoteToggleMock}
        />
      )

      expect(container.textContent).toContain('2 votes')

      const chips = container.querySelectorAll('.option-voting-section .voter-avatars-row .voter-avatar-chip')
      const chipTitles = Array.from(chips).map((c) => c.getAttribute('title'))
      expect(chips.length).toBe(2)
      expect(chipTitles).toContain('Alexis')
      expect(chipTitles).toContain('Nolwen')
      expect(chipTitles).not.toContain('Traveler')

      const voteBtn = container.querySelector('.btn-voted')
      expect(voteBtn).not.toBeNull()
      expect(voteBtn.textContent).toContain('✓ Voted (2)')

      fireEvent.click(voteBtn)
      expect(onVoteToggleMock).toHaveBeenCalledWith(42, true, 'Accommodation')
    })
  })
})
