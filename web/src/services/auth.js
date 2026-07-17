import { supabase } from './supabase';

/**
 * Request a passwordless login link by generating a token and inserting it into the database.
 * The database trigger/webhook will automatically dispatch the email via Resend API.
 * 
 * @param {string} email - The user's email address
 * @returns {Promise<string>} The generated high-entropy token
 */
export async function requestLoginLink(email) {
  if (!email || !email.includes('@')) {
    throw new Error('Please enter a valid email address.');
  }

  const cleanEmail = email.trim().toLowerCase();
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // Valid for 15 minutes

  const { error } = await supabase
    .from('login_tokens')
    .insert({
      email: cleanEmail,
      token,
      expires_at: expiresAt,
      used: false
    });

  if (error) {
    console.error('Failed to request magic link:', error);
    throw new Error(error.message || 'Failed to request login link. Please try again.');
  }

  return token;
}

/**
 * Verify a magic link token, mark it as used, and resolve/create the traveler profile.
 * 
 * @param {string} token - The magic link token UUID
 * @returns {Promise<Object>} The authenticated user profile
 */
export async function verifyLoginToken(token) {
  if (!token) {
    throw new Error('No token provided.');
  }

  // 1. Fetch token record
  const { data: tokenRecord, error: fetchError } = await supabase
    .from('login_tokens')
    .select('*')
    .eq('token', token)
    .maybeSingle();

  if (fetchError || !tokenRecord) {
    throw new Error('Invalid magic link. The link may be broken.');
  }

  if (tokenRecord.used) {
    throw new Error('This magic link has already been used. Please request a new one.');
  }

  if (new Date(tokenRecord.expires_at) < new Date()) {
    throw new Error('This magic link has expired. Please request a new one.');
  }

  // 2. Mark token as used immediately to prevent replay attacks
  const { error: updateError } = await supabase
    .from('login_tokens')
    .update({ used: true })
    .eq('id', tokenRecord.id);

  if (updateError) {
    console.error('Failed to invalidate token:', updateError);
    throw new Error('Verification failed. Please try again.');
  }

  // 3. Resolve user profile by email
  let { data: user, error: userError } = await supabase
    .from('users')
    .select('*')
    .eq('email', tokenRecord.email)
    .maybeSingle();

  if (userError) {
    console.error('Error fetching user profile:', userError);
    throw new Error('Verification failed while loading user profile.');
  }

  if (!user) {
    // 4. Standalone Onboarding: Create traveler profile with a temporary negative Telegram ID
    const tempTelegramId = -1000000 - Math.floor(Math.random() * 1000000);
    const emailPrefix = tokenRecord.email.split('@')[0];
    const firstName = emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1);
    const username = emailPrefix.toLowerCase().replace(/[^a-z0-9]/g, '');

    const { data: newUser, error: createError } = await supabase
      .from('users')
      .insert({
        email: tokenRecord.email,
        telegram_id: tempTelegramId,
        first_name: firstName,
        username: username || 'traveler'
      })
      .select()
      .single();

    if (createError) {
      console.error('Failed to create new user profile:', createError);
      throw new Error('Failed to create traveler profile. Please try again.');
    }
    user = newUser;
  }

  return user;
}
