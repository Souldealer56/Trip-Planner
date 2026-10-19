import { supabase } from './supabase.js'

export const TRIP_CATEGORIES = ['Accommodation', 'Transport', 'Activities', 'Food', 'Other']
export const TRIP_CATEGORIES_LOWER = ['accommodation', 'transport', 'activities', 'food', 'other']

/**
 * Normalizes any category string. Automatically maps legacy 'flights' or 'flight' to 'transport'.
 * @param {string} cat Category name
 * @returns {string} Lowercase normalized category
 */
export function normalizeCategory(cat) {
  if (!cat) return 'other'
  const c = String(cat).trim().toLowerCase()
  if (c === 'flights' || c === 'flight') return 'transport'
  return c
}

/**
 * Normalizes an option database row, transforming legacy 'flights' into 'transport'
 * with transport_mode = 'ticket' and is_legacy_flight = true.
 * @param {Object} row Raw option database row
 * @returns {Object} Normalized option row
 */
export function normalizeOptionRow(row) {
  if (!row) return row
  const catLower = (row.category || '').trim().toLowerCase()
  if (catLower === 'flights' || catLower === 'flight') {
    const existingMeta = row.metadata && typeof row.metadata === 'object' ? row.metadata : {}
    return {
      ...row,
      category: 'transport',
      metadata: {
        ...existingMeta,
        transport_mode: existingMeta.transport_mode || 'ticket',
        is_legacy_flight: true
      }
    }
  }
  return row
}

/**
 * Fetches pitched options for a specific trip and category.
 * If querying 'transport', automatically fetches legacy 'flights' records as well.
 * @param {string} tripId The UUID of the trip.
 * @param {string} category The category name (lowercase or capitalized).
 * @returns {Promise<Array>} A promise resolving to an array of option records.
 */
export async function fetchOptions(tripId, category) {
  const normalizedCat = normalizeCategory(category)
  let query = supabase
    .from('poll_options')
    .select('*')
    .eq('trip_id', tripId)
    .order('id', { ascending: true })

  if (normalizedCat === 'transport') {
    query = query.in('category', ['transport', 'flights', 'flight'])
  } else {
    query = query.ilike('category', normalizedCat)
  }

  const { data, error } = await query

  if (error) {
    throw error
  }
  return (data || []).map(normalizeOptionRow)
}

/**
 * Inserts a new pitched option into the database.
 */
export async function pitchOption(
  tripId,
  category,
  name,
  estimatedCost,
  currency,
  link,
  description,
  addedByUserId,
  startDate,
  endDate,
  costType = 'split_total',
  assignedUsers = [],
  metadata = {}
) {
  let sanitizedLink = link ? link.trim() : null
  if (sanitizedLink && !/^https?:\/\//i.test(sanitizedLink)) {
    sanitizedLink = `https://${sanitizedLink}`
  }

  const normalizedCat = normalizeCategory(category)
  const cleanMeta = metadata && typeof metadata === 'object' ? { ...metadata } : {}
  if (normalizedCat === 'transport' && !cleanMeta.transport_mode) {
    cleanMeta.transport_mode = 'vehicle'
  }

  const payload = {
    trip_id: tripId,
    category: normalizedCat,
    option_text: name,
    estimated_cost: estimatedCost ? parseFloat(estimatedCost) : null,
    currency: estimatedCost ? (currency || 'USD') : null,
    link: sanitizedLink,
    description: description || null,
    start_date: startDate || null,
    end_date: endDate || null,
    added_by: addedByUserId,
    is_locked: false,
    cost_type: costType || 'split_total',
    assigned_users: Array.isArray(assignedUsers) ? assignedUsers : [],
    metadata: cleanMeta
  }

  let { data, error } = await supabase
    .from('poll_options')
    .insert(payload)
    .select()
    .single()

  if (error) {
    // Fallback without new columns if schema not yet migrated
    const fallbackPayload = {
      trip_id: tripId,
      category: normalizedCat,
      option_text: name,
      estimated_cost: estimatedCost ? parseFloat(estimatedCost) : null,
      currency: estimatedCost ? (currency || 'USD') : null,
      link: sanitizedLink,
      description: description || null,
      start_date: startDate || null,
      end_date: endDate || null,
      added_by: addedByUserId,
      is_locked: false
    }

    const fallback = await supabase
      .from('poll_options')
      .insert(fallbackPayload)
      .select()
      .single()

    if (fallback.error) {
      throw fallback.error
    }
    data = fallback.data
  }

  // Ensure active poll record exists for this trip category
  try {
    await fetchActivePoll(tripId, normalizedCat)
  } catch (pollErr) {
    console.error('Failed to initialize active poll for pitched option:', pollErr)
  }

  return normalizeOptionRow(data)
}

/**
 * Fetches or initializes the active poll record for a trip and category.
 * Uses .order().limit(1) instead of .maybeSingle() to prevent PGRST116 crashes
 * if duplicate rows exist for the same trip and category.
 */
export async function fetchActivePoll(tripId, category) {
  const cat = normalizeCategory(category)
  const { data, error: fetchError } = await supabase
    .from('active_polls')
    .select('*')
    .eq('trip_id', tripId)
    .eq('category', cat)
    .order('id', { ascending: true })
    .limit(1)

  if (fetchError) {
    throw fetchError
  }

  const existing = Array.isArray(data) && data.length > 0 ? data[0] : null

  if (existing) {
    const lockedId = existing.voter_selections?._locked_option_ids?.[0] || existing.voter_selections?._locked_option_id || existing.locked_option_id || null
    existing.locked_option_id = lockedId
    existing.locked_option_ids = existing.voter_selections?._locked_option_ids || (lockedId ? [lockedId] : [])
    return existing
  }

  // Insert a default active poll record if missing
  const { data: created, error: insertError } = await supabase
    .from('active_polls')
    .insert({
      trip_id: tripId,
      category: cat,
      telegram_poll_id: null,
      poll_options_json: [],
      voter_selections: {},
      votes_by_option: {}
    })
    .select()
    .single()

  if (insertError) {
    // If a concurrent insert occurred or constraint conflict, query one more time
    const { data: retryData, error: retryError } = await supabase
      .from('active_polls')
      .select('*')
      .eq('trip_id', tripId)
      .eq('category', cat)
      .order('id', { ascending: true })
      .limit(1)

    if (!retryError && Array.isArray(retryData) && retryData.length > 0) {
      const poll = retryData[0]
      const lockedId = poll.voter_selections?._locked_option_ids?.[0] || poll.voter_selections?._locked_option_id || poll.locked_option_id || null
      poll.locked_option_id = lockedId
      poll.locked_option_ids = poll.voter_selections?._locked_option_ids || (lockedId ? [lockedId] : [])
      return poll
    }

    throw insertError
  }

  if (created) {
    const lockedId = created.voter_selections?._locked_option_ids?.[0] || created.voter_selections?._locked_option_id || created.locked_option_id || null
    created.locked_option_id = lockedId
    created.locked_option_ids = created.voter_selections?._locked_option_ids || (lockedId ? [lockedId] : [])
  }
  return created
}

/**
 * Toggles a user's vote on a specific option. Recalculates tallies.
 * Guarantees that metadata keys (like _locked_option_ids) are preserved and NEVER counted as votes.
 */
export async function toggleVote(tripId, category, optionId, userId, cast) {
  if (!userId) {
    throw new Error('User ID is required to toggle vote')
  }
  if (!tripId || !category || optionId === undefined || optionId === null) {
    throw new Error('Missing required parameters for toggleVote')
  }

  const userKey = String(userId)
  const optIdStr = String(optionId)
  const cat = normalizeCategory(category)

  const poll = await fetchActivePoll(tripId, cat)
  if (!poll) {
    throw new Error(`Active poll not found for category: ${category}`)
  }

  const voterSelections = { ...(poll.voter_selections || {}) }
  let userVotes = Array.isArray(voterSelections[userKey]) ? [...voterSelections[userKey]] : []

  if (cast) {
    if (!userVotes.some(id => String(id) === optIdStr)) {
      userVotes.push(optIdStr)
    }
  } else {
    userVotes = userVotes.filter(id => String(id) !== optIdStr)
  }

  if (userVotes.length > 0) {
    voterSelections[userKey] = userVotes
  } else {
    delete voterSelections[userKey]
  }

  // Recalculate votes_by_option totals from updated selections to maintain consistency
  // CRITICAL: ignore keys starting with '_' (e.g. _locked_option_ids, _locked_option_id)
  const votesByOption = {}
  Object.entries(voterSelections).forEach(([key, opts]) => {
    if (!key.startsWith('_') && Array.isArray(opts)) {
      opts.forEach(id => {
        const idStr = String(id)
        votesByOption[idStr] = (votesByOption[idStr] || 0) + 1
      })
    }
  })

  const { data, error } = await supabase
    .from('active_polls')
    .update({
      voter_selections: voterSelections,
      votes_by_option: votesByOption
    })
    .eq('id', poll.id)
    .select()
    .single()

  if (error) {
    throw error
  }

  if (data) {
    const lockedId = data.voter_selections?._locked_option_ids?.[0] || data.voter_selections?._locked_option_id || data.locked_option_id || null
    data.locked_option_id = lockedId
    data.locked_option_ids = data.voter_selections?._locked_option_ids || (lockedId ? [lockedId] : [])
  }

  // Insert activity log entry
  try {
    let userName = 'Someone'
    if (userId) {
      const { data: userRec } = await supabase
        .from('users')
        .select('first_name')
        .eq('id', userId)
        .maybeSingle()
      if (userRec?.first_name) {
        userName = userRec.first_name
      }
    }
    const actionDesc = cast
      ? `${userName} voted on an option in ${category}`
      : `${userName} removed vote in ${category}`

    await supabase.from('activity_log').insert({
      trip_id: tripId,
      user_id: userId || null,
      action_type: 'vote_option',
      description: actionDesc
    })
  } catch (logErr) {
    console.error('Failed to log voting activity:', logErr)
  }

  return data
}

/**
 * Checks if an option's start/end dates fall outside the trip's start/end dates.
 * @param {Object} option The option object with start_date and end_date.
 * @param {string} tripStartDate The trip start date string (YYYY-MM-DD).
 * @param {string} tripEndDate The trip end date string (YYYY-MM-DD).
 * @returns {boolean} True if the option has dates and any date falls outside [tripStartDate, tripEndDate].
 */
export function checkOptionDateConflict(option, tripStartDate, tripEndDate) {
  if (!tripStartDate || !tripEndDate) return false
  if (!option || (!option.start_date && !option.end_date)) return false

  // Parse start of trip day at 00:00:00 local time
  const startParts = typeof tripStartDate === 'string' ? tripStartDate.slice(0, 10).split('-') : null
  const tripStart = startParts && startParts.length === 3
    ? new Date(Number(startParts[0]), Number(startParts[1]) - 1, Number(startParts[2]), 0, 0, 0, 0)
    : new Date(tripStartDate)

  // Parse end of trip day at 23:59:59.999 local time so anything on the departure day is inside the trip
  const endParts = typeof tripEndDate === 'string' ? tripEndDate.slice(0, 10).split('-') : null
  const tripEnd = endParts && endParts.length === 3
    ? new Date(Number(endParts[0]), Number(endParts[1]) - 1, Number(endParts[2]), 23, 59, 59, 999)
    : new Date(tripEndDate)

  const parseOptDate = (dStr) => {
    if (!dStr) return null
    if (typeof dStr === 'string' && dStr.includes('T')) {
      const [dateP, timeP] = dStr.split('T')
      const dp = dateP.split('-')
      const tp = timeP.split(':')
      if (dp.length === 3 && tp.length >= 2) {
        return new Date(Number(dp[0]), Number(dp[1]) - 1, Number(dp[2]), Number(tp[0]), Number(tp[1]), Number(tp[2] || 0))
      }
    }
    return new Date(dStr)
  }

  if (option.start_date) {
    const optStart = parseOptDate(option.start_date)
    if (optStart && (optStart < tripStart || optStart > tripEnd)) return true
  }
  if (option.end_date) {
    const optEnd = parseOptDate(option.end_date)
    if (optEnd && (optEnd < tripStart || optEnd > tripEnd)) return true
  }
  return false
}

/**
 * Fetches all pitched options across all categories for a trip.
 * @param {string} tripId The UUID of the trip.
 * @returns {Promise<Array>} A promise resolving to an array of all option records.
 */
export async function fetchAllTripOptions(tripId) {
  const { data, error } = await supabase
    .from('poll_options')
    .select('*')
    .eq('trip_id', tripId)

  if (error) {
    throw error
  }
  return (data || []).map(normalizeOptionRow)
}

/**
 * Determines whether a given option is locked, checking the relational is_locked column
 * or backward-compatible active_polls voter_selections.
 * @param {Object} option The option object.
 * @param {Object} [activePoll] The active poll object for the category.
 * @returns {boolean} True if the option is currently locked.
 */
export function isOptionLocked(option, activePoll) {
  if (!option) return false
  if (option.is_locked === true) return true

  const optIdStr = String(option.id)
  const selections = activePoll?.voter_selections

  if (Array.isArray(selections?._locked_option_ids) && selections._locked_option_ids.map(String).includes(optIdStr)) {
    return true
  }
  if (activePoll?.locked_option_id && String(activePoll.locked_option_id) === optIdStr) {
    return true
  }
  if (selections?._locked_option_id && String(selections._locked_option_id) === optIdStr) {
    return true
  }

  return false
}

/**
 * Locks or unlocks an itinerary choice. Supports multi-option locking within the same category
 * (e.g. multiple hotels across different dates of a multi-city trip).
 * Updates poll_options.is_locked directly and maintains _locked_option_ids in active_polls.
 * @param {string} tripId The UUID of the trip.
 * @param {string} category The category name.
 * @param {string|number} optionId The ID of the option to lock/unlock.
 * @param {string} userId The active user's ID.
 * @returns {Promise<Object>} Updated poll record.
 */
export async function lockOption(tripId, category, optionId, userId) {
  const optIdStr = String(optionId)

  // 1. Check existing locked state on poll_options
  let isCurrentlyLocked = false
  try {
    const { data: opt } = await supabase
      .from('poll_options')
      .select('id, is_locked')
      .eq('id', optionId)
      .maybeSingle()
    if (opt && typeof opt.is_locked === 'boolean') {
      isCurrentlyLocked = opt.is_locked
    }
  } catch (_) {
    // Column might not exist on older schemas
  }

  const cat = normalizeCategory(category)
  const poll = await fetchActivePoll(tripId, cat)
  const selections = { ...(poll?.voter_selections || {}) }
  let lockedIds = Array.isArray(selections._locked_option_ids)
    ? [...selections._locked_option_ids]
    : selections._locked_option_id
      ? [String(selections._locked_option_id)]
      : []

  if (lockedIds.includes(optIdStr)) {
    isCurrentlyLocked = true
  }

  const newLockedState = !isCurrentlyLocked

  // 2. Update is_locked directly on poll_options table
  try {
    await supabase
      .from('poll_options')
      .update({ is_locked: newLockedState })
      .eq('id', optionId)
  } catch (_) {
    // Ignore if column is absent on unmigrated schema
  }

  // 3. Update active_polls voter_selections with _locked_option_ids array for backward UI compatibility
  if (newLockedState) {
    if (!lockedIds.includes(optIdStr)) {
      lockedIds.push(optIdStr)
    }
  } else {
    lockedIds = lockedIds.filter(id => String(id) !== optIdStr)
  }

  selections._locked_option_ids = lockedIds
  selections._locked_option_id = lockedIds.length > 0 ? lockedIds[0] : null

  let updatedPoll = null
  try {
    const { data, error } = await supabase
      .from('active_polls')
      .update({ voter_selections: selections })
      .eq('id', poll.id)
      .select()
      .single()

    if (!error) {
      updatedPoll = data
      updatedPoll.locked_option_id = selections._locked_option_id
      updatedPoll.locked_option_ids = lockedIds
    }
  } catch (err) {
    console.error('Failed to update active_polls locked selection:', err)
  }

  // 4. Log activity
  try {
    let userName = 'Someone'
    if (userId) {
      const { data: userRec } = await supabase
        .from('users')
        .select('first_name')
        .eq('id', userId)
        .maybeSingle()
      if (userRec?.first_name) {
        userName = userRec.first_name
      }
    }
    const actionDesc = newLockedState
      ? `${userName} locked an itinerary choice in ${category}`
      : `${userName} unlocked choice in ${category}`

    await supabase.from('activity_log').insert({
      trip_id: tripId,
      user_id: userId || null,
      action_type: 'lock_option',
      description: actionDesc
    })
  } catch (logErr) {
    console.error('Failed to log lock activity:', logErr)
  }

  return updatedPoll || {
    ...poll,
    voter_selections: selections,
    locked_option_id: selections._locked_option_id,
    locked_option_ids: lockedIds
  }
}

/**
 * Deletes a pitched option from the database, cleans up active_polls references and locks, and logs activity.
 * @param {string} tripId The UUID of the trip.
 * @param {string|number} optionId The option ID to delete.
 * @param {string} [category] The category name for poll cleanup.
 * @param {string} [userId] Optional active user ID for activity logging.
 * @returns {Promise<boolean>} Resolves true on deletion.
 */
export async function deleteOption(tripId, optionId, category, userId = null) {
  let effectiveTripId = tripId
  let effectiveOptionId = optionId
  let effectiveCategory = category
  let effectiveUserId = userId

  // Support legacy signature deleteOption(optionId, tripId, userId)
  if (typeof tripId === 'number' || (typeof optionId === 'string' && typeof category !== 'string' && !userId)) {
    effectiveOptionId = tripId
    effectiveTripId = optionId || null
    effectiveCategory = null
    effectiveUserId = category || null
  }

  if (effectiveOptionId === undefined || effectiveOptionId === null || effectiveOptionId === '') {
    throw new Error('optionId is required to delete an option')
  }

  // 1. Delete the option from public.poll_options
  let query = supabase.from('poll_options').delete().eq('id', effectiveOptionId)
  if (effectiveTripId) {
    query = query.eq('trip_id', effectiveTripId)
  }
  const { error } = await query
  if (error) {
    throw error
  }

  // 2. Clean up any references to String(optionId) inside public.active_polls for (tripId, category)
  if (effectiveTripId && effectiveCategory) {
    try {
      const cat = normalizeCategory(effectiveCategory)
      const poll = await fetchActivePoll(effectiveTripId, cat)
      if (poll) {
        const optIdStr = String(effectiveOptionId)
        const voterSelections = { ...(poll.voter_selections || {}) }

        // Remove String(optionId) from every user's array in voter_selections
        Object.keys(voterSelections).forEach((key) => {
          if (!key.startsWith('_') && Array.isArray(voterSelections[key])) {
            const filtered = voterSelections[key].filter((id) => String(id) !== optIdStr)
            if (filtered.length > 0) {
              voterSelections[key] = filtered
            } else {
              delete voterSelections[key]
            }
          }
        })

        // If voter_selections._locked_option_id === String(optionId), delete _locked_option_id
        if (voterSelections._locked_option_id && String(voterSelections._locked_option_id) === optIdStr) {
          delete voterSelections._locked_option_id
        }

        // If Array.isArray(voter_selections._locked_option_ids), filter out String(optionId)
        if (Array.isArray(voterSelections._locked_option_ids)) {
          voterSelections._locked_option_ids = voterSelections._locked_option_ids.filter((id) => String(id) !== optIdStr)
        }

        // Recalculate votes_by_option (ignoring metadata keys starting with '_')
        const votesByOption = {}
        Object.entries(voterSelections).forEach(([key, opts]) => {
          if (!key.startsWith('_') && Array.isArray(opts)) {
            opts.forEach((id) => {
              const idStr = String(id)
              votesByOption[idStr] = (votesByOption[idStr] || 0) + 1
            })
          }
        })

        await supabase
          .from('active_polls')
          .update({
            voter_selections: voterSelections,
            votes_by_option: votesByOption
          })
          .eq('id', poll.id)
      }
    } catch (pollCleanErr) {
      console.warn('Failed to clean up active poll references after option deletion:', pollCleanErr)
    }
  }

  // 3. Log the deletion in public.activity_log
  if (effectiveTripId) {
    try {
      let userName = 'Someone'
      if (effectiveUserId) {
        const { data: userRec } = await supabase
          .from('users')
          .select('first_name')
          .eq('id', effectiveUserId)
          .maybeSingle()
        if (userRec?.first_name) {
          userName = userRec.first_name
        }
      }

      const description = effectiveCategory
        ? `${userName} deleted a pitched option in ${effectiveCategory}`
        : `${userName} deleted a pitched option`

      await supabase.from('activity_log').insert({
        trip_id: effectiveTripId,
        user_id: effectiveUserId || null,
        action_type: 'delete_option',
        description
      })
    } catch (logErr) {
      console.warn('Failed to log delete option activity:', logErr)
    }
  }

  return true
}

/**
 * Updates start and end dates for a pitched option.
 * @param {string|number} optionId The option ID.
 * @param {string|null} startDate ISO datetime string or YYYY-MM-DD.
 * @param {string|null} endDate ISO datetime string or YYYY-MM-DD.
 * @param {string} [tripId] Optional trip UUID for activity logging.
 * @param {string} [userId] Optional active user ID.
 * @returns {Promise<Object>} Updated option record.
 */
export async function updateOptionDates(optionId, startDate, endDate, tripId = null, userId = null) {
  const { data, error } = await supabase
    .from('poll_options')
    .update({
      start_date: startDate || null,
      end_date: endDate || null
    })
    .eq('id', optionId)
    .select()
    .single()

  if (error) {
    throw error
  }

  if (tripId) {
    try {
      let userName = 'Someone'
      if (userId) {
        const { data: userRec } = await supabase
          .from('users')
          .select('first_name')
          .eq('id', userId)
          .maybeSingle()
        if (userRec?.first_name) {
          userName = userRec.first_name
        }
      }

      await supabase.from('activity_log').insert({
        trip_id: tripId,
        user_id: userId || null,
        action_type: 'update_option_dates',
        description: `${userName} updated dates for an option`
      })
    } catch (logErr) {
      console.warn('Failed to log update dates activity:', logErr)
    }
  }

  return data
}

/**
 * Updates a pitched option's attributes with graceful fallback for unmigrated columns.
 * @param {string|number} optionId The option ID.
 * @param {Object} updates Properties to update.
 * @returns {Promise<Object>} Updated option record.
 */
export async function updateOption(optionId, updates) {
  const allowedKeys = [
    'option_text', 'estimated_cost', 'currency', 'link',
    'description', 'start_date', 'end_date', 'cost_type',
    'assigned_users', 'metadata', 'is_locked', 'category'
  ]
  const payload = {}
  Object.keys(updates || {}).forEach(k => {
    if (allowedKeys.includes(k) && updates[k] !== undefined) {
      payload[k] = updates[k]
    }
  })

  try {
    const { data, error } = await supabase
      .from('poll_options')
      .update(payload)
      .eq('id', optionId)
      .select()
      .single()

    if (!error && data) return data
  } catch (_) {
    // Fallback if schema does not support new columns
  }

  const fallbackPayload = { ...payload }
  delete fallbackPayload.cost_type
  delete fallbackPayload.assigned_users
  delete fallbackPayload.metadata

  if (Object.keys(fallbackPayload).length > 0) {
    const { data, error } = await supabase
      .from('poll_options')
      .update(fallbackPayload)
      .eq('id', optionId)
      .select()
      .single()

    if (error) throw error
    return data
  }

  return { id: optionId, ...payload }
}

/**
 * Toggles a user's participation in an option's assigned_users list.
 * Supports implicit-to-explicit resolution if currentAssignedUsers is empty.
 * @param {string|number} optionId The option ID.
 * @param {string} userId The user UUID to add or remove.
 * @param {Array} [currentAssignedUsers=[]] The current assigned user IDs.
 * @param {Array} [fallbackAllUserIds=[]] All present/committed user IDs if current list is empty.
 * @returns {Promise<Object>} Updated option record.
 */
export async function toggleOptionParticipant(optionId, userId, currentAssignedUsers = [], fallbackAllUserIds = []) {
  const uIdStr = String(userId)
  const currentList = Array.isArray(currentAssignedUsers) ? [...currentAssignedUsers].map(String) : []
  let nextList = []

  if (currentList.length === 0 && Array.isArray(fallbackAllUserIds) && fallbackAllUserIds.length > 0) {
    const allNormalized = fallbackAllUserIds.map(String)
    if (allNormalized.includes(uIdStr)) {
      nextList = allNormalized.filter(id => id !== uIdStr)
    } else {
      nextList = [...allNormalized, uIdStr]
    }
  } else if (currentList.includes(uIdStr)) {
    nextList = currentList.filter(id => id !== uIdStr)
  } else {
    nextList = [...currentList, uIdStr]
  }

  return updateOption(optionId, { assigned_users: nextList })
}

/**
 * Calculates dynamic cost per passenger for a shared vehicle based on passenger count and capacity.
 * @param {number|string} totalCost Total rental/vehicle cost.
 * @param {number|string} assignedCount Number of currently assigned passengers.
 * @param {number|string|null} seatsCapacity Total seats in vehicle.
 * @param {string} [currency='USD'] Currency ISO code.
 * @returns {Object} Vehicle cost analysis.
 */
export function calculateVehicleCostPerPassenger(totalCost, assignedCount, seatsCapacity, currency = 'USD') {
  const cost = parseFloat(totalCost || 0)
  const validCost = !isNaN(cost) && cost >= 0 ? cost : 0
  const assigned = parseInt(assignedCount || 0, 10)
  const effectiveDivisor = Math.max(1, assigned)
  const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100

  const costPerPassenger = round2(validCost / effectiveDivisor)
  const seatsCap = seatsCapacity ? parseInt(seatsCapacity, 10) : null
  const costIfFull = seatsCap && seatsCap > 0 ? round2(validCost / seatsCap) : costPerPassenger
  const seatsLeft = seatsCap !== null ? Math.max(0, seatsCap - assigned) : null
  const isFull = seatsCap !== null ? assigned >= seatsCap : false
  const isOverCapacity = seatsCap !== null ? assigned > seatsCap : false

  return {
    totalCost: validCost,
    costPerPassenger,
    costIfFull,
    assignedCount: assigned,
    seatsCapacity: seatsCap,
    seatsLeft,
    isFull,
    isOverCapacity,
    currency
  }
}

/**
 * Checks accommodation capacity and warns if assigned travelers or group size exceed available beds.
 * @param {number|string} assignedCount Currently assigned sleepers.
 * @param {number|string|null} maxCapacity Maximum bed/sleep capacity.
 * @param {number|string} [totalGroupSize=0] Total size of group on trip.
 * @returns {Object} Accommodation capacity status.
 */
export function checkAccommodationCapacity(assignedCount, maxCapacity, totalGroupSize = 0) {
  const assigned = parseInt(assignedCount || 0, 10)
  const maxCap = maxCapacity ? parseInt(maxCapacity, 10) : null
  const groupSize = parseInt(totalGroupSize || 0, 10)

  const isOverCapacity = maxCap !== null ? assigned > maxCap : false
  const bedsRemaining = maxCap !== null ? Math.max(0, maxCap - assigned) : null
  const bedsNeededForGroup = maxCap !== null && groupSize > 0 ? Math.max(0, groupSize - maxCap) : 0
  const groupExceedsCapacity = maxCap !== null && groupSize > 0 ? groupSize > maxCap : false

  return {
    assignedCount: assigned,
    maxCapacity: maxCap,
    bedsRemaining,
    isOverCapacity,
    bedsNeededForGroup,
    groupExceedsCapacity,
    capacityPercent: maxCap && maxCap > 0 ? Math.round((assigned / maxCap) * 100) : null
  }
}

/**
 * Checks activity spot quota and remaining spots.
 * @param {number|string} assignedCount Currently joined travelers.
 * @param {number|string|null} maxParticipants Quota limit.
 * @returns {Object} Activity spots quota status.
 */
export function checkActivitySpots(assignedCount, maxParticipants) {
  const assigned = parseInt(assignedCount || 0, 10)
  const maxPart = maxParticipants ? parseInt(maxParticipants, 10) : null

  const isFull = maxPart !== null ? assigned >= maxPart : false
  const isOverLimit = maxPart !== null ? assigned > maxPart : false
  const spotsLeft = maxPart !== null ? Math.max(0, maxPart - assigned) : null

  return {
    assignedCount: assigned,
    maxParticipants: maxPart,
    spotsLeft,
    isFull,
    isOverLimit
  }
}




