import { supabase } from './supabase'

/**
 * Creates a new user record inside the database.
 * No longer generates negative telegram IDs; includes fallback if database has legacy NOT NULL constraint.
 * @param {string} username The username of the user.
 * @param {string} firstName The first name of the user.
 * @param {string|null} [email=null] Optional email address.
 * @returns {Promise<Object>} A promise resolving to the created user record.
 */
export async function createUser(username, firstName, email = null) {
  const payload = {
    first_name: firstName,
    username: username || null,
    email: email || null
  }

  const { data, error } = await supabase
    .from('users')
    .insert(payload)
    .select()
    .single()

  if (!error) {
    return data
  }

  // Graceful fallback if legacy unmigrated schema enforces telegram_id NOT NULL
  if (error && (error.message?.includes('telegram_id') || error.details?.includes('telegram_id'))) {
    const fallbackTelegramId = -1000000 - Math.floor(Math.random() * 1000000)
    const fallback = await supabase
      .from('users')
      .insert({
        ...payload,
        telegram_id: fallbackTelegramId
      })
      .select()
      .single()

    if (fallback.error) throw fallback.error
    return fallback.data
  }

  throw error
}

/**
 * Fetches all user records from the users table, ordered alphabetically by first_name.
 * @returns {Promise<Array>} A promise resolving to an array of user objects.
 */
export async function fetchAllUsers() {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .order('first_name', { ascending: true })

  if (error) {
    throw error
  }
  return data
}

/**
 * Checks if a given username is available (not already registered).
 * If the input is empty or null, returns true.
 * @param {string} username The username to check.
 * @returns {Promise<boolean>} Resolves to true if available, false if taken.
 */
export async function checkUsernameAvailable(username) {
  if (!username) return true
  const cleanUsername = username.trim().toLowerCase()
  if (!cleanUsername) return true

  const { data, error } = await supabase
    .from('users')
    .select('id')
    .ilike('username', cleanUsername)
    .maybeSingle()

  if (error) {
    throw error
  }

  return data === null
}

/**
 * Fetches a traveler profile by their username (case-insensitive, strips leading @).
 * @param {string} username The username.
 * @returns {Promise<Object|null>} The user object or null.
 */
export async function fetchUserByUsername(username) {
  if (!username) return null
  const cleanUsername = username.trim().replace(/^@/, '')

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .ilike('username', cleanUsername)
    .maybeSingle()

  if (error) {
    throw error
  }
  return data
}

/**
 * Updates a user's profile details (first_name, username).
 * @param {string} userId - The user's UUID
 * @param {Object} updates - Object containing fields to update (first_name, username)
 * @returns {Promise<Object>} The updated user record
 */
export async function updateUserProfile(userId, updates) {
  const { data, error } = await supabase
    .from('users')
    .update(updates)
    .eq('id', userId)
    .select()
    .single()

  if (error) {
    throw error
  }
  return data
}
