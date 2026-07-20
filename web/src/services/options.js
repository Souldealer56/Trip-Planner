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
    .order('created_at', { ascending: true })

  if (error) {
    throw error
  }
  return data
}

/**
 * Inserts a new pitched option into the database.
 */
export async function pitchOption(tripId, category, name, estimatedCost, currency, link, description, addedByUserId) {
  const { data, error } = await supabase
    .from('poll_options')
    .insert({
      trip_id: tripId,
      category: category.toLowerCase(),
      option_text: name,
      estimated_cost: estimatedCost ? parseFloat(estimatedCost) : null,
      currency: estimatedCost ? currency : null,
      link: link || null,
      description: description || null,
      added_by: addedByUserId
    })
    .select()
    .single()

  if (error) {
    throw error
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
