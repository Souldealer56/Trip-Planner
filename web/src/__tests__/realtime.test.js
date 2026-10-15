import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createTripRealtimeController } from '../hooks/useTripRealtime'

describe('Supabase Realtime Synchronization Logic', () => {
  let mockChannel
  let mockClient

  beforeEach(() => {
    vi.useFakeTimers()

    mockChannel = {
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn((cb) => {
        if (cb) cb('SUBSCRIBED')
        return mockChannel
      })
    }

    mockClient = {
      channel: vi.fn(() => mockChannel),
      removeChannel: vi.fn()
    }
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  it('subscribes to a single multiplexed channel with correct trip_id filters', () => {
    const tripId = 'trip-abc-123'
    createTripRealtimeController({
      tripId,
      callbacks: {},
      client: mockClient
    })

    expect(mockClient.channel).toHaveBeenCalledWith(`trip-room:${tripId}`)
    expect(mockChannel.on).toHaveBeenCalledTimes(7)

    // Verify filter for root trips table uses id=eq.
    expect(mockChannel.on).toHaveBeenCalledWith(
      'postgres_changes',
      expect.objectContaining({ table: 'trips', filter: `id=eq.${tripId}` }),
      expect.any(Function)
    )

    // Verify filters for child tables use trip_id=eq.
    const childTables = ['rsvps', 'poll_options', 'option_votes', 'active_polls', 'expenses', 'activity_log']
    childTables.forEach((table) => {
      expect(mockChannel.on).toHaveBeenCalledWith(
        'postgres_changes',
        expect.objectContaining({ table, filter: `trip_id=eq.${tripId}` }),
        expect.any(Function)
      )
    })
  })

  it('coalesces 5 rapid option_votes events within 100ms into a single onOptionsChange call after 300ms', () => {
    const onOptionsChange = vi.fn()
    const controller = createTripRealtimeController({
      tripId: 'trip-1',
      callbacks: { onOptionsChange },
      debounceMs: 300,
      client: mockClient
    })

    // Fire 5 rapid events over 80ms (within 100ms)
    controller.simulateEvent('option_votes', { new: { id: 'vote-1' } })
    vi.advanceTimersByTime(20)

    controller.simulateEvent('option_votes', { new: { id: 'vote-2' } })
    vi.advanceTimersByTime(20)

    controller.simulateEvent('poll_options', { new: { id: 'opt-3' } })
    vi.advanceTimersByTime(20)

    controller.simulateEvent('active_polls', { new: { id: 'poll-4' } })
    vi.advanceTimersByTime(20)

    controller.simulateEvent('option_votes', { new: { id: 'vote-5' } })

    // Total elapsed: 80ms; onOptionsChange must not have fired yet
    expect(onOptionsChange).not.toHaveBeenCalled()

    // Advance 250ms (only 250ms since last event at 80ms)
    vi.advanceTimersByTime(250)
    expect(onOptionsChange).not.toHaveBeenCalled()

    // Advance remaining 50ms (total 300ms since the last event)
    vi.advanceTimersByTime(50)
    expect(onOptionsChange).toHaveBeenCalledTimes(1)

    // Ensure no additional trailing invocations occur
    vi.advanceTimersByTime(500)
    expect(onOptionsChange).toHaveBeenCalledTimes(1)
  })

  it('unmounting / unsubscribing cancels pending timers and removes the channel', () => {
    const onOptionsChange = vi.fn()
    const onTripChange = vi.fn()

    const controller = createTripRealtimeController({
      tripId: 'trip-1',
      callbacks: { onOptionsChange, onTripChange },
      debounceMs: 300,
      client: mockClient
    })

    // Queue up mutations
    controller.simulateEvent('option_votes', { new: { id: 'v-1' } })
    controller.simulateEvent('trips', { new: { id: 'trip-1', title: 'New Title' } })

    // Immediately unsubscribe before debounce timer expires
    controller.unsubscribe()

    expect(mockClient.removeChannel).toHaveBeenCalledWith(mockChannel)

    // Advance time past debounce threshold
    vi.advanceTimersByTime(500)

    // Neither callback should fire after cleanup
    expect(onOptionsChange).not.toHaveBeenCalled()
    expect(onTripChange).not.toHaveBeenCalled()
  })

  it('debounces different resources independently without cross-interference', () => {
    const onRosterChange = vi.fn()
    const onExpensesChange = vi.fn()

    const controller = createTripRealtimeController({
      tripId: 'trip-2',
      callbacks: { onRosterChange, onExpensesChange },
      debounceMs: 300,
      client: mockClient
    })

    // Fire roster event at t=0ms
    controller.simulateEvent('rsvps', {})

    // Advance 150ms and fire expenses event at t=150ms
    vi.advanceTimersByTime(150)
    controller.simulateEvent('expenses', {})

    // At t=300ms (300ms after roster event, but only 150ms after expense event)
    vi.advanceTimersByTime(150)
    expect(onRosterChange).toHaveBeenCalledTimes(1)
    expect(onExpensesChange).not.toHaveBeenCalled()

    // At t=450ms (300ms after expense event)
    vi.advanceTimersByTime(150)
    expect(onExpensesChange).toHaveBeenCalledTimes(1)
  })

  it('reports realtime status transitions correctly', () => {
    let capturedSubscriberCallback
    mockChannel.subscribe = vi.fn((cb) => {
      capturedSubscriberCallback = cb
      return mockChannel
    })

    const statusUpdates = []
    const controller = createTripRealtimeController({
      tripId: 'trip-status',
      client: mockClient,
      onStatusChange: (status) => statusUpdates.push(status)
    })

    // Initial subscribe returns SUBSCRIBED
    capturedSubscriberCallback('SUBSCRIBED')
    expect(statusUpdates).toContain('connected')

    // Simulate error transition
    capturedSubscriberCallback('CHANNEL_ERROR', new Error('Connection lost'))
    expect(statusUpdates).toContain('error')

    // Simulate disconnect on teardown
    controller.unsubscribe()
    expect(statusUpdates[statusUpdates.length - 1]).toBe('disconnected')
  })
})
