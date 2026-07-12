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
