import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  saveTripOfflineSnapshot,
  loadTripOfflineSnapshot,
  isNetworkOffline
} from '../utils/offlineCache'

describe('Offline Cache Utilities', () => {
  let mockStorage = {}

  beforeEach(() => {
    mockStorage = {}
    Object.defineProperty(globalThis, 'localStorage', {
      value: {
        getItem: vi.fn((key) => mockStorage[key] || null),
        setItem: vi.fn((key, value) => {
          mockStorage[key] = String(value)
        }),
        removeItem: vi.fn((key) => {
          delete mockStorage[key]
        }),
        clear: vi.fn(() => {
          mockStorage = {}
        })
      },
      writable: true,
      configurable: true
    })
  })

  afterEach(() => {
    mockStorage = {}
  })

  it('saves and restores trip offline snapshot in localStorage', () => {
    const tripData = {
      trip: { id: 'trip-123', title: 'Tokyo Trip' },
      roster: [{ user_id: 'u1' }],
      options: [{ id: 1, option_text: 'Hotel' }],
      expenses: [{ id: 10, amount: 50 }]
    }

    saveTripOfflineSnapshot('trip-123', tripData)
    const loaded = loadTripOfflineSnapshot('trip-123')

    expect(loaded).not.toBeNull()
    expect(loaded.trip.title).toBe('Tokyo Trip')
    expect(loaded.roster).toHaveLength(1)
    expect(loaded.options).toHaveLength(1)
    expect(loaded.expenses).toHaveLength(1)
    expect(loaded.timestamp).toBeTypeOf('number')
  })

  it('returns null if no snapshot exists', () => {
    expect(loadTripOfflineSnapshot('non-existent')).toBeNull()
  })

  it('isNetworkOffline correctly identifies offline errors', () => {
    expect(isNetworkOffline(new Error('Failed to fetch'))).toBe(true)
    expect(isNetworkOffline(new Error('Network request failed'))).toBe(true)
    expect(isNetworkOffline(new Error('Internet disconnected'))).toBe(true)
    expect(isNetworkOffline(new Error('Validation error: invalid name'))).toBe(false)
  })
})
