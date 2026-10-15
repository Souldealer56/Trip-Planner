import { describe, it, expect } from 'vitest'
import {
  parseLocalDate,
  formatLocalDateStr,
  formatDateRange,
  formatCurrency,
  formatRelativeTime,
  formatDateTimeRange
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
})
