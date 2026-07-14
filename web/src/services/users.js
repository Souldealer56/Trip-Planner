import { supabase } from './supabase'

/**
 * Creates a new user inside the database, generating a unique negative telegram_id
 * to guarantee no key collisions with real positive Telegram IDs synced by the bot.
 * @param {string} username The username of the user.
 * @param {string} firstName The first name of the user.
 * @returns {Promise<Object>} A promise resolving to the created user record.
 */
export async function createUser(username, firstName) {
  // Generate a random unique negative integer for telegram_id
  const telegramId = -1000000 - Math.floor(Math.random() * 1000000)

  const { data, error } = await supabase
    .from('users')
    .insert({
      telegram_id: telegramId,
      username: username || null,
      first_name: firstName
    })
    .select()
    .single()

  if (error) {
    throw error
  }
  return data
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

  // If data is null, it means no user exists with this username, so it is available
  return data === null
}

/**
 * Fetches a traveler profile by their Telegram ID.
 * @param {number} telegramId The Telegram user ID.
 * @returns {Promise<Object|null>} The user object or null.
 */
export async function fetchUserByTelegramId(telegramId) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('telegram_id', telegramId)
    .maybeSingle()

  if (error) {
    throw error
  }
  return data
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


