import { useState, useEffect, useRef } from 'react'
import { supabase } from '../services/supabase'

/**
 * Controller managing Supabase Realtime channel subscription, event dispatching,
 * and per-resource debouncing for trip updates.
 *
 * @param {Object} options
 * @param {string} options.tripId - The UUID of the trip.
 * @param {Object} [options.callbacks={}] - Callback map for resource changes.
 * @param {Function} [options.callbacks.onTripChange] - Fired when trips table mutates.
 * @param {Function} [options.callbacks.onRosterChange] - Fired when rsvps table mutates.
 * @param {Function} [options.callbacks.onOptionsChange] - Fired when poll_options, option_votes, or active_polls mutate.
 * @param {Function} [options.callbacks.onExpensesChange] - Fired when expenses table mutates.
 * @param {Function} [options.callbacks.onActivityChange] - Fired when activity_log table mutates.
 * @param {number} [options.debounceMs=300] - Debounce window in milliseconds.
 * @param {Object} [options.client=supabase] - Supabase client instance.
 * @param {Function} [options.onStatusChange] - Status change listener.
 * @returns {Object} Controller with channel, unsubscribe, and test simulation helpers.
 */
export function createTripRealtimeController({
  tripId,
  callbacks = {},
  debounceMs = 300,
  client = supabase,
  onStatusChange
}) {
  const timers = {}
  const handlersByTable = {}

  function triggerDebounced(resource) {
    if (timers[resource]) {
      clearTimeout(timers[resource])
    }
    timers[resource] = setTimeout(() => {
      delete timers[resource]
      if (resource === 'trip') callbacks.onTripChange?.()
      else if (resource === 'roster') callbacks.onRosterChange?.()
      else if (resource === 'options') callbacks.onOptionsChange?.()
      else if (resource === 'expenses') callbacks.onExpensesChange?.()
      else if (resource === 'activity') callbacks.onActivityChange?.()
    }, debounceMs)
  }

  // Register table handlers
  handlersByTable.trips = () => triggerDebounced('trip')
  handlersByTable.rsvps = () => triggerDebounced('roster')
  handlersByTable.poll_options = () => triggerDebounced('options')
  handlersByTable.option_votes = () => triggerDebounced('options')
  handlersByTable.active_polls = () => triggerDebounced('options')
  handlersByTable.expenses = () => triggerDebounced('expenses')
  handlersByTable.activity_log = () => triggerDebounced('activity')

  const channelName = `trip-room:${tripId}`
  const channel = client.channel(channelName)

  channel
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'trips', filter: `id=eq.${tripId}` },
      (payload) => handlersByTable.trips(payload)
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'rsvps', filter: `trip_id=eq.${tripId}` },
      (payload) => handlersByTable.rsvps(payload)
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'poll_options', filter: `trip_id=eq.${tripId}` },
      (payload) => handlersByTable.poll_options(payload)
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'option_votes', filter: `trip_id=eq.${tripId}` },
      (payload) => handlersByTable.option_votes(payload)
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'active_polls', filter: `trip_id=eq.${tripId}` },
      (payload) => handlersByTable.active_polls(payload)
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'expenses', filter: `trip_id=eq.${tripId}` },
      (payload) => handlersByTable.expenses(payload)
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'activity_log', filter: `trip_id=eq.${tripId}` },
      (payload) => handlersByTable.activity_log(payload)
    )
    .subscribe((status, err) => {
      if (status === 'SUBSCRIBED') {
        onStatusChange?.('connected')
      } else if (status === 'CHANNEL_ERROR' || err) {
        onStatusChange?.('error')
      } else if (status === 'TIMED_OUT' || status === 'CLOSED') {
        onStatusChange?.('disconnected')
      }
    })

  function unsubscribe() {
    Object.values(timers).forEach(clearTimeout)
    for (const key of Object.keys(timers)) {
      delete timers[key]
    }
    if (channel && client?.removeChannel) {
      client.removeChannel(channel)
    }
    onStatusChange?.('disconnected')
  }

  function simulateEvent(table, payload = {}) {
    if (handlersByTable[table]) {
      handlersByTable[table](payload)
    }
  }

  return {
    channel,
    channelName,
    unsubscribe,
    simulateEvent,
    getPendingTimers: () => Object.keys(timers)
  }
}

/**
 * Custom React hook establishing real-time collaborative synchronization for a trip.
 *
 * Listens to multiplexed Supabase Realtime postgres_changes on:
 * - trips -> onTripChange
 * - rsvps -> onRosterChange
 * - poll_options, option_votes, active_polls -> onOptionsChange
 * - expenses -> onExpensesChange
 * - activity_log -> onActivityChange
 *
 * Employs per-resource debouncing to gracefully coalesce rapid event cascades.
 *
 * @param {string} tripId - The UUID of the trip.
 * @param {Object} [callbacks={}] - Callbacks for entity updates.
 * @param {number} [debounceMs=300] - Debounce window duration in milliseconds.
 * @returns {{ realtimeStatus: 'connecting' | 'connected' | 'disconnected' | 'error' }}
 */
export function useTripRealtime(tripId, callbacks = {}, debounceMs = 300) {
  const [realtimeStatus, setRealtimeStatus] = useState(tripId ? 'connecting' : 'disconnected')
  const callbacksRef = useRef(callbacks)
  callbacksRef.current = callbacks

  useEffect(() => {
    if (!tripId) {
      setRealtimeStatus('disconnected')
      return
    }

    setRealtimeStatus('connecting')

    const controller = createTripRealtimeController({
      tripId,
      callbacks: {
        onTripChange: () => callbacksRef.current.onTripChange?.(),
        onRosterChange: () => callbacksRef.current.onRosterChange?.(),
        onOptionsChange: () => callbacksRef.current.onOptionsChange?.(),
        onExpensesChange: () => callbacksRef.current.onExpensesChange?.(),
        onActivityChange: () => callbacksRef.current.onActivityChange?.()
      },
      debounceMs,
      onStatusChange: (status) => setRealtimeStatus(status)
    })

    return () => {
      controller.unsubscribe()
    }
  }, [tripId, debounceMs])

  return { realtimeStatus }
}
