import { describe, it, expect } from 'vitest'
import {
  parseLocalDate,
  formatLocalDateStr,
  formatDateRange,
  formatCurrency,
  formatMoney,
  formatRelativeTime,
  formatDateTimeRange,
  getTripDaysList,
  buildDefaultOptionDates
} from '../utils/format'

describe('Formatting Utilities', () => {
  describe('parseLocalDate', () => {
    it('returns null for empty, null, or undefined inputs', () => {
      expect(parseLocalDate(null)).toBeNull()
      expect(parseLocalDate('')).toBeNull()
      expect(parseLocalDate(undefined)).toBeNull()
    })

    it('parses YYYY-MM-DD into local midnight', () => {
      const d = parseLocalDate('2026-12-25')
      expect(d.getFullYear()).toBe(2026)
      expect(d.getMonth()).toBe(11) // December is 11
      expect(d.getDate()).toBe(25)
      expect(d.getHours()).toBe(0)
      expect(d.getMinutes()).toBe(0)
    })

    it('parses YYYY-MM-DDTHH:mm into local hours and minutes', () => {
      const d = parseLocalDate('2026-08-15T09:45')
      expect(d.getFullYear()).toBe(2026)
      expect(d.getMonth()).toBe(7)
      expect(d.getDate()).toBe(15)
      expect(d.getHours()).toBe(9)
      expect(d.getMinutes()).toBe(45)
    })

    it('handles Date instances directly', () => {
      const original = new Date(2026, 5, 20)
      const parsed = parseLocalDate(original)
      expect(parsed.getTime()).toBe(original.getTime())
    })
  })

  describe('formatLocalDateStr', () => {
    it('formats Date instance to YYYY-MM-DD without UTC offset shifting', () => {
      const d = new Date(2026, 6, 4) // July 4, 2026
      expect(formatLocalDateStr(d)).toBe('2026-07-04')
    })

    it('formats date string cleanly', () => {
      expect(formatLocalDateStr('2026-09-01')).toBe('2026-09-01')
    })

    it('returns empty string for null or empty input', () => {
      expect(formatLocalDateStr(null)).toBe('')
    })
  })

  describe('formatDateRange', () => {
    it('formats human readable date range with months and year', () => {
      const range = formatDateRange('2026-07-12', '2026-07-18')
      expect(range).toContain('Jul 12')
      expect(range).toContain('Jul 18, 2026')
    })

    it('returns empty string when either date is missing', () => {
      expect(formatDateRange('2026-07-12', null)).toBe('')
      expect(formatDateRange(null, '2026-07-18')).toBe('')
    })
  })

  describe('formatCurrency', () => {
    it('formats recognized currency symbols correctly', () => {
      expect(formatCurrency(100, 'USD')).toBe('$100')
      expect(formatCurrency(50, 'EUR')).toBe('€50')
      expect(formatCurrency(75, 'GBP')).toBe('£75')
      expect(formatCurrency(2500, 'JPY')).toBe('¥2500')
      expect(formatCurrency(80, 'CAD')).toBe('CA$80')
      expect(formatCurrency(90, 'AUD')).toBe('A$90')
      expect(formatCurrency(120, 'MXN')).toBe('MX$120')
      expect(formatCurrency(110, 'NZD')).toBe('NZ$110')
    })

    it('falls back to currency code prefix when symbol is unknown', () => {
      expect(formatCurrency(100, 'XYZ')).toBe('XYZ100')
    })
  })

  describe('formatMoney', () => {
    it('formats integer amounts without decimal zeroes', () => {
      expect(formatMoney(6563, 'CAD')).toBe('6,563 CAD')
      expect(formatMoney(6563.00, 'CAD')).toBe('6,563 CAD')
      expect(formatMoney(0, 'USD')).toBe('0 USD')
    })

    it('formats amounts with cents up to 2 decimal places', () => {
      expect(formatMoney(6563.5, 'CAD')).toBe('6,563.50 CAD')
      expect(formatMoney(6563.25, 'USD')).toBe('6,563.25 USD')
    })

    it('handles missing or zero currency code properly', () => {
      expect(formatMoney(1200)).toBe('1,200')
      expect(formatMoney(null, 'CAD')).toBe('0 CAD')
      expect(formatMoney(undefined)).toBe('0')
    })
  })

  describe('formatRelativeTime', () => {
    it('returns empty string for empty input', () => {
      expect(formatRelativeTime('')).toBe('')
      expect(formatRelativeTime(null)).toBe('')
    })

    it('formats recent timestamps as Just now or minutes ago', () => {
      const now = new Date()
      expect(formatRelativeTime(now.toISOString())).toBe('Just now')

      const twoMinutesAgo = new Date(now.getTime() - 2 * 60 * 1000)
      expect(formatRelativeTime(twoMinutesAgo.toISOString())).toBe('2m ago')

      const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000)
      expect(formatRelativeTime(threeHoursAgo.toISOString())).toBe('3h ago')

      const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000)
      expect(formatRelativeTime(twoDaysAgo.toISOString())).toBe('2d ago')
    })
  })

  describe('formatDateTimeRange', () => {
    it('formats single day event with start and end times', () => {
      const range = formatDateTimeRange('2026-07-24T14:00', '2026-07-24T17:00')
      expect(range).toContain('Jul 24')
      expect(range).toContain('2:00 PM')
      expect(range).toContain('5:00 PM')
    })

    it('formats multi-day event range across distinct calendar dates', () => {
      const range = formatDateTimeRange('2026-07-24T14:00', '2026-07-26T11:00')
      expect(range).toContain('Jul 24')
      expect(range).toContain('Jul 26')
    })

    it('handles start-only or end-only date strings', () => {
      const startOnly = formatDateTimeRange('2026-07-24T14:00', null)
      expect(startOnly).toContain('Jul 24')
      expect(startOnly).toContain('2:00 PM')

      const endOnly = formatDateTimeRange(null, '2026-07-24T17:00')
      expect(endOnly).toContain('Until')
      expect(endOnly).toContain('Jul 24')
    })
  })

  describe('getTripDaysList', () => {
    it('returns empty array when start or end date is missing', () => {
      expect(getTripDaysList(null, '2026-12-25')).toEqual([])
      expect(getTripDaysList('2026-12-25', null)).toEqual([])
      expect(getTripDaysList('', '')).toEqual([])
    })

    it('returns empty array when start date is after end date', () => {
      expect(getTripDaysList('2026-12-28', '2026-12-25')).toEqual([])
    })

    it('generates a 1-day list when start equals end', () => {
      const days = getTripDaysList('2026-12-25', '2026-12-25')
      expect(days).toHaveLength(1)
      expect(days[0]).toEqual({
        dayNumber: 1,
        dateStr: '2026-12-25',
        label: 'Day 1 (Dec 25)',
        shortDate: 'Dec 25',
        chipLabel: 'Day 1 · Dec 25'
      })
    })

    it('generates a multi-day descriptor list for trip span', () => {
      const days = getTripDaysList('2026-12-25', '2026-12-27')
      expect(days).toHaveLength(3)
      expect(days[0].dayNumber).toBe(1)
      expect(days[0].dateStr).toBe('2026-12-25')
      expect(days[0].label).toBe('Day 1 (Dec 25)')

      expect(days[1].dayNumber).toBe(2)
      expect(days[1].dateStr).toBe('2026-12-26')
      expect(days[1].label).toBe('Day 2 (Dec 26)')

      expect(days[2].dayNumber).toBe(3)
      expect(days[2].dateStr).toBe('2026-12-27')
      expect(days[2].label).toBe('Day 3 (Dec 27)')
    })
  })

  describe('buildDefaultOptionDates', () => {
    it('returns empty object when trip start date is missing', () => {
      const res = buildDefaultOptionDates(null, null, 'Activities')
      expect(res.start).toBe('')
      expect(res.end).toBe('')
    })

    it('defaults Accommodation to full trip span (15:00 to 11:00)', () => {
      const res = buildDefaultOptionDates('2026-12-25', '2026-12-28', 'Accommodation')
      expect(res.start).toBe('2026-12-25T15:00')
      expect(res.end).toBe('2026-12-28T11:00')
    })

    it('defaults Accommodation on single-day trip safely', () => {
      const res = buildDefaultOptionDates('2026-12-25', '2026-12-25', 'Accommodation')
      expect(res.start).toBe('2026-12-25T15:00')
      expect(res.end).toBe('2026-12-25T21:00')
    })

    it('defaults Shared Vehicle / Transport to full trip span (09:00 to 18:00)', () => {
      const res = buildDefaultOptionDates('2026-12-25', '2026-12-28', 'Transport')
      expect(res.start).toBe('2026-12-25T09:00')
      expect(res.end).toBe('2026-12-28T18:00')
    })

    it('defaults Activity to Day 1 from 09:00 to 12:00', () => {
      const res = buildDefaultOptionDates('2026-12-25', '2026-12-28', 'Activities')
      expect(res.start).toBe('2026-12-25T09:00')
      expect(res.end).toBe('2026-12-25T12:00')
    })

    it('defaults Meal / Food to Day 1 at 19:30', () => {
      const res = buildDefaultOptionDates('2026-12-25', '2026-12-28', 'Food')
      expect(res.start).toBe('2026-12-25T19:30')
      expect(res.end).toBe('2026-12-25T21:30')
    })
  })
})

