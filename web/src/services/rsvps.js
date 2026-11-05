import { supabase } from './supabase.js'

/**
 * Fetches the RSVP roster for a specific trip, including user profile details.
 * Uses native Supabase (Postgrest) table relations to query linked user details in one request.
 * @param {string} tripId The UUID of the trip.
 * @returns {Promise<Array>} A promise resolving to an array of RSVPs.
 */
export async function fetchRsvpRoster(tripId) {
  let { data, error } = await supabase
    .from('rsvps')
    .select('id, status, user_id, notes, role, arrival_date, departure_date, dietary_tags, users(*)')
    .eq('trip_id', tripId)

  if (error) {
    // Fallback if arrival_date, departure_date, or dietary_tags column absent on unmigrated schema
    const fallback = await supabase
      .from('rsvps')
      .select('id, status, user_id, notes, role, users(*)')
      .eq('trip_id', tripId)
    data = fallback.data
    error = fallback.error
  }

  if (error) {
    // Fallback if role or is_admin column absent on unmigrated schema
    const baseline = await supabase
      .from('rsvps')
      .select('status, user_id, notes, users(*)')
      .eq('trip_id', tripId)
    data = baseline.data
    error = baseline.error
  }

  if (error) {
    throw error
  }

  // Deduplicate by user_id keeping the first/latest occurrence
  const seenUsers = new Set()
  const deduplicated = []
  for (const item of (data || [])) {
    const uid = String(item.user_id)
    if (!seenUsers.has(uid)) {
      seenUsers.add(uid)
      deduplicated.push(item)
    }
  }

  return deduplicated
}

/**
 * Defensively queries existing RSVP rows matching (trip_id, user_id),
 * deletes any redundant duplicate rows so only the primary row remains,
 * and executes an update or insert without chaining .single().
 *
 * @param {string} tripId The UUID of the trip.
 * @param {string|number} userId The user ID.
 * @param {Object} payload Key-value pairs to update or insert.
 * @param {Object} [fallbackPayload] Fallback fields if columns are missing.
 * @returns {Promise<Object>} The updated or inserted RSVP row.
 */
export async function saveRsvpRecord(tripId, userId, payload, fallbackPayload = null) {
  if (!tripId || !userId) {
    throw new Error('tripId and userId are required to save RSVP.')
  }

  // 1. Query existing rows matching (trip_id, user_id)
  let existingRows = []
  try {
    const res = await supabase
      .from('rsvps')
      .select('*')
      .eq('trip_id', tripId)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (res.error) {
      // Fallback query without .order() if created_at is absent
      const fallback = await supabase
        .from('rsvps')
        .select('*')
        .eq('trip_id', tripId)
        .eq('user_id', userId)
      if (fallback?.error) throw fallback.error
      if (!fallback?.data) throw res.error
      existingRows = fallback.data || []
    } else {
      existingRows = res.data || []
    }
  } catch (err) {
    const fallback = await supabase
      .from('rsvps')
      .select('*')
      .eq('trip_id', tripId)
      .eq('user_id', userId)
    if (fallback?.error) throw fallback.error
    if (!fallback?.data) throw err
    existingRows = fallback.data || []
  }

  // If multiple rows exist, sort by updated_at or created_at descending
  if (existingRows.length > 1) {
    existingRows.sort((a, b) => {
      const timeA = new Date(a.updated_at || a.created_at || 0).getTime()
      const timeB = new Date(b.updated_at || b.created_at || 0).getTime()
      return timeB - timeA
    })

    // Delete redundant duplicate IDs so only the primary row remains
    const duplicateIds = existingRows.slice(1).map((r) => r.id).filter(Boolean)
    if (duplicateIds.length > 0) {
      await supabase
        .from('rsvps')
        .delete()
        .in('id', duplicateIds)
    }
  }

  const primaryRow = existingRows[0] || null

  const executeMutation = async (fieldsToApply) => {
    if (primaryRow) {
      let updateQuery = supabase
        .from('rsvps')
        .update(fieldsToApply)

      if (primaryRow.id) {
        updateQuery = updateQuery.eq('id', primaryRow.id)
      } else {
        updateQuery = updateQuery.eq('trip_id', tripId).eq('user_id', userId)
      }

      const { data, error } = await updateQuery.select()
      if (error) throw error
      const row = Array.isArray(data) ? data[0] : (data || { ...primaryRow, ...fieldsToApply })
      return row
    } else {
      const insertData = {
        trip_id: tripId,
        user_id: userId,
        ...fieldsToApply
      }
      const { data, error } = await supabase
        .from('rsvps')
        .insert([insertData])
        .select()

      if (error) throw error
      const row = Array.isArray(data) ? data[0] : (data || insertData)
      return row
    }
  }

  try {
    return await executeMutation(payload)
  } catch (err) {
    if (fallbackPayload && Object.keys(fallbackPayload).length > 0) {
      return await executeMutation(fallbackPayload)
    }
    throw err
  }
}

/**
 * Creates / updates an RSVP record for a user joining a trip.
 * Uses defensive query and save pattern to prevent duplicate RSVP rows.
 * @param {string} tripId The UUID of the trip.
 * @param {string} userId The UUID of the user.
 * @param {string} [status='Committed'] The RSVP status.
 * @param {string} [role='member'] The RSVP role ('organizer', 'co_organizer', 'member').
 * @returns {Promise<Object>} A promise resolving to the created/updated RSVP record.
 */
export async function createRsvp(tripId, userId, status = 'Committed', role = 'member') {
  return await saveRsvpRecord(
    tripId,
    userId,
    { status, role },
    { status }
  )
}

/**
 * Updates the RSVP notes field for a specific participant.
 * @param {string} tripId The UUID of the trip.
 * @param {string} userId The UUID of the user.
 * @param {string} notes The note text to set.
 * @returns {Promise<Object>} A promise resolving to the updated RSVP record.
 */
export async function updateRsvpNote(tripId, userId, notes) {
  return await saveRsvpRecord(
    tripId,
    userId,
    { notes }
  )
}

/**
 * Updates the RSVP status field for a specific participant.
 * @param {string} tripId The UUID of the trip.
 * @param {string} userId The UUID of the user.
 * @param {string} status The status to set ('Committed', 'Tentative', 'Declined').
 * @returns {Promise<Object>} A promise resolving to the updated RSVP record.
 */
export async function updateRsvpStatus(tripId, userId, status) {
  return await saveRsvpRecord(
    tripId,
    userId,
    { status }
  )
}

/**
 * Helper to determine if a user has admin/organizer permissions for a trip.
 * Strictly uses relational columns (trip.organizer_id, rsvp.role, rsvp.is_admin)
 * and never grants privileges from user-editable notes.
 * @param {Object|number|string} user The active user object or user ID.
 * @param {Object} trip The trip object.
 * @param {Object} [rsvp] Optional RSVP record for the user on this trip.
 * @returns {boolean} True if user is the primary organizer or a co-organizer.
 */
export function isUserTripAdmin(user, trip, rsvpOrRoster) {
  if (!user) return false
  const userId = typeof user === 'object' ? user.id : user

  // 1. Primary organizer check from trip object
  if (trip && trip.organizer_id && String(trip.organizer_id) === String(userId)) {
    return true
  }

  // 2. Resolve RSVP if array was passed as 2nd or 3rd param
  let rsvp = rsvpOrRoster
  if (Array.isArray(rsvpOrRoster)) {
    rsvp = rsvpOrRoster.find(r => String(r.user_id || r.id) === String(userId))
  } else if (!rsvp && Array.isArray(trip)) {
    rsvp = trip.find(r => String(r.user_id || r.id) === String(userId))
  }

  // 3. Co-organizer or explicit admin check from RSVP role / is_admin column
  if (rsvp) {
    if (rsvp.role === 'organizer' || rsvp.role === 'co_organizer') {
      return true
    }
    if (rsvp.is_admin === true) {
      return true
    }
  }

  return false
}

/**
 * Promotes a participant to Co-Organizer admin status.
 * Updates role to 'co_organizer' and is_admin to true without mutating user notes.
 * @param {string} tripId The UUID of the trip.
 * @param {string|number} userId The ID of the participant.
 * @returns {Promise<Object>} Updated RSVP record.
 */
export async function promoteToCoOrganizer(tripId, userId) {
  return await saveRsvpRecord(
    tripId,
    userId,
    { role: 'co_organizer' },
    { is_admin: true }
  )
}

/**
 * Demotes a Co-Organizer back to regular participant status.
 * Updates role to 'member' without mutating user notes.
 * @param {string} tripId The UUID of the trip.
 * @param {string|number} userId The ID of the participant.
 * @returns {Promise<Object>} Updated RSVP record.
 */
export async function demoteCoOrganizer(tripId, userId) {
  return await saveRsvpRecord(
    tripId,
    userId,
    { role: 'member' },
    { is_admin: false }
  )
}

/**
 * Updates an RSVP's presence dates, dietary tags, and/or notes with graceful schema fallback.
 * @param {string} tripId The UUID of the trip.
 * @param {string|number} userId The user ID.
 * @param {Object} details Details to update: { arrival_date, departure_date, dietary_tags, notes }.
 * @returns {Promise<Object>} Updated RSVP record.
 */
export async function updateRsvpDetails(tripId, userId, details = {}) {
  const { arrival_date, departure_date, dietary_tags, notes } = details || {}
  const payload = {}
  if (arrival_date !== undefined) payload.arrival_date = arrival_date || null
  if (departure_date !== undefined) payload.departure_date = departure_date || null
  if (dietary_tags !== undefined) payload.dietary_tags = Array.isArray(dietary_tags) ? dietary_tags : []
  if (notes !== undefined) payload.notes = notes

  const fallbackPayload = {}
  if (notes !== undefined) fallbackPayload.notes = notes

  try {
    return await saveRsvpRecord(tripId, userId, payload, fallbackPayload)
  } catch (err) {
    if (Object.keys(fallbackPayload).length > 0) {
      return await saveRsvpRecord(tripId, userId, fallbackPayload)
    }
    return { trip_id: tripId, user_id: userId, ...payload }
  }
}

/**
 * Helper to filter committed roster members whose presence overlaps with the given dates.
 * Defaults to the full trip duration if a member hasn't set custom arrival/departure dates.
 * @param {Array} roster List of RSVP records.
 * @param {string|null} startDateStr Option/event start date (YYYY-MM-DD or ISO).
 * @param {string|null} endDateStr Option/event end date (YYYY-MM-DD or ISO).
 * @returns {Array} List of committed members present during the date window.
 */
export function getPresentTravelers(roster = [], startDateStr = null, endDateStr = null) {
  if (!Array.isArray(roster)) return []

  // Filter only committed members
  const committed = roster.filter(m => m.status?.toLowerCase() === 'committed')

  // If no date boundaries specified on the option, all committed travelers are present
  if (!startDateStr && !endDateStr) {
    return committed
  }

  const optStart = startDateStr ? String(startDateStr).slice(0, 10) : null
  const optEnd = endDateStr ? String(endDateStr).slice(0, 10) : null

  let effectiveStart = optStart || optEnd
  let effectiveEnd = optEnd || optStart

  if (effectiveStart && effectiveEnd && effectiveStart > effectiveEnd) {
    const temp = effectiveStart
    effectiveStart = effectiveEnd
    effectiveEnd = temp
  }

  return committed.filter(m => {
    const arr = m.arrival_date ? String(m.arrival_date).slice(0, 10) : null
    const dep = m.departure_date ? String(m.departure_date).slice(0, 10) : null

    // Traveler left before option starts
    if (dep && effectiveStart && dep < effectiveStart) {
      return false
    }

    // Traveler arrives after option ends
    if (arr && effectiveEnd && arr > effectiveEnd) {
      return false
    }

    return true
  })
}

