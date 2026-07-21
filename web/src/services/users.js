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

/**
 * Generate a temporary verification code to link a Telegram account.
 * Valid for 5 minutes.
 * @param {string} userId - The user's ID
 * @returns {Promise<string>} The generated link code
 */
export async function generateTelegramLinkCode(userId) {
  // Generate a random 6-character uppercase alphanumeric code
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

  const { error } = await supabase
    .from('users')
    .update({
      telegram_link_code: code,
      telegram_link_expires_at: expiresAt
    })
    .eq('id', userId);

  if (error) {
    throw error;
  }

  return code;
}

/**
 * Disconnect a user's profile from Telegram by reverting to a negative telegram_id.
 * @param {string} userId - The user's ID
 * @returns {Promise<Object>} The updated user profile
 */
export async function disconnectTelegram(userId) {
  const tempTelegramId = -1000000 - Math.floor(Math.random() * 1000000);

  const { data, error } = await supabase
    .from('users')
    .update({
      telegram_id: tempTelegramId,
      telegram_link_code: null,
      telegram_link_expires_at: null
    })
    .eq('id', userId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
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



