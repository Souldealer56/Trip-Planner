import { describe, it, expect } from 'vitest'
import { isUserTripAdmin } from '../services/rsvps'
import { isTripArchived } from '../services/trips'

describe('Permissions & Security Domain Logic', () => {
  describe('isUserTripAdmin', () => {
    const trip = {
      id: 'trip-100',
      title: 'Summer Getaway',
      organizer_id: 'user-organizer-1'
    }

    it('grants admin status to the primary organizer by user ID or user object', () => {
      expect(isUserTripAdmin('user-organizer-1', trip)).toBe(true)
      expect(isUserTripAdmin({ id: 'user-organizer-1' }, trip)).toBe(true)
    })

    it('grants admin status when rsvp.role is organizer or co_organizer', () => {
      const rsvpOrganizer = {
        role: 'organizer',
        is_admin: true,
        user_id: 'user-2'
      }
      expect(isUserTripAdmin('user-2', trip, rsvpOrganizer)).toBe(true)

      const rsvpCoOrganizer = {
        role: 'co_organizer',
        is_admin: true,
        user_id: 'user-3'
      }
      expect(isUserTripAdmin('user-3', trip, rsvpCoOrganizer)).toBe(true)
    })

    it('grants admin status when rsvp.is_admin is explicitly true', () => {
      const rsvpAdmin = {
        role: 'member',
        is_admin: true,
        user_id: 'user-4'
      }
      expect(isUserTripAdmin('user-4', trip, rsvpAdmin)).toBe(true)
    })

    it('DENIES admin status to regular participants even if they insert [ADMIN] or [CO_ORGANIZER] into notes', () => {
      const maliciousRsvp = {
        user_id: 'user-hacker',
        role: 'member',
        is_admin: false,
        notes: '[ADMIN] [CO_ORGANIZER] I am an administrator now'
      }

      // Must strictly return false to prevent privilege escalation
      expect(isUserTripAdmin('user-hacker', trip, maliciousRsvp)).toBe(false)
      expect(isUserTripAdmin({ id: 'user-hacker' }, trip, maliciousRsvp)).toBe(false)
    })

    it('returns false when user or trip is missing', () => {
      expect(isUserTripAdmin(null, trip)).toBe(false)
      expect(isUserTripAdmin('user-1', null)).toBe(false)
    })
  })

  describe('isTripArchived', () => {
    it('returns true when trip.is_archived is boolean true', () => {
      expect(isTripArchived({ is_archived: true })).toBe(true)
    })

    it('returns false when trip.is_archived is false, null, or undefined', () => {
      expect(isTripArchived({ is_archived: false })).toBe(false)
      expect(isTripArchived({ is_archived: null })).toBe(false)
      expect(isTripArchived({})).toBe(false)
      expect(isTripArchived(null)).toBe(false)
    })

    it('does NOT treat string tags in vibe or description as archived state', () => {
      const tripWithStringTag = {
        title: 'Trip to Rome',
        vibe: '[ARCHIVED] Chill sightseeing',
        description: '[ARCHIVED] Was a great trip',
        is_archived: false
      }
      expect(isTripArchived(tripWithStringTag)).toBe(false)
    })
  })
})
