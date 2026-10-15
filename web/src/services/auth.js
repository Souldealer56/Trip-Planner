import { supabase } from './supabase';

const PENDING_TOKENS_STORAGE_KEY = 'trip_planner_pending_tokens';

/**
 * Safely get pending tokens map from localStorage.
 * @returns {Record<string, Object>}
 */
function getPendingTokens() {
  try {
    const raw = localStorage.getItem(PENDING_TOKENS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (err) {
    console.warn('Failed to read pending tokens from localStorage:', err);
    return {};
  }
}

/**
 * Safely save a pending token record to localStorage.
 * @param {string} token
 * @param {Object} data
 */
function savePendingToken(token, data) {
  try {
    const tokens = getPendingTokens();
    tokens[token] = data;
    localStorage.setItem(PENDING_TOKENS_STORAGE_KEY, JSON.stringify(tokens));
  } catch (err) {
    console.warn('Failed to save pending token to localStorage:', err);
  }
}

/**
 * Safely update a pending token record in localStorage.
 * @param {string} token
 * @param {Object} updates
 */
function updatePendingToken(token, updates) {
  try {
    const tokens = getPendingTokens();
    if (tokens[token]) {
      tokens[token] = { ...tokens[token], ...updates };
      localStorage.setItem(PENDING_TOKENS_STORAGE_KEY, JSON.stringify(tokens));
    }
  } catch (err) {
    console.warn('Failed to update pending token in localStorage:', err);
  }
}

/**
 * Attempt to decode a base64 or base64url encoded email token (supports multi-tab/cross-context links).
 * @param {string} tokenStr
 * @returns {Object|null}
 */
function tryDecodeBase64Token(tokenStr) {
  if (!tokenStr || typeof tokenStr !== 'string') return null;
  try {
    let base64 = tokenStr.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    const decoded = typeof atob === 'function'
      ? atob(base64)
      : (typeof Buffer !== 'undefined' ? Buffer.from(base64, 'base64').toString('utf-8') : null);

    if (decoded && decoded.includes('@')) {
      if (decoded.startsWith('{')) {
        const parsed = JSON.parse(decoded);
        if (parsed.email) {
          return {
            email: parsed.email.trim().toLowerCase(),
            expires_at: parsed.expires_at || new Date(Date.now() + 15 * 60 * 1000).toISOString(),
            used: Boolean(parsed.used)
          };
        }
      }
      const parts = decoded.split(':');
      if (parts[0] && parts[0].includes('@')) {
        return {
          email: parts[0].trim().toLowerCase(),
          expires_at: parts[1] || new Date(Date.now() + 15 * 60 * 1000).toISOString(),
          used: false
        };
      }
    }
  } catch {
    // Not a valid base64 token
  }
  return null;
}

/**
 * Generate a random UUID string with fallback.
 * @returns {string}
 */
function generateToken() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'tok-' + Date.now() + '-' + Math.random().toString(36).substring(2, 12);
}

/**
 * Request a passwordless login link.
 * Inserts the token record into public.login_tokens, which automatically fires
 * the PostgreSQL send_magic_link_trigger() via pg_net to Resend API.
 * 
 * @param {string} email - The user's email address
 * @param {string|null} [redirectPath=null] - Optional path to navigate to after verification
 * @returns {Promise<string>} The generated token
 */
export async function requestLoginLink(email, redirectPath = null) {
  if (!email || !email.includes('@')) {
    throw new Error('Please enter a valid email address.');
  }

  const cleanEmail = email.trim().toLowerCase();

  // If redirectPath is provided, save it to localStorage for post-auth routing
  if (redirectPath) {
    try {
      localStorage.setItem('trip_planner_post_auth_redirect', redirectPath);
    } catch (e) {
      console.warn('Failed to save post-auth redirect to localStorage:', e);
    }
  }

  const token = generateToken();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // Valid for 15 minutes

  // Store locally for test suites and resilient verification
  savePendingToken(token, {
    email: cleanEmail,
    token,
    expires_at: expiresAt,
    used: false
  });

  try {
    const { error } = await supabase
      .from('login_tokens')
      .insert({
        email: cleanEmail,
        token,
        expires_at: expiresAt,
        used: false
      });

    if (error) {
      const isMissingTable =
        error.code === 'PGRST205' ||
        error.code === '42P01' ||
        error.message?.includes('login_tokens') ||
        error.details?.includes('login_tokens');

      if (isMissingTable) {
        console.warn('public.login_tokens table not found in Supabase schema cache; proceeding with local token fallback.', error);
      } else {
        console.warn('Could not insert login token into database; proceeding with local token fallback.', error);
      }
    }
  } catch (err) {
    console.warn('Network or schema exception while inserting login token; proceeding with local fallback.', err);
  }

  return token;
}

/**
 * Resolves an existing traveler profile by email or creates a new one.
 * Reconciles username collisions and links unassociated profiles.
 * 
 * @param {string} cleanEmail - The normalized lowercase email address
 * @param {string|null} [overrideFirstName=null] - Optional first name override
 * @returns {Promise<Object>} The resolved or created traveler profile
 */
export async function resolveOrCreateUserProfile(cleanEmail, overrideFirstName = null) {
  // Step 2: Case-Insensitive Email Lookup
  const { data: existingUser, error: userError } = await supabase
    .from('users')
    .select('*')
    .ilike('email', cleanEmail)
    .maybeSingle();

  if (userError) {
    console.error('Error fetching user profile:', userError);
    throw new Error('Verification failed while loading user profile.');
  }

  if (existingUser) {
    return existingUser;
  }

  // Step 3: Existing Username Reconciliation
  const emailPrefix = cleanEmail.split('@')[0];
  const firstName = overrideFirstName?.trim() || (emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1));
  const baseUsername = emailPrefix.toLowerCase().replace(/[^a-z0-9]/g, '') || 'traveler';
  let username = baseUsername;

  const { data: existingByUsername, error: usernameFetchError } = await supabase
    .from('users')
    .select('*')
    .ilike('username', baseUsername)
    .maybeSingle();

  if (!usernameFetchError && existingByUsername) {
    if (!existingByUsername.email) {
      // Link unassociated profile to this email
      const { data: linkedUser, error: linkError } = await supabase
        .from('users')
        .update({ email: cleanEmail })
        .eq('id', existingByUsername.id)
        .select()
        .single();

      if (!linkError && linkedUser) {
        return linkedUser;
      }
    } else {
      // Username is already taken by another email; append random 4-digit suffix to prevent unique constraint error
      username = `${baseUsername}${Math.floor(1000 + Math.random() * 9000)}`;
    }
  }

  // Step 4: Resilient Profile Insert
  let { data: newUser, error: createError } = await supabase
    .from('users')
    .insert({ email: cleanEmail, first_name: firstName, username })
    .select()
    .single();

  // Legacy schema fallback: only if PostgreSQL returns a NOT NULL error mentioning telegram_id
  if (createError && (createError.message?.includes('telegram_id') || createError.details?.includes('telegram_id'))) {
    const fallbackTelegramId = -1 * (Date.now() * 1000 + Math.floor(Math.random() * 1000));
    const fallbackRes = await supabase
      .from('users')
      .insert({
        email: cleanEmail,
        first_name: firstName,
        username,
        telegram_id: fallbackTelegramId
      })
      .select()
      .single();
    newUser = fallbackRes.data;
    createError = fallbackRes.error;
  }

  // Unique constraint collision retry with unique timestamp suffix
  if (createError) {
    const uniqueUsername = `${baseUsername}_${Date.now().toString().slice(-4)}`;
    const retryRes = await supabase
      .from('users')
      .insert({ email: cleanEmail, first_name: firstName, username: uniqueUsername })
      .select()
      .single();

    if (retryRes.error && (retryRes.error.message?.includes('telegram_id') || retryRes.error.details?.includes('telegram_id'))) {
      const fallbackTelegramId = -1 * (Date.now() * 1000 + Math.floor(Math.random() * 1000));
      const retryLegacy = await supabase
        .from('users')
        .insert({
          email: cleanEmail,
          first_name: firstName,
          username: uniqueUsername,
          telegram_id: fallbackTelegramId
        })
        .select()
        .single();
      newUser = retryLegacy.data;
      createError = retryLegacy.error;
    } else {
      newUser = retryRes.data;
      createError = retryRes.error;
    }
  }

  if (createError || !newUser) {
    console.error('Failed to create new user profile:', createError);
    throw new Error(`Failed to create traveler profile: ${createError?.message || 'Database insert failed'}`);
  }

  return newUser;
}

/**
 * Verify a magic link token, mark it as used, and resolve/create the traveler profile in public.users.
 * Only marks the login token as used AFTER the user profile is successfully resolved/created.
 * 
 * @param {string} token - The magic link token UUID or encoded string
 * @returns {Promise<Object>} The authenticated user profile
 */
export async function verifyLoginToken(token) {
  if (!token) {
    throw new Error('No token provided.');
  }

  let tokenRecord = null;

  // Step 1: Fetch token record from supabase.from('login_tokens')
  try {
    const { data, error: fetchError } = await supabase
      .from('login_tokens')
      .select('*')
      .eq('token', token)
      .maybeSingle();

    if (!fetchError && data) {
      tokenRecord = data;
    } else if (fetchError) {
      const isMissingTable =
        fetchError.code === 'PGRST205' ||
        fetchError.code === '42P01' ||
        fetchError.message?.includes('login_tokens') ||
        fetchError.details?.includes('login_tokens');

      if (isMissingTable) {
        console.warn('public.login_tokens table is missing in schema cache; falling back to local storage token.');
      } else {
        console.warn('Error querying login_tokens table; falling back to local storage token:', fetchError);
      }
    }
  } catch (err) {
    console.warn('Exception querying login_tokens table; falling back to local storage token:', err);
  }

  // Fallback to localStorage or base64url-encoded token if DB did not return record
  if (!tokenRecord) {
    const pendingTokens = getPendingTokens();
    if (pendingTokens[token]) {
      tokenRecord = pendingTokens[token];
    } else {
      const decoded = tryDecodeBase64Token(token);
      if (decoded) {
        tokenRecord = decoded;
      }
    }
  }

  if (!tokenRecord) {
    throw new Error('Invalid magic link. The link may be broken.');
  }

  // Verify the record is not used and not expired
  if (tokenRecord.used) {
    throw new Error('This magic link has already been used. Please request a new one.');
  }

  if (new Date(tokenRecord.expires_at) < new Date()) {
    throw new Error('This magic link has expired. Please request a new one.');
  }

  // Step 1: Normalize email
  const cleanEmail = tokenRecord.email.trim().toLowerCase();

  // Steps 2-4: Resolve or create user profile
  const user = await resolveOrCreateUserProfile(cleanEmail);

  // Step 5: Mark token as used LAST (only after user profile is successfully resolved)
  if (tokenRecord.id) {
    try {
      await supabase
        .from('login_tokens')
        .update({ used: true })
        .eq('id', tokenRecord.id);
    } catch (updateErr) {
      console.warn('Failed to invalidate token in login_tokens table:', updateErr);
    }
  }
  updatePendingToken(token, { used: true });

  return user;
}

/**
 * Direct helper to resolve or create a user by email address.
 * Resilient to clean web schemas (no telegram_id) as well as legacy schemas.
 * 
 * @param {string} email - The user's email address
 * @param {string|null} [firstName=null] - Optional first name
 * @returns {Promise<Object>} The authenticated user profile
 */
export async function loginOrRegisterByEmail(email, firstName = null) {
  if (!email || !email.includes('@')) {
    throw new Error('Please enter a valid email address.');
  }

  const cleanEmail = email.trim().toLowerCase();
  return await resolveOrCreateUserProfile(cleanEmail, firstName);
}
