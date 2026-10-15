import { describe, it, expect } from 'vitest'
import { generateICalContent, formatICalDateTime } from '../utils/ical'

describe('iCalendar (.ics) Utilities', () => {
  describe('formatICalDateTime', () => {
    it('formats date-only YYYY-MM-DD string into YYYYMMDD for all-day events', () => {
      const formatted = formatICalDateTime('2026-07-24')
      expect(formatted).toBe('20260724')
    })

    it('formats local datetime string into floating wall-clock time without trailing Z', () => {
      const formatted = formatICalDateTime('2026-07-24T18:30')
      expect(formatted).toBe('20260724T183000')

      const formattedWithSeconds = formatICalDateTime('2026-07-24T18:30:45')
      expect(formattedWithSeconds).toBe('20260724T183045')
    })

    it('formats UTC ISO strings into standard representation with Z', () => {
      const formatted = formatICalDateTime('2026-07-24T18:30:00.000Z')
      expect(formatted).toBe('20260724T183000Z')
    })

    it('handles Date instance inputs cleanly', () => {
      const date = new Date(Date.UTC(2026, 6, 24, 12, 0, 0))
      const formatted = formatICalDateTime(date)
      expect(formatted).toBe('20260724T120000Z')
    })

    it('returns valid timestamp string when called with null or empty', () => {
      const formatted = formatICalDateTime()
      expect(formatted).toMatch(/^\d{8}T\d{6}Z$/)
    })
  })

  describe('generateICalContent', () => {
    const dummyTrip = {
      id: 'trip-tokyo-2026',
      title: 'Tokyo Summer Adventure 2026',
      destination: 'Tokyo, Japan',
      start_date: '2026-07-24',
      end_date: '2026-07-30'
    }

    const dummyOptions = [
      {
        id: 101,
        category: 'activities',
        option_text: 'Shibuya Crossing & Robot Restaurant',
        description: 'Guided evening walking tour of Shibuya\nBring comfortable shoes',
        link: 'https://example.com/tour',
        start_date: '2026-07-24T18:00',
        end_date: '2026-07-24T21:00'
      },
      {
        id: 102,
        category: 'accommodation',
        option_text: 'Park Hyatt Tokyo',
        description: 'Shinjuku luxury stay',
        start_date: '2026-07-24',
        end_date: '2026-07-30'
      }
    ]

    it('generates compliant RFC 5545 VCALENDAR boundaries and headers', () => {
      const ics = generateICalContent(dummyTrip, dummyOptions)

      expect(ics).toContain('BEGIN:VCALENDAR')
      expect(ics).toContain('VERSION:2.0')
      expect(ics).toContain('PRODID:-//TripPlanner//NONGNS v1.8//EN')
      expect(ics).toContain('CALSCALE:GREGORIAN')
      expect(ics).toContain('METHOD:PUBLISH')
      expect(ics).toContain('X-WR-CALNAME:Trip Itinerary - Tokyo Summer Adventure 2026')
      expect(ics).toContain('END:VCALENDAR')
    })

    it('formats VEVENT blocks with correct summaries, descriptions, and UIDs', () => {
      const ics = generateICalContent(dummyTrip, dummyOptions)

      expect(ics).toContain('BEGIN:VEVENT')
      expect(ics).toContain('UID:opt-101-trip-tokyo-2026@tripplanner')
      expect(ics).toContain('SUMMARY:ACTIVITIES: Shibuya Crossing & Robot Restaurant')
      expect(ics).toContain('DESCRIPTION:Guided evening walking tour of Shibuya\\nBring comfortable shoes\\nLink: https://example.com/tour')
      expect(ics).toContain('LOCATION:Tokyo, Japan')
      expect(ics).toContain('UID:opt-102-trip-tokyo-2026@tripplanner')
      expect(ics).toContain('SUMMARY:ACCOMMODATION: Park Hyatt Tokyo')
    })

    it('uses VALUE=DATE for date-only all-day options and floating times for timed options', () => {
      const ics = generateICalContent(dummyTrip, dummyOptions)

      // Timed activity option
      expect(ics).toContain('DTSTART:20260724T180000')
      expect(ics).toContain('DTEND:20260724T210000')

      // Date-only accommodation option
      expect(ics).toContain('DTSTART;VALUE=DATE:20260724')
      expect(ics).toContain('DTEND;VALUE=DATE:20260730')
    })
  })
})
