import { describe, it, expect } from 'vitest'
import { detectScheduleGaps, detectScheduleConflicts, packOptionsIntoSubTracks } from '../utils/schedule'
import { parseLocalDate, formatLocalDateStr } from '../utils/format'

describe('Schedule Engine Utilities', () => {
  describe('Timezone resilience with parseLocalDate', () => {
    it('parses YYYY-MM-DD date-only strings into local midnight without day shift', () => {
      const parsed = parseLocalDate('2026-07-12')
      expect(parsed).not.toBeNull()
      expect(parsed.getFullYear()).toBe(2026)
      expect(parsed.getMonth()).toBe(6) // July is 0-indexed month 6
      expect(parsed.getDate()).toBe(12)
      expect(parsed.getHours()).toBe(0)
      expect(parsed.getMinutes()).toBe(0)

      // Verify formatLocalDateStr converts back to exact date
      expect(formatLocalDateStr(parsed)).toBe('2026-07-12')
    })

    it('parses local datetime strings with T without shifting calendar day', () => {
      const parsed = parseLocalDate('2026-07-12T14:30')
      expect(parsed.getFullYear()).toBe(2026)
      expect(parsed.getMonth()).toBe(6)
      expect(parsed.getDate()).toBe(12)
      expect(parsed.getHours()).toBe(14)
      expect(parsed.getMinutes()).toBe(30)
    })
  })

  describe('detectScheduleGaps', () => {
    const trip = {
      id: 'trip-1',
      start_date: '2026-07-24',
      end_date: '2026-07-26' // 3 days: Jul 24, Jul 25, Jul 26
    }

    it('detects all days as unbooked gaps when no options are scheduled', () => {
      const gaps = detectScheduleGaps(trip, [])
      expect(gaps).toHaveLength(3)
      expect(gaps.map(g => g.dateStr)).toEqual(['2026-07-24', '2026-07-25', '2026-07-26'])
    })

    it('detects unbooked gaps when only partial days have options', () => {
      const options = [
        {
          id: 1,
          option_text: 'Morning Boat Tour',
          start_date: '2026-07-24T09:00:00.000Z',
          end_date: '2026-07-24T12:00:00.000Z'
        }
      ]
      // Day 2 (Jul 25) and Day 3 (Jul 26) should be identified as gaps
      const gaps = detectScheduleGaps(trip, options)
      expect(gaps).toHaveLength(2)
      expect(gaps.map(g => g.dateStr)).toEqual(['2026-07-25', '2026-07-26'])
    })

    it('returns empty array when every day in the trip range has at least one option', () => {
      const options = [
        {
          id: 1,
          start_date: '2026-07-24T10:00',
          end_date: '2026-07-24T12:00'
        },
        {
          id: 2,
          start_date: '2026-07-25T11:00',
          end_date: '2026-07-25T14:00'
        },
        {
          id: 3,
          start_date: '2026-07-26T15:00',
          end_date: '2026-07-26T17:00'
        }
      ]
      const gaps = detectScheduleGaps(trip, options)
      expect(gaps).toEqual([])
    })

    it('recognizes multi-day options (e.g. hotel stays) as covering all spanned days', () => {
      const options = [
        {
          id: 1,
          category: 'accommodation',
          start_date: '2026-07-24',
          end_date: '2026-07-26'
        }
      ]
      const gaps = detectScheduleGaps(trip, options)
      expect(gaps).toEqual([])
    })
  })

  describe('detectScheduleConflicts', () => {
    it('detects genuine overlapping time collision between two activities', () => {
      const options = [
        {
          id: 1,
          category: 'activities',
          option_text: 'Morning Museum',
          start_date: '2026-07-24T09:00',
          end_date: '2026-07-24T12:00',
          is_locked: true
        },
        {
          id: 2,
          category: 'transport',
          option_text: 'Train to Suburb',
          start_date: '2026-07-24T11:00', // overlaps with museum 11:00-12:00
          end_date: '2026-07-24T13:00',
          is_locked: true
        }
      ]

      const { conflictingOptionIds, conflictPairs } = detectScheduleConflicts(options)
      expect(conflictingOptionIds.has(1)).toBe(true)
      expect(conflictingOptionIds.has(2)).toBe(true)
      expect(conflictPairs).toHaveLength(1)
    })

    it('does NOT flag accommodation options colliding with daytime activities', () => {
      const options = [
        {
          id: 101,
          category: 'accommodation',
          option_text: 'Grand Hotel Stay',
          start_date: '2026-07-24T15:00',
          end_date: '2026-07-28T11:00',
          is_locked: true
        },
        {
          id: 102,
          category: 'activities',
          option_text: 'City Walking Tour',
          start_date: '2026-07-25T10:00',
          end_date: '2026-07-25T13:00',
          is_locked: true
        }
      ]

      const { conflictingOptionIds, conflictPairs } = detectScheduleConflicts(options)
      expect(conflictingOptionIds.size).toBe(0)
      expect(conflictPairs).toHaveLength(0)
    })

    it('flags conflict if two locked accommodations overlap on dates', () => {
      const options = [
        {
          id: 201,
          category: 'accommodation',
          option_text: 'Hotel Alpha',
          start_date: '2026-07-24T15:00',
          end_date: '2026-07-27T11:00',
          is_locked: true
        },
        {
          id: 202,
          category: 'accommodation',
          option_text: 'Hotel Beta',
          start_date: '2026-07-26T15:00',
          end_date: '2026-07-28T11:00',
          is_locked: true
        }
      ]

      const { conflictingOptionIds } = detectScheduleConflicts(options)
      expect(conflictingOptionIds.has(201)).toBe(true)
      expect(conflictingOptionIds.has(202)).toBe(true)
    })

    it('treats competing unlocked proposals in the same category as voter alternatives, NOT conflicts', () => {
      const options = [
        {
          id: 301,
          category: 'food',
          option_text: 'Bistro Parisien',
          start_date: '2026-07-24T19:00',
          end_date: '2026-07-24T21:00',
          is_locked: false
        },
        {
          id: 302,
          category: 'food',
          option_text: 'Sushi Bar',
          start_date: '2026-07-24T19:30',
          end_date: '2026-07-24T21:30',
          is_locked: false
        }
      ]

      const { conflictingOptionIds } = detectScheduleConflicts(options)
      expect(conflictingOptionIds.size).toBe(0)
    })

    it('supports passing explicit lockedOptionIds Set/Array', () => {
      const options = [
        {
          id: 'optA',
          category: 'activities',
          start_date: '2026-07-24T14:00',
          end_date: '2026-07-24T16:00'
        },
        {
          id: 'optB',
          category: 'activities',
          start_date: '2026-07-24T15:00',
          end_date: '2026-07-24T17:00'
        }
      ]

      // When only one is locked and lockedOptionIds is provided, it is a candidate proposal, not a clash
      const res1 = detectScheduleConflicts(options, ['optA'])
      expect(res1.conflictingOptionIds.size).toBe(0)

      // When both are locked, it is a hard conflict
      const res2 = detectScheduleConflicts(options, ['optA', 'optB'])
      expect(res2.conflictingOptionIds.has('optA')).toBe(true)
      expect(res2.conflictingOptionIds.has('optB')).toBe(true)
    })
  })

  describe('packOptionsIntoSubTracks multi-lane track packing', () => {
    it('assigns 6 overlapping options in the same category to 6 distinct vertical laneIndex values (0 through 5)', () => {
      // 6 accommodation options spanning the exact same 15-day range (e.g. Sep 4 - Sep 18)
      const options = [
        { id: 1, option_text: 'Hotel Alpha', category: 'accommodation', start_date: '2026-09-04', end_date: '2026-09-18' },
        { id: 2, option_text: 'Villa Beta', category: 'accommodation', start_date: '2026-09-04', end_date: '2026-09-18' },
        { id: 3, option_text: 'Resort Gamma', category: 'accommodation', start_date: '2026-09-04', end_date: '2026-09-18' },
        { id: 4, option_text: 'Chalet Delta', category: 'accommodation', start_date: '2026-09-04', end_date: '2026-09-18' },
        { id: 5, option_text: 'Apartment Epsilon', category: 'accommodation', start_date: '2026-09-04', end_date: '2026-09-18' },
        { id: 6, option_text: 'Hostel Zeta', category: 'accommodation', start_date: '2026-09-04', end_date: '2026-09-18' }
      ]

      const lanes = packOptionsIntoSubTracks(options)
      expect(lanes).toHaveLength(6)

      const flat = lanes.flat()
      expect(flat).toHaveLength(6)
      const laneIndices = flat.map(o => o.laneIndex)
      expect(laneIndices).toEqual([0, 1, 2, 3, 4, 5])
    })

    it('packs non-overlapping options sequentially into the same lane', () => {
      const options = [
        { id: 1, option_text: 'Hotel Alpha (Days 1-3)', category: 'accommodation', start_date: '2026-09-04', end_date: '2026-09-07' },
        { id: 2, option_text: 'Hotel Beta (Days 4-7)', category: 'accommodation', start_date: '2026-09-07', end_date: '2026-09-11' },
        { id: 3, option_text: 'Hotel Gamma (Days 8-15)', category: 'accommodation', start_date: '2026-09-11', end_date: '2026-09-18' }
      ]

      const lanes = packOptionsIntoSubTracks(options)
      // Since they are sequential and do not overlap, all 3 can share laneIndex 0
      expect(lanes).toHaveLength(1)
      expect(lanes[0]).toHaveLength(3)
      lanes[0].forEach(opt => {
        expect(opt.laneIndex).toBe(0)
      })
    })

    it('prioritizes locked options in the primary top lane (laneIndex 0)', () => {
      const options = [
        { id: 1, option_text: 'Unlocked Proposal', category: 'accommodation', start_date: '2026-09-04', end_date: '2026-09-18', is_locked: false },
        { id: 2, option_text: 'Locked Winning Choice', category: 'accommodation', start_date: '2026-09-04', end_date: '2026-09-18', is_locked: true }
      ]

      const lanes = packOptionsIntoSubTracks(options)
      expect(lanes).toHaveLength(2)
      // Locked option must be in lane 0
      expect(lanes[0][0].id).toBe(2)
      expect(lanes[0][0].laneIndex).toBe(0)
      // Unlocked option placed in lane 1
      expect(lanes[1][0].id).toBe(1)
      expect(lanes[1][0].laneIndex).toBe(1)
    })

    it('filters out dateless unscheduled options from the track lanes', () => {
      const options = [
        { id: 1, option_text: 'Scheduled Option', start_date: '2026-09-04', end_date: '2026-09-06' },
        { id: 2, option_text: 'Unscheduled Idea', start_date: null, end_date: null }
      ]

      const lanes = packOptionsIntoSubTracks(options)
      expect(lanes).toHaveLength(1)
      expect(lanes[0]).toHaveLength(1)
      expect(lanes[0][0].id).toBe(1)
    })
  })
})

