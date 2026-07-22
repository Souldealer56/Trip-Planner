import { supabase } from './supabase'

/**
 * Fetches pitched options for a specific trip and category.
 * @param {string} tripId The UUID of the trip.
 * @param {string} category The category name (lowercase).
 * @returns {Promise<Array>} A promise resolving to an array of option records.
 */
export async function fetchOptions(tripId, category) {
  const { data, error } = await supabase
    .from('poll_options')
    .select('*')
    .eq('trip_id', tripId)
    .eq('category', category.toLowerCase())
    .order('id', { ascending: true })

  if (error) {
    throw error
  }
  return data
}

/**
 * Inserts a new pitched option into the database.
 */
export async function pitchOption(tripId, category, name, estimatedCost, currency, link, description, addedByUserId, startDate, endDate) {
  let sanitizedLink = link ? link.trim() : null
  if (sanitizedLink && !/^https?:\/\//i.test(sanitizedLink)) {
    sanitizedLink = `https://${sanitizedLink}`
  }

  const { data, error } = await supabase
    .from('poll_options')
    .insert({
      trip_id: tripId,
      category: category.toLowerCase(),
      option_text: name,
      estimated_cost: estimatedCost ? parseFloat(estimatedCost) : null,
      currency: estimatedCost ? (currency || 'USD') : null,
      link: sanitizedLink,
      description: description || null,
      start_date: startDate || null,
      end_date: endDate || null,
      added_by: addedByUserId
    })
    .select()
    .single()

  if (error) {
    throw error
  }

  // Ensure active poll record exists for this trip category
  try {
    await fetchActivePoll(tripId, category)
  } catch (pollErr) {
    console.error('Failed to initialize active poll for pitched option:', pollErr)
  }

  return data
}

/**
 * Fetches or initializes the active poll record for a trip and category.
 */
export async function fetchActivePoll(tripId, category) {
  const { data: existing, error: fetchError } = await supabase
    .from('active_polls')
    .select('*')
    .eq('trip_id', tripId)
    .eq('category', category.toLowerCase())
    .maybeSingle()

  if (fetchError) {
    throw fetchError
  }
  if (existing) {
    existing.locked_option_id = existing.voter_selections?._locked_option_id || existing.locked_option_id || null
    return existing
  }

  // Insert a default active poll record if missing
  const { data: created, error: insertError } = await supabase
    .from('active_polls')
    .insert({
      trip_id: tripId,
      category: category.toLowerCase(),
      telegram_poll_id: null,
      poll_options_json: [],
      voter_selections: {},
      votes_by_option: {}
    })
    .select()
    .single()

  if (insertError) {
    throw insertError
  }
  if (created) {
    created.locked_option_id = created.voter_selections?._locked_option_id || created.locked_option_id || null
  }
  return created
}

/**
 * Toggles a user's vote on a specific option. Recalculates tallies.
 */
export async function toggleVote(tripId, category, optionId, userId, cast) {
  const poll = await fetchActivePoll(tripId, category)

  const voterSelections = { ...(poll.voter_selections || {}) }
  let userVotes = Array.isArray(voterSelections[userId]) ? [...voterSelections[userId]] : []

  const optIdStr = String(optionId)

  if (cast) {
    if (!userVotes.includes(optIdStr)) {
      userVotes.push(optIdStr)
    }
  } else {
    userVotes = userVotes.filter(id => String(id) !== optIdStr)
  }

  if (userVotes.length > 0) {
    voterSelections[userId] = userVotes
  } else {
    delete voterSelections[userId]
  }

  // Recalculate votes_by_option totals from updated selections to maintain perfect consistency
  const votesByOption = {}
  Object.values(voterSelections).forEach(opts => {
    if (Array.isArray(opts)) {
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

  const tripStart = new Date(tripStartDate)
  const tripEnd = new Date(tripEndDate)

  if (option.start_date) {
    const optStart = new Date(option.start_date)
    if (optStart < tripStart || optStart > tripEnd) return true
  }
  if (option.end_date) {
    const optEnd = new Date(option.end_date)
    if (optEnd < tripStart || optEnd > tripEnd) return true
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
  return data || []
}

/**
 * Locks or unlocks a winning option choice for a category poll.
 */
export async function lockOption(tripId, category, optionId, userId) {
  const poll = await fetchActivePoll(tripId, category)
  const selections = { ...(poll?.voter_selections || {}) }
  const isCurrentlyLocked = String(selections._locked_option_id) === String(optionId)

  if (isCurrentlyLocked) {
    delete selections._locked_option_id
  } else {
    selections._locked_option_id = String(optionId)
  }

  const { data, error } = await supabase
    .from('active_polls')
    .update({
      voter_selections: selections
    })
    .eq('id', poll.id)
    .select()
    .single()

  if (error) {
    throw error
  }

  if (data) {
    data.locked_option_id = data.voter_selections?._locked_option_id || null
  }

  // Log activity
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
    const actionDesc = selections._locked_option_id
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

  return data
}
